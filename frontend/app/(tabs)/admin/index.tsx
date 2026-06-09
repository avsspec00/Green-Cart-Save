// Admin tab — JWT-gated dashboard for managing advertisers & sponsorships.

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";import { SafeAreaView } from "react-native-safe-area-context";

import { PRODUCTS } from "@/src/data/products";
import { useAuth } from "@/src/store/auth";
import { colors, radius, shadow, spacing } from "@/src/theme";
import {
  Advertiser,
  createAdvertiser,
  createSponsorship,
  deleteAdvertiser,
  deleteSponsorship,
  listAdvertisers,
  listSponsorships,
  Sponsorship,
  updateSponsorship,
} from "@/src/utils/api";

export default function AdminScreen() {
  const { ready, token } = useAuth();

  if (!ready) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 64 }} />
      </SafeAreaView>
    );
  }

  return token ? <Dashboard /> : <Login />;
}

// ---------- Login ----------

function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@greencartsave.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.loginWrap}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandBubble}>
            <Ionicons name="briefcase" size={32} color={colors.primaryDark} />
          </View>
          <Text style={styles.title}>Advertiser Console</Text>
          <Text style={styles.subtitle}>
            Sign in to manage paid placements on Green Cart Save.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="admin-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="admin@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="admin-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
          />

          {error && (
            <Text testID="admin-login-error" style={styles.errorTxt}>
              {error}
            </Text>
          )}

          <Pressable
            testID="admin-login-btn"
            onPress={onSubmit}
            disabled={busy}
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
          >
            <Ionicons name="log-in" size={18} color="#fff" />
            <Text style={styles.primaryBtnTxt}>
              {busy ? "Signing in..." : "Sign in"}
            </Text>
          </Pressable>

          <Pressable
            testID="request-password-btn"
            onPress={() => setShowReset(true)}
            style={styles.ghostBtnWide}
          >
            <Ionicons name="key-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.ghostBtnWideTxt}>Request password</Text>
          </Pressable>

          <Modal
            visible={showReset}
            transparent
            animationType="fade"
            onRequestClose={() => setShowReset(false)}
          >
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setShowReset(false)}
            >
              <Pressable
                style={styles.modalCard}
                testID="reset-modal"
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalIcon}>
                  <Ionicons name="key" size={28} color="#fff" />
                </View>
                <Text style={styles.modalTitle}>Request a password</Text>
                <Text style={styles.modalSub}>
                  This console is single-admin only. To reset or request the
                  password, contact the app owner:
                </Text>
                <Text style={styles.modalContact}>Ardra Vanessa Spector</Text>
                <Text style={styles.modalEmail}>support@greencartsave.com</Text>
                <Pressable
                  testID="reset-modal-close"
                  onPress={() => setShowReset(false)}
                  style={styles.modalBtn}
                >
                  <Text style={styles.modalBtnTxt}>Got it</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- Dashboard ----------

function Dashboard() {
  const { logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"sponsorships" | "advertisers">("sponsorships");
  const [adv, setAdv] = useState<Advertiser[]>([]);
  const [spons, setSpons] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdvForm, setShowAdvForm] = useState(false);
  const [showSponsForm, setShowSponsForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, s] = await Promise.all([listAdvertisers(), listSponsorships()]);
      setAdv(a);
      setSpons(s);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Advertiser Console</Text>
          <Text style={styles.subtitle}>Manage paid placements</Text>
        </View>
        <Pressable
          testID="admin-logout-btn"
          onPress={logout}
          style={styles.logoutBtn}
          hitSlop={8}
        >
          <Ionicons name="log-out" size={18} color={colors.danger} />
        </Pressable>
      </View>

      <View style={styles.segment}>
        <SegmentBtn
          label="Sponsorships"
          active={tab === "sponsorships"}
          onPress={() => setTab("sponsorships")}
          testID="seg-sponsorships"
          count={spons.length}
        />
        <SegmentBtn
          label="Advertisers"
          active={tab === "advertisers"}
          onPress={() => setTab("advertisers")}
          testID="seg-advertisers"
          count={adv.length}
        />
      </View>

      {error && (
        <Text testID="admin-error" style={[styles.errorTxt, { marginHorizontal: spacing.lg }]}>
          {error}
        </Text>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 200, paddingHorizontal: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : tab === "sponsorships" ? (
          <SponsorshipsList
            items={spons}
            advertisers={adv}
            onRefresh={refresh}
            onError={setError}
          />
        ) : (
          <AdvertisersList items={adv} onRefresh={refresh} onError={setError} />
        )}

        <Pressable
          testID="admin-ownership-link"
          onPress={() => router.push("/(tabs)/admin/ownership")}
          style={styles.ownershipLink}
        >
          <Ionicons name="document-text-outline" size={16} color={colors.primaryDark} />
          <Text style={styles.ownershipLinkTxt}>Ownership &amp; credits</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
        </Pressable>
      </ScrollView>

      <Pressable
        testID="admin-fab"
        onPress={() =>
          tab === "sponsorships" ? setShowSponsForm(true) : setShowAdvForm(true)
        }
        style={styles.fab}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.fabTxt}>
          New {tab === "sponsorships" ? "sponsorship" : "advertiser"}
        </Text>
      </Pressable>

      <AdvertiserForm
        visible={showAdvForm}
        onClose={() => setShowAdvForm(false)}
        onCreated={() => {
          setShowAdvForm(false);
          refresh();
        }}
        onError={setError}
      />

      <SponsorshipForm
        visible={showSponsForm}
        advertisers={adv}
        onClose={() => setShowSponsForm(false)}
        onCreated={() => {
          setShowSponsForm(false);
          refresh();
        }}
        onError={setError}
      />
    </SafeAreaView>
  );
}

