import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { OrderStatusDto } from "@/services/api/dto";
import { orderStatusTranslationKey } from "@/lib/order-status-i18n";
import { OrderTimeline, type OrderTimelineStep } from "@/components/ui";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";

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
        <Ionicons name="close-circle" size={compact ? 18 : 22} color={captainUiTheme.danger} />
        <Text style={[styles.bannerDangerText, compact && styles.bannerDangerTextCompact]}>{t("orderStatusProgress.cancelledBanner")}</Text>
      </View>
    );
  }

  const di = deliveryStepIndex(status);
  if (di >= 0) {
    const steps: OrderTimelineStep[] = DELIVERY_CHAIN.map((step, idx) => {
      const done = status === "DELIVERED" || idx < di;
      const current = !done && idx === di;
      const state: OrderTimelineStep["state"] = done ? "done" : current ? "current" : "upcoming";
      return {
        key: step.status,
        title: t(step.labelKey),
        subtitle: current ? t("orderStatusProgress.currentStep") : undefined,
        state,
      };
    });
    return (
      <View style={[styles.timelineWrap, compact && styles.timelineWrapCompact]}>
        <Text style={[styles.timelineTitle, compact && styles.timelineTitleCompact]}>{t("orderStatusProgress.title")}</Text>
        <OrderTimeline steps={steps} />
      </View>
    );
  }

  return (
    <View style={[styles.bannerInfo, compact && styles.bannerInfoCompact]}>
      <Ionicons name="information-circle-outline" size={compact ? 18 : 22} color={captainUiTheme.warning} />
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
  timelineWrap: {
    marginTop: captainSpacing.sm,
  },
  timelineWrapCompact: {
    marginTop: captainSpacing.xs,
  },
  timelineTitle: {
    ...captainTypography.bodyStrong,
    fontSize: 15,
    color: captainUiTheme.text,
    textAlign: "right",
    marginBottom: captainSpacing.xs,
  },
  timelineTitleCompact: {
    fontSize: 12,
    marginBottom: 2,
  },
  bannerDanger: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: captainSpacing.sm + 2,
    padding: captainSpacing.sm + 2,
    borderRadius: captainUiTheme.radiusMd,
    backgroundColor: captainUiTheme.dangerSoft,
    borderWidth: 1,
    borderColor: captainUiTheme.dangerBorder,
  },
  bannerDangerText: {
    flex: 1,
    color: captainUiTheme.dangerText,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    fontWeight: "600",
  },
  bannerDangerCompact: {
    padding: captainSpacing.sm,
    gap: captainSpacing.sm,
  },
  bannerDangerTextCompact: {
    fontSize: 12,
    lineHeight: 18,
  },
  bannerInfo: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: captainSpacing.sm + 2,
    padding: captainSpacing.sm + 2,
    borderRadius: captainUiTheme.radiusMd,
    backgroundColor: captainUiTheme.goldSoft,
    borderWidth: 1,
    borderColor: captainUiTheme.goldMuted,
  },
  bannerInfoTitle: {
    color: captainUiTheme.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  bannerInfoBody: {
    color: captainUiTheme.textMuted,
    fontSize: 14,
    marginTop: captainSpacing.sm - 2,
    textAlign: "right",
    lineHeight: 22,
  },
  bannerInfoHint: {
    color: captainUiTheme.textSubtle,
    fontSize: 12,
    marginTop: captainSpacing.sm,
    textAlign: "right",
    lineHeight: 20,
  },
  bannerInfoCompact: {
    padding: captainSpacing.sm,
    gap: captainSpacing.sm,
    marginTop: captainSpacing.sm,
  },
  bannerInfoTitleCompact: {
    fontSize: 12,
  },
  bannerInfoBodyCompact: {
    fontSize: 11,
    marginTop: captainSpacing.xs,
    lineHeight: 17,
  },
});
