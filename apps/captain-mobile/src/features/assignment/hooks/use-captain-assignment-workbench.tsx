import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { logCaptainAssignment } from "@/lib/captain-assignment-debug";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { homeTheme } from "@/features/home/theme";
import { alertMutationError } from "@/lib/alert-mutation-error";
import { formatUnknownError } from "@/lib/error-format";
import { useCaptainAssignment } from "@/hooks/api/use-captain-assignment";
import { useCaptainAssignmentOverflow } from "@/hooks/api/use-captain-assignment-overflow";
import { routes } from "@/navigation/routes";
import { useCaptainOrderMutations } from "./use-captain-order-mutations";
import { useAssignmentOfferSecondsTick } from "@/hooks/use-assignment-offer-seconds-tick";
import { formatAssignmentOfferCountdownAr } from "@/lib/assignment-offer-seconds-left";
import type { AssignmentOverflowItemDto, OrderStatusDto } from "@/services/api/dto";
import { formatOrderSerial } from "@/lib/order-serial";
import { orderStatusAr } from "@/lib/order-status-ar";
import { orderStatusAccent } from "@/features/orders/utils/order-status-accent";
import { ORDER_DROPOFF_LOCATION_LABEL, ORDER_PICKUP_LOCATION_LABEL } from "@/lib/order-location-labels";
import { openMapSearch, openPhoneDialer } from "@/lib/open-external";
import { WhatsAppActionButton } from "@/components/ui/whatsapp-action-button";
import { OrderFinancialSection } from "@/components/order/order-financial-section";
import { shouldShowOrderFinancialSection } from "@/lib/order-payment-ui-visibility";

/** ASSIGNED+pending offer → API `OFFER` (shown here as kind OFFER); post-accept work → `ACTIVE` (ACCEPTED+). Blocking for auto distribution still counts ASSIGNED on server. */

type NormalizedCurrentOrder = {
  id: string;
  kind: "OFFER" | "ACTIVE";
  status: OrderStatusDto;
  orderNumber: string;
  merchantName: string;
  pickup: string;
  dropoff: string;
  customerPhone: string;
  amount: string;
  cashCollection: string;
  offerExpiresAt: string | null;
};

function normalizeOrderId(id: unknown): string {
  return String(id ?? "").trim();
}

