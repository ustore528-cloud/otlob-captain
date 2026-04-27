export const BRAND_COLORS = {
  primary: "#C62828",
  primaryDark: "#8E1B1B",
  accent: "#D4AF37",
  accentDark: "#A67C00",
  white: "#FFFFFF",
  lightPrimary: "#FFF3F3",
  lightAccent: "#FFF8E1",
  textDark: "#1E293B",
  border: "#F5CACA",
} as const;

export const BRAND_GRADIENTS = {
  gold: "linear-gradient(135deg, #FFF3B0 0%, #E7C85A 35%, #CFA22B 65%, #A67C00 100%)",
} as const;

/**
 * 2in mobile theme mapped to existing token names so components stay unchanged.
 */
/** App shell — clean royal / soft white (avoid heavy gray page fills). */
export const homeTheme = {
  /** Full-screen page behind cards */
  pageBackground: "#FAFBFF",
  bg: BRAND_COLORS.white,
  bgSubtle: "#F4F6FB",
  cardWhite: BRAND_COLORS.white,
  surface: "#FEFEFE",
  surfaceElevated: BRAND_COLORS.white,
  border: BRAND_COLORS.border,
  borderStrong: "#EAA5A5",
  text: BRAND_COLORS.textDark,
  textMuted: "#475569",
  textSubtle: "#64748B",
  accent: BRAND_COLORS.primary,
  accentSoft: BRAND_COLORS.lightPrimary,
  accentMuted: "#E7A2A2",
  gold: BRAND_COLORS.accent,
  goldSoft: BRAND_COLORS.lightAccent,
  goldMuted: "#E7D28C",
  onAccent: BRAND_COLORS.white,
  inputBg: BRAND_COLORS.white,
  inputBorder: BRAND_COLORS.border,
  tabBarBg: BRAND_COLORS.white,
  tabBarBorder: BRAND_COLORS.border,
  tabBarActive: BRAND_COLORS.primary,
  tabBarInactive: "#94A3B8",
  success: "#15803D",
  successSoft: "#ECFDF3",
  successBorder: "#86EFAC",
  successText: "#166534",
  warning: BRAND_COLORS.accentDark,
  danger: "#B91C1C",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
  dangerText: "#991B1B",
  dangerTextLight: "#7F1D1D",
  cardHeaderTint: "#FCE8E8",
  neutralSoft: "#F3F5FA",
  /** Subtle card elevation — iOS shadow + Android elevation */
  cardShadow: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  } as const,
  statusOfferSoft: "#FDF4FF",
  statusOfferBorder: "#E9D5FF",
  statusOfferText: "#7E22CE",
  statusAcceptedSoft: "#ECFEFF",
  statusAcceptedBorder: "#A5F3FC",
  statusAcceptedText: "#0F766E",
  statusTransitSoft: "#EFF6FF",
  statusTransitBorder: "#BFDBFE",
  statusTransitText: "#1D4ED8",
  radiusLg: 20,
  radiusMd: 14,
} as const;
