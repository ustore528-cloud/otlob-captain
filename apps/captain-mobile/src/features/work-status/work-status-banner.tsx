import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useCaptainWorkStatus } from "@/hooks/api/use-captain-work-status";
import { homeTheme } from "@/features/home/theme";
import { WORK_STATUS_PALETTE } from "./work-status-palette";

/**
 * Lightweight full-width strip — first row under safe area on each screen that mounts it.
 * Same data as admin «تنبيه سريع عن حالة الشغل».
 */
export function WorkStatusBanner() {
  const { t } = useTranslation();
  const { data, isError } = useCaptainWorkStatus();

  if (isError || !data || !data.active) {
    return null;
  }

  const palette = WORK_STATUS_PALETTE[data.code] ?? WORK_STATUS_PALETTE.PRESSURE;

  return (
    <View
      style={[styles.wrap, { backgroundColor: palette.bg, borderColor: palette.border }]}
      accessibilityRole="alert"
      accessibilityLabel={t("workStatus.a11yLabel", { label: data.label })}
    >
      <Ionicons name={palette.icon} size={18} color={palette.text} style={styles.icon} />
      <Text style={[styles.text, { color: palette.text }]} numberOfLines={3}>
        {data.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  icon: { marginTop: 0 },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 19,
  },
});
