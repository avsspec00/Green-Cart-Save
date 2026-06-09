import { StyleSheet, Text, View } from "react-native";

import { colors, radius, scoreStyle } from "@/src/theme";

export function EcoBadge({ score, testID }: { score: "A" | "B" | "C" | "D"; testID?: string }) {
  const s = scoreStyle(score);
  return (
    <View
      testID={testID}
      style={[styles.badge, { backgroundColor: s.bg }]}
    >
      <View style={[styles.dot, { backgroundColor: s.fg }]} />
      <Text style={[styles.text, { color: s.fg }]}>Eco {score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 6,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  _: { color: colors.text },
});
