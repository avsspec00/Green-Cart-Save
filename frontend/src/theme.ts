// Central design tokens for GreenCart. Playful eco aesthetic — emerald
// primary, amber playful accent, warm stone backgrounds.

export const colors = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F1",
  text: "#053024",
  textMuted: "#6B7280",
  primary: "#10B981",
  primaryDark: "#047857",
  primaryLight: "#D1FAE5",
  accent: "#F59E0B",
  accentLight: "#FEF3C7",
  danger: "#E11D48",
  border: "#E5E7EB",
  // Eco score badge colors
  scoreA: { bg: "#D1FAE5", fg: "#047857" },
  scoreB: { bg: "#ECFCCB", fg: "#65A30D" },
  scoreC: { bg: "#FEF3C7", fg: "#B45309" },
  scoreD: { bg: "#FECACA", fg: "#B91C1C" },
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pill: {
    shadowColor: "#10B981",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};

export function scoreStyle(s: "A" | "B" | "C" | "D") {
  switch (s) {
    case "A":
      return colors.scoreA;
    case "B":
      return colors.scoreB;
    case "C":
      return colors.scoreC;
    case "D":
      return colors.scoreD;
  }
}
