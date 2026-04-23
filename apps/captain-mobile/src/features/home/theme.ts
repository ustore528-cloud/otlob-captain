/**
 * Captain app — white-first UI with supporting neutrals, premium accent, and semantic status hues.
 * RTL-friendly; use tokens instead of raw hex in components.
 */
export const homeTheme = {
  /** Primary screen background — white base */
  bg: "#111318",
  /** Slightly off-white for layered scroll areas / alternation */
  bgSubtle: "#171A21",
  /** Pure cards / sheets on top of gray */
  cardWhite: "#1D222B",
  /** Light gray surfaces (chips, secondary blocks) */
  surface: "#232A35",
  /** Slightly stronger gray for elevated rows / inputs */
  surfaceElevated: "#2B3442",
  border: "rgba(255, 255, 255, 0.10)",
  borderStrong: "rgba(255, 102, 119, 0.38)",
  /** Primary readable body */
  text: "#F7F8FA",
  textMuted: "#D6DAE1",
  textSubtle: "#A7AFBC",
  /** Premium accent — primary buttons, links, key highlights */
  accent: "#F05261",
  accentSoft: "rgba(240, 82, 97, 0.16)",
  accentMuted: "rgba(240, 82, 97, 0.28)",
  /**
   * Warm amber — active / in-progress / attention (not error).
   * Kept as `gold*` names for existing imports; values are amber-toned.
   */
  gold: "#F59E0B",
  goldSoft: "rgba(245, 158, 11, 0.18)",
  goldMuted: "rgba(245, 158, 11, 0.42)",
  /** Text/icons on primary buttons */
  onAccent: "#FFFFFF",
  inputBg: "#171C24",
  inputBorder: "rgba(255, 255, 255, 0.12)",
  /** Bottom tab bar — light, not heavy cream */
  tabBarBg: "#171A21",
  tabBarBorder: "rgba(255, 255, 255, 0.08)",
  tabBarActive: "#F05261",
  tabBarInactive: "#9AA3B2",
  /** Success / delivered — green, distinct from amber in-progress */
  success: "#34D399",
  successSoft: "rgba(52, 211, 153, 0.16)",
  successBorder: "rgba(52, 211, 153, 0.36)",
  successText: "#A7F3D0",
  /** Warning label (non-destructive) */
  warning: "#F59E0B",
  /** Urgent / destructive / cancelled — use sparingly */
  danger: "#F87171",
  dangerSoft: "rgba(248, 113, 113, 0.14)",
  dangerBorder: "rgba(248, 113, 113, 0.36)",
  dangerText: "#FCA5A5",
  dangerTextLight: "#D4A0A0",
  cardHeaderTint: "rgba(240, 82, 97, 0.10)",
  neutralSoft: "rgba(255, 255, 255, 0.07)",
  /**
   * Order status pills (captain list + detail) — one distinct treatment per delivery step.
   * Offer / accepted / picked up / transit use separate hues so states are scannable at a glance.
   */
  statusOfferSoft: "rgba(124, 58, 237, 0.12)",
  statusOfferBorder: "rgba(124, 58, 237, 0.32)",
  statusOfferText: "#C4B5FD",
  statusAcceptedSoft: "rgba(13, 148, 136, 0.12)",
  statusAcceptedBorder: "rgba(13, 148, 136, 0.30)",
  statusAcceptedText: "#99F6E4",
  /** `IN_TRANSIT` — high-salience sky (on the way to customer); stronger than other steps for quick recognition */
  statusTransitSoft: "rgba(14, 165, 233, 0.26)",
  statusTransitBorder: "rgba(2, 132, 199, 0.58)",
  statusTransitText: "#BAE6FD",
  radiusLg: 20,
  radiusMd: 14,
} as const;
