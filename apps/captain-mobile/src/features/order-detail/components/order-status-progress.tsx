import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { OrderStatusDto } from "@/services/api/dto";
import { orderStatusTranslationKey } from "@/lib/order-status-i18n";
import { homeTheme } from "@/features/home/theme";

const DELIVERY_CHAIN: { status: OrderStatusDto; labelKey: string }[] = [
  { status: "ACCEPTED", labelKey: "orderStatusProgress.stepAccepted" },
  { status: "PICKED_UP", labelKey: "orderStatusProgress.stepPickedUp" },
  { status: "IN_TRANSIT", labelKey: "orderStatusProgress.stepInTransit" },
  { status: "DELIVERED", labelKey: "orderStatusProgress.stepDelivered" },
];

function deliveryStepIndex(s: OrderStatusDto): number {
  const i = DELIVERY_CHAIN.findIndex((x) => x.status === s);
  return i >= 0 ? i : -1;
}

type Props = {
  status: OrderStatusDto;
  compact?: boolean;
};

/**
 * Delivery progress after acceptance; short summary for other statuses.
 */
export function OrderStatusProgress({ status, compact }: Props) {
  const { t } = useTranslation();

  if (status === "CANCELLED") {
    return (
      <View style={[styles.bannerDanger, compact && styles.bannerDangerCompact]}>
        <Ionicons name="close-circle" size={compact ? 18 : 22} color={homeTheme.danger} />
        <Text style={[styles.bannerDangerText, compact && styles.bannerDangerTextCompact]}>
          {t("orderStatusProgress.cancelledBanner")}
        </Text>
      </View>
    );
  }

  const di = deliveryStepIndex(status);
  if (di >= 0) {
    return (
      <View style={[styles.card, compact && styles.cardCompact]}>
        <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>{t("orderStatusProgress.title")}</Text>
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
                      <Ionicons name="checkmark" size={14} color={homeTheme.onAccent} />
                    ) : current ? (
                      <View style={styles.dotInner} />
                    ) : null}
                  </View>
                  {idx < DELIVERY_CHAIN.length - 1 ? (
                    <View style={[styles.vline, done && styles.vlineDone]} />
                  ) : null}
                </View>
                <View style={[styles.stepTextCol, compact && styles.stepTextColCompact]}>
                  <Text
                    style={[
                      styles.stepLabel,
                      compact && styles.stepLabelCompact,
                      (done || current) && styles.stepLabelActive,
                    ]}
                  >
                    {t(step.labelKey)}
                  </Text>
                  {current ? (
                    <Text style={[styles.stepSub, compact && styles.stepSubCompact]}>{t("orderStatusProgress.currentStep")}</Text>
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
    <View style={[styles.bannerInfo, compact && styles.bannerInfoCompact]}>
      <Ionicons name="information-circle-outline" size={compact ? 18 : 22} color={homeTheme.warning} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.bannerInfoTitle, compact && styles.bannerInfoTitleCompact]}>{t("orderStatusProgress.beforeDeliveryTitle")}</Text>
        <Text style={[styles.bannerInfoBody, compact && styles.bannerInfoBodyCompact]}>
          {t("orderStatusProgress.currentStatus", { status: t(orderStatusTranslationKey(status)) })}
        </Text>
        {!compact ? <Text style={styles.bannerInfoHint}>{t("orderStatusProgress.beforeDeliveryHint")}</Text> : null}
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
  cardCompact: {
    padding: 10,
    borderRadius: homeTheme.radiusMd,
    marginTop: 8,
  },
  sectionTitle: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 12,
  },
  sectionTitleCompact: {
    fontSize: 12,
    marginBottom: 8,
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
    backgroundColor: homeTheme.accentSoft,
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
    backgroundColor: homeTheme.accentMuted,
  },
  stepTextCol: {
    flex: 1,
    paddingRight: 12,
    paddingBottom: 16,
  },
  stepTextColCompact: {
    paddingBottom: 10,
    paddingRight: 8,
  },
  stepLabel: {
    color: homeTheme.textMuted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  stepLabelCompact: {
    fontSize: 12,
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
  stepSubCompact: {
    fontSize: 10,
    marginTop: 2,
  },
  bannerDanger: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: homeTheme.radiusMd,
    backgroundColor: homeTheme.dangerSoft,
    borderWidth: 1,
    borderColor: homeTheme.dangerBorder,
  },
  bannerDangerText: {
    flex: 1,
    color: homeTheme.dangerText,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    fontWeight: "600",
  },
  bannerDangerCompact: {
    padding: 10,
    gap: 8,
  },
  bannerDangerTextCompact: {
    fontSize: 12,
    lineHeight: 18,
  },
  bannerInfo: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: homeTheme.radiusMd,
    backgroundColor: homeTheme.goldSoft,
    borderWidth: 1,
    borderColor: homeTheme.goldMuted,
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
  bannerInfoHint: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
    lineHeight: 20,
  },
  bannerInfoCompact: {
    padding: 10,
    gap: 8,
    marginTop: 8,
  },
  bannerInfoTitleCompact: {
    fontSize: 12,
  },
  bannerInfoBodyCompact: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 17,
  },
});
