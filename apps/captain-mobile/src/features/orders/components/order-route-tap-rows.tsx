import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { homeTheme } from "@/features/home/theme";
import { ORDER_DROPOFF_LOCATION_LABEL, ORDER_PICKUP_LOCATION_LABEL } from "@/lib/order-location-labels";
import { openMapSearch } from "@/lib/open-external";

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  compact?: boolean;
};

function LocationTapRow({ icon, label, value, compact }: RowProps) {
  const v = value.trim();
  if (!v) return null;
  return (
    <Pressable
      onPress={() => void openMapSearch(v)}
      style={({ pressed }) => [styles.row, compact && styles.rowCompact, pressed && styles.pressed]}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${v}`}
      accessibilityHint="فتح الخريطة"
    >
      <Ionicons name={icon} size={compact ? 15 : 18} color={homeTheme.accent} />
      <View style={styles.textCol}>
        <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
        <Text style={[styles.value, compact && styles.valueCompact]} numberOfLines={compact ? 1 : 4}>
          {v}
        </Text>
      </View>
    </Pressable>
  );
}

type Props = {
  pickupAddress: string;
  dropoffAddress: string;
  /** إذا كان العنوان الفارغ — عرض المنطقة كاحتياطي للتسليم */
  areaFallback?: string;
  /** أقل ارتفاعًا — قوائم متعددة على الشاشة */
  compact?: boolean;
};

export function OrderRouteTapRows({ pickupAddress, dropoffAddress, areaFallback, compact }: Props) {
  const drop = dropoffAddress.trim() || areaFallback?.trim() || "";
  return (
    <View style={[styles.block, compact && styles.blockCompact]}>
      <LocationTapRow
        icon="arrow-up-circle-outline"
        label={ORDER_PICKUP_LOCATION_LABEL}
        value={pickupAddress}
        compact={compact}
      />
      <LocationTapRow icon="flag-outline" label={ORDER_DROPOFF_LOCATION_LABEL} value={drop} compact={compact} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  blockCompact: { gap: 3 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: homeTheme.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.neutralSoft,
  },
  rowCompact: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 6,
  },
  pressed: { opacity: 0.9 },
  textCol: { flex: 1, alignItems: "flex-end" },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: homeTheme.accent,
    textAlign: "right",
    marginBottom: 4,
  },
  labelCompact: {
    fontSize: 9,
    marginBottom: 2,
  },
  value: {
    fontSize: 13,
    color: homeTheme.text,
    lineHeight: 20,
    textAlign: "right",
    fontWeight: "600",
    textDecorationLine: "underline",
    textDecorationColor: homeTheme.accentMuted,
  },
  valueCompact: {
    fontSize: 11,
    lineHeight: 16,
  },
});
