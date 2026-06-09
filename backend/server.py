"""Green Cart Save backend.

Provides:
- Public sponsorship lookup so the storefront can surface paid placements first.
- Single-admin JWT auth for managing advertisers and sponsored placements.

All routes are mounted under /api to match the ingress.
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
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
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

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
admins = db["admins"]
advertisers = db["advertisers"]
sponsorships = db["sponsorships"]

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
    bid_cents: int = Field(ge=0)
    active: bool = True


class SponsorshipUpdate(BaseModel):
    bid_cents: Optional[int] = Field(default=None, ge=0)
    active: Optional[bool] = None


class Sponsorship(BaseModel):
    id: str
    advertiser_id: str
    advertiser_name: Optional[str] = None
    product_id: str
    bid_cents: int
    active: bool
    created_at: str


class ActiveSponsorship(BaseModel):
    product_id: str
    bid_cents: int
    advertiser_name: str


# ---------------------------------------------------------------------------
# App / lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_admin()
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
    """Storefront uses this to lift sponsored products to the top."""
    cursor = sponsorships.find({"active": True}, {"_id": 0}).sort("bid_cents", -1)
    rows = await cursor.to_list(500)
    if not rows:
        return []

    # Resolve advertiser names in a single round-trip.
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
    # cascade: also drop their sponsorships
    await sponsorships.delete_many({"advertiser_id": advertiser_id})
    return None


# ---------------------------------------------------------------------------
# Admin: Sponsorships
# ---------------------------------------------------------------------------


@api.get("/admin/sponsorships", response_model=List[Sponsorship])
async def list_sponsorships(_: dict = Depends(get_current_admin)):
    rows = await sponsorships.find({}, {"_id": 0}).sort("bid_cents", -1).to_list(500)
    if not rows:
        return []
    adv_cursor = advertisers.find({}, {"_id": 0, "id": 1, "name": 1})
    name_by_id = {a["id"]: a["name"] async for a in adv_cursor}
    return [
        Sponsorship(advertiser_name=name_by_id.get(r["advertiser_id"]), **r)
        for r in rows
    ]


@api.post("/admin/sponsorships", response_model=Sponsorship, status_code=201)
async def create_sponsorship(
    body: SponsorshipIn, _: dict = Depends(get_current_admin)
):
    adv = await advertisers.find_one({"id": body.advertiser_id}, {"_id": 0, "name": 1})
    if not adv:
        raise HTTPException(status_code=400, detail="Unknown advertiser_id")
    doc = {
        "id": str(uuid.uuid4()),
        "advertiser_id": body.advertiser_id,
        "product_id": body.product_id,
        "bid_cents": body.bid_cents,
        "active": body.active,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await sponsorships.insert_one(doc)
    return Sponsorship(advertiser_name=adv["name"], **{k: v for k, v in doc.items() if k != "_id"})


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
    return Sponsorship(advertiser_name=adv["name"] if adv else None, **row)


@api.delete("/admin/sponsorships/{sponsorship_id}", status_code=204)
async def delete_sponsorship(
    sponsorship_id: str, _: dict = Depends(get_current_admin)
):
    res = await sponsorships.delete_one({"id": sponsorship_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sponsorship not found")
    return None


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
