import { StyleSheet } from "react-native";
import { homeTheme } from "@/features/home/theme";
import { rtlLayout } from "./rtl";

/** أنماط شاشات مشتركة — ألوان من `homeTheme` فقط */
export const screenStyles = StyleSheet.create({
  /** Page shell — soft royal white; cards provide contrast. */
  safe: {
    flex: 1,
    backgroundColor: homeTheme.pageBackground,
    ...rtlLayout,
  },
  /** محتوى قابل للتمرير — يحدّ العرض على الشاشات العريضة */
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  title: {
    color: homeTheme.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "right",
  },
  subtitle: {
    color: homeTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    marginTop: 6,
  },
  centerLoading: {
    flex: 1,
    minHeight: 240,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  muted: {
    color: homeTheme.textMuted,
    fontSize: 14,
  },
  errorBox: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: homeTheme.radiusLg,
    backgroundColor: homeTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: homeTheme.dangerBorder,
    gap: 8,
  },
  errorTitle: {
    color: homeTheme.dangerText,
    fontWeight: "800",
    fontSize: 17,
    textAlign: "center",
  },
  errorBody: {
    color: homeTheme.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    alignSelf: "center",
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: homeTheme.radiusMd,
    backgroundColor: homeTheme.accentSoft,
    borderWidth: 1,
    borderColor: homeTheme.borderStrong,
  },
  retryButtonText: {
    color: homeTheme.accent,
    fontWeight: "800",
    fontSize: 15,
  },
});
