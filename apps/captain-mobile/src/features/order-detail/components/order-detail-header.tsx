import { StyleSheet, Text, View } from "react-native";
import type { OrderDetailDto } from "@/services/api/dto";
import { formatLastSeenAr } from "@/features/home/utils/format";
import { homeTheme } from "@/features/home/theme";

type Props = {
  order: OrderDetailDto;
  offerHint?: string | null;
};

export function OrderDetailHeader({ order, offerHint }: Props) {
  const created = formatLastSeenAr(order.createdAt);
  const updated = formatLastSeenAr(order.updatedAt);

  return (
    <View style={styles.wrap}>
      <View>
        <Text style={styles.kicker}>رقم الطلب</Text>
        <Text style={styles.orderNo}>{order.orderNumber}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          أُنشئ {created ?? "—"} · عُدّل {updated ?? "—"}
        </Text>
      </View>
      {offerHint ? (
        <View style={styles.offerBanner}>
          <Text style={styles.offerText}>{offerHint}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    borderWidth: 1,
    borderColor: homeTheme.border,
    padding: 18,
    gap: 10,
  },
  kicker: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    textAlign: "right",
    marginBottom: 4,
  },
  orderNo: {
    color: homeTheme.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "right",
  },
  metaRow: { paddingTop: 4 },
  meta: {
    color: homeTheme.textMuted,
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
  },
  offerBanner: {
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.35)",
  },
  offerText: {
    color: "#fcd34d",
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
});
