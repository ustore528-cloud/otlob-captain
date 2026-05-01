import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { OrderDetailDto } from "@/services/api/dto";
import { ActionRow, SectionCard, StatusBadge, type ActionRowItem } from "@/components/ui";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";
import { orderStatusTranslationKey } from "@/lib/order-status-i18n";
import { formatOrderEventTime } from "@/lib/order-timestamps";
import { OrderFinancialSection } from "@/components/order/order-financial-section";
import { shouldShowOrderFinancialSection } from "@/lib/order-payment-ui-visibility";
import { hasMapCoordinates, openOrderMapNav, openPhoneDialer, openWhatsAppChat } from "@/lib/open-external";
import { AssignmentLogsTimeline } from "./components/assignment-logs-timeline";
import { DetailRow } from "./components/detail-row";
import { OrderStatusProgress } from "./components/order-status-progress";
import { isRtlLng } from "@/i18n/i18n";
import { formatOrderSerial } from "@/lib/order-serial";
import { mapOrderStatusDtoToBadgeVariant } from "@/lib/map-order-status-to-badge-variant";
import { resolveOrderFinancialBreakdownDto } from "@/lib/order-financial-breakdown";

export type OrderDetailContentProps = {
  order: OrderDetailDto;
  offerHint?: string | null;
  showAssignmentLogs?: boolean;
};

function trimOrNull(s: string | null | undefined): string | null {
  const x = (s ?? "").trim();
  return x || null;
}

function formatCoord(n: number): string {
  return Number.isFinite(n) ? n.toFixed(5) : String(n);
}

/**
 * عرض موحّد لبيانات الطلب — بطاقات مدمجة للموبايل.
 */
