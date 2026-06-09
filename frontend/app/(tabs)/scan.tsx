import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { findByBarcode, PRODUCTS } from "@/src/data/products";
import { ProductImage } from "@/src/components/ProductImage";
import { useCart } from "@/src/store/cart";
import { colors, radius, shadow, spacing } from "@/src/theme";

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [notFound, setNotFound] = useState<string | null>(null);
  const router = useRouter();
  const { add } = useCart();
  const lastScanRef = useRef<number>(0);

  const handleCode = useCallback(
    (code: string) => {
      const now = Date.now();
      if (now - lastScanRef.current < 1500) return; // debounce repeat scans
      lastScanRef.current = now;

      const product = findByBarcode(code);
      if (product) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        add(product.id);
        setNotFound(null);
        setLastScan(product.id);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setNotFound(code);
        setLastScan(null);
      }
    },
    [add],
  );

  const onManualSubmit = () => {
    if (!manualCode.trim()) return;
    handleCode(manualCode.trim());
    setManualCode("");
  };

  // ---- Permission states ----
  if (!permission) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.title}>Loading camera...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.permWrap}>
          <View style={styles.permIcon}>
            <Ionicons name="scan" size={48} color={colors.primaryDark} />
          </View>
          <Text style={styles.title}>Scan barcodes on the go</Text>
          <Text style={styles.subtitle}>
            We use your camera only to read product barcodes. Nothing is recorded
            or stored.
          </Text>
          {permission.canAskAgain ? (
            <Pressable
              testID="grant-camera-btn"
              onPress={requestPermission}
              style={styles.primaryBtn}
            >
              <Ionicons name="camera" size={18} color="#fff" />
              <Text style={styles.primaryBtnTxt}>Allow camera</Text>
            </Pressable>
          ) : (
            <Pressable
              testID="open-settings-btn"
              onPress={() => Linking.openSettings()}
              style={styles.primaryBtn}
            >
              <Ionicons name="settings" size={18} color="#fff" />
              <Text style={styles.primaryBtnTxt}>Open settings</Text>
            </Pressable>
          )}

          <View style={styles.manualBlock}>
            <Text style={styles.manualLabel}>Or enter barcode manually</Text>
            <View style={styles.manualRow}>
              <TextInput
                testID="manual-barcode-input"
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="e.g. 0000000002"
                placeholderTextColor={colors.textMuted}
                style={styles.manualInput}
                keyboardType="number-pad"
              />
              <Pressable
                testID="manual-barcode-submit"
                onPress={onManualSubmit}
                style={styles.manualBtn}
              >
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.hint}>
              Try one of the sample codes from the Shop tab.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const scanned = lastScan ? PRODUCTS.find((p) => p.id === lastScan) : undefined;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Scan a barcode</Text>
        <Pressable
          testID="open-cart-from-scan"
          onPress={() => router.push("/(tabs)/cart")}
          style={styles.headerBtn}
        >
          <Ionicons name="basket" size={20} color={colors.primaryDark} />
        </Pressable>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"],
          }}
          onBarcodeScanned={(r) => handleCode(r.data)}
        />
        <View pointerEvents="none" style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      <View style={styles.footer}>
        {scanned ? (
          <View style={styles.resultCard} testID="scan-result-card">
            <View style={[styles.resultEmoji, { backgroundColor: scanned.color }]}>
              <ProductImage product={scanned} fontSize={32} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultBrand}>{scanned.brand}</Text>
              <Text style={styles.resultName} numberOfLines={1}>{scanned.name}</Text>
              <Text style={styles.resultMeta}>Added • ${scanned.price.toFixed(2)}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
          </View>
        ) : notFound ? (
          <View style={[styles.resultCard, styles.notFoundCard]} testID="scan-not-found">
            <Ionicons name="alert-circle" size={28} color={colors.danger} />
            <Text style={styles.notFoundTxt}>No product for code {notFound}</Text>
          </View>
        ) : (
          <Text style={styles.hint}>Point your camera at a barcode</Text>
        )}

        <View style={styles.manualRowInline}>
          <TextInput
            testID="manual-barcode-input"
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="Or type barcode (e.g. 0000000002)"
            placeholderTextColor={colors.textMuted}
            style={styles.manualInputInline}
            keyboardType="number-pad"
          />
          <Pressable
            testID="manual-barcode-submit"
            onPress={onManualSubmit}
            style={styles.manualBtn}
          >
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: 8, paddingHorizontal: 24 },
  cameraWrap: {
    marginHorizontal: spacing.lg,
    aspectRatio: 1,
    backgroundColor: "#000",
    borderRadius: radius.xl,
    overflow: "hidden",
    position: "relative",
  },
  viewfinder: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 40, height: 40, borderColor: colors.primary, borderWidth: 4 },
  cornerTL: { top: 24, left: 24, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 16 },
  cornerTR: { top: 24, right: 24, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 16 },
  cornerBL: { bottom: 24, left: 24, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 16 },
  cornerBR: { bottom: 24, right: 24, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 16 },
  footer: { padding: spacing.lg, gap: spacing.md },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadow.card,
  },
  notFoundCard: { backgroundColor: "#FEF2F2" },
  notFoundTxt: { color: colors.danger, fontWeight: "700", fontSize: 14, flex: 1 },
  resultEmoji: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  resultBrand: { fontSize: 10, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  resultName: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 2 },
  resultMeta: { fontSize: 12, color: colors.primaryDark, fontWeight: "600", marginTop: 2 },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  manualRowInline: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    alignItems: "center",
    height: 52,
    gap: spacing.sm,
    ...shadow.card,
  },
  manualInputInline: { flex: 1, fontSize: 14, color: colors.text },
  manualBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  permWrap: { flex: 1, padding: spacing.lg, alignItems: "center", paddingTop: 64 },
  permIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 28,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  manualBlock: { marginTop: 40, width: "100%" },
  manualLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 8, textAlign: "center" },
  manualRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    alignItems: "center",
    height: 52,
    gap: spacing.sm,
    ...shadow.card,
  },
  manualInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: Platform.OS === "ios" ? 14 : 8,
  },
});
