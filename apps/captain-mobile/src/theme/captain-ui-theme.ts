/**
 * captainUiTheme — design tokens للكابتن (مصدر وحيد قبل تطبيق Figma على الشاشات).
 * القيم المعروضة تطابق هوية 2in الحالية؛ عند تصدير Figma Variables استبدِل القيم هنا فقط.
 */
import type { TextStyle } from "react-native";

// -----------------------------------------------------------------------------
// Palette (أساس الهوية: أحمر غامق + ذهبي ثانوي + محايدات)
// -----------------------------------------------------------------------------
export const captainPalette = {
  /** لون أساسي — أزرار وأيقونات نشطة */
  brandRed: "#C62828",
  /** أحمر أغمق — تباين وشريط علوي */
  brandRedDark: "#8E1B1B",
  /** ذهبي — تحذيرات / تمييز ثانوي (محدود على الخلفيات الفاتحة) */
  brandGold: "#D4AF37",
  brandGoldDark: "#A67C00",
  white: "#FFFFFF",
  redTint50: "#FFF3F3",
  goldTint50: "#FFF8E1",
  slate900: "#0F172A",
  slate800: "#1E293B",
  slate600: "#475569",
  slate500: "#64748B",
  slate400: "#94A3B8",
  pageWash: "#FAFBFF",
  surfaceMuted: "#F4F6FB",
  surfaceSubtle: "#FEFEFE",
  borderPink: "#F5CACA",
  borderPinkStrong: "#EAA5A5",
  accentPinkMuted: "#E7A2A2",
  goldMutedSoft: "#E7D28C",
  overlayInk: "#0F172A",
} as const;

// -----------------------------------------------------------------------------
// Spacing (جدول 4pt — للاستخدام في المراحل القادمة عند refactor للشاشات)
// -----------------------------------------------------------------------------
export const captainSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screenHorizontal: 20,
  screenBottom: 28,
  tabBarPaddingTop: 6,
  tabBarIosBottom: 28,
  tabBarAndroidBottom: 10,
} as const;

// -----------------------------------------------------------------------------
// Radius
// -----------------------------------------------------------------------------
export const captainRadius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 9999,
} as const;

// -----------------------------------------------------------------------------
// Shadows / elevation — قيم RN
// -----------------------------------------------------------------------------
export const captainShadows = {
  card: {
    shadowColor: captainPalette.overlayInk,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  } as const,
  tabBarTopIos: {
    shadowColor: captainPalette.overlayInk,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  } as const,
  tabBarTopAndroidElevation: 6 as const,
} as const;

// -----------------------------------------------------------------------------
// Typography — استخدم في المراحل القادمة؛ الشاشات الحالية لم تُرحَّل بعد
// -----------------------------------------------------------------------------
export const captainTypography = {
  screenTitle: { fontSize: 24, fontWeight: "900", lineHeight: 32 } satisfies TextStyle,
  sectionTitle: { fontSize: 18, fontWeight: "800", lineHeight: 26 } satisfies TextStyle,
  cardTitle: { fontSize: 16, fontWeight: "800", lineHeight: 22 } satisfies TextStyle,
  bodyStrong: { fontSize: 16, fontWeight: "600", lineHeight: 24 } satisfies TextStyle,
  body: { fontSize: 15, fontWeight: "400", lineHeight: 22 } satisfies TextStyle,
  caption: { fontSize: 12, fontWeight: "700", lineHeight: 18 } satisfies TextStyle,
  tabLabel: { fontSize: 11, fontWeight: "600" } satisfies TextStyle,
} as const;

/** علامات قديمة — تُستخدم من وحدات خارجية؛ تُعبَّأ من captainPalette */
export const BRAND_COLORS = {
  primary: captainPalette.brandRed,
  primaryDark: captainPalette.brandRedDark,
  accent: captainPalette.brandGold,
  accentDark: captainPalette.brandGoldDark,
  white: captainPalette.white,
  lightPrimary: captainPalette.redTint50,
  lightAccent: captainPalette.goldTint50,
  textDark: captainPalette.slate800,
  border: captainPalette.borderPink,
} as const;

export const BRAND_GRADIENTS = {
  gold: "linear-gradient(135deg, #FFF3B0 0%, #E7C85A 35%, #CFA22B 65%, #A67C00 100%)",
} as const;

/**
 * ثيم مسطح متوافق مع `homeTheme` السابق — كل المفاتيح كما كانت لتفادي كسر الاستيرادات.
 */
export const captainUiTheme = {
  pageBackground: captainPalette.pageWash,
  bg: BRAND_COLORS.white,
  bgSubtle: captainPalette.surfaceMuted,
  cardWhite: BRAND_COLORS.white,
  surface: captainPalette.surfaceSubtle,
  surfaceElevated: BRAND_COLORS.white,
  border: BRAND_COLORS.border,
  borderStrong: captainPalette.borderPinkStrong,
  text: BRAND_COLORS.textDark,
  textMuted: captainPalette.slate600,
  textSubtle: captainPalette.slate500,
  accent: BRAND_COLORS.primary,
  accentSoft: BRAND_COLORS.lightPrimary,
  accentMuted: captainPalette.accentPinkMuted,
  gold: BRAND_COLORS.accent,
  goldSoft: BRAND_COLORS.lightAccent,
  goldMuted: captainPalette.goldMutedSoft,
  onAccent: BRAND_COLORS.white,
  inputBg: BRAND_COLORS.white,
  inputBorder: BRAND_COLORS.border,
  tabBarBg: BRAND_COLORS.white,
  tabBarBorder: BRAND_COLORS.border,
  tabBarActive: BRAND_COLORS.primary,
  tabBarInactive: captainPalette.slate400,
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
  cardShadow: captainShadows.card,
  statusOfferSoft: "#FDF4FF",
  statusOfferBorder: "#E9D5FF",
  statusOfferText: "#7E22CE",
  statusAcceptedSoft: "#ECFEFF",
  statusAcceptedBorder: "#A5F3FC",
  statusAcceptedText: "#0F766E",
  statusTransitSoft: "#EFF6FF",
  statusTransitBorder: "#BFDBFE",
  statusTransitText: "#1D4ED8",
  radiusLg: captainRadius.lg,
  radiusMd: captainRadius.md,
  tabBarIosShadow: captainShadows.tabBarTopIos,
  tabBarAndroidElevation: captainShadows.tabBarTopAndroidElevation,
} as const;

/** أسماء قديمة — نفس مرجع الكائن لتفادي تعقيم المقارنة */
export const homeTheme = captainUiTheme;
export const appTheme = captainUiTheme;

export type CaptainUiTheme = typeof captainUiTheme;
