import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { CaptainActionResult } from "../utils/captain-order-actions";
import {
  captainShadows,
  captainSpacing,
  captainTypography,
  captainUiTheme,
} from "@/theme/captain-ui-theme";
import { locationI18nKey } from "@/lib/order-location-i18n";
import type { OrderDetailDto } from "@/services/api/dto";
import { paymentSummaryLinesFromDetail } from "@/features/orders/utils/order-list-primary-action";
import { formatAssignmentOfferCountdown } from "@/lib/assignment-offer-seconds-left";
import { PrimaryButton } from "@/components/ui";

type Props = {
  actions: CaptainActionResult;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onAdvance: () => void;
  /** ثوانٍ متبقية لعرض القبول/الرفض — من `expiresAt` على الخادم (غالباً نافذة ~30 ث) */
  offerSecondsRemaining?: number | null;
  /** ملخص عناوين + زر تفاصيل فوق أزرار القبول/الرفض — تبويب الطلبات */
  compactSummary?: boolean;
  onOpenOrderDetail?: () => void;
};

const dockElev =
  Platform.OS === "ios"
    ? captainShadows.tabBarTopIos
    : { elevation: captainShadows.tabBarTopAndroidElevation };

function InlineOrderSummary({
  order,
  onOpenDetail,
}: {
  order: OrderDetailDto;
  onOpenDetail: () => void;
}) {
  const { t } = useTranslation();
  const pay = paymentSummaryLinesFromDetail(order);
  const dash = t("common.emDash");
  const pickup = order.pickupAddress?.trim() || dash;
  const drop = (order.dropoffAddress || order.area || "").trim() || dash;
  return (
    <View style={styles.sumWrap}>
      <View style={styles.sumLocBlock}>
        <Text style={styles.sumLocLabel}>{t(locationI18nKey.pickup)}</Text>
        <Text style={styles.sumLocValue} numberOfLines={4}>
          {pickup}
        </Text>
        <Text style={[styles.sumLocLabel, styles.sumLocLabelSpaced]}>{t(locationI18nKey.dropoff)}</Text>
        <Text style={styles.sumLocValue} numberOfLines={4}>
          {drop}
        </Text>
      </View>
      <Pressable
        onPress={onOpenDetail}
        style={({ pressed }) => [styles.detailsCard, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("assignmentBar.orderDetailsFullA11y")}
      >
        <View style={styles.detailsCardBody}>
          <Text style={styles.detailsCardTitle}>{t("assignmentBar.orderDetailsTitle")}</Text>
          {order.senderFullName?.trim() ? (
            <Text style={styles.detailsLine} numberOfLines={1}>
              {t("orderDetail.senderLine", { name: order.senderFullName.trim() })}
            </Text>
          ) : null}
          {order.customerName ? (
            <Text style={styles.detailsLine} numberOfLines={1}>
              {order.customerName}
            </Text>
          ) : null}
          {order.customerPhone?.trim() ? (
            <View style={styles.detailsPhoneRow}>
              <Ionicons name="call-outline" size={14} color={captainUiTheme.accent} />
              <Text style={styles.detailsPhone}>{order.customerPhone.trim()}</Text>
            </View>
          ) : (
            <Text style={styles.detailsHint}>{t("orderDetail.customerPhoneMissing")}</Text>
          )}
          <Text style={styles.detailsPay} numberOfLines={2}>
            {pay}
          </Text>
          <Text style={styles.detailsHint}>{t("assignmentBar.fullDetailsHint")}</Text>
        </View>
        <Ionicons name="chevron-back" size={18} color={captainUiTheme.accent} />
      </Pressable>
    </View>
  );
}

export function AssignmentActionsBar({
  actions,
  busy,
  onAccept,
  onReject,
  onAdvance,
  offerSecondsRemaining,
  compactSummary = false,
  onOpenOrderDetail,
}: Props) {
  const { t } = useTranslation();
  const compact = compactSummary;
  const showInlineOrder =
    compact &&
    onOpenOrderDetail &&
    (actions.mode === "offer" || actions.mode === "active_patch");

  if (actions.mode === "none" && !actions.readOnly) {
    return null;
  }

  if (actions.mode === "none" && actions.readOnly) {
    return (
      <View style={[styles.dockWrap, dockElev]}>
        <View style={styles.readOnly}>
          <Text style={styles.readOnlyText}>{t("assignmentBar.readOnly")}</Text>
        </View>
      </View>
    );
  }

  if (actions.mode === "offer") {
    const showCountdown = typeof offerSecondsRemaining === "number";
    const sec = showCountdown ? offerSecondsRemaining : 0;
    const urgent = showCountdown && sec <= 10;

    return (
      <View style={[styles.dockWrap, dockElev, compact && styles.dockWrapCompact]}>
        {showCountdown ? (
          <View style={[styles.offerCountdownRow, compact && styles.offerCountdownRowCompact]}>
            <Text style={styles.offerCountdownLabel}>{t("assignmentBar.offerCountdown")}</Text>
            <Text style={[styles.offerCountdownDigits, urgent && styles.offerCountdownUrgent, compact && styles.offerCountdownDigitsCompact]}>
              {showCountdown ? formatAssignmentOfferCountdown(t, sec) : t("common.emDash")}
            </Text>
          </View>
        ) : null}
        {!compact ? (
          <Text style={styles.acceptDisclaimer} numberOfLines={3}>
            {t("assignmentBar.acceptConfirmHint")}
          </Text>
        ) : null}
        {showInlineOrder ? <InlineOrderSummary order={actions.order} onOpenDetail={onOpenOrderDetail} /> : null}
        <View style={styles.offerRow}>
          <Pressable
            style={({ pressed }) => [
              styles.btnReject,
              compact && styles.btnRejectCompact,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
            onPress={onReject}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("assignmentBar.declineA11y")}
          >
            <Ionicons name="close-outline" size={compact ? 18 : 22} color={captainUiTheme.dangerText} />
            <Text style={[styles.btnRejectText, compact && styles.btnRejectTextCompact]} numberOfLines={1}>
              {t("assignmentBar.decline")}
            </Text>
          </Pressable>
          <PrimaryButton
            icon="checkmark-circle"
            label={t("assignmentBar.acceptOrder")}
            onPress={onAccept}
            disabled={busy}
            loading={busy}
            style={compact ? styles.btnAcceptFlexCompact : styles.btnAcceptFlex}
          />
        </View>
      </View>
    );
  }

  if (actions.mode === "active_patch") {
    return (
      <View style={[styles.dockWrap, dockElev, compact && styles.dockWrapCompact]}>
        {showInlineOrder ? <InlineOrderSummary order={actions.order} onOpenDetail={onOpenOrderDetail!} /> : null}
        <PrimaryButton
          fullWidth
          icon="arrow-forward-circle"
          label={t(actions.labelKey)}
          onPress={onAdvance}
          disabled={busy}
          loading={busy}
          style={compact ? styles.advanceCompactLift : styles.advanceLift}
        />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  dockWrap: {
    backgroundColor: captainUiTheme.surfaceElevated,
    paddingHorizontal: captainSpacing.screenHorizontal,
    paddingTop: captainSpacing.sm + 2,
    paddingBottom: Platform.OS === "ios" ? 6 : 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: captainUiTheme.border,
  },
  dockWrapCompact: {
    paddingTop: captainSpacing.sm,
    paddingBottom: Platform.OS === "ios" ? 6 : captainSpacing.sm,
  },
  advanceLift: {
    minHeight: 50,
    marginTop: 2,
  },
  advanceCompactLift: {
    minHeight: 40,
    marginTop: 2,
    paddingVertical: captainSpacing.sm,
    paddingHorizontal: captainSpacing.md,
  },
  sumWrap: {
    marginBottom: captainSpacing.sm + 2,
    gap: captainSpacing.sm,
  },
  sumLocBlock: {
    gap: captainSpacing.xs,
  },
  sumLocLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: captainUiTheme.textSubtle,
    textAlign: "right",
  },
  sumLocLabelSpaced: {
    marginTop: captainSpacing.sm - 2,
  },
  sumLocValue: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: captainUiTheme.text,
    textAlign: "right",
  },
  detailsCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: captainSpacing.sm,
    paddingVertical: captainSpacing.sm + 2,
    paddingHorizontal: captainSpacing.md,
    borderRadius: captainUiTheme.radiusMd,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    backgroundColor: captainUiTheme.neutralSoft,
    ...captainUiTheme.cardShadow,
  },
  detailsCardBody: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
    gap: 2,
  },
  detailsCardTitle: {
    ...captainTypography.bodyStrong,
    fontSize: 13,
    color: captainUiTheme.text,
    textAlign: "right",
    fontWeight: "900",
  },
  detailsLine: {
    fontSize: 12,
    fontWeight: "600",
    color: captainUiTheme.textMuted,
    textAlign: "right",
  },
  detailsPhoneRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: captainSpacing.xs,
  },
  detailsPhone: {
    fontSize: 13,
    fontWeight: "800",
    color: captainUiTheme.accent,
    textAlign: "right",
  },
  detailsPay: {
    fontSize: 11,
    fontWeight: "600",
    color: captainUiTheme.text,
    textAlign: "right",
    lineHeight: 16,
  },
  detailsHint: {
    ...captainTypography.tabLabel,
    fontWeight: "600",
    fontSize: 10,
    color: captainUiTheme.textSubtle,
    textAlign: "right",
    marginTop: 2,
  },
  offerCountdownRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: captainSpacing.sm + 2,
    marginBottom: captainSpacing.sm,
    paddingHorizontal: captainSpacing.xs,
  },
  offerCountdownRowCompact: {
    marginBottom: captainSpacing.sm - 2,
  },
  offerCountdownLabel: {
    flex: 1,
    color: captainUiTheme.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 18,
  },
  offerCountdownDigits: {
    fontVariant: ["tabular-nums"],
    color: captainUiTheme.accent,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  offerCountdownDigitsCompact: {
    fontSize: 17,
  },
  offerCountdownUrgent: {
    color: captainUiTheme.dangerText,
  },
  acceptDisclaimer: {
    ...captainTypography.caption,
    fontWeight: "600",
    fontSize: 11,
    lineHeight: 16,
    color: captainUiTheme.textSubtle,
    textAlign: "right",
    marginBottom: captainSpacing.sm,
    paddingHorizontal: captainSpacing.xs,
  },
  offerRow: {
    flexDirection: "row-reverse",
    alignItems: "stretch",
    gap: captainSpacing.sm,
  },
  btnAcceptFlex: {
    flex: 1.2,
    minHeight: 48,
    alignSelf: "stretch",
  },
  btnAcceptFlexCompact: {
    flex: 1,
    minHeight: 36,
    paddingVertical: captainSpacing.sm - 4,
    paddingHorizontal: captainSpacing.sm + 2,
  },
  readOnly: {
    padding: captainSpacing.md - 4,
    borderRadius: captainUiTheme.radiusMd,
    backgroundColor: captainUiTheme.neutralSoft,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
  },
  readOnlyText: {
    color: captainUiTheme.textMuted,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
  btnReject: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: captainSpacing.xs,
    backgroundColor: captainUiTheme.surfaceElevated,
    borderWidth: 1.5,
    borderColor: captainUiTheme.dangerBorder,
    paddingVertical: captainSpacing.sm + 4,
    paddingHorizontal: captainSpacing.sm + 2,
    borderRadius: captainUiTheme.radiusMd,
    minHeight: 48,
  },
  btnRejectCompact: {
    paddingVertical: captainSpacing.sm - 2,
    paddingHorizontal: captainSpacing.sm,
    minHeight: 36,
  },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.55 },
  btnRejectText: { color: captainUiTheme.dangerText, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  btnRejectTextCompact: { fontSize: 12 },
});