/** Current-order workbench modeled as a list (primary + overflow), not a single-order screen. */
export function useCaptainAssignmentWorkbench() {
  const router = useRouter();
  const assignmentQuery = useCaptainAssignment({ staleTime: 15_000 });
  const overflowQuery = useCaptainAssignmentOverflow({ staleTime: 15_000 });
  const {
    accept,
    reject,
    updateStatus,
    acceptPendingOrderId,
    rejectPendingOrderId,
    updatePendingOrderId,
  } = useCaptainOrderMutations();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      logCaptainAssignment("FOCUS_REFETCH", { screen: "assignment-workbench" });
      void assignmentQuery.refetch();
      void overflowQuery.refetch();
    }, [assignmentQuery, overflowQuery]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([assignmentQuery.refetch(), overflowQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [assignmentQuery, overflowQuery]);

  const run = async (fn: () => Promise<unknown>, errTitle: string) => {
    try {
      await fn();
    } catch (e) {
      alertMutationError(errTitle, e);
    }
  };

  /**
   * Single normalization point for current-order data:
   * primary assignment + overflow rows -> normalized list from backend truth.
   * UI does not invent/suppress multi-order behavior.
   */
  const computedOrders = useMemo<NormalizedCurrentOrder[]>(() => {
    const out: NormalizedCurrentOrder[] = [];
    const seen = new Set<string>();
    const push = (row: Omit<NormalizedCurrentOrder, "id"> & { id?: string | null }) => {
      const id = normalizeOrderId(row.id);
      if (!id) return;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        kind: row.kind,
        status: row.status,
        orderNumber: row.orderNumber,
        merchantName: row.merchantName,
        pickup: row.pickup,
        dropoff: row.dropoff,
        customerPhone: row.customerPhone,
        amount: row.amount,
        cashCollection: row.cashCollection,
        offerExpiresAt: row.offerExpiresAt,
      });
    };

    // Primary keeps top priority for stable ordering.
    const primary = assignmentQuery.data;
    if (primary?.state === "OFFER") {
      push({
        id: primary.order.id,
        kind: "OFFER",
        status: primary.order.status,
        orderNumber: primary.order.orderNumber,
        merchantName: primary.order.store?.name?.trim() || "—",
        pickup: primary.order.pickupAddress,
        dropoff: primary.order.dropoffAddress,
        customerPhone: primary.order.customerPhone,
        amount: primary.order.amount,
        cashCollection: primary.order.cashCollection,
        offerExpiresAt: primary.log.expiresAt,
      });
    } else if (primary?.state === "ACTIVE") {
      const activeOrder = primary.order;
      push({
        id: activeOrder.id,
        kind: "ACTIVE",
        status: activeOrder.status,
        orderNumber: activeOrder.orderNumber,
        merchantName: activeOrder.store?.name?.trim() || "—",
        pickup: activeOrder.pickupAddress,
        dropoff: activeOrder.dropoffAddress,
        customerPhone: activeOrder.customerPhone,
        amount: activeOrder.amount,
        cashCollection: activeOrder.cashCollection,
        offerExpiresAt: null,
      });
    }

    for (const item of overflowQuery.data?.items ?? []) {
      if (!item) continue;
      push({
        id: item.orderId,
        kind: item.kind,
        status: item.status,
        orderNumber: item.orderNumber,
        merchantName: item.storeName || "—",
        pickup: item.pickupAddress,
        dropoff: item.dropoffAddress,
        customerPhone: item.customerPhone,
        amount: item.amount,
        cashCollection: item.cashCollection,
        offerExpiresAt: item.kind === "OFFER" ? item.offerExpiresAt : null,
      });
    }

    return out;
  }, [assignmentQuery.data, overflowQuery.data?.items]);

  const orders = computedOrders;

  const isLoading = assignmentQuery.isLoading;
  const isError = assignmentQuery.isError;
  const errorMessage = isError ? formatUnknownError(assignmentQuery.error, "Could not load assignment.") : null;
  const retryLoadAssignment = useCallback(() => {
    void assignmentQuery.refetch();
  }, [assignmentQuery]);

  const renderOrderCard = useCallback(
    (card: NormalizedCurrentOrder) => (
      <BundleOfferCard
        key={card.id}
        orderId={card.id}
        kind={card.kind}
        status={card.status}
        orderNumber={card.orderNumber}
        merchantName={card.merchantName}
        pickup={card.pickup}
        dropoff={card.dropoff}
        customerPhone={card.customerPhone}
        amount={card.amount}
        cashCollection={card.cashCollection}
        offerExpiresAt={card.offerExpiresAt}
        busyAccept={acceptPendingOrderId === card.id}
        busyReject={rejectPendingOrderId === card.id}
        onAccept={
          card.kind === "OFFER"
            ? () =>
                void run(async () => {
                  await accept.mutateAsync(card.id);
                }, "تعذّر القبول")
            : undefined
        }
        onReject={
          card.kind === "OFFER"
            ? () =>
                void run(async () => {
                  await reject.mutateAsync(card.id);
                }, "تعذّر الرفض")
            : undefined
        }
        onOpenDetail={() => router.push(routes.app.order(card.id))}
        onAdvance={
          card.kind === "ACTIVE"
            ? () => {
                const nextStatus = nextStatusFromCurrent(card.status);
                if (!nextStatus) return;
                void run(
                  () => updateStatus.mutateAsync({ orderId: card.id, body: { status: nextStatus } }),
                  "تعذّر تحديث الحالة",
                );
              }
            : undefined
        }
        busyAdvance={updatePendingOrderId === card.id}
        onOfferExpired={() => {
          void assignmentQuery.refetch();
          void overflowQuery.refetch();
        }}
      />
    ),
    [
      accept,
      reject,
      updateStatus,
      acceptPendingOrderId,
      rejectPendingOrderId,
      updatePendingOrderId,
      router,
      assignmentQuery,
      overflowQuery,
    ],
  );

  return {
    refreshing,
    onRefresh,
    orders,
    isLoading,
    isError,
    errorMessage,
    retryLoadAssignment,
    renderOrderCard,
  };
}

