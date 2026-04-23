import { StyleSheet, Text, View } from "react-native";
import type { CaptainPrepaidSummaryDto } from "@/services/api/dto";
import { homeTheme } from "../theme";

type Props = {
  balance: CaptainPrepaidSummaryDto | undefined;
};

export function PrepaidBalanceCard({ balance }: Props) {
  if (!balance) return null;

  const blocked = balance.blockedFromReceivingOrders;
  const low = balance.lowBalance;
  const tone = blocked ? styles.danger : low ? styles.warning : styles.ok;

  return (
    <View style={[styles.card, tone]}>
      <View style={styles.header}>
        <Text style={styles.label}>الرصيد المتبقي</Text>
        <Text style={styles.amount}>{balance.currentBalance} ILS</Text>
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>نسبة العمولة</Text>
          <Text style={styles.metricValue}>{balance.commissionPercent}%</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>طلبات تقديرية</Text>
          <Text style={styles.metricValue}>
            {balance.estimatedRemainingOrders == null ? "حسب رسوم التوصيل" : String(balance.estimatedRemainingOrders)}
          </Text>
        </View>
      </View>
      <Text style={styles.body}>
        يتم الخصم من رسوم التوصيل فقط بعد تسليم الطلب. مثال: إذا كانت رسوم التوصيل 10 ILS والعمولة 15%، يتم خصم 1.5 ILS بعد التسليم.
      </Text>
      <View style={styles.rules}>
        <Text style={styles.rule}>• لا يتم الخصم إلا بعد تسليم الطلب</Text>
        <Text style={styles.rule}>• لا يتم الخصم من الطلبات الملغاة</Text>
        <Text style={styles.rule}>• عند انخفاض الرصيد قد يتوقف استقبال طلبات جديدة حتى الشحن</Text>
      </View>
      {blocked ? (
        <Text style={styles.blocked}>الرصيد غير كافٍ لاستقبال طلبات جديدة مؤقتًا.</Text>
      ) : low ? (
        <Text style={styles.low}>رصيدك منخفض. يرجى التواصل مع الإدارة لإعادة الشحن.</Text>
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
  },
  ok: { borderColor: homeTheme.successBorder },
  warning: { borderColor: homeTheme.goldMuted },
  danger: { borderColor: homeTheme.dangerBorder },
  header: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  label: { color: homeTheme.textMuted, fontSize: 14, fontWeight: "700", textAlign: "right" },
  amount: { color: homeTheme.text, fontSize: 28, fontWeight: "900", textAlign: "left" },
  metrics: { flexDirection: "row-reverse", gap: 10, marginTop: 14 },
  metric: {
    flex: 1,
    borderRadius: homeTheme.radiusMd,
    padding: 12,
    backgroundColor: homeTheme.neutralSoft,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  metricLabel: { color: homeTheme.textSubtle, fontSize: 12, textAlign: "right" },
  metricValue: { color: homeTheme.text, fontSize: 16, fontWeight: "800", textAlign: "right", marginTop: 4 },
  body: { color: homeTheme.textMuted, fontSize: 13, lineHeight: 21, textAlign: "right", marginTop: 14 },
  rules: { gap: 5, marginTop: 12 },
  rule: { color: homeTheme.textSubtle, fontSize: 12, lineHeight: 19, textAlign: "right" },
  low: { color: homeTheme.gold, fontSize: 13, fontWeight: "800", textAlign: "right", marginTop: 12 },
  blocked: { color: homeTheme.dangerText, fontSize: 13, fontWeight: "900", textAlign: "right", marginTop: 12 },
});
