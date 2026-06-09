import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCart } from "@/src/store/cart";
import { colors } from "@/src/theme";

function CartIcon({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  const { itemCount } = useCart();
  return (
    <View>
      <Ionicons name={focused ? "basket" : "basket-outline"} size={size} color={color} />
      {itemCount > 0 && (
        <View style={styles.badge} testID="cart-tab-badge">
          <Text style={styles.badgeTxt}>{itemCount}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Lift the bar above the home indicator (iOS) and the gesture pill /
  // 3-button nav (Android). Use the system insets with a small buffer so
  // labels are never clipped on Google Pixel or Samsung devices either.
  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 16 : 12);
  const tabHeight = 56 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: "#FFFFFF",
          height: tabHeight,
          paddingTop: 8,
          paddingBottom: bottomPad,
          shadowColor: "#10B981",
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          elevation: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen
        name="shop"
        options={{
          // Keep the screen mounted (index route) but hide it from the bar.
          href: null,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "scan" : "scan-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: CartIcon,
        }}
      />
      <Tabs.Screen
        name="impact"
        options={{
          title: "Impact",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "earth" : "earth-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "briefcase" : "briefcase-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: colors.accent,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
