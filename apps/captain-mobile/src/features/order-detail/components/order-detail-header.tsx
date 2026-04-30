import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { OrderDetailDto } from "@/services/api/dto";
import { formatLogTime } from "@/lib/order-timestamps";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";
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
    backgroundColor: captainUiTheme.surfaceElevated,
    borderRadius: captainUiTheme.radiusLg,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    padding: captainSpacing.lg + 2,
    gap: captainSpacing.sm + 2,
    ...captainUiTheme.cardShadow,
  },
  kicker: {
    color: captainUiTheme.textSubtle,
    fontSize: 12,
    textAlign: "right",
    marginBottom: captainSpacing.xs,
  },
  orderNo: {
    ...captainTypography.screenTitle,
    color: captainUiTheme.text,
    textAlign: "right",
  },
  metaRow: { paddingTop: captainSpacing.xs },
  meta: {
    color: captainUiTheme.textMuted,
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
  },
  offerBanner: {
    backgroundColor: captainUiTheme.goldSoft,
    borderRadius: captainUiTheme.radiusMd,
    padding: captainSpacing.sm + 2,
    borderWidth: 1,
    borderColor: captainUiTheme.goldMuted,
  },
  offerText: {
    color: captainUiTheme.gold,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
});
