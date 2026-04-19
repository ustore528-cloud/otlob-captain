/**
 * Captain app — white-first UI with supporting neutrals, premium accent, and semantic status hues.
 * RTL-friendly; use tokens instead of raw hex in components.
 */
export const homeTheme = {
  /** Primary screen background — white base */
  bg: "#FFFFFF",
  /** Slightly off-white for layered scroll areas / alternation */
  bgSubtle: "#F5F6FA",
  /** Pure cards / sheets on top of gray */
  cardWhite: "#FFFFFF",
  /** Light gray surfaces (chips, secondary blocks) */
  surface: "#EEF1F6",
  /** Slightly stronger gray for elevated rows / inputs */
  surfaceElevated: "#E4E8F0",
  border: "rgba(15, 23, 42, 0.10)",
  borderStrong: "rgba(176, 36, 50, 0.28)",
  /** Primary readable body */
  text: "#171A1F",
  textMuted: "#4B5563",
  textSubtle: "#6B7280",
  /** Premium accent — primary buttons, links, key highlights */
  accent: "#B02432",
  accentSoft: "rgba(176, 36, 50, 0.12)",
  accentMuted: "rgba(176, 36, 50, 0.22)",
  /**
   * Warm amber — active / in-progress / attention (not error).
   * Kept as `gold*` names for existing imports; values are amber-toned.
   */
  gold: "#B45309",
  goldSoft: "rgba(180, 83, 9, 0.15)",
  goldMuted: "rgba(180, 83, 9, 0.38)",
  /** Text/icons on primary buttons */
  onAccent: "#FFFFFF",
  inputBg: "#F8F9FC",
  inputBorder: "rgba(15, 23, 42, 0.12)",
  /** Bottom tab bar — light, not heavy cream */
  tabBarBg: "#FFFFFF",
  tabBarBorder: "rgba(15, 23, 42, 0.07)",
  tabBarActive: "#B02432",
  tabBarInactive: "#8B9099",
  /** Success / delivered — green, distinct from amber in-progress */
  success: "#166A4F",
  successSoft: "rgba(22, 106, 79, 0.13)",
  successBorder: "rgba(22, 106, 79, 0.32)",
  successText: "#145A42",
  /** Warning label (non-destructive) */
  warning: "#B45309",
  /** Urgent / destructive / cancelled — use sparingly */
  danger: "#B91C1C",
  dangerSoft: "rgba(185, 28, 28, 0.10)",
  dangerBorder: "rgba(185, 28, 28, 0.30)",
  dangerText: "#9B1C1C",
  dangerTextLight: "#D4A0A0",
  cardHeaderTint: "rgba(176, 36, 50, 0.06)",
  neutralSoft: "rgba(15, 23, 42, 0.06)",
  radiusLg: 20,
  radiusMd: 14,
} as const;