function BundleOfferCard({
  orderId,
  kind,
  status,
  orderNumber,
  merchantName,
  pickup,
  dropoff,
  customerPhone,
  amount,
  cashCollection,
  offerExpiresAt,
  busyAccept,
  busyReject,
  onAccept,
  onReject,
  onOpenDetail,
  onAdvance,
  busyAdvance,
  onOfferExpired,
}: {
  orderId: string;
  kind: "OFFER" | "ACTIVE";
  status: OrderStatusDto;
  orderNumber: string;
  merchantName: string;
  pickup: string;
  dropoff: string;
  customerPhone: string;
  amount: string;
  cashCollection: string;
  offerExpiresAt: string | null;
  busyAccept: boolean;
  busyReject: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onOpenDetail: () => void;
  onAdvance?: () => void;
  busyAdvance?: boolean;
  onOfferExpired?: () => void;
}) {
  const isOffer = kind === "OFFER";
  const statusAccent = orderStatusAccent(status);
  const statusLabelAr = orderStatusAr[status] ?? status;
  const nextStatus = nextStatusFromCurrent(status);
  const offerSeconds = useAssignmentOfferSecondsTick(offerExpiresAt, isOffer);
  const isBusy = busyAccept || busyReject || Boolean(busyAdvance);
  const expiredNotifiedRef = useRef(false);
  useEffect(() => {
    if (!isOffer) {
      expiredNotifiedRef.current = false;
      return;
    }
    if (offerSeconds !== 0) return;
    if (expiredNotifiedRef.current) return;
    expiredNotifiedRef.current = true;
    onOfferExpired?.();
  }, [isOffer, offerSeconds, onOfferExpired]);
  return (
    <View style={styles.bundleCard}>
      <View style={styles.bundleHeader}>
        <Text style={styles.bundleOrderNo}>طلب #{formatOrderSerial(orderNumber)}</Text>
        <View style={styles.bundleHeaderChips}>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: statusAccent.bg, borderColor: statusAccent.border },
            ]}
          >
            <Text style={[styles.statusChipText, { color: statusAccent.text }]} numberOfLines={1}>
              {statusLabelAr}
            </Text>
          </View>
          <View style={[styles.kindBadge, isOffer ? styles.kindBadgeOffer : styles.kindBadgeActive]}>
            <Text style={[styles.kindBadgeText, isOffer ? styles.kindBadgeOfferText : styles.kindBadgeActiveText]}>
              {isOffer ? "عرض" : "نشط"}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>المتجر</Text>
      <Text style={styles.merchantValue} numberOfLines={2}>
        {merchantName || "—"}
      </Text>

      <Text style={styles.sectionTitle}>موقع الطلب</Text>
      <View style={styles.bundleRow}>
        <Text style={styles.bundleLabel}>{ORDER_PICKUP_LOCATION_LABEL}</Text>
        <Text style={styles.bundleValue} numberOfLines={2}>
          {pickup || "—"}
        </Text>
      </View>

      <View style={styles.bundleRow}>
        <Text style={styles.bundleLabel}>{ORDER_DROPOFF_LOCATION_LABEL}</Text>
        <Text style={styles.bundleValue} numberOfLines={2}>
          {dropoff || "—"}
        </Text>
      </View>

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionTitle}>بيانات العميل</Text>
      <View style={styles.bundlePhonePill}>
        <Text style={styles.bundleMetaLabel}>الهاتف</Text>
        <Text style={styles.bundleMetaValue} numberOfLines={1}>
          {customerPhone || "—"}
        </Text>
      </View>
      {shouldShowOrderFinancialSection(status) ? (
        <View style={styles.financialOnCard}>
          <OrderFinancialSection
            amount={amount}
            cashCollection={cashCollection}
            orderStatus={status}
            variant="compact"
            hideTitle
          />
        </View>
      ) : null}

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
      <View style={styles.bundleQuickActions}>
        <Pressable style={({ pressed }) => [styles.quickMapBtn, pressed && styles.pressed]} onPress={() => void openMapSearch(pickup)}>
          <Text style={styles.quickMapBtnText}>خريطة الاستلام</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.quickMapBtn, pressed && styles.pressed]} onPress={() => void openMapSearch(dropoff)}>
          <Text style={styles.quickMapBtnText}>خريطة التسليم</Text>
        </Pressable>
      </View>

      <View style={styles.bundlePhoneRow}>
        <WhatsAppActionButton phone={customerPhone} variant="icon" size="large" />
        <Pressable onPress={() => void openPhoneDialer(customerPhone)} style={({ pressed }) => [pressed && styles.pressed]}>
          <Text style={styles.phoneLink}>{customerPhone || "—"}</Text>
        </Pressable>
      </View>

      {isOffer && offerSeconds != null ? (
        <Text style={styles.bundleTimer}>المتبقي: {formatAssignmentOfferCountdownAr(offerSeconds)}</Text>
      ) : null}

      <View style={styles.sectionDivider} />
      <View style={styles.bundleActions}>
        <Pressable onPress={onOpenDetail} style={({ pressed }) => [styles.bundleBtnGhost, pressed && styles.pressed]}>
          <Text style={styles.bundleBtnGhostText}>التفاصيل</Text>
        </Pressable>
        {isOffer ? (
          <>
            <Pressable
              onPress={onReject}
              disabled={isBusy}
              style={({ pressed }) => [styles.bundleBtnReject, pressed && styles.pressed, isBusy && styles.btnDisabled]}
            >
              {busyReject ? <ActivityIndicator size="small" color={homeTheme.textMuted} /> : <Text style={styles.bundleBtnRejectText}>رفض</Text>}
            </Pressable>
            <Pressable
              onPress={onAccept}
              disabled={isBusy}
              style={({ pressed }) => [styles.bundleBtnAccept, pressed && styles.pressed, isBusy && styles.btnDisabled]}
            >
              {busyAccept ? <ActivityIndicator size="small" color={homeTheme.onAccent} /> : <Text style={styles.bundleBtnAcceptText}>قبول</Text>}
            </Pressable>
          </>
        ) : nextStatus && onAdvance ? (
          <Pressable
            onPress={onAdvance}
            disabled={isBusy}
            style={({ pressed }) => [styles.bundleBtnAdvance, pressed && styles.pressed, isBusy && styles.btnDisabled]}
          >
            {busyAdvance ? (
              <ActivityIndicator size="small" color={homeTheme.onAccent} />
            ) : (
              <Text style={styles.bundleBtnAdvanceText}>{advanceLabelAr(nextStatus)}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function nextStatusFromCurrent(status: OrderStatusDto): "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | null {
  if (status === "ACCEPTED") return "PICKED_UP";
  if (status === "PICKED_UP") return "IN_TRANSIT";
  if (status === "IN_TRANSIT") return "DELIVERED";
  return null;
}

function advanceLabelAr(status: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED"): string {
  if (status === "PICKED_UP") return "تم الاستلام من المتجر";
  if (status === "IN_TRANSIT") return "في الطريق للعميل";
  return "تم تسليم الطلب";
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  bundleCard: {
    borderWidth: 1,
    borderColor: homeTheme.border,
    borderRadius: 14,
    backgroundColor: homeTheme.cardWhite,
    padding: 12,
    gap: 8,
    minHeight: 248,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  bundleHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  bundleHeaderChips: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    maxWidth: "58%",
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: "72%",
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  bundleOrderNo: {
    color: homeTheme.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "right",
    flexShrink: 1,
  },
  kindBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  kindBadgeOffer: {
    backgroundColor: homeTheme.accentSoft,
    borderColor: homeTheme.accentMuted,
  },
  kindBadgeActive: {
    backgroundColor: homeTheme.neutralSoft,
    borderColor: homeTheme.border,
  },
  kindBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  kindBadgeOfferText: {
    color: homeTheme.accent,
  },
  kindBadgeActiveText: {
    color: homeTheme.textMuted,
  },
  sectionTitle: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "right",
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
    marginTop: 2,
  },
  merchantValue: {
    color: homeTheme.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 20,
  },
  bundleRow: {
    gap: 2,
  },
  bundleLabel: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  bundleValue: {
    color: homeTheme.text,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 20,
  },
  bundleTimer: {
    color: homeTheme.accent,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 2,
  },
  bundleQuickActions: {
    flexDirection: "row-reverse",
    gap: 6,
  },
  quickMapBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.bg,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickMapBtnText: {
    color: homeTheme.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  bundlePhoneRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  phoneLink: {
    color: homeTheme.accent,
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
    textAlign: "right",
  },
  bundleMetaRow: {
    flexDirection: "row-reverse",
    gap: 6,
  },
  bundleMetaPill: {
    flex: 1,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.bg,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 1,
  },
  bundlePhonePill: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.bg,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 1,
  },
  financialOnCard: {
    marginTop: 6,
  },
  bundleMetaLabel: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
  },
  bundleMetaValue: {
    color: homeTheme.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  bundleActions: {
    flexDirection: "row-reverse",
    gap: 6,
    alignItems: "center",
    marginTop: 2,
  },
  bundleBtnGhost: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: homeTheme.bg,
    minHeight: 44,
    minWidth: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  bundleBtnGhostText: {
    color: homeTheme.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  bundleBtnReject: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 76,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeTheme.neutralSoft,
  },
  bundleBtnRejectText: {
    color: homeTheme.textMuted,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  bundleBtnAccept: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 76,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeTheme.accent,
  },
  bundleBtnAcceptText: {
    color: homeTheme.onAccent,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  bundleBtnAdvance: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeTheme.accent,
  },
  bundleBtnAdvanceText: {
    color: homeTheme.onAccent,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.92,
  },
  loadingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingVertical: 8,
  },
  muted: { color: homeTheme.textMuted, fontSize: 13 },
  inlineError: {
    paddingVertical: 8,
    gap: 8,
    alignItems: "flex-end",
  },
  inlineErrorText: {
    color: homeTheme.dangerText,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
  inlineRetry: {
    paddingVertical: 4,
  },
  inlineRetryText: {
    color: homeTheme.accent,
    fontWeight: "800",
    fontSize: 14,
  },
});
