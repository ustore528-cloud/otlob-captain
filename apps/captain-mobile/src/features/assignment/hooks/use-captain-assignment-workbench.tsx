import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
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
import type { OrderStatusDto } from "@/services/api/dto";
import type { OrderFinancialBreakdownDto } from "@/lib/order-financial-breakdown";
import { orderStatusTranslationKey } from "@/lib/order-status-i18n";
import { orderStatusAccent } from "@/features/orders/utils/order-status-accent";
import { locationI18nKey } from "@/lib/order-location-i18n";
import { ActionRow, type ActionRowItem } from "@/components/ui";
import { hasMapCoordinates, openOrderMapNav, openPhoneDialer, openWhatsAppChat } from "@/lib/open-external";
import { OrderFinancialSection } from "@/components/order/order-financial-section";
import { shouldShowOrderFinancialSection } from "@/lib/order-payment-ui-visibility";
import { workflowAdvanceLabelKey } from "../utils/captain-order-actions";
import { playNewOrderAlertSound, stopNewOrderAlertSound } from "@/lib/sounds/new-order-alert";

/** ASSIGNED+pending offer → API `OFFER` (shown here as kind OFFER); post-accept work → `ACTIVE` (ACCEPTED+). Blocking for auto distribution still counts ASSIGNED on server. */

type NormalizedCurrentOrder = {
  id: string;
  kind: "OFFER" | "ACTIVE";
  status: OrderStatusDto;
  orderNumber: string;
  displayOrderNo?: number | null;
  merchantName: string;
  pickup: string;
  dropoff: string;
  customerName: string;
  customerPhone: string;
  senderFullName: string | null;
  senderPhone: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  notes: string | null;
  amount: string;
  deliveryFee: string | null;
  cashCollection: string;
  /** Present on primary assignment (`OrderDetailDto`); overflow infers from raw fields. */
  financialBreakdown?: OrderFinancialBreakdownDto | null;
  offerExpiresAt: string | null;
};

