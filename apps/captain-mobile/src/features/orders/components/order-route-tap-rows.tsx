import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { homeTheme } from "@/features/home/theme";
import { locationI18nKey } from "@/lib/order-location-i18n";
import { hasMapCoordinates, openOrderMapNav } from "@/lib/open-external";

type RowProps = {
  label: string;
  value: string;
  lat?: number | null;
  lng?: number | null;
  tone?: "pickup" | "dropoff";
  compact?: boolean;
  dense?: boolean;
  mapHint: string;
};

function LocationTapRow({ label, value, lat, lng, tone = "pickup", compact, dense, mapHint }: RowProps) {
  const v = value.trim();
  const coordsOnly = hasMapCoordinates(lat, lng);
  if (!v && !coordsOnly) return null;
  const displayValue =
    v ||
    (coordsOnly ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : "");
  const pickupTone = tone === "pickup";
  const iconName = pickupTone ? ("navigate-circle-outline" as const) : ("flag-outline" as const);
  const iconColor = pickupTone ? homeTheme.accent : homeTheme.gold;
  return (
    <Pressable
      onPress={() => void openOrderMapNav({ address: v || displayValue, lat, lng })}
      style={({ pressed }) => [
        styles.row,
        pickupTone ? styles.rowPickup : styles.rowDropoff,
        compact && styles.rowCompact,
        dense && styles.rowDense,
        homeTheme.cardShadow,
        pressed && styles.pressed,
      ]}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${displayValue}`}
      accessibilityHint={mapHint}
    >
      <View style={styles.rowShell}>
        <View style={styles.textCol}>
          <Text style={[styles.label, compact && styles.labelCompact, dense && styles.labelDense]}>{label}</Text>
          <Text
            style={[styles.value, compact && styles.valueCompact, dense && styles.valueDense]}
            numberOfLines={compact || dense ? 2 : 4}
          >
            {displayValue}
          </Text>
        </View>
        <Ionicons
          name={iconName}
          size={dense ? 22 : compact ? 24 : 28}
          color={iconColor}
          style={styles.leadingIcon}
        />
      </View>
    </Pressable>
  );
}

type Props = {
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  /** إذا كان العنوان الفارغ — عرض المنطقة كاحتياطي للتسليم */
  areaFallback?: string;
  /** أقل ارتفاعًا — بطاقة مضغوطة أو شريط سفلي يقتسمان الشاشة */
  compact?: boolean;
  /** أخفّ ضمن بطاقة تشغيل حيّة (نصف شاشة تقريبًا) */
  dense?: boolean;
};

export function OrderRouteTapRows({
  pickupAddress,
  dropoffAddress,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  areaFallback,
  compact,
  dense,
}: Props) {
  const { t } = useTranslation();
  const drop = dropoffAddress.trim() || areaFallback?.trim() || "";
  const tight = Boolean(compact || dense);
  return (
    <View style={[styles.block, compact && styles.blockCompact, dense && styles.blockDense]}>
      <LocationTapRow
        label={t(locationI18nKey.pickup)}
        value={pickupAddress}
        lat={pickupLat}
        lng={pickupLng}
        tone="pickup"
        compact={tight}
        dense={dense}
        mapHint={t("map.openHint")}
      />
      <LocationTapRow
        label={t(locationI18nKey.dropoff)}
        value={drop}
        lat={dropoffLat}
        lng={dropoffLng}
        tone="dropoff"
        compact={tight}
        dense={dense}
        mapHint={t("map.openHint")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  blockCompact: { gap: 4 },
  blockDense: { gap: 3 },
  row: {
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: homeTheme.radiusMd,
    borderWidth: 1,
  },
  rowShell: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
  },
  leadingIcon: { marginTop: 2 },
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
  textCol: { flex: 1, alignItems: "flex-end", minWidth: 0 },
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
