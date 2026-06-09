import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EcoBadge } from "@/src/components/EcoBadge";
import { ProductImage } from "@/src/components/ProductImage";
import {
  findProduct,
  getGreenAlternative,
  PRODUCTS,
  Product,
} from "@/src/data/products";
import { useCart } from "@/src/store/cart";
import { usePriceOf } from "@/src/store/prices";
import { colors, radius, shadow, spacing } from "@/src/theme";

export default function Cart() {
  const router = useRouter();
  const {
    items,
    add,
    remove,
    setQty,
    clear,
    swapAllGreen,
    total,
    itemCount,
    co2Total,
    plasticCount,
    savedLists,
    saveCurrentList,
    restoreList,
    deleteSavedList,
  } = useCart();

  const [confirm, setConfirm] = useState<{ count: number; co2Saved: number; stores: string[] } | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [showSavedLists, setShowSavedLists] = useState(false);
  const [listName, setListName] = useState("");
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [showCoupons, setShowCoupons] = useState(false);
  const priceOf = usePriceOf();

  const entries = useMemo(
    () =>
      Object.entries(items)
        .map(([id, qty]) => ({ product: findProduct(id), qty }))
        .filter((e): e is { product: Product; qty: number } => !!e.product),
    [items],
  );

  const greenerSwapsAvailable = useMemo(
    () => entries.filter((e) => getGreenAlternative(e.product.id)).length,
    [entries],
  );

  const potentialCO2Save = useMemo(() => {
    let saved = 0;
    for (const { product, qty } of entries) {
      const alt = getGreenAlternative(product.id);
      if (!alt) continue;
      saved += (product.co2Kg - alt.co2Kg) * qty;
    }
    return saved;
  }, [entries]);

  // For each cart product, find the cheapest similar product from a
  // different store. "Similar" = same category + at least one shared 4-letter
  // word in the name (so "Bananas (bunch)" matches "Organic Fair-Trade Bananas").
  const cheaperById = useMemo(() => {
    const STOP = new Set([
      "fresh","organic","with","extra","large","small","virgin",
      "from","into","that","this","your","ounce","pack","each",
    ]);
    const out: Record<string, Product> = {};
    for (const { product } of entries) {
      const tokens = product.name
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((t) => t.length >= 4 && !STOP.has(t));
      if (tokens.length === 0) continue;
      const curPrice = priceOf(product.id, product.price);
      let best: Product | undefined;
      let bestPrice = curPrice;
      for (const p of PRODUCTS) {
        if (p.id === product.id) continue;
        if (p.category !== product.category) continue;
        if (p.brand === product.brand) continue;
        const pn = p.name.toLowerCase();
        if (!tokens.some((t) => pn.includes(t))) continue;
        const eff = priceOf(p.id, p.price);
        if (eff < bestPrice - 0.01) {
          best = p;
          bestPrice = eff;
        }
      }
      if (best) out[product.id] = best;
    }
    return out;
  }, [entries, priceOf]);

  const onSwapAll = () => {
    const r = swapAllGreen();
    setConfirm(r);
  };

  if (entries.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Your cart</Text>
        </View>
        <View style={styles.empty}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>🛒</Text>
          <Text style={styles.emptyTitle}>Cart is empty</Text>
          <Text style={styles.emptySub}>Add fresh picks from the Shop tab.</Text>
          <Pressable
            testID="go-to-shop-btn"
            onPress={() => router.push("/(tabs)/shop")}
            style={styles.ctaBtn}
          >
            <Ionicons name="leaf" size={16} color="#fff" />
            <Text style={styles.ctaBtnTxt}>Start shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Pressable
            testID="cart-home-logo"
            onPress={() => router.push("/")}
            style={styles.logoBubble}
            hitSlop={8}
          >
            <Ionicons name="cart" size={22} color={colors.primaryDark} />
          </Pressable>
          <View>
            <Text style={styles.title}>Your cart</Text>
            {savedLists.length > 0 && (
              <Pressable
                testID="open-saved-lists-btn"
                onPress={() => setShowSavedLists(true)}
                hitSlop={8}
              >
                <Text style={styles.savedListsLink}>
                  {savedLists.length} saved list{savedLists.length === 1 ? "" : "s"} ›
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            testID="save-list-btn"
            onPress={() => {
              if (itemCount === 0) return;
              setListName(`List ${new Date().toLocaleDateString()}`);
              setShowSaveForm(true);
            }}
            disabled={itemCount === 0}
            style={[styles.saveListBtn, itemCount === 0 && { opacity: 0.4 }]}
            hitSlop={8}
          >
            <Ionicons name="bookmark-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.saveListBtnTxt}>Save list</Text>
          </Pressable>
          <Pressable testID="clear-cart-btn" onPress={clear} hitSlop={8}>
            <Text style={styles.clearTxt}>Clear</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 220, paddingHorizontal: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {greenerSwapsAvailable > 0 && (
          <View style={styles.greenCard} testID="go-green-card">
            <View style={styles.greenCardTop}>
              <View style={styles.greenIconBubble}>
                <Ionicons name="leaf" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.greenTitle}>Go Green in one tap</Text>
                <Text style={styles.greenSub}>
                  {greenerSwapsAvailable} item{greenerSwapsAvailable > 1 ? "s" : ""} can
                  be swapped • save {potentialCO2Save.toFixed(1)} kg CO₂
                </Text>
              </View>
            </View>
            <Pressable
              testID="swap-all-green-btn"
              onPress={onSwapAll}
              style={styles.greenBtn}
            >
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.greenBtnTxt}>Swap all greener</Text>
            </Pressable>
          </View>
        )}

        {entries.map(({ product, qty }) => {
          const alt = getGreenAlternative(product.id);
          const cheaper = cheaperById[product.id];
          return (
            <View key={product.id} style={styles.row} testID={`cart-row-${product.id}`}>
              <View style={[styles.thumb, { backgroundColor: product.color }]}>
                <ProductImage product={product} fontSize={32} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowBrand}>{product.brand}</Text>
                <Text style={styles.rowName} numberOfLines={1}>{product.name}</Text>
                <View style={styles.rowMeta}>
                  <EcoBadge score={product.ecoScore} />
                  <Text style={styles.rowPrice}>${(priceOf(product.id, product.price) * qty).toFixed(2)}</Text>
                </View>
                {alt && (
                  <Pressable
                    testID={`swap-row-${product.id}`}
                    onPress={() => {
                      const q = qty;
                      setQty(product.id, 0);
                      for (let i = 0; i < q; i++) add(alt.id);
                    }}
                    style={styles.swapHint}
                  >
                    <Ionicons name="swap-horizontal" size={12} color={colors.primaryDark} />
                    <Text style={styles.swapHintTxt}>
                      Swap for {alt.name} at {alt.brand}
                    </Text>
                  </Pressable>
                )}
                {cheaper && (
                  <Pressable
                    testID={`cheaper-${product.id}`}
                    onPress={() => {
                      const q = qty;
                      setQty(product.id, 0);
                      for (let i = 0; i < q; i++) add(cheaper.id);
                    }}
                    style={styles.cheaperHint}
                  >
                    <Ionicons name="trending-down" size={12} color="#B45309" />
                    <Text style={styles.cheaperHintTxt} numberOfLines={1}>
                      Cheaper at {cheaper.brand}: ${priceOf(cheaper.id, cheaper.price).toFixed(2)}
                    </Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.qtyCol}>
                <Pressable
                  testID={`cart-plus-${product.id}`}
                  onPress={() => add(product.id)}
                  style={styles.qtyBtn}
                >
                  <Ionicons name="add" size={16} color={colors.primaryDark} />
                </Pressable>
                <Text style={styles.qtyValue}>{qty}</Text>
                <Pressable
                  testID={`cart-minus-${product.id}`}
                  onPress={() => remove(product.id)}
                  style={styles.qtyBtn}
                >
                  <Ionicons name="remove" size={16} color={colors.primaryDark} />
                </Pressable>
              </View>
            </View>
          );
        })}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{co2Total.toFixed(1)} kg</Text>
            <Text style={styles.statLabel}>CO₂ footprint</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{plasticCount}</Text>
            <Text style={styles.statLabel}>Plastic items</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.checkoutBar}>
        <Text style={styles.checkoutLabel}>Total ({itemCount} items)</Text>
        <Text testID="cart-total" style={styles.checkoutTotal}>${total.toFixed(2)}</Text>
      </View>

      <Pressable
        testID="apply-coupons-btn"
        onPress={() => setShowCoupons((v) => !v)}
        style={styles.couponsBtn}
        accessibilityLabel="Coupon Links"
      >
        <Ionicons name="pricetag" size={16} color="#fff" />
        <Text style={styles.couponsBtnTxt}>
          {showCoupons ? "Hide links" : "Coupon Links"}
        </Text>
        <Ionicons
          name={showCoupons ? "chevron-down" : "chevron-up"}
          size={14}
          color="#fff"
        />
      </Pressable>

      {showCoupons && (
        <View style={styles.couponPanel} testID="coupon-links-panel">
          <Text style={styles.couponHint}>
            Tap a product to search the web for coupons:
          </Text>
          <ScrollView
            style={{ maxHeight: 180 }}
            showsVerticalScrollIndicator={false}
          >
            {entries.map(({ product }) => {
              const url = `https://www.google.com/search?q=${encodeURIComponent(
                `${product.brand} ${product.name} coupon`,
              )}`;
              return (
                <Pressable
                  key={product.id}
                  testID={`coupon-link-${product.id}`}
                  onPress={() => Linking.openURL(url)}
                  style={styles.couponLink}
                >
                  <Ionicons
                    name="link"
                    size={14}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.couponLinkTxt} numberOfLines={1}>
                    {product.brand} · {product.name}
                  </Text>
                  <Ionicons
                    name="open-outline"
                    size={14}
                    color={colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <SwapConfirmModal data={confirm} onClose={() => setConfirm(null)} />

      <SaveListSheet
        visible={showSaveForm}
        value={listName}
        onChange={setListName}
        onSubmit={async () => {
          const saved = await saveCurrentList(listName);
          setShowSaveForm(false);
          if (saved) {
            setSavedToast(`Saved “${saved.name}” (${Object.keys(saved.items).length} items)`);
            setTimeout(() => setSavedToast(null), 2500);
          }
        }}
        onClose={() => setShowSaveForm(false)}
      />

      <SavedListsSheet
        visible={showSavedLists}
        lists={savedLists}
        onRestore={(id) => {
          restoreList(id);
          setShowSavedLists(false);
        }}
        onDelete={async (id) => deleteSavedList(id)}
        onClose={() => setShowSavedLists(false)}
      />

      {savedToast && (
        <View testID="saved-toast" style={styles.toast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.toastTxt}>{savedToast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function SaveListSheet({
  visible,
  value,
  onChange,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Save grocery list</Text>
          <Text style={styles.sheetSub}>
            Give your list a name so you can restore it later.
          </Text>
          <TextInput
            testID="save-list-name-input"
            value={value}
            onChangeText={onChange}
            placeholder="e.g. Weekly staples"
            placeholderTextColor={colors.textMuted}
            style={styles.sheetInput}
            autoFocus
          />
          <View style={styles.sheetRow}>
            <Pressable onPress={onClose} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnTxt}>Cancel</Text>
            </Pressable>
            <Pressable
              testID="save-list-submit"
              onPress={onSubmit}
              style={styles.primaryBtn}
            >
              <Ionicons name="bookmark" size={16} color="#fff" />
              <Text style={styles.primaryBtnTxt}>Save list</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SavedListsSheet({
  visible,
  lists,
  onRestore,
  onDelete,
  onClose,
}: {
  visible: boolean;
  lists: import("@/src/store/cart").SavedList[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Saved lists</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {lists.length === 0 ? (
              <Text style={styles.sheetSub}>You don&apos;t have any saved lists yet.</Text>
            ) : (
              lists.map((l) => {
                const count = Object.values(l.items).reduce((a, b) => a + b, 0);
                return (
                  <View key={l.id} testID={`saved-list-${l.id}`} style={styles.savedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.savedName}>{l.name}</Text>
                      <Text style={styles.savedMeta}>
                        {count} item{count === 1 ? "" : "s"} •{" "}
                        {new Date(l.savedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Pressable
                      testID={`restore-list-${l.id}`}
                      onPress={() => onRestore(l.id)}
                      style={styles.restoreBtn}
                    >
                      <Ionicons name="cart" size={14} color="#fff" />
                      <Text style={styles.restoreBtnTxt}>Show List</Text>
                    </Pressable>
                    <Pressable
                      testID={`delete-list-${l.id}`}
                      onPress={() => onDelete(l.id)}
                      style={styles.iconBtn}
                    >
                      <Ionicons name="trash" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={styles.sheetRow}>
            <Pressable onPress={onClose} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnTxt}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SwapConfirmModal({
  data,
  onClose,
}: {
  data: { count: number; co2Saved: number; stores: string[] } | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!data} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.modalCard} testID="swap-confirm-modal">
          <View style={styles.modalIcon}>
            <Ionicons name="leaf" size={32} color="#fff" />
          </View>
          <Text style={styles.modalTitle}>You went greener! 🌿</Text>
          <Text style={styles.modalSub}>
            {data?.count ?? 0} item{(data?.count ?? 0) === 1 ? "" : "s"} swapped •{" "}
            {(data?.co2Saved ?? 0).toFixed(1)} kg CO₂ saved
          </Text>
          {data && data.stores.length > 0 && (
            <Text testID="swap-confirm-stores" style={styles.modalStores}>
              Replacements available at: {data.stores.join(", ")}
            </Text>
          )}
          <Pressable testID="swap-confirm-close" onPress={onClose} style={styles.modalBtn}>
            <Text style={styles.modalBtnTxt}>Sweet!</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function CheckoutModal() {
  // Checkout flow intentionally removed per product requirements.
  return null;
}
void CheckoutModal;

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
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  titleBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  savedListsLink: { fontSize: 12, color: colors.primaryDark, fontWeight: "700", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  saveListBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  saveListBtnTxt: { color: colors.primaryDark, fontWeight: "800", fontSize: 12 },
  clearTxt: { color: colors.danger, fontWeight: "700", fontSize: 14 },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 90,
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    ...shadow.pill,
  },
  toastTxt: { color: "#fff", fontSize: 13, fontWeight: "700", flex: 1 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 48, 36, 0.55)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: Platform.OS === "ios" ? 36 : spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  sheetSub: { fontSize: 13, color: colors.textMuted },
  sheetInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 15,
    color: colors.text,
  },
  sheetRow: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: spacing.sm },
  ghostBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  ghostBtnTxt: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    ...shadow.pill,
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  savedName: { fontSize: 15, fontWeight: "800", color: colors.text },
  savedMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  restoreBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  emptySub: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 24 },
  ctaBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaBtnTxt: { color: "#fff", fontWeight: "700" },
  greenCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  greenCardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  greenIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  greenTitle: { fontSize: 16, fontWeight: "800", color: colors.primaryDark },
  greenSub: { fontSize: 12, color: colors.primaryDark, marginTop: 2 },
  greenBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    ...shadow.pill,
  },
  greenBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  rowBrand: { fontSize: 10, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase" },
  rowName: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 2 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  rowPrice: { fontSize: 13, fontWeight: "800", color: colors.text, marginLeft: "auto" },
  swapHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  swapHintTxt: { fontSize: 11, color: colors.primaryDark, fontWeight: "700" },
  cheaperHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  cheaperHintTxt: { fontSize: 11, color: "#92400E", fontWeight: "800", maxWidth: 220 },
  qtyCol: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 4,
    gap: 4,
  },
  qtyBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  qtyValue: { fontWeight: "800", color: colors.primaryDark, fontSize: 13 },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 2 },
  checkoutBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 16,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...shadow.pill,
  },
  checkoutLabel: { color: "#A7F3D0", fontSize: 12, fontWeight: "700" },
  checkoutTotal: { color: "#fff", fontSize: 22, fontWeight: "800" },
  couponsBtn: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 78,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadow.pill,
  },
  couponsBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  couponPanel: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 132,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 8,
    ...shadow.card,
  },
  couponHint: { fontSize: 12, color: colors.textMuted, fontWeight: "700" },
  couponLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  couponLinkTxt: {
    flex: 1,
    fontSize: 13,
    color: colors.primaryDark,
    fontWeight: "700",
  },
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" },
  modalSub: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: 8 },
  modalStores: {
    marginTop: 10,
    fontSize: 13,
    color: colors.primaryDark,
    textAlign: "center",
    fontWeight: "700",
  },
  modalBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius.pill,
    marginTop: 20,
  },
  modalBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
