// Ownership notice — linked from the Admin dashboard footer.

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, shadow, spacing } from "@/src/theme";

export default function Ownership() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          testID="ownership-back-btn"
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primaryDark} />
        </Pressable>
        <Text style={styles.headerTitle}>Ownership & Credits</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBubble}>
          <Ionicons name="leaf" size={36} color={colors.primaryDark} />
        </View>

        <Text style={styles.appName}>Green Cart Save</Text>
        <Text style={styles.tagline}>Shop greener, save the planet.</Text>

        <View style={styles.card} testID="ownership-card">
          <Text style={styles.cardLabel}>Created by</Text>
          <Text style={styles.cardName}>Ardra Vanessa Spector</Text>
          <View style={styles.divider} />
          <Text style={styles.cardBody}>
            This application — including its design, source code, branding,
            sponsored-placement system, and product catalog — was created by{" "}
            <Text style={styles.bold}>Ardra Vanessa Spector</Text>, who holds
            full ownership and all intellectual-property rights to it.
          </Text>
          <Text style={styles.cardBody}>
            All trademarks of grocery retailers (Trader Joe's, ShopRite, A&P,
            Kings, Whole Foods, Wegmans, Aldi, Costco, Target) and product
            brands referenced in the catalog remain the property of their
            respective owners and are used here for illustrative purposes.
          </Text>
        </View>

        <View style={styles.footerBlock}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primaryDark} />
          <Text style={styles.footerTxt}>
            © {new Date().getFullYear()} Ardra Vanessa Spector. All rights reserved.
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
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: "center",
  },
  heroBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  appName: { fontSize: 28, fontWeight: "800", color: colors.text },
  tagline: {
    fontSize: 14,
    color: colors.primaryDark,
    fontWeight: "600",
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow.card,
  },
  cardLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardName: { fontSize: 22, fontWeight: "800", color: colors.primaryDark },
  divider: { height: 1, backgroundColor: colors.border },
  cardBody: { fontSize: 14, lineHeight: 22, color: colors.text },
  bold: { fontWeight: "800" },
  footerBlock: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerTxt: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
});
