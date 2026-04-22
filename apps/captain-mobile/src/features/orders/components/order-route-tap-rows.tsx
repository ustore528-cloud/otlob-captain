import { Pressable, StyleSheet, Text, View } from "react-native";
import { homeTheme } from "@/features/home/theme";
import { ORDER_DROPOFF_LOCATION_LABEL, ORDER_PICKUP_LOCATION_LABEL } from "@/lib/order-location-labels";
import { openMapSearch } from "@/lib/open-external";

type RowProps = {
  label: string;
  value: string;
  tone?: "pickup" | "dropoff";
  compact?: boolean;
  dense?: boolean;
};

function LocationTapRow({ label, value, tone = "pickup", compact, dense }: RowProps) {
  const v = value.trim();
  if (!v) return null;
  const pickupTone = tone === "pickup";
  return (
    <Pressable
      onPress={() => void openMapSearch(v)}
      style={({ pressed }) => [
        styles.row,
        pickupTone ? styles.rowPickup : styles.rowDropoff,
        compact && styles.rowCompact,
        dense && styles.rowDense,
        pressed && styles.pressed,
      ]}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${v}`}
      accessibilityHint="فتح الخريطة"
    >
      <View style={styles.textCol}>
        <Text style={[styles.label, compact && styles.labelCompact, dense && styles.labelDense]}>{label}</Text>
        <Text
          style={[styles.value, compact && styles.valueCompact, dense && styles.valueDense]}
          numberOfLines={compact || dense ? 2 : 4}
        >
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
  /** أقل ارتفاعًا — بطاقة مضغوطة أو شريط سفلي يقتسمان الشاشة */
  compact?: boolean;
  /** أخفّ ضمن بطاقة تشغيل حيّة (نصف شاشة تقريبًا) */
  dense?: boolean;
};

export function OrderRouteTapRows({ pickupAddress, dropoffAddress, areaFallback, compact, dense }: Props) {
  const drop = dropoffAddress.trim() || areaFallback?.trim() || "";
  const tight = Boolean(compact || dense);
  return (
    <View style={[styles.block, compact && styles.blockCompact, dense && styles.blockDense]}>
      <LocationTapRow
        label={ORDER_PICKUP_LOCATION_LABEL}
        value={pickupAddress}
        tone="pickup"
        compact={tight}
        dense={dense}
      />
      <LocationTapRow
        label={ORDER_DROPOFF_LOCATION_LABEL}
        value={drop}
        tone="dropoff"
        compact={tight}
        dense={dense}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  blockCompact: { gap: 4 },
  blockDense: { gap: 3 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 0,
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: homeTheme.radiusMd,
    borderWidth: 1,
  },
  rowPickup: {
    borderColor: homeTheme.accentMuted,
    backgroundColor: "rgba(176, 36, 50, 0.07)",
  },
  rowDropoff: {
    borderColor: homeTheme.goldMuted,
    backgroundColor: "rgba(180, 83, 9, 0.08)",
  },
  rowCompact: {
    paddingVertical: 5,
    paddingHorizontal: 7,
    gap: 4,
  },
  rowDense: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    gap: 3,
  },
  pressed: { opacity: 0.9 },
  textCol: { flex: 1, alignItems: "flex-end" },
  label: {
    fontSize: 12,
    fontWeight: "900",
    color: homeTheme.textMuted,
    textAlign: "right",
    marginBottom: 4,
    lineHeight: 16,
  },
  labelCompact: {
    fontSize: 11,
    marginBottom: 3,
    lineHeight: 14,
  },
  labelDense: {
    fontSize: 10,
    marginBottom: 2,
    lineHeight: 13,
  },
  value: {
    fontSize: 15,
    color: homeTheme.text,
    lineHeight: 22,
    textAlign: "right",
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: homeTheme.accentMuted,
  },
  valueCompact: {
    fontSize: 13,
    lineHeight: 19,
  },
  valueDense: {
    fontSize: 12,
    lineHeight: 17,
  },
});
