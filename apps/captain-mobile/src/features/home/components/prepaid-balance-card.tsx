import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { CaptainPrepaidSummaryDto } from "@/services/api/dto";
import { homeTheme } from "../theme";

type Props = {
  balance: CaptainPrepaidSummaryDto | undefined;
};

export function PrepaidBalanceCard({ balance }: Props) {
  const { t } = useTranslation();
  if (!balance) return null;

  const blocked = balance.blockedFromReceivingOrders;
  const low = balance.lowBalance;
  const tone = blocked ? styles.danger : low ? styles.warning : styles.ok;

  return (
    <View style={[styles.card, tone]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Ionicons name="wallet-outline" size={22} color={homeTheme.accent} style={styles.headerIcon} />
          <View style={styles.headerLabels}>
            <Text style={styles.label}>{t("prepaid.labelRemaining")}</Text>
            <Text style={styles.amount} accessibilityRole="text">
              {balance.readAlignment?.displayBalance ?? balance.currentBalance} ILS
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <View style={styles.metricHead}>
            <Ionicons name="pie-chart-outline" size={16} color={homeTheme.gold} />
            <Text style={styles.metricLabel}>{t("prepaid.metricCommission")}</Text>
          </View>
          <Text style={styles.metricValue}>{balance.commissionPercent}%</Text>
        </View>
        <View style={styles.metric}>
          <View style={styles.metricHead}>
            <Ionicons name="layers-outline" size={16} color={homeTheme.gold} />
            <Text style={styles.metricLabel}>{t("prepaid.metricEstimatedOrders")}</Text>
          </View>
          <Text style={styles.metricValue}>
            {balance.estimatedRemainingOrders == null
              ? t("prepaid.estimatedByFees")
              : String(balance.estimatedRemainingOrders)}
          </Text>
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: homeTheme.radiusLg,
    padding: 16,
    borderWidth: 1,
    backgroundColor: homeTheme.surfaceElevated,
    ...homeTheme.cardShadow,
  },
  ok: { borderColor: homeTheme.successBorder },
  warning: { borderColor: homeTheme.goldMuted },
  danger: { borderColor: homeTheme.dangerBorder },
  header: { marginBottom: 2 },
  headerText: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: { marginTop: 2 },
  headerLabels: { flex: 1, minWidth: 0, alignItems: "flex-end" },
  label: { color: homeTheme.textMuted, fontSize: 14, fontWeight: "700", textAlign: "right" },
  amount: { color: homeTheme.text, fontSize: 28, fontWeight: "900", textAlign: "right", marginTop: 4 },
  metrics: { flexDirection: "row-reverse", gap: 10, marginTop: 14 },
  metric: {
    flex: 1,
    borderRadius: homeTheme.radiusMd,
    padding: 12,
    backgroundColor: homeTheme.inputBg,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  metricHead: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 4 },
  metricLabel: { color: homeTheme.textSubtle, fontSize: 12, textAlign: "right", flex: 1 },
  metricValue: { color: homeTheme.text, fontSize: 16, fontWeight: "800", textAlign: "right", marginTop: 4 },
  body: { color: homeTheme.textMuted, fontSize: 13, lineHeight: 21, textAlign: "right", marginTop: 14 },
  rules: { gap: 5, marginTop: 12 },
  rule: { color: homeTheme.textSubtle, fontSize: 12, lineHeight: 19, textAlign: "right" },
  low: { color: homeTheme.gold, fontSize: 13, fontWeight: "800", textAlign: "right", marginTop: 12 },
  blocked: { color: homeTheme.dangerText, fontSize: 13, fontWeight: "900", textAlign: "right", marginTop: 12 },
});