export function OrderDetailContent({ order, offerHint, showAssignmentLogs = true }: OrderDetailContentProps) {
  const { t, i18n } = useTranslation();
  const rtl = isRtlLng(i18n.resolvedLanguage ?? i18n.language);
  const notRecorded = t("orderDetail.notRecorded");
  const statusLabel = t(orderStatusTranslationKey(order.status));
  const statusBadgeVariant = mapOrderStatusDtoToBadgeVariant(order.status);
  const showFinancial = shouldShowOrderFinancialSection(order.status);

  const senderPhone = trimOrNull(order.senderPhone);
  const senderName = trimOrNull(order.senderFullName);
  const customerPhone = trimOrNull(order.customerPhone);
  const customerName = trimOrNull(order.customerName);
  const notes = trimOrNull(order.notes);

  const pickupAddr = trimOrNull(order.pickupAddress) ?? "";
  const dropAddr = trimOrNull(order.dropoffAddress) ?? trimOrNull(order.area) ?? "";

  const canNavigatePickup =
    Boolean(pickupAddr) || hasMapCoordinates(order.pickupLat, order.pickupLng);
  const canNavigateDrop =
    Boolean(dropAddr) || hasMapCoordinates(order.dropoffLat, order.dropoffLng);

  const financialDto = resolveOrderFinancialBreakdownDto({
    amount: order.amount,
    cashCollection: order.cashCollection,
    deliveryFee: order.deliveryFee ?? null,
    financialBreakdown: order.financialBreakdown,
  });
  const paymentMethodLabel = financialDto.isCashOnDelivery
    ? t("orderDetail.paymentMethodCod")
    : t("orderDetail.paymentMethodPrepaid");

  const pickupCoordLine = hasMapCoordinates(order.pickupLat, order.pickupLng)
    ? t("orderDetail.coordinatesLine", {
        lat: formatCoord(order.pickupLat as number),
        lng: formatCoord(order.pickupLng as number),
      })
    : null;

  const dropCoordLine = hasMapCoordinates(order.dropoffLat, order.dropoffLng)
    ? t("orderDetail.coordinatesLine", {
        lat: formatCoord(order.dropoffLat as number),
        lng: formatCoord(order.dropoffLng as number),
      })
    : null;

  const senderToolbar: ActionRowItem[] = [
    {
      key: "sender-call",
      icon: "call-outline",
      disabled: !senderPhone,
      onPress: () => {
        if (senderPhone) void openPhoneDialer(senderPhone);
      },
      accessibilityLabel: t("orderDetail.callSenderA11y", { phone: senderPhone ?? t("common.emDash") }),
    },
    {
      key: "sender-wa",
      icon: "logo-whatsapp",
      disabled: !senderPhone,
      onPress: () => {
        if (senderPhone) void openWhatsAppChat(senderPhone);
      },
      accessibilityLabel: t("orderDetail.whatsappSenderA11y", { phone: senderPhone ?? t("common.emDash") }),
    },
    {
      key: "sender-map",
      icon: "map-outline",
      disabled: !canNavigatePickup,
      onPress: () =>
        void openOrderMapNav({
          address: pickupAddr,
          lat: order.pickupLat,
          lng: order.pickupLng,
        }),
      accessibilityLabel: t("orderDetail.mapNavPickupA11y"),
    },
  ];

  const customerToolbar: ActionRowItem[] = [
    {
      key: "cust-call",
      icon: "call-outline",
      disabled: !customerPhone,
      onPress: () => {
        if (customerPhone) void openPhoneDialer(customerPhone);
      },
      accessibilityLabel: t("orderDetail.callA11y", { phone: customerPhone ?? t("common.emDash") }),
    },
    {
      key: "cust-wa",
      icon: "logo-whatsapp",
      disabled: !customerPhone,
      onPress: () => {
        if (customerPhone) void openWhatsAppChat(customerPhone);
      },
      accessibilityLabel: t("whatsapp.a11y", { phone: customerPhone ?? t("common.emDash") }),
    },
    {
      key: "cust-map",
      icon: "map-outline",
      disabled: !canNavigateDrop,
      onPress: () =>
        void openOrderMapNav({
          address: dropAddr,
          lat: order.dropoffLat,
          lng: order.dropoffLng,
        }),
      accessibilityLabel: t("orderDetail.mapNavDeliveryA11y"),
    },
  ];

  return (
    <View style={[styles.stack, { direction: rtl ? "rtl" : "ltr" }]}>
      <SectionCard title={t("orderDetail.sectionOrder")} icon="receipt-outline" compact>
        <Text style={styles.orderNo}>{formatOrderSerial(order.orderNumber, order.displayOrderNo)}</Text>
        <View style={styles.badgeRow}>
          <StatusBadge variant={statusBadgeVariant} label={statusLabel} />
        </View>
        <Text style={styles.timeLine} numberOfLines={5}>
          {t("orderDetail.created")}: {formatOrderEventTime(order.createdAt, notRecorded)}
          {"\n"}
          {t("orderDetail.pickupTime")}: {formatOrderEventTime(order.pickedUpAt, notRecorded)}
          {"\n"}
          {t("orderDetail.deliveryTime")}: {formatOrderEventTime(order.deliveredAt, notRecorded)}
        </Text>
        {offerHint ? (
          <View style={styles.offerBanner}>
            <Text style={styles.offerText} numberOfLines={3}>
              {offerHint}
            </Text>
          </View>
        ) : null}
        <Text style={styles.inlineMeta} numberOfLines={1}>
          {t("orderDetail.areaLine", { area: order.area })}
        </Text>
        <Text style={styles.inlineMeta} numberOfLines={2}>
          {t("orderDetail.storeLine", { name: order.store.name, area: order.store.area })}
        </Text>
        {showFinancial ? (
          <View style={styles.financialInset}>
            <Text style={styles.financialInsetTitle}>{t("money.sectionTitle")}</Text>
            <OrderFinancialSection
              amount={order.amount}
              cashCollection={order.cashCollection}
              deliveryFee={order.deliveryFee ?? null}
              orderStatus={order.status}
              financialBreakdown={order.financialBreakdown}
              variant="default"
              hideTitle
            />
            <Text style={styles.paymentMethodLine}>{t("orderDetail.paymentMethodLabel")}</Text>
            <Text style={styles.paymentMethodValue}>{paymentMethodLabel}</Text>
          </View>
        ) : null}
        <OrderStatusProgress status={order.status} compact />
      </SectionCard>

      <SectionCard title={t("orderDetail.sectionPickupSender")} icon="cube-outline" compact>
        <View style={styles.infoPanel}>
          {senderName ? (
            <Text style={styles.infoTitle} numberOfLines={2}>
              {senderName}
            </Text>
          ) : null}
          {senderPhone ? (
            <Pressable
              onPress={() => void openPhoneDialer(senderPhone)}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel={t("orderDetail.callSenderA11y", { phone: senderPhone })}
              style={({ pressed }) => [styles.phonePress, pressed && styles.phonePressed]}
            >
              <Text style={styles.phoneLink}>{senderPhone}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.toolbarCaption}>{t("orderDetail.toolbarPickup")}</Text>
          <ActionRow items={senderToolbar} style={styles.actionRowTight} />
          {pickupAddr ? (
            <Pressable
              onPress={() =>
                void openOrderMapNav({
                  address: pickupAddr,
                  lat: order.pickupLat,
                  lng: order.pickupLng,
                })
              }
              hitSlop={8}
              style={({ pressed }) => [styles.addressButton, pressed && styles.phonePressed]}
            >
              <Text style={styles.addressButtonText}>{pickupAddr}</Text>
            </Pressable>
          ) : hasMapCoordinates(order.pickupLat, order.pickupLng) ? (
            <Pressable
              onPress={() =>
                void openOrderMapNav({
                  address: "",
                  lat: order.pickupLat,
                  lng: order.pickupLng,
                })
              }
              hitSlop={8}
              style={({ pressed }) => [styles.addressButton, pressed && styles.phonePressed]}
            >
              <Text style={styles.addressButtonText}>{pickupCoordLine}</Text>
            </Pressable>
          ) : (
            <Text style={styles.mutedLine}>{t("orderDetail.addressMissingPickup")}</Text>
          )}
          {pickupCoordLine && pickupAddr ? (
            <Text style={styles.coordLine} numberOfLines={2}>
              {pickupCoordLine}
            </Text>
          ) : null}
        </View>
      </SectionCard>

      <SectionCard title={t("orderDetail.sectionDeliveryCustomer")} icon="person-outline" compact>
        <View style={styles.infoPanel}>
          {customerName ? (
            <Text style={styles.infoTitle} numberOfLines={2}>
              {customerName}
            </Text>
          ) : null}
          {customerPhone ? (
            <Pressable
              onPress={() => void openPhoneDialer(customerPhone)}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel={t("orderDetail.callA11y", { phone: customerPhone })}
              style={({ pressed }) => [styles.phonePress, pressed && styles.phonePressed]}
            >
              <Text style={styles.phoneLink}>{customerPhone}</Text>
            </Pressable>
          ) : (
            <Text style={styles.mutedLine}>{t("orderDetail.customerPhoneMissing")}</Text>
          )}
          <Text style={styles.toolbarCaption}>{t("orderDetail.toolbarDelivery")}</Text>
          <ActionRow items={customerToolbar} style={styles.actionRowTight} />
          {dropAddr ? (
            <Pressable
              onPress={() =>
                void openOrderMapNav({
                  address: dropAddr,
                  lat: order.dropoffLat,
                  lng: order.dropoffLng,
                })
              }
              hitSlop={8}
              style={({ pressed }) => [styles.addressButton, pressed && styles.phonePressed]}
            >
              <Text style={styles.addressButtonText}>{dropAddr}</Text>
            </Pressable>
          ) : hasMapCoordinates(order.dropoffLat, order.dropoffLng) ? (
            <Pressable
              onPress={() =>
                void openOrderMapNav({
                  address: "",
                  lat: order.dropoffLat,
                  lng: order.dropoffLng,
                })
              }
              hitSlop={8}
              style={({ pressed }) => [styles.addressButton, pressed && styles.phonePressed]}
            >
              <Text style={styles.addressButtonText}>{dropCoordLine}</Text>
            </Pressable>
          ) : (
            <Text style={styles.mutedLine}>{t("orderDetail.addressMissingDelivery")}</Text>
          )}
          {dropCoordLine && dropAddr ? (
            <Text style={styles.coordLine} numberOfLines={2}>
              {dropCoordLine}
            </Text>
          ) : null}
          {notes ? (
            <View style={styles.notesBlock}>
              <DetailRow compact isFirst label={t("orderDetail.deliveryNotesLabel")} value={notes} />
            </View>
          ) : null}
        </View>
      </SectionCard>

      {showAssignmentLogs ? <AssignmentLogsTimeline logs={order.assignmentLogs} compact /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: captainSpacing.md,
  },
  orderNo: {
    ...captainTypography.sectionTitle,
    color: captainUiTheme.text,
    textAlign: "right",
    marginBottom: captainSpacing.xs,
  },
  badgeRow: {
    alignItems: "flex-end",
    marginBottom: captainSpacing.sm,
  },
  timeLine: {
    color: captainUiTheme.textMuted,
    fontSize: 11,
    textAlign: "right",
    lineHeight: 16,
    marginBottom: captainSpacing.sm,
  },
  offerBanner: {
    backgroundColor: captainUiTheme.goldSoft,
    borderRadius: captainUiTheme.radiusMd,
    padding: captainSpacing.sm,
    borderWidth: 1,
    borderColor: captainUiTheme.goldMuted,
    marginBottom: captainSpacing.sm,
  },
  offerText: {
    color: captainUiTheme.gold,
    fontSize: 11,
    textAlign: "right",
    lineHeight: 16,
  },
  inlineMeta: {
    color: captainUiTheme.textSubtle,
    fontSize: 11,
    textAlign: "right",
    lineHeight: 16,
    marginBottom: captainSpacing.xs,
  },
  actionRowTight: {
    paddingVertical: captainSpacing.xs,
    alignSelf: "stretch",
    justifyContent: "flex-end",
  },
  financialInset: {
    marginTop: captainSpacing.sm,
    paddingTop: captainSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: captainUiTheme.border,
    gap: captainSpacing.xs,
  },
  financialInsetTitle: {
    ...captainTypography.caption,
    color: captainUiTheme.textMuted,
    textAlign: "right",
  },
  paymentMethodLine: {
    ...captainTypography.caption,
    color: captainUiTheme.textMuted,
    textAlign: "right",
    marginTop: captainSpacing.sm,
  },
  paymentMethodValue: {
    color: captainUiTheme.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  infoPanel: {
    gap: captainSpacing.sm,
    alignItems: "flex-end",
  },
  infoTitle: {
    color: captainUiTheme.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  toolbarCaption: {
    ...captainTypography.caption,
    color: captainUiTheme.textSubtle,
    textAlign: "right",
    alignSelf: "stretch",
    marginTop: captainSpacing.xs,
  },
  addressButton: {
    width: "100%",
    borderRadius: captainUiTheme.radiusMd,
    backgroundColor: captainUiTheme.neutralSoft,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    padding: captainSpacing.sm + 2,
  },
  addressButtonText: {
    color: captainUiTheme.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  coordLine: {
    color: captainUiTheme.textSubtle,
    fontSize: 11,
    textAlign: "right",
    lineHeight: 16,
    width: "100%",
  },
  mutedLine: {
    color: captainUiTheme.textMuted,
    fontSize: 12,
    textAlign: "right",
    width: "100%",
  },
  phonePress: { alignSelf: "flex-end" },
  phonePressed: { opacity: 0.85 },
  phoneLink: {
    color: captainUiTheme.accent,
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
    textDecorationColor: captainUiTheme.accentMuted,
    lineHeight: 18,
  },
  notesBlock: {
    width: "100%",
    marginTop: captainSpacing.xs,
  },
});
