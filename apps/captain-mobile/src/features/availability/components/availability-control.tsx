import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { CaptainAvailabilityStatus } from "@/services/api/dto";
import { homeTheme } from "@/features/home/theme";
import { AVAILABILITY_ORDER, availabilityHint, availabilityLabel } from "../labels";

const icons: Record<CaptainAvailabilityStatus, ComponentProps<typeof Ionicons>["name"]> = {
  AVAILABLE: "checkmark-circle-outline",
  OFFLINE: "moon-outline",
  BUSY: "time-outline",
  ON_DELIVERY: "paper-plane-outline",
};

export type AvailabilityControlProps = {
  /** الحالة المعروضة — يُفضَّل ربطها بـ GET /me أو Zustand بعد التحديث التفاؤلي */
  value: CaptainAvailabilityStatus;
  pending?: boolean;
  disabled?: boolean;
  onChange: (next: CaptainAvailabilityStatus) => void;
  /** عنوان القسم */
  title?: string;
  subtitle?: string;
  /** وضع مدمج لشريط جانبي أو إعدادات */
  compact?: boolean;
};

/**
 * اختيار حالة التوفر — قابل لإعادة الاستخدام (Home، الملف الشخصي، إلخ).
 */
export function AvailabilityControl({
  value,
  pending = false,
  disabled = false,
  onChange,
  title = "حالة التوفر",
  subtitle = "يتحكم ظهورك في التوزيع والعروض الجديدة",
  compact = false,
}: AvailabilityControlProps) {
  const blocked = pending || disabled;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? (
        <Text style={styles.sub} numberOfLines={compact ? 2 : undefined}>
          {subtitle}
        </Text>
      ) : null}
      <View style={[styles.grid, compact && styles.gridCompact]}>
        {AVAILABILITY_ORDER.map((key) => {
          const active = value === key;
          return (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.option,
                compact && styles.optionCompact,
                active && styles.optionActive,
                pressed && !blocked && styles.optionPressed,
                blocked && styles.optionBlocked,
              ]}
              onPress={() => {
                if (!blocked && !active) onChange(key);
              }}
              disabled={blocked}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: blocked }}
              accessibilityLabel={`${availabilityLabel[key]}. ${availabilityHint[key]}`}
            >
              <View style={styles.optionRow}>
                <Ionicons
                  name={icons[key]}
                  size={compact ? 20 : 22}
                  color={active ? homeTheme.accent : homeTheme.textMuted}
                />
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                    {availabilityLabel[key]}
                  </Text>
                  {!compact ? (
                    <Text style={styles.optionHint} numberOfLines={2}>
                      {availabilityHint[key]}
                    </Text>
                  ) : null}
                </View>
                {active ? (
                  pending ? (
                    <ActivityIndicator size="small" color={homeTheme.accent} />
                  ) : (
                    <Ionicons name="checkmark-circle" size={22} color={homeTheme.accent} />
                  )
                ) : (
                  <View style={styles.radioOuter}>
                    <View style={styles.radioInner} />
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    padding: 18,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  title: {
    color: homeTheme.text,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 4,
  },
  sub: {
    color: homeTheme.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    marginBottom: 14,
  },
  grid: { gap: 10 },
  gridCompact: { gap: 8 },
  option: {
    borderRadius: homeTheme.radiusMd,
    borderWidth: 1,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.surface,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  optionCompact: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  optionActive: {
    borderColor: homeTheme.borderStrong,
    backgroundColor: homeTheme.accentSoft,
  },
  optionPressed: { opacity: 0.92 },
  optionBlocked: { opacity: 0.65 },
  optionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  optionText: { flex: 1, alignItems: "flex-end" },
  optionTitle: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  optionTitleActive: { color: homeTheme.accent },
  optionHint: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    textAlign: "right",
    marginTop: 2,
    lineHeight: 18,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: homeTheme.textSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "transparent" },
});
