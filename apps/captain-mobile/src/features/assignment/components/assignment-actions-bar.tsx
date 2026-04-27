import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { CaptainActionResult } from "../utils/captain-order-actions";
import { homeTheme } from "@/features/home/theme";
import { locationI18nKey } from "@/lib/order-location-i18n";
import type { OrderDetailDto } from "@/services/api/dto";
import { paymentSummaryLinesFromDetail } from "@/features/orders/utils/order-list-primary-action";
import { formatAssignmentOfferCountdown } from "@/lib/assignment-offer-seconds-left";

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
          {order.customerName ? (
            <Text style={styles.detailsLine} numberOfLines={1}>
              {order.customerName}
            </Text>
          ) : null}
          <View style={styles.detailsPhoneRow}>
            <Ionicons name="call-outline" size={14} color={homeTheme.accent} />
            <Text style={styles.detailsPhone}>{order.customerPhone}</Text>
          </View>
          <Text style={styles.detailsPay} numberOfLines={2}>
            {pay}
          </Text>
          <Text style={styles.detailsHint}>{t("assignmentBar.fullDetailsHint")}</Text>
        </View>
        <Ionicons name="chevron-back" size={18} color={homeTheme.accent} />
      </Pressable>
    </View>
  );
}

const dockShadow =
  Platform.OS === "ios"
    ? {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      }
    : { elevation: 5 };

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
      <View style={[styles.dockWrap, dockShadow]}>
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
      <View style={[styles.dockWrap, dockShadow, compact && styles.dockWrapCompact]}>
        {showCountdown ? (
          <View style={[styles.offerCountdownRow, compact && styles.offerCountdownRowCompact]}>
            <Text style={styles.offerCountdownLabel}>{t("assignmentBar.offerCountdown")}</Text>
            <Text style={[styles.offerCountdownDigits, urgent && styles.offerCountdownUrgent, compact && styles.offerCountdownDigitsCompact]}>
              {showCountdown ? formatAssignmentOfferCountdown(t, sec) : t("common.emDash")}
            </Text>
          </View>
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
            <Ionicons name="close-outline" size={compact ? 18 : 22} color={homeTheme.dangerText} />
            <Text style={[styles.btnRejectText, compact && styles.btnRejectTextCompact]} numberOfLines={1}>
              {t("assignmentBar.decline")}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btnAccept,
              compact && styles.btnAcceptCompact,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
            onPress={onAccept}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("assignmentBar.acceptA11y")}
          >
            {busy ? (
              <ActivityIndicator color={homeTheme.onAccent} size="small" />
            ) : (
              <View style={styles.btnAcceptInner}>
                <Ionicons name="checkmark-circle" size={compact ? 18 : 22} color={homeTheme.onAccent} />
                <View style={styles.btnAcceptTextCol}>
                  <Text style={[styles.btnAcceptText, compact && styles.btnAcceptTextCompact]} numberOfLines={1}>
                    {t("assignmentBar.acceptOrder")}
                  </Text>
                  {!compact ? (
                    <Text style={styles.btnAcceptSub} numberOfLines={1}>
                      {t("assignmentBar.acceptConfirmHint")}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (actions.mode === "active_patch") {
    return (
      <View style={[styles.dockWrap, dockShadow, compact && styles.dockWrapCompact]}>
        {showInlineOrder ? <InlineOrderSummary order={actions.order} onOpenDetail={onOpenOrderDetail!} /> : null}
        <Pressable
          style={({ pressed }) => [
            styles.btnAdvance,
            compact && styles.btnAdvanceCompact,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
          onPress={onAdvance}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t(actions.labelKey)}
        >
          {busy ? (
            <ActivityIndicator color={homeTheme.onAccent} size="small" />
          ) : (
            <View style={styles.btnAdvanceInner}>
              <Ionicons name="arrow-forward-circle" size={compact ? 18 : 22} color={homeTheme.onAccent} />
              <View style={styles.btnAdvanceTextCol}>
                <Text style={[styles.btnAdvanceEn, compact && styles.btnAdvanceEnCompact]} numberOfLines={2}>
                  {t(actions.labelKey)}
                </Text>
              </View>
            </View>
          )}
        </Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  dockWrap: {
    backgroundColor: homeTheme.cardWhite,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 6 : 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
  },
  dockWrapCompact: {
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 6 : 8,
  },
  sumWrap: {
    marginBottom: 10,
    gap: 8,
  },
  sumLocBlock: {
    gap: 4,
  },
  sumLocLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: homeTheme.textSubtle,
    textAlign: "right",
  },
  sumLocLabelSpaced: {
    marginTop: 6,
  },
  sumLocValue: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: homeTheme.text,
    textAlign: "right",
  },
  detailsCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.neutralSoft,
  },
  detailsCardBody: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
    gap: 2,
  },
  detailsCardTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: homeTheme.text,
    textAlign: "right",
  },
  detailsLine: {
    fontSize: 12,
    fontWeight: "600",
    color: homeTheme.textMuted,
    textAlign: "right",
  },
  detailsPhoneRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  detailsPhone: {
    fontSize: 13,
    fontWeight: "800",
    color: homeTheme.accent,
    textAlign: "right",
  },
  detailsPay: {
    fontSize: 11,
    fontWeight: "600",
    color: homeTheme.text,
    textAlign: "right",
    lineHeight: 16,
  },
  detailsHint: {
    fontSize: 10,
    fontWeight: "600",
    color: homeTheme.textSubtle,
    textAlign: "right",
    marginTop: 2,
  },
  offerCountdownRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  offerCountdownRowCompact: {
    marginBottom: 6,
  },
  offerCountdownLabel: {
    flex: 1,
    color: homeTheme.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 18,
  },
  offerCountdownDigits: {
    fontVariant: ["tabular-nums"],
    color: homeTheme.accent,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  offerCountdownDigitsCompact: {
    fontSize: 17,
  },
  offerCountdownUrgent: {
    color: homeTheme.dangerText,
  },
  offerRow: {
    flexDirection: "row-reverse",
    alignItems: "stretch",
    gap: 8,
  },
  readOnly: {
    padding: 12,
    borderRadius: homeTheme.radiusMd,
    backgroundColor: homeTheme.neutralSoft,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  readOnlyText: {
    color: homeTheme.textMuted,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
  btnAccept: {
    flex: 1.2,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeTheme.accent,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: homeTheme.radiusMd,
    minHeight: 48,
  },
  btnAcceptCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    minHeight: 36,
    flex: 1,
  },
  btnAcceptInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  btnAcceptTextCol: { alignItems: "flex-end", flexShrink: 1 },
  btnReject: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: homeTheme.surface,
    borderWidth: 1.5,
    borderColor: homeTheme.dangerBorder,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: homeTheme.radiusMd,
    minHeight: 48,
  },
  btnRejectCompact: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 36,
  },
  btnAdvance: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeTheme.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: homeTheme.radiusMd,
    minHeight: 50,
  },
  btnAdvanceCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  btnAdvanceInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1,
  },
  btnAdvanceTextCol: { flex: 1, alignItems: "flex-end" },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.55 },
  btnAcceptText: { color: homeTheme.onAccent, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  btnAcceptTextCompact: { fontSize: 12 },
  btnAcceptSub: {
    color: "rgba(250,247,240,0.88)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
    textAlign: "right",
  },
  btnRejectText: { color: homeTheme.dangerText, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  btnRejectTextCompact: { fontSize: 12 },
  btnAdvanceEn: {
    color: homeTheme.onAccent,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  btnAdvanceEnCompact: { fontSize: 12 },
  btnAdvanceAr: {
    color: "rgba(250,247,240,0.88)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
    marginTop: 2,
  },
  btnAdvanceArCompact: { fontSize: 11, marginTop: 1 },
});