function trimStr(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function normalizeOrderId(id: unknown): string {
  return String(id ?? "").trim();
}

/** Current-order workbench modeled as a list (primary + overflow), not a single-order screen. */
export function useCaptainAssignmentWorkbench() {
  const { t } = useTranslation();
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
  const lastPlayedOfferKeyRef = useRef<string | null>(null);

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
    const push = (
      row: Omit<NormalizedCurrentOrder, "id" | "displayOrderNo"> &
        Pick<NormalizedCurrentOrder, "displayOrderNo"> & { id?: string | null },
    ) => {
      const id = normalizeOrderId(row.id);
      if (!id) return;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        kind: row.kind,
        status: row.status,
        orderNumber: row.orderNumber,
        displayOrderNo: row.displayOrderNo ?? null,
        merchantName: row.merchantName,
        pickup: row.pickup,
        dropoff: row.dropoff,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        senderFullName: row.senderFullName,
        senderPhone: row.senderPhone,
        pickupLat: row.pickupLat,
        pickupLng: row.pickupLng,
        dropoffLat: row.dropoffLat,
        dropoffLng: row.dropoffLng,
        notes: row.notes,
        amount: row.amount,
        deliveryFee: row.deliveryFee,
        cashCollection: row.cashCollection,
        financialBreakdown: row.financialBreakdown,
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
        displayOrderNo: primary.order.displayOrderNo ?? null,
        merchantName: primary.order.store?.name?.trim() || "—",
        pickup: primary.order.pickupAddress,
        dropoff: primary.order.dropoffAddress,
        customerName: primary.order.customerName ?? "",
        customerPhone: primary.order.customerPhone,
        senderFullName: primary.order.senderFullName ?? null,
        senderPhone: primary.order.senderPhone ?? null,
        pickupLat: primary.order.pickupLat ?? null,
        pickupLng: primary.order.pickupLng ?? null,
        dropoffLat: primary.order.dropoffLat ?? null,
        dropoffLng: primary.order.dropoffLng ?? null,
        notes: primary.order.notes ?? null,
        amount: primary.order.amount,
        deliveryFee: primary.order.deliveryFee ?? null,
        cashCollection: primary.order.cashCollection,
        financialBreakdown: primary.order.financialBreakdown ?? null,
        offerExpiresAt: primary.log.expiresAt,
      });
    } else if (primary?.state === "ACTIVE") {
      const activeOrder = primary.order;
      push({
        id: activeOrder.id,
        kind: "ACTIVE",
        status: activeOrder.status,
        orderNumber: activeOrder.orderNumber,
        displayOrderNo: activeOrder.displayOrderNo ?? null,
        merchantName: activeOrder.store?.name?.trim() || "—",
        pickup: activeOrder.pickupAddress,
        dropoff: activeOrder.dropoffAddress,
        customerName: activeOrder.customerName ?? "",
        customerPhone: activeOrder.customerPhone,
        senderFullName: activeOrder.senderFullName ?? null,
        senderPhone: activeOrder.senderPhone ?? null,
        pickupLat: activeOrder.pickupLat ?? null,
        pickupLng: activeOrder.pickupLng ?? null,
        dropoffLat: activeOrder.dropoffLat ?? null,
        dropoffLng: activeOrder.dropoffLng ?? null,
        notes: activeOrder.notes ?? null,
        amount: activeOrder.amount,
        deliveryFee: activeOrder.deliveryFee ?? null,
        cashCollection: activeOrder.cashCollection,
        financialBreakdown: activeOrder.financialBreakdown ?? null,
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
        displayOrderNo: item.displayOrderNo ?? null,
        merchantName: item.storeName || "—",
        pickup: item.pickupAddress,
        dropoff: item.dropoffAddress,
        customerName: "",
        customerPhone: item.customerPhone,
        senderFullName: null,
        senderPhone: null,
        pickupLat: null,
        pickupLng: null,
        dropoffLat: null,
        dropoffLng: null,
        notes: null,
        amount: item.amount,
        deliveryFee: item.deliveryFee,
        cashCollection: item.cashCollection,
        financialBreakdown: null,
        offerExpiresAt: item.kind === "OFFER" ? item.offerExpiresAt : null,
      });
    }

    return out;
  }, [assignmentQuery.data, overflowQuery.data?.items]);

  const orders = computedOrders;

  useEffect(() => {
    const current = assignmentQuery.data;
    if (current?.state === "OFFER") {
      const offerKey = `${current.order.id}:${current.log.id}`;
      if (lastPlayedOfferKeyRef.current !== offerKey) {
        lastPlayedOfferKeyRef.current = offerKey;
        void playNewOrderAlertSound();
      }
      return;
    }

    lastPlayedOfferKeyRef.current = null;
    void stopNewOrderAlertSound();
  }, [assignmentQuery.data]);

  useEffect(
    () => () => {
      void stopNewOrderAlertSound();
    },
    [],
  );

  const isLoading = assignmentQuery.isLoading;
  const isError = assignmentQuery.isError;
  const errorMessage = isError ? formatUnknownError(assignmentQuery.error, t("workbench.loadError")) : null;
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
        customerName={card.customerName}
        customerPhone={card.customerPhone}
        senderFullName={card.senderFullName}
        senderPhone={card.senderPhone}
        pickupLat={card.pickupLat}
        pickupLng={card.pickupLng}
        dropoffLat={card.dropoffLat}
        dropoffLng={card.dropoffLng}
        notes={card.notes}
        amount={card.amount}
        deliveryFee={card.deliveryFee}
        cashCollection={card.cashCollection}
        financialBreakdown={card.financialBreakdown}
        offerExpiresAt={card.offerExpiresAt}
        busyAccept={acceptPendingOrderId === card.id}
        busyReject={rejectPendingOrderId === card.id}
        onAccept={
          card.kind === "OFFER"
            ? () =>
                void run(async () => {
                  lastPlayedOfferKeyRef.current = null;
                  await stopNewOrderAlertSound();
                  await accept.mutateAsync(card.id);
                }, t("workbench.errorAccept"))
            : undefined
        }
        onReject={
          card.kind === "OFFER"
            ? () =>
                void run(async () => {
                  lastPlayedOfferKeyRef.current = null;
                  await stopNewOrderAlertSound();
                  await reject.mutateAsync(card.id);
                }, t("workbench.errorReject"))
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
                  t("workbench.errorUpdate"),
                );
              }
            : undefined
        }
        busyAdvance={updatePendingOrderId === card.id}
        onOfferExpired={() => {
          lastPlayedOfferKeyRef.current = null;
          void stopNewOrderAlertSound();
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
      t,
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
  orderId: _orderId,
  kind,
  status,
  orderNumber,
  displayOrderNo,
  merchantName,
  pickup,
  dropoff,
  customerName,
  customerPhone,
  senderFullName,
  senderPhone,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  notes,
  amount,
  deliveryFee,
  cashCollection,
  financialBreakdown,
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
  displayOrderNo?: number | null;
  merchantName: string;
  pickup: string;
  dropoff: string;
  customerName: string;
  customerPhone: string;
  senderFullName: string | null;
  senderPhone: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  notes: string | null;
  amount: string;
  deliveryFee: string | null;
  cashCollection: string;
  financialBreakdown?: OrderFinancialBreakdownDto | null;
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
  const { t } = useTranslation();
  const dash = t("common.emDash");
  const sp = trimStr(senderPhone) || null;
  const cp = trimStr(customerPhone) || null;
  const cn = trimStr(customerName);
  const sfn = trimStr(senderFullName);
  const pickupNav = Boolean(trimStr(pickup)) || hasMapCoordinates(pickupLat, pickupLng);
  const dropNav = Boolean(trimStr(dropoff)) || hasMapCoordinates(dropoffLat, dropoffLng);
  const notesLine = trimStr(notes);

  const pickupToolbar: ActionRowItem[] = [
    {
      key: "s-call",
      icon: "call-outline",
      disabled: !sp,
      onPress: () => {
        if (sp) void openPhoneDialer(sp);
      },
      accessibilityLabel: t("orderDetail.callSenderA11y", { phone: sp ?? dash }),
    },
    {
      key: "s-wa",
      icon: "logo-whatsapp",
      disabled: !sp,
      onPress: () => {
        if (sp) void openWhatsAppChat(sp);
      },
      accessibilityLabel: t("orderDetail.whatsappSenderA11y", { phone: sp ?? dash }),
    },
    {
      key: "p-map",
      icon: "map-outline",
      disabled: !pickupNav,
      onPress: () =>
        void openOrderMapNav({
          address: pickup,
          lat: pickupLat,
          lng: pickupLng,
        }),
      accessibilityLabel: t("orderDetail.mapNavPickupA11y"),
    },
  ];

  const deliveryToolbar: ActionRowItem[] = [
    {
      key: "c-call",
      icon: "call-outline",
      disabled: !cp,
      onPress: () => {
        if (cp) void openPhoneDialer(cp);
      },
      accessibilityLabel: t("orderDetail.callA11y", { phone: cp ?? dash }),
    },
    {
      key: "c-wa",
      icon: "logo-whatsapp",
      disabled: !cp,
      onPress: () => {
        if (cp) void openWhatsAppChat(cp);
      },
      accessibilityLabel: t("whatsapp.a11y", { phone: cp ?? dash }),
    },
    {
      key: "d-map",
      icon: "map-outline",
      disabled: !dropNav,
      onPress: () =>
        void openOrderMapNav({
          address: dropoff,
          lat: dropoffLat,
          lng: dropoffLng,
        }),
      accessibilityLabel: t("orderDetail.mapNavDeliveryA11y"),
    },
  ];
  const isOffer = kind === "OFFER";
  const statusAccent = orderStatusAccent(status);
  const statusLabel = t(orderStatusTranslationKey(status));
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
        <Text style={styles.bundleOrderNo}>
          {displayOrderNo != null ? t("workbench.orderLine", { n: displayOrderNo }) : t("workbench.orderLineFallback")}
        </Text>
        <View style={styles.bundleHeaderChips}>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: statusAccent.bg, borderColor: statusAccent.border },
            ]}
          >
            <Text style={[styles.statusChipText, { color: statusAccent.text }]} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
          <View style={[styles.kindBadge, isOffer ? styles.kindBadgeOffer : styles.kindBadgeActive]}>
            <Text style={[styles.kindBadgeText, isOffer ? styles.kindBadgeOfferText : styles.kindBadgeActiveText]}>
              {isOffer ? t("assignmentKind.offer") : t("assignmentKind.active")}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t("workbench.store")}</Text>
      <Text style={styles.merchantValue} numberOfLines={2}>
        {merchantName || dash}
      </Text>

      <Text style={styles.sectionTitle}>{t("workbench.orderLocation")}</Text>
      <View style={styles.bundleRow}>
        <Text style={styles.bundleLabel}>{t(locationI18nKey.pickup)}</Text>
        <Text style={styles.bundleValue} numberOfLines={2}>
          {pickup || dash}
        </Text>
      </View>

      <View style={styles.bundleRow}>
        <Text style={styles.bundleLabel}>{t(locationI18nKey.dropoff)}</Text>
        <Text style={styles.bundleValue} numberOfLines={2}>
          {dropoff || dash}
        </Text>
      </View>

      <View style={styles.sectionDivider} />
      {sfn || sp ? (
        <View style={styles.senderBlock}>
          <Text style={styles.sectionTitle}>{t("orderDetail.sectionPickupSender")}</Text>
          {sfn ? (
            <Text style={styles.bundleSenderName} numberOfLines={2}>
              {sfn}
            </Text>
          ) : null}
          {sp ? (
            <Text style={styles.bundleMetaValue} numberOfLines={1}>
              {sp}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>{t("workbench.customer")}</Text>
      {cn ? (
        <Text style={styles.bundleCustomerName} numberOfLines={2}>
          {cn}
        </Text>
      ) : null}
      <View style={styles.bundlePhonePill}>
        <Text style={styles.bundleMetaLabel}>{t("workbench.phone")}</Text>
        <Text style={styles.bundleMetaValue} numberOfLines={1}>
          {customerPhone || dash}
        </Text>
      </View>
      {notesLine ? (
        <Text style={styles.bundleNotesPreview} numberOfLines={3}>
          {notesLine}
        </Text>
      ) : null}
      {shouldShowOrderFinancialSection(status) ? (
        <View style={styles.financialOnCard}>
          <OrderFinancialSection
            amount={amount}
            cashCollection={cashCollection}
            deliveryFee={deliveryFee}
            orderStatus={status}
            financialBreakdown={financialBreakdown}
            variant="compact"
            hideTitle
          />
        </View>
      ) : null}

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionTitle}>{t("orderDetail.toolbarPickup")}</Text>
      <ActionRow items={pickupToolbar} style={styles.bundleActionRow} />
      <Text style={styles.sectionTitle}>{t("orderDetail.toolbarDelivery")}</Text>
      <ActionRow items={deliveryToolbar} style={styles.bundleActionRow} />

      {isOffer && offerSeconds != null ? (
        <View style={styles.bundleTimerBadge}>
          <Text style={styles.bundleTimerText}>
            {t("workbench.timeRemainingSeconds", { seconds: Math.max(offerSeconds, 0) })}
          </Text>
        </View>
      ) : null}

      <View style={styles.sectionDivider} />
      <View style={styles.bundleActions}>
        <Pressable onPress={onOpenDetail} style={({ pressed }) => [styles.bundleBtnGhost, pressed && styles.pressed]}>
          <Text style={styles.bundleBtnGhostText}>{t("workbench.details")}</Text>
        </Pressable>
        {isOffer ? (
          <>
            <Pressable
              onPress={onReject}
              disabled={isBusy}
              style={({ pressed }) => [styles.bundleBtnReject, pressed && styles.pressed, isBusy && styles.btnDisabled]}
            >
              {busyReject ? (
                <ActivityIndicator size="small" color={homeTheme.textMuted} />
              ) : (
                <Text style={styles.bundleBtnRejectText}>{t("workbench.reject")}</Text>
              )}
            </Pressable>
            <Pressable
              onPress={onAccept}
              disabled={isBusy}
              style={({ pressed }) => [styles.bundleBtnAccept, pressed && styles.pressed, isBusy && styles.btnDisabled]}
            >
              {busyAccept ? (
                <ActivityIndicator size="small" color={homeTheme.onAccent} />
              ) : (
                <Text style={styles.bundleBtnAcceptText}>{t("assignmentBar.acceptOrder")}</Text>
              )}
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
              <Text style={styles.bundleBtnAdvanceText}>{t(workflowAdvanceLabelKey(nextStatus))}</Text>
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
    fontSize: 10,
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
    fontSize: 11,
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
  bundleTimerBadge: {
    alignSelf: "flex-end",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#FDEBEC",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#F8C9CD",
    marginTop: 2,
  },
  bundleTimerText: {
    color: "#A32732",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  bundleActionRow: {
    paddingVertical: 6,
    alignSelf: "stretch",
  },
  bundleCustomerName: {
    fontSize: 14,
    fontWeight: "700",
    color: homeTheme.text,
    textAlign: "right",
    marginBottom: 6,
  },
  senderBlock: {
    marginBottom: 10,
    gap: 6,
    alignSelf: "stretch",
  },
  bundleSenderName: {
    fontSize: 13,
    fontWeight: "700",
    color: homeTheme.text,
    textAlign: "right",
  },
  bundleNotesPreview: {
    fontSize: 11,
    color: homeTheme.textMuted,
    textAlign: "right",
    marginTop: 6,
    marginBottom: 10,
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
    backgroundColor: homeTheme.cardWhite,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBtnInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
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
    backgroundColor: homeTheme.cardWhite,
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
