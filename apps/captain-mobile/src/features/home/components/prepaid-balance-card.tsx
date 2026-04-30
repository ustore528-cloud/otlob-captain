import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { CaptainPrepaidSummaryDto } from "@/services/api/dto";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";
import { SectionCard, MetricCard } from "@/components/ui";
import { formatOrderAmountAr } from "@/lib/order-currency";

type Props = {
  balance: CaptainPrepaidSummaryDto | undefined;
};

export function PrepaidBalanceCard({ balance }: Props) {
  const { t } = useTranslation();
  if (!balance) return null;

  const blocked = balance.blockedFromReceivingOrders;
  const low = balance.lowBalance;
  const toneBorder =
    blocked
      ? { borderColor: captainUiTheme.dangerBorder }
      : low
        ? { borderColor: captainUiTheme.goldMuted }
        : { borderColor: captainUiTheme.successBorder };

  return (
    <SectionCard title={t("prepaid.sectionTitle")} icon="wallet-outline" compact style={toneBorder}>
      <Text style={styles.label}>{t("prepaid.labelRemaining")}</Text>
      <Text style={styles.amount} accessibilityRole="text">
        {formatOrderAmountAr(balance.readAlignment?.displayBalance ?? balance.currentBalance)}
      </Text>

      <View style={styles.metricRow}>
        <MetricCard
          dense
          style={styles.metricCell}
          title={t("prepaid.metricCommission")}
          value={`${balance.commissionPercent}%`}
          accessory={<Ionicons name="pie-chart-outline" size={16} color={captainUiTheme.gold} />}
        />
        <MetricCard
          dense
          style={styles.metricCell}
          title={t("prepaid.metricEstimatedOrders")}
          value={
            balance.estimatedRemainingOrders == null ? t("prepaid.estimatedByFees") : String(balance.estimatedRemainingOrders)
          }
          accessory={<Ionicons name="layers-outline" size={16} color={captainUiTheme.gold} />}
        />
      </View>

      <Text style={styles.body}>{t("prepaid.bodyExplain")}</Text>
      <View style={styles.rules}>
        <Text style={styles.rule}>{t("prepaid.rule1")}</Text>
        <Text style={styles.rule}>{t("prepaid.rule2")}</Text>
        <Text style={styles.rule}>{t("prepaid.rule3")}</Text>
      </View>
      {blocked ? (
        <Text style={styles.blocked}>{t("prepaid.blocked")}</Text>
      ) : low ? (
        <Text style={styles.low}>{t("prepaid.low")}</Text>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  label: {
    color: captainUiTheme.textMuted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: captainSpacing.xs,
  },
  amount: {
    ...captainTypography.screenTitle,
    fontSize: 28,
    lineHeight: 34,
    color: captainUiTheme.text,
    textAlign: "right",
    marginBottom: captainSpacing.sm,
  },
  metricRow: {
    flexDirection: "row-reverse",
    gap: captainSpacing.sm,
    marginBottom: captainSpacing.sm,
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
  },
  body: {
    color: captainUiTheme.textMuted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "right",
    marginTop: captainSpacing.sm + 2,
  },
  rules: { gap: captainSpacing.xs + 1, marginTop: captainSpacing.md },
  rule: {
    color: captainUiTheme.textSubtle,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "right",
  },
  low: {
    color: captainUiTheme.gold,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    marginTop: captainSpacing.md,
  },
  blocked: {
    color: captainUiTheme.dangerText,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
    marginTop: captainSpacing.md,
  },
});
