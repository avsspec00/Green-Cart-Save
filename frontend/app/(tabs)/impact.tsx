import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  findProduct,
  getGreenAlternative,
  PRODUCTS,
} from "@/src/data/products";
import { ProductImage } from "@/src/components/ProductImage";
import { useCart } from "@/src/store/cart";
import { colors, radius, shadow, spacing } from "@/src/theme";

export default function Impact() {
  const router = useRouter();
  const { items, co2Total, plasticCount, itemCount, total } = useCart();

  // Stats for the current cart
  const stats = useMemo(() => {
    let organic = 0;
    let local = 0;
    let plant = 0;
    let aCount = 0;
    let potentialSave = 0;

    for (const [id, qty] of Object.entries(items)) {
      const p = findProduct(id);
      if (!p) continue;
      if (p.organic) organic += qty;
      if (p.local) local += qty;
      if (p.plantBased) plant += qty;
      if (p.ecoScore === "A") aCount += qty;
      const alt = getGreenAlternative(id);
      if (alt) potentialSave += (p.co2Kg - alt.co2Kg) * qty;
    }
    return { organic, local, plant, aCount, potentialSave };
  }, [items]);

  // Rough scoring: more A's & swaps already done = higher %
  const greenScore = useMemo(() => {
    if (itemCount === 0) return 0;
    const ratio = stats.aCount / itemCount;
    return Math.round(ratio * 100);
  }, [stats.aCount, itemCount]);

  // Reference: best-in-class products for inspiration
  const tips = PRODUCTS.filter((p) => p.ecoScore === "A").slice(0, 4);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Your eco impact</Text>
            <Text style={styles.subtitle}>Live snapshot of this basket</Text>
          </View>
          <Pressable
            testID="impact-home-logo"
            onPress={() => router.push("/")}
            style={styles.leafBubble}
            hitSlop={8}
          >
            <Ionicons name="cart" size={22} color={colors.primaryDark} />
          </Pressable>
        </View>

        {/* Hero score */}
        <View style={styles.scoreCard} testID="green-score-card">
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreVal}>{greenScore}</Text>
            <Text style={styles.scorePct}>%</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreTitle}>Green Score</Text>
            <Text style={styles.scoreSub}>
              {itemCount === 0
                ? "Add items to see your impact"
                : greenScore >= 70
                ? "Excellent! You're saving the planet 🌍"
                : greenScore >= 40
                ? "Good start — try the Go Green swap"
                : "Lots of room to go greener!"}
            </Text>
          </View>
        </View>

        {/* Stat grid */}
        <View style={styles.gridRow}>
          <View style={[styles.statBox, { backgroundColor: "#ECFDF5" }]}>
            <Ionicons name="cloud" size={22} color={colors.primaryDark} />
            <Text testID="impact-co2" style={styles.statBig}>{co2Total.toFixed(1)} kg</Text>
            <Text style={styles.statLabel}>CO₂ footprint</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: "#FEF3C7" }]}>
            <Ionicons name="trash" size={22} color="#B45309" />
            <Text testID="impact-plastic" style={styles.statBig}>{plasticCount}</Text>
            <Text style={styles.statLabel}>Plastic items</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={[styles.statBox, { backgroundColor: "#F0FDF4" }]}>
            <Ionicons name="leaf" size={22} color={colors.primaryDark} />
            <Text style={styles.statBig}>{stats.organic}</Text>
            <Text style={styles.statLabel}>Organic items</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: "#EFF6FF" }]}>
            <Ionicons name="navigate" size={22} color="#1D4ED8" />
            <Text style={styles.statBig}>{stats.local}</Text>
            <Text style={styles.statLabel}>Locally sourced</Text>
          </View>
        </View>

        {stats.potentialSave > 0 && (
          <View style={styles.opportunity} testID="opportunity-card">
            <View style={styles.opportunityIcon}>
              <Ionicons name="trending-down" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.opportunityTitle}>
                Save {stats.potentialSave.toFixed(1)} kg CO₂
              </Text>
              <Text style={styles.opportunitySub}>
                Try “Swap all greener” in your cart to reach the next level.
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Eco champions 🌿</Text>
        <Text style={styles.sectionSub}>Top-rated products you can stock up on</Text>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {tips.map((p) => (
            <View key={p.id} style={styles.tipRow} testID={`tip-${p.id}`}>
              <View style={[styles.tipThumb, { backgroundColor: p.color }]}>
                <ProductImage product={p} fontSize={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipName}>{p.name}</Text>
                <Text style={styles.tipMeta}>
                  {p.co2Kg.toFixed(1)} kg CO₂ • {p.packaging === "none" ? "no packaging" : p.packaging}
                </Text>
              </View>
              <Text style={styles.tipPrice}>${p.price.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footerInfo}>
          <Text style={styles.footerLabel}>Basket total</Text>
          <Text style={styles.footerTotal}>${total.toFixed(2)}</Text>
          <Text style={styles.footerHint}>
            Estimates are based on average lifecycle data per product type.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  leafBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadow.pill,
  },
  scoreCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  scoreVal: { color: "#fff", fontSize: 30, fontWeight: "800" },
  scorePct: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 6 },
  scoreTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  scoreSub: { color: "#A7F3D0", fontSize: 12, marginTop: 4 },
  gridRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statBox: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  statBig: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 6 },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  opportunity: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: "#FFFBEB",
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  opportunityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  opportunityTitle: { fontSize: 15, fontWeight: "800", color: "#92400E" },
  opportunitySub: { fontSize: 12, color: "#92400E", marginTop: 2 },
  sectionTitle: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  sectionSub: { paddingHorizontal: spacing.lg, color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.md },
  tipRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadow.card,
  },
  tipThumb: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tipName: { fontSize: 14, fontWeight: "700", color: colors.text },
  tipMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  tipPrice: { fontSize: 14, fontWeight: "800", color: colors.text },
  footerInfo: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, alignItems: "center" },
  footerLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  footerTotal: { fontSize: 44, fontWeight: "800", color: colors.text, marginTop: 4 },
  footerHint: { fontSize: 11, color: colors.textMuted, textAlign: "center", marginTop: 8 },
});
