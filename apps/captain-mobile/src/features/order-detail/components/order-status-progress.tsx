import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { OrderStatusDto } from "@/services/api/dto";
import { orderStatusAr } from "@/lib/order-status-ar";
import { homeTheme } from "@/features/home/theme";

const DELIVERY_CHAIN: { status: OrderStatusDto; label: string }[] = [
  { status: "ACCEPTED", label: "قبول الطلب" },
  { status: "PICKED_UP", label: "الاستلام من المتجر" },
  { status: "IN_TRANSIT", label: "في الطريق للعميل" },
  { status: "DELIVERED", label: "تسليم الطلب" },
];

function deliveryStepIndex(s: OrderStatusDto): number {
  const i = DELIVERY_CHAIN.findIndex((x) => x.status === s);
  return i >= 0 ? i : -1;
}

type Props = {
  status: OrderStatusDto;
};

/**
 * شريط تقدّم لمسار التسليم بعد القبول؛ وعرض مختصر للحالات الأخرى.
 */
export function OrderStatusProgress({ status }: Props) {
  if (status === "CANCELLED") {
    return (
      <View style={styles.bannerDanger}>
        <Ionicons name="close-circle" size={22} color={homeTheme.danger} />
        <Text style={styles.bannerDangerText}>هذا الطلب ملغى ولا يمكن متابعة التسليم.</Text>
      </View>
    );
  }

  const di = deliveryStepIndex(status);
  if (di >= 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>تقدّم التسليم</Text>
        <View style={styles.steps}>
          {DELIVERY_CHAIN.map((step, idx) => {
            const done = status === "DELIVERED" || idx < di;
            const current = !done && idx === di;
            return (
              <View key={step.status} style={styles.stepRow}>
                <View style={styles.stepIconCol}>
                  <View
                    style={[
                      styles.dot,
                      done && styles.dotDone,
                      current && !done && styles.dotCurrent,
                    ]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={14} color="#0f172a" />
                    ) : current ? (
                      <View style={styles.dotInner} />
                    ) : null}
                  </View>
                  {idx < DELIVERY_CHAIN.length - 1 ? (
                    <View style={[styles.vline, done && styles.vlineDone]} />
                  ) : null}
                </View>
                <View style={styles.stepTextCol}>
                  <Text style={[styles.stepLabel, (done || current) && styles.stepLabelActive]}>
                    {step.label}
                  </Text>
                  {current ? (
                    <Text style={styles.stepSub}>الخطوة الحالية</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.bannerInfo}>
      <Ionicons name="information-circle-outline" size={22} color={homeTheme.warning} />
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerInfoTitle}>قبل بدء التسليم</Text>
        <Text style={styles.bannerInfoBody}>
          الحالة الحالية: <Text style={styles.em}>{orderStatusAr[status] ?? status}</Text>
        </Text>
        <Text style={styles.bannerInfoHint}>
          بعد قبول العرض وتحويل الطلب إلى «مقبول»، يظهر هنا مسار الاستلام والتسليم خطوة بخطوة.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    borderWidth: 1,
    borderColor: homeTheme.border,
    padding: 16,
  },
  sectionTitle: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 12,
  },
  steps: { gap: 0 },
  stepRow: {
    flexDirection: "row-reverse",
    alignItems: "stretch",
  },
  stepIconCol: {
    width: 28,
    alignItems: "center",
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: homeTheme.borderStrong,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: {
    backgroundColor: homeTheme.accent,
    borderColor: homeTheme.accent,
  },
  dotCurrent: {
    borderColor: homeTheme.accent,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: homeTheme.accent,
  },
  vline: {
    width: 2,
    flex: 1,
    minHeight: 12,
    backgroundColor: homeTheme.border,
    marginVertical: 2,
  },
  vlineDone: {
    backgroundColor: "rgba(56, 189, 248, 0.45)",
  },
  stepTextCol: {
    flex: 1,
    paddingRight: 12,
    paddingBottom: 16,
  },
  stepLabel: {
    color: homeTheme.textMuted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  stepLabelActive: {
    color: homeTheme.text,
  },
  stepSub: {
    color: homeTheme.accent,
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
    fontWeight: "700",
  },
  bannerDanger: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: homeTheme.radiusMd,
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.35)",
  },
  bannerDangerText: {
    flex: 1,
    color: "#fecaca",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    fontWeight: "600",
  },
  bannerInfo: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: homeTheme.radiusMd,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.25)",
  },
  bannerInfoTitle: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  bannerInfoBody: {
    color: homeTheme.textMuted,
    fontSize: 14,
    marginTop: 6,
    textAlign: "right",
    lineHeight: 22,
  },
  em: { color: homeTheme.accent, fontWeight: "800" },
  bannerInfoHint: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
    lineHeight: 20,
  },
});
