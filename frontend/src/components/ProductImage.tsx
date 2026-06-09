// ProductImage — renders the product photo and falls back to the emoji
// graphic on a single colored tile if the network image fails to load.
// Always fills its parent; parent decides size & background color.

import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Product } from "@/src/data/products";

export function ProductImage({
  product,
  fontSize = 32,
}: {
  product: Product;
  fontSize?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !product.image) {
    return (
      <View style={styles.fallback} testID={`product-image-fallback-${product.id}`}>
        <Text style={{ fontSize }}>{product.emoji}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: product.image }}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      transition={200}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
