"""Green Cart Save backend.

Provides:
- Public sponsorship lookup so the storefront can surface paid placements first.
- Single-admin JWT auth for managing advertisers and sponsored placements.
- Stripe Checkout for advertiser self-serve billing.
- Public privacy policy page.

All API routes are mounted under /api to match the ingress.
"""

import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import bcrypt
import jwt
import stripe
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.routing import APIRouter
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Config & globals
# ---------------------------------------------------------------------------

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_ACCESS_MINUTES = int(os.environ.get("JWT_ACCESS_MINUTES", "720"))

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
PUBLIC_BACKEND_URL = os.environ.get(
    "PUBLIC_BACKEND_URL", "https://green-cart-save.preview.emergentagent.com"
).rstrip("/")

stripe.api_key = STRIPE_API_KEY

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
admins = db["admins"]
advertisers = db["advertisers"]
sponsorships = db["sponsorships"]
stripe_events = db["stripe_events"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("greencart")

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/login")


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "is_admin": True,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_ACCESS_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_admin(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    email = payload.get("sub")
    if not email or not payload.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    admin = await admins.find_one({"email": email}, {"_id": 0, "password_hash": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return admin


async def seed_admin() -> None:
    """Ensure a single admin exists matching ADMIN_EMAIL/ADMIN_PASSWORD."""
    existing = await admins.find_one({"email": ADMIN_EMAIL})
    hashed = hash_password(ADMIN_PASSWORD)
    if existing is None:
        await admins.insert_one(
            {
                "id": str(uuid.uuid4()),
                "email": ADMIN_EMAIL,
                "password_hash": hashed,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        log.info("Seeded admin %s", ADMIN_EMAIL)
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await admins.update_one(
            {"email": ADMIN_EMAIL}, {"$set": {"password_hash": hashed}}
        )
        log.info("Updated admin password for %s", ADMIN_EMAIL)


async def backfill_sponsorship_status() -> None:
    """Existing sponsorships (created before Stripe was added) are treated as
    already paid so admin history keeps working."""
    await sponsorships.update_many(
        {"status": {"$exists": False}}, {"$set": {"status": "active"}}
    )


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminMe(BaseModel):
    id: str
    email: str
    created_at: str


class AdvertiserIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    contact_email: EmailStr


class Advertiser(BaseModel):
    id: str
    name: str
    contact_email: EmailStr
    created_at: str


class SponsorshipIn(BaseModel):
    advertiser_id: str
    product_id: str = Field(min_length=1, max_length=64)
    bid_cents: int = Field(ge=50)  # Stripe min charge
    active: bool = True


class SponsorshipUpdate(BaseModel):
    bid_cents: Optional[int] = Field(default=None, ge=50)
    active: Optional[bool] = None


class Sponsorship(BaseModel):
    id: str
    advertiser_id: str
    advertiser_name: Optional[str] = None
    product_id: str
    bid_cents: int
    active: bool
    status: str = "active"
    created_at: str


class SponsorshipCreated(BaseModel):
    sponsorship: Sponsorship
    checkout_url: Optional[str] = None
    session_id: Optional[str] = None


class ActiveSponsorship(BaseModel):
    product_id: str
    bid_cents: int
    advertiser_name: str


class BillingStatus(BaseModel):
    sponsorship_id: str
    status: str


# ---------------------------------------------------------------------------
# App / lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_admin()
    await backfill_sponsorship_status()
    await stripe_events.create_index("event_id", unique=True)
    yield
    client.close()


app = FastAPI(title="Green Cart Save", lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------


@api.get("/")
async def root():
    return {"app": "Green Cart Save", "status": "ok"}


# ---- Price refresh (mock) -------------------------------------------------
#
# Simulates a price update from real grocery stores every 3 days. Returns a
# deterministic multiplier per product id so the same 3-day window always
# yields the same prices. Multipliers range roughly 0.92 – 1.18.

_PRICE_EPOCH = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _multiplier_for(product_id: str, window: int) -> float:
    import hashlib

    digest = hashlib.sha256(f"{product_id}-{window}".encode()).digest()
    # Map first byte (0..255) to roughly -8% .. +18% drift
    pct = (digest[0] / 255.0) * 0.26 - 0.08
    return round(1.0 + pct, 3)


@api.get("/prices/current")
async def current_prices():
    now = datetime.now(timezone.utc)
    days = max(0, (now - _PRICE_EPOCH).days)
    window = days // 3
    window_start = _PRICE_EPOCH + timedelta(days=window * 3)
    next_refresh = window_start + timedelta(days=3)
    multipliers = {
        f"p{i}": _multiplier_for(f"p{i}", window) for i in range(1, 301)
    }
    return {
        "window": window,
        "refreshed_at": window_start.isoformat(),
        "next_refresh_at": next_refresh.isoformat(),
        "multipliers": multipliers,
    }


@api.get("/sponsorships/active", response_model=List[ActiveSponsorship])
async def list_active_sponsorships():
    """Storefront uses this to lift sponsored products to the top.

    Only paid, active sponsorships surface here.
    """
    cursor = sponsorships.find(
        {"active": True, "status": "active"}, {"_id": 0}
    ).sort("bid_cents", -1)
    rows = await cursor.to_list(500)
    if not rows:
        return []

    advertiser_ids = list({r["advertiser_id"] for r in rows})
    adv_cursor = advertisers.find(
        {"id": {"$in": advertiser_ids}}, {"_id": 0, "id": 1, "name": 1}
    )
    name_by_id = {a["id"]: a["name"] async for a in adv_cursor}

    return [
        ActiveSponsorship(
            product_id=r["product_id"],
            bid_cents=r["bid_cents"],
            advertiser_name=name_by_id.get(r["advertiser_id"], "Sponsor"),
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Admin auth
# ---------------------------------------------------------------------------


@api.post("/admin/login", response_model=TokenResponse)
async def admin_login(form: OAuth2PasswordRequestForm = Depends()):
    admin = await admins.find_one({"email": form.username.lower().strip()})
    if not admin or not verify_password(form.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return TokenResponse(access_token=create_access_token(admin["email"]))


@api.get("/admin/me", response_model=AdminMe)
async def admin_me(current: dict = Depends(get_current_admin)):
    return AdminMe(**current)


# ---------------------------------------------------------------------------
# Admin: Advertisers
# ---------------------------------------------------------------------------


@api.get("/admin/advertisers", response_model=List[Advertiser])
async def list_advertisers(_: dict = Depends(get_current_admin)):
    rows = await advertisers.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Advertiser(**r) for r in rows]


@api.post("/admin/advertisers", response_model=Advertiser, status_code=201)
async def create_advertiser(
    body: AdvertiserIn, _: dict = Depends(get_current_admin)
):
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "contact_email": body.contact_email,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await advertisers.insert_one(doc)
    return Advertiser(**{k: v for k, v in doc.items() if k != "_id"})


@api.delete("/admin/advertisers/{advertiser_id}", status_code=204)
async def delete_advertiser(
    advertiser_id: str, _: dict = Depends(get_current_admin)
):
    res = await advertisers.delete_one({"id": advertiser_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Advertiser not found")
    await sponsorships.delete_many({"advertiser_id": advertiser_id})
    return None


# ---------------------------------------------------------------------------
# Admin: Sponsorships
# ---------------------------------------------------------------------------


def _sponsorship_to_model(row: dict, advertiser_name: Optional[str]) -> Sponsorship:
    return Sponsorship(
        id=row["id"],
        advertiser_id=row["advertiser_id"],
        advertiser_name=advertiser_name,
        product_id=row["product_id"],
        bid_cents=row["bid_cents"],
        active=row["active"],
        status=row.get("status", "active"),
        created_at=row["created_at"],
    )


@api.get("/admin/sponsorships", response_model=List[Sponsorship])
async def list_sponsorships(_: dict = Depends(get_current_admin)):
    rows = await sponsorships.find({}, {"_id": 0}).sort("bid_cents", -1).to_list(500)
    if not rows:
        return []
    adv_cursor = advertisers.find({}, {"_id": 0, "id": 1, "name": 1})
    name_by_id = {a["id"]: a["name"] async for a in adv_cursor}
    return [_sponsorship_to_model(r, name_by_id.get(r["advertiser_id"])) for r in rows]


@api.post("/admin/sponsorships", response_model=SponsorshipCreated, status_code=201)
async def create_sponsorship(
    body: SponsorshipIn, _: dict = Depends(get_current_admin)
):
    """Advertiser-paid sponsorship. Creates a Stripe Checkout Session and
    returns the URL. The sponsorship is stored as `pending_payment` until the
    webhook or a session lookup confirms payment."""
    adv = await advertisers.find_one({"id": body.advertiser_id}, {"_id": 0, "name": 1})
    if not adv:
        raise HTTPException(status_code=400, detail="Unknown advertiser_id")

    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")

    sponsorship_id = str(uuid.uuid4())
    doc = {
        "id": sponsorship_id,
        "advertiser_id": body.advertiser_id,
        "product_id": body.product_id,
        "bid_cents": body.bid_cents,
        "active": body.active,
        "status": "pending_payment",
        "stripe_session_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await sponsorships.insert_one(doc)

    success_url = (
        f"{PUBLIC_BACKEND_URL}/api/billing/return"
        "?session_id={CHECKOUT_SESSION_ID}"
    )
    cancel_url = f"{PUBLIC_BACKEND_URL}/api/billing/cancel?sponsorship_id={sponsorship_id}"

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": f"Sponsorship: {adv['name']} → {body.product_id}",
                        },
                        "unit_amount": body.bid_cents,
                    },
                    "quantity": 1,
                }
            ],
            success_url=success_url,
            cancel_url=cancel_url,
            client_reference_id=sponsorship_id,
            metadata={"sponsorship_id": sponsorship_id},
            payment_intent_data={"metadata": {"sponsorship_id": sponsorship_id}},
        )
    except stripe.StripeError as exc:
        await sponsorships.update_one(
            {"id": sponsorship_id}, {"$set": {"status": "payment_failed"}}
        )
        log.exception("Stripe session create failed")
        raise HTTPException(status_code=502, detail=f"Stripe error: {exc}") from exc

    await sponsorships.update_one(
        {"id": sponsorship_id}, {"$set": {"stripe_session_id": session.id}}
    )
    doc["stripe_session_id"] = session.id

    return SponsorshipCreated(
        sponsorship=_sponsorship_to_model(doc, adv["name"]),
        checkout_url=session.url,
        session_id=session.id,
    )


@api.patch("/admin/sponsorships/{sponsorship_id}", response_model=Sponsorship)
async def update_sponsorship(
    sponsorship_id: str,
    body: SponsorshipUpdate,
    _: dict = Depends(get_current_admin),
):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await sponsorships.update_one({"id": sponsorship_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sponsorship not found")
    row = await sponsorships.find_one({"id": sponsorship_id}, {"_id": 0})
    adv = await advertisers.find_one({"id": row["advertiser_id"]}, {"_id": 0, "name": 1})
    return _sponsorship_to_model(row, adv["name"] if adv else None)


@api.delete("/admin/sponsorships/{sponsorship_id}", status_code=204)
async def delete_sponsorship(
    sponsorship_id: str, _: dict = Depends(get_current_admin)
):
    res = await sponsorships.delete_one({"id": sponsorship_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sponsorship not found")
    return None


# ---------------------------------------------------------------------------
# Stripe billing endpoints
# ---------------------------------------------------------------------------


async def _activate_from_session(session_obj: dict) -> bool:
    """Idempotent fulfillment. Only activates paid sessions."""
    if session_obj.get("payment_status") != "paid":
        return False
    metadata = session_obj.get("metadata") or {}
    sponsorship_id = metadata.get("sponsorship_id") or session_obj.get(
        "client_reference_id"
    )
    if not sponsorship_id:
        return False
    res = await sponsorships.update_one(
        {"id": sponsorship_id, "status": {"$ne": "active"}},
        {
            "$set": {
                "status": "active",
                "stripe_payment_intent_id": session_obj.get("payment_intent"),
                "activated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    return res.matched_count > 0


@api.get("/billing/status/{sponsorship_id}", response_model=BillingStatus)
async def billing_status(sponsorship_id: str):
    row = await sponsorships.find_one(
        {"id": sponsorship_id}, {"_id": 0, "id": 1, "status": 1, "stripe_session_id": 1}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Sponsorship not found")
    # If still pending, ask Stripe once (also covers cases without webhook).
    if row.get("status") == "pending_payment" and row.get("stripe_session_id"):
        try:
            session_obj = stripe.checkout.Session.retrieve(row["stripe_session_id"])
            if await _activate_from_session(session_obj.to_dict()):
                return BillingStatus(sponsorship_id=sponsorship_id, status="active")
        except stripe.StripeError:
            log.exception("Stripe retrieve failed")
    return BillingStatus(sponsorship_id=sponsorship_id, status=row.get("status", "active"))


@api.get("/billing/return", response_class=HTMLResponse)
async def billing_return(session_id: str):
    """Stripe redirects here on success. We activate the sponsorship server-
    side (defense against skipped webhooks), then show a small landing page."""
    try:
        session_obj = stripe.checkout.Session.retrieve(session_id)
    except stripe.StripeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid session: {exc}") from exc
    await _activate_from_session(session_obj.to_dict())
    return HTMLResponse(
        f"""<!doctype html><html><head><meta charset="utf-8">
<title>Payment received · Green Cart Save</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
background:#ECFDF5;color:#053024;margin:0;display:flex;align-items:center;justify-content:center;
min-height:100vh;padding:24px}}.card{{background:#fff;border-radius:20px;padding:32px;
max-width:420px;text-align:center;box-shadow:0 10px 30px rgba(5,48,36,0.12)}}
.icon{{width:64px;height:64px;border-radius:32px;background:#10B981;color:#fff;font-size:32px;
line-height:64px;margin:0 auto 16px}}h1{{margin:0 0 8px;font-size:22px}}p{{color:#4B5563;margin:8px 0}}
.pill{{display:inline-block;background:#D1FAE5;color:#065F46;padding:6px 14px;border-radius:999px;
font-weight:700;font-size:13px;margin-top:12px}}</style></head><body>
<div class="card"><div class="icon">✓</div><h1>Payment received!</h1>
<p>Your sponsorship is now <strong>active</strong>. You can close this window and return to the app.</p>
<div class="pill">Green Cart Save · Advertiser Billing</div></div></body></html>"""
    )


@api.get("/billing/cancel")
async def billing_cancel(sponsorship_id: str):
    await sponsorships.update_one(
        {"id": sponsorship_id, "status": "pending_payment"},
        {"$set": {"status": "cancelled"}},
    )
    return RedirectResponse(url=f"{PUBLIC_BACKEND_URL}/api/billing/cancel-page")


@api.get("/billing/cancel-page", response_class=HTMLResponse)
async def billing_cancel_page():
    return HTMLResponse(
        """<!doctype html><html><head><meta charset="utf-8">
<title>Payment cancelled</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
background:#FFFBEB;color:#78350F;margin:0;display:flex;align-items:center;justify-content:center;
min-height:100vh;padding:24px}.card{background:#fff;border-radius:20px;padding:32px;
max-width:420px;text-align:center;box-shadow:0 10px 30px rgba(120,53,15,0.12)}
h1{margin:0 0 8px;font-size:22px}p{color:#4B5563;margin:8px 0}</style></head><body>
<div class="card"><h1>Payment cancelled</h1>
<p>Your sponsorship was not charged. Return to the app to try again.</p></div></body></html>"""
    )


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("stripe-signature")

    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.error.SignatureVerificationError) as exc:
            raise HTTPException(status_code=400, detail="Invalid Stripe webhook") from exc
    else:
        # Fallback for envs without STRIPE_WEBHOOK_SECRET (dev/preview only).
        import json

        try:
            event = json.loads(payload)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Bad payload") from exc

    event_id = event.get("id") if isinstance(event, dict) else event["id"]
    try:
        await stripe_events.insert_one(
            {"event_id": event_id, "received_at": datetime.now(timezone.utc).isoformat()}
        )
    except Exception:
        return {"received": True, "duplicate": True}

    event_type = event.get("type") if isinstance(event, dict) else event["type"]
    if event_type in (
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
    ):
        obj = (event.get("data") or {}).get("object") if isinstance(event, dict) else event["data"]["object"]
        if isinstance(obj, dict):
            await _activate_from_session(obj)
    return {"received": True}


# ---------------------------------------------------------------------------
# Public privacy policy
# ---------------------------------------------------------------------------


_PRIVACY_HTML = """<!doctype html>
<html><head><meta charset="utf-8">
<title>Privacy Policy · Green Cart Save</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--green:#10B981;--green-dark:#053024;--muted:#4B5563;--bg:#F7FBF8;}
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
background:var(--bg);color:var(--green-dark);margin:0;padding:24px 16px;line-height:1.6;}
.container{max-width:720px;margin:0 auto;background:#fff;border-radius:20px;padding:32px;
box-shadow:0 10px 30px rgba(5,48,36,0.08);}
h1{margin:0 0 4px;font-size:28px;}
.sub{color:var(--muted);font-size:14px;margin-bottom:24px;}
h2{margin-top:28px;font-size:18px;color:var(--green-dark);}
p,li{color:#1F2937;font-size:15px;}
ul{padding-left:22px;}
.pill{display:inline-block;background:#D1FAE5;color:#065F46;padding:6px 12px;border-radius:999px;
font-weight:700;font-size:12px;margin-top:8px;}
footer{margin-top:32px;color:var(--muted);font-size:13px;text-align:center;}
</style></head>
<body><div class="container">
<h1>Privacy Policy</h1>
<div class="sub">Green Cart Save · Last updated: 2026</div>
<span class="pill">Plain-English summary at the top</span>

<h2>The short version</h2>
<p>We built Green Cart Save to help you shop more sustainably. We collect the
minimum data required to run the app: your grocery lists, camera frames used
only for barcode scanning, and anonymous usage statistics. We do not sell
your data. Payments (advertiser billing) are handled entirely by Stripe.</p>

<h2>1. Who we are</h2>
<p>Green Cart Save (&ldquo;the app&rdquo;, &ldquo;we&rdquo;) is a mobile
grocery shopping and sustainability tool. For privacy questions email
<strong>support@greencartsave.com</strong>.</p>

<h2>2. Information we collect</h2>
<ul>
  <li><strong>Grocery lists and cart items</strong> stored locally on your
  device (AsyncStorage) so the app remembers what you were shopping for.</li>
  <li><strong>Camera frames</strong> processed on-device by
  <em>expo-camera</em> for barcode scanning. Frames are never uploaded or
  stored.</li>
  <li><strong>Advertiser account data</strong> (name, email) if you sign up
  as a paid sponsor of products in our storefront.</li>
  <li><strong>Payment data</strong> (only for advertisers) is collected and
  processed by Stripe. We never see or store card numbers.</li>
  <li><strong>Aggregate, anonymous analytics</strong> such as which screens
  are used most often. No personal identifiers are attached.</li>
</ul>

<h2>3. How we use your information</h2>
<ul>
  <li>To operate the app&#39;s core features: shopping list, greener
  swaps, impact estimates, barcode scanning.</li>
  <li>To surface sponsored placements paid for by advertisers.</li>
  <li>To secure and improve the app.</li>
</ul>

<h2>4. Sharing</h2>
<p>We do not sell personal information. We share limited data with the
following service providers strictly to run the app:</p>
<ul>
  <li><strong>Stripe</strong> &mdash; advertiser payments and billing.</li>
  <li><strong>Cloud hosting</strong> &mdash; where our backend runs.</li>
</ul>

<h2>5. Permissions</h2>
<ul>
  <li><strong>Camera</strong> &mdash; only for barcode scanning. You can
  deny or revoke this anytime in your OS settings.</li>
</ul>

<h2>6. Data retention</h2>
<p>Local device data (cart, saved lists) stays on your device until you
clear it. Advertiser records are retained as long as the account is active.
You can request deletion by emailing <strong>support@greencartsave.com</strong>.</p>

<h2>7. Children&#39;s privacy</h2>
<p>Green Cart Save is not directed at children under 13 and we do not
knowingly collect their personal information.</p>

<h2>8. Your rights</h2>
<p>Depending on where you live you may have rights to access, correct or
delete your data. Email <strong>support@greencartsave.com</strong> and we
will respond within 30 days.</p>

<h2>9. Changes</h2>
<p>If we materially change this policy we will update the &ldquo;Last
updated&rdquo; date at the top and, where required by law, notify you in
the app.</p>

<footer>Green Cart Save &copy; 2026 &mdash; Made with 💚</footer>
</div></body></html>
"""


@api.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    return HTMLResponse(_PRIVACY_HTML)


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
