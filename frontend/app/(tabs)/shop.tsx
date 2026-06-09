import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProductCard } from "@/src/components/ProductCard";
import { CATEGORIES, Category, PRODUCTS, STORES } from "@/src/data/products";
import { useCart } from "@/src/store/cart";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { ActiveSponsorship, fetchActiveSponsorships } from "@/src/utils/api";

type Filter = "All" | Category;

export default function Shop() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("All");
  const [store, setStore] = useState<string>("All");
  const [sponsored, setSponsored] = useState<ActiveSponsorship[]>([]);
  const { itemCount, total } = useCart();

  // Refresh sponsorship rankings every time the Shop tab is focused.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchActiveSponsorships().then((rows) => {
        if (!cancelled) setSponsored(rows);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const sponsoredBidById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sponsored) {
      // Keep the highest bid if multiple advertisers compete for one product.
      map[s.product_id] = Math.max(map[s.product_id] ?? 0, s.bid_cents);
    }
    return map;
  }, [sponsored]);

  const filtered = useMemo(() => {
    const matched = PRODUCTS.filter((p) => {
      if (filter !== "All" && p.category !== filter) return false;
      if (store !== "All" && p.brand !== store) return false;
      return true;
    });
    // Sponsored placements first (by bid desc), then organic results in
    // catalog order. Stable sort via index.
    return matched
      .map((p, idx) => ({ p, idx, bid: sponsoredBidById[p.id] ?? 0 }))
      .sort((a, b) => {
        if (a.bid !== b.bid) return b.bid - a.bid;
        return a.idx - b.idx;
      })
      .map(({ p }) => p);
  }, [filter, store, sponsoredBidById]);

  const chips: Filter[] = ["All", ...CATEGORIES];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hello}>Hey there, let&apos;s start saving 👋</Text>
            <Text style={styles.title}>Green Cart Save</Text>
            <Text style={styles.tagline}>Cheap, healthy, and going green</Text>
          </View>
          <View style={styles.leafBubble}>
            <Ionicons name="cart" size={22} color={colors.primaryDark} />
          </View>
        </View>

        <Text style={styles.rowLabel}>Pick the store:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRowContent}
          style={styles.storeChipRow}
        >
          {["All", ...STORES].map((s) => {
            const active = store === s;
            return (
              <Pressable
                key={s}
                testID={`store-chip-${s}`}
                onPress={() => setStore(s)}
                style={[styles.storeChip, active && styles.storeChipActive]}
              >
                <Text style={[styles.storeChipTxt, active && styles.storeChipTxtActive]}>
                  {s === "All" ? "All stores" : s}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.rowLabel}>Create your shopping list:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRowContent}
          style={styles.chipRow}
        >
          {chips.map((c) => {
            const active = filter === c;
            return (
              <Pressable
                key={c}
                testID={`chip-${c}`}
                onPress={() => setFilter(c)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.scrollHint}>
          <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
        </View>
      </View>

      <FlatList
        testID="products-grid"
        data={filtered}
        keyExtractor={(it) => it.id}
        numColumns={3}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: spacing.lg }}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <ProductCard product={item} isSponsored={!!sponsoredBidById[item.id]} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTxt}>No products found</Text>
          </View>
        }
      />

      {itemCount > 0 && (
        <Pressable
          testID="floating-cart-cta"
          onPress={() => router.push("/(tabs)/cart")}
          style={styles.cartCta}
        >
          <View style={styles.cartCtaLeft}>
            <View style={styles.cartCtaBadge}>
              <Text style={styles.cartCtaBadgeTxt}>{itemCount}</Text>
            </View>
            <Text style={styles.cartCtaLabel}>View cart</Text>
          </View>
          <Text style={styles.cartCtaTotal}>${total.toFixed(2)}</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerWrap: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  headerRow: {
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hello: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginTop: 2 },
  tagline: { fontSize: 13, color: colors.primaryDark, fontWeight: "600", marginTop: 2 },
  leafBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 48,
    ...shadow.card,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingLeft: 35,
    paddingRight: spacing.lg,
    marginTop: 6,
  },
  rowLabel: {
    marginTop: spacing.md,
    paddingLeft: 35,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: { marginTop: spacing.md, height: 44 },
  chipRowContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  categoryRowContent: { paddingHorizontal: spacing.lg, gap: 4 },
  scrollHint: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    marginTop: 2,
    marginBottom: -2,
  },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 13, fontWeight: "700", color: colors.text },
  chipTxtActive: { color: "#fff" },
  storeChipRow: { marginTop: spacing.sm, height: 36 },
  storeChip: {
    flexShrink: 0,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  storeChipActive: { backgroundColor: colors.primaryDark },
  storeChipTxt: { fontSize: 11, fontWeight: "700", color: colors.primaryDark },
  storeChipTxtActive: { color: "#fff" },
  listContent: { paddingBottom: 120, paddingTop: spacing.sm },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTxt: { color: colors.textMuted, fontSize: 14 },
  cartCta: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 16,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadow.pill,
  },
  cartCtaLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  cartCtaBadge: {
    backgroundColor: "#fff",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cartCtaBadgeTxt: { color: colors.primaryDark, fontWeight: "800", fontSize: 12 },
  cartCtaLabel: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cartCtaTotal: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