function SegmentBtn({
  label,
  active,
  onPress,
  testID,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
  count?: number;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.segBtn, active && styles.segBtnActive]}
    >
      <Text style={[styles.segTxt, active && styles.segTxtActive]}>
        {label}
        {count !== undefined && ` · ${count}`}
      </Text>
    </Pressable>
  );
}

// ---------- Sponsorships list ----------

function SponsorshipsList({
  items,
  advertisers,
  onRefresh,
  onError,
}: {
  items: Sponsorship[];
  advertisers: Advertiser[];
  onRefresh: () => void;
  onError: (e: string) => void;
}) {
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="megaphone-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No sponsorships yet</Text>
        <Text style={styles.emptySub}>
          Tap "New sponsorship" to boost a product to the top of search.
        </Text>
      </View>
    );
  }
  if (advertisers.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Create an advertiser first</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((s) => (
        <SponsorshipRow
          key={s.id}
          item={s}
          onRefresh={onRefresh}
          onError={onError}
        />
      ))}
    </View>
  );
}

function SponsorshipRow({
  item,
  onRefresh,
  onError,
}: {
  item: Sponsorship;
  onRefresh: () => void;
  onError: (e: string) => void;
}) {
  const product = PRODUCTS.find((p) => p.id === item.product_id);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await updateSponsorship(item.id, { active: !item.active });
      onRefresh();
    } catch (e: any) {
      onError(e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteSponsorship(item.id);
      onRefresh();
    } catch (e: any) {
      onError(e?.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row} testID={`sponsorship-row-${item.id}`}>
      <View style={[styles.rowEmoji, { backgroundColor: product?.color ?? colors.surfaceAlt }]}>
        <Text style={{ fontSize: 26 }}>{product?.emoji ?? "📦"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {product?.name ?? item.product_id}
        </Text>
        <Text style={styles.rowMeta}>
          {item.advertiser_name ?? "—"} · ${(item.bid_cents / 100).toFixed(2)} bid
        </Text>
        <View style={[styles.statusPill, !item.active && styles.statusPillOff]}>
          <View style={[styles.statusDot, !item.active && { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.statusTxt, !item.active && { color: colors.textMuted }]}>
            {item.active ? "Active" : "Paused"}
          </Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Pressable
          testID={`sponsorship-toggle-${item.id}`}
          onPress={toggle}
          disabled={busy}
          style={styles.iconBtn}
        >
          <Ionicons
            name={item.active ? "pause" : "play"}
            size={16}
            color={colors.primaryDark}
          />
        </Pressable>
        <Pressable
          testID={`sponsorship-delete-${item.id}`}
          onPress={remove}
          disabled={busy}
          style={[styles.iconBtn, { backgroundColor: "#FEE2E2" }]}
        >
          <Ionicons name="trash" size={16} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------- Advertisers list ----------

function AdvertisersList({
  items,
  onRefresh,
  onError,
}: {
  items: Advertiser[];
  onRefresh: () => void;
  onError: (e: string) => void;
}) {
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="business-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No advertisers yet</Text>
        <Text style={styles.emptySub}>Add grocery stores or brands that want top placement.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((a) => (
        <View key={a.id} style={styles.row} testID={`advertiser-row-${a.id}`}>
          <View style={[styles.rowEmoji, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="business" size={22} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName}>{a.name}</Text>
            <Text style={styles.rowMeta}>{a.contact_email}</Text>
          </View>
          <Pressable
            testID={`advertiser-delete-${a.id}`}
            onPress={async () => {
              try {
                await deleteAdvertiser(a.id);
                onRefresh();
              } catch (e: any) {
                onError(e?.message ?? "Delete failed");
              }
            }}
            style={[styles.iconBtn, { backgroundColor: "#FEE2E2" }]}
          >
            <Ionicons name="trash" size={16} color={colors.danger} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ---------- Forms ----------

function AdvertiserForm({
  visible,
  onClose,
  onCreated,
  onError,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  onError: (e: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      await createAdvertiser(name.trim(), email.trim());
      setName("");
      setEmail("");
      onCreated();
    } catch (e: any) {
      onError(e?.message ?? "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>New advertiser</Text>
          <Text style={styles.label}>Brand or store name</Text>
          <TextInput
            testID="adv-name-input"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="e.g. FreshMart Co-op"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Contact email</Text>
          <TextInput
            testID="adv-email-input"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="ads@brand.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={styles.sheetActions}>
            <Pressable onPress={onClose} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnTxt}>Cancel</Text>
            </Pressable>
            <Pressable
              testID="adv-submit-btn"
              onPress={submit}
              disabled={busy}
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            >
              <Text style={styles.primaryBtnTxt}>{busy ? "Saving..." : "Create"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SponsorshipForm({
  visible,
  advertisers,
  onClose,
  onCreated,
  onError,
}: {
  visible: boolean;
  advertisers: Advertiser[];
  onClose: () => void;
  onCreated: () => void;
  onError: (e: string) => void;
}) {
  const [advertiserId, setAdvertiserId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [bidUsd, setBidUsd] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!advertiserId || !productId) {
      onError("Pick an advertiser and a product");
      return;
    }
    const cents = Math.round(parseFloat(bidUsd) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      onError("Bid must be a positive amount");
      return;
    }
    setBusy(true);
    try {
      await createSponsorship({
        advertiser_id: advertiserId,
        product_id: productId,
        bid_cents: cents,
      });
      setAdvertiserId(null);
      setProductId(null);
      setBidUsd("");
      onCreated();
    } catch (e: any) {
      onError(e?.message ?? "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>New sponsorship</Text>

          <Text style={styles.label}>Advertiser</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {advertisers.map((a) => {
              const active = advertiserId === a.id;
              return (
                <Pressable
                  key={a.id}
                  testID={`pick-adv-${a.id}`}
                  onPress={() => setAdvertiserId(a.id)}
                  style={[styles.pickChip, active && styles.pickChipActive]}
                >
                  <Text style={[styles.pickChipTxt, active && styles.pickChipTxtActive]}>
                    {a.name}
                  </Text>
                </Pressable>
              );
            })}
            {advertisers.length === 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                No advertisers — create one first.
              </Text>
            )}
          </ScrollView>

          <Text style={styles.label}>Product</Text>
          <ScrollView style={styles.productPickerScroll}>
            <View style={styles.productPicker}>
              {PRODUCTS.map((p) => {
                const active = productId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    testID={`pick-product-${p.id}`}
                    onPress={() => setProductId(p.id)}
                    style={[styles.productPick, active && styles.productPickActive]}
                  >
                    <Text style={{ fontSize: 18 }}>{p.emoji}</Text>
                    <Text
                      style={[styles.productPickName, active && styles.productPickNameActive]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Text style={styles.label}>Daily bid (USD)</Text>
          <TextInput
            testID="bid-input"
            value={bidUsd}
            onChangeText={setBidUsd}
            keyboardType="decimal-pad"
            placeholder="e.g. 50.00"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <View style={styles.sheetActions}>
            <Pressable onPress={onClose} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnTxt}>Cancel</Text>
            </Pressable>
            <Pressable
              testID="sponsorship-submit-btn"
              onPress={submit}
              disabled={busy}
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            >
              <Text style={styles.primaryBtnTxt}>{busy ? "Saving..." : "Launch"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  loginWrap: { padding: spacing.lg, alignItems: "stretch" },
  brandBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 32,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "700",
    marginTop: spacing.md,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadow.pill,
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  ghostBtnWide: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    backgroundColor: "#FFFFFF",
  },
  ghostBtnWideTxt: { color: colors.primaryDark, fontWeight: "700", fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 48, 36, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" },
  modalSub: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: 8 },
  modalContact: { fontSize: 15, fontWeight: "800", color: colors.primaryDark, marginTop: 12 },
  modalEmail: { fontSize: 13, color: colors.text, marginTop: 2 },
  modalBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radius.pill,
    marginTop: 20,
  },
  modalBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  errorTxt: { color: colors.danger, fontSize: 13, fontWeight: "700", marginTop: 12 },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radius.pill,
  },
  segBtnActive: { backgroundColor: colors.surface, ...shadow.card },
  segTxt: { fontSize: 13, color: colors.textMuted, fontWeight: "700" },
  segTxtActive: { color: colors.text },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadow.card,
  },
  rowEmoji: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: { fontSize: 14, fontWeight: "800", color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  statusPillOff: { backgroundColor: colors.surfaceAlt },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  statusTxt: { fontSize: 11, fontWeight: "800", color: colors.primaryDark },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: "center", paddingHorizontal: 32 },
  fab: {
    position: "absolute",
    bottom: 18,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadow.pill,
  },
  fabTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  ownershipLink: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ownershipLinkTxt: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 48, 36, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "85%",
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 8 },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: spacing.lg,
  },
  ghostBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  ghostBtnTxt: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },
  chipRow: { gap: 8, paddingVertical: 8 },
  pickChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pickChipActive: { backgroundColor: colors.primary },
  pickChipTxt: { fontSize: 13, fontWeight: "700", color: colors.text },
  pickChipTxtActive: { color: "#fff" },
  productPickerScroll: { maxHeight: 220, marginTop: 4 },
  productPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 8,
  },
  productPick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    minWidth: 140,
    maxWidth: 200,
  },
  productPickActive: { backgroundColor: colors.primary },
  productPickName: { fontSize: 12, color: colors.text, fontWeight: "600", flex: 1 },
  productPickNameActive: { color: "#fff" },
});
