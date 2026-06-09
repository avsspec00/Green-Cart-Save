import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { EcoBadge } from "@/src/components/EcoBadge";
import { ProductImage } from "@/src/components/ProductImage";
import { getGreenAlternative, Product } from "@/src/data/products";
import { useCart } from "@/src/store/cart";
import { usePriceOf } from "@/src/store/prices";
import { colors, radius, shadow, spacing } from "@/src/theme";

export function ProductCard({ product, isSponsored }: { product: Product; isSponsored?: boolean }) {
  const { items, add, remove } = useCart();
  const priceOf = usePriceOf();
  const qty = items[product.id] ?? 0;
  const alt = getGreenAlternative(product.id);
  const hasGreener = !!alt;
  const price = priceOf(product.id, product.price);

  return (
    <View testID={`product-card-${product.id}`} style={styles.card}>
      <View style={[styles.image, { backgroundColor: product.color }]}>
        <ProductImage product={product} fontSize={56} />
        <View style={styles.badgeWrap}>
          <EcoBadge score={product.ecoScore} testID={`badge-${product.id}`} />
        </View>
        {isSponsored && (
          <View style={styles.sponsoredTag} testID={`sponsored-tag-${product.id}`}>
            <Ionicons name="star" size={10} color="#92400E" />
            <Text style={styles.sponsoredTxt}>Sponsored</Text>
          </View>
        )}
        {hasGreener && !isSponsored && (
          <View style={styles.greenerTag} testID={`greener-tag-${product.id}`}>
            <Ionicons name="leaf" size={11} color="#fff" />
            <Text style={styles.greenerTxt}>Greener swap</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.brand} numberOfLines={1}>{product.brand}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.row}>
          <Text style={styles.price}>${price.toFixed(2)}</Text>
          {qty === 0 ? (
            <TouchableOpacity
              testID={`add-btn-${product.id}`}
              onPress={() => add(product.id)}
              style={styles.addBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.qtyRow}>
              <TouchableOpacity
                testID={`minus-btn-${product.id}`}
                onPress={() => remove(product.id)}
                style={styles.qtyBtn}
              >
                <Ionicons name="remove" size={16} color={colors.primaryDark} />
              </TouchableOpacity>
              <Text testID={`qty-${product.id}`} style={styles.qtyTxt}>{qty}</Text>
              <TouchableOpacity
                testID={`plus-btn-${product.id}`}
                onPress={() => add(product.id)}
                style={styles.qtyBtn}
              >
                <Ionicons name="add" size={16} color={colors.primaryDark} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
    flex: 1,
    ...shadow.card,
  },
  image: {
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  emoji: { fontSize: 44, opacity: 0 },
  badgeWrap: { position: "absolute", top: 8, left: 8 },
  greenerTag: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  greenerTxt: { color: "#fff", fontSize: 9, fontWeight: "700" },
  sponsoredTag: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#FEF3C7",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#FBBF24",
  },
  sponsoredTxt: { color: "#92400E", fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  body: { padding: 10, gap: 2 },
  brand: { fontSize: 10, color: colors.textMuted, fontWeight: "600", letterSpacing: 0.3, textTransform: "uppercase" },
  name: { fontSize: 12, fontWeight: "700", color: colors.text, minHeight: 30 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  price: { fontSize: 15, fontWeight: "800", color: colors.text },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 3,
    height: 28,
    gap: 4,
  },
  qtyBtn: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  qtyTxt: { fontSize: 12, fontWeight: "700", color: colors.primaryDark, minWidth: 12, textAlign: "center" },
});
