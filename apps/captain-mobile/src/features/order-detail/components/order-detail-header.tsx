import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { OrderDetailDto } from "@/services/api/dto";
import { formatLogTime } from "@/lib/order-timestamps";
import { homeTheme } from "@/features/home/theme";
import { formatOrderSerial } from "@/lib/order-serial";

type Props = {
  order: OrderDetailDto;
  offerHint?: string | null;
};

export function OrderDetailHeader({ order, offerHint }: Props) {
  const { t } = useTranslation();
  const dash = t("common.emDash");
  const created = formatLogTime(order.createdAt) ?? dash;
  const updated = formatLogTime(order.updatedAt) ?? dash;

  return (
    <View style={styles.wrap}>
      <View>
        <Text style={styles.kicker}>{t("orderDetailHeader.kicker")}</Text>
        <Text style={styles.orderNo}>{formatOrderSerial(order.orderNumber, order.displayOrderNo)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{t("orderDetailHeader.meta", { created, updated })}</Text>
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
    backgroundColor: homeTheme.goldSoft,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: homeTheme.goldMuted,
  },
  offerText: {
    color: homeTheme.gold,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
});
