import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { OrderDetailDto } from "@/services/api/dto";
import { ActionRow, SectionCard, StatusBadge } from "@/components/ui";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";
import { locationI18nKey } from "@/lib/order-location-i18n";
import { orderStatusTranslationKey } from "@/lib/order-status-i18n";
import { formatOrderEventTime } from "@/lib/order-timestamps";
import { OrderFinancialSection } from "@/components/order/order-financial-section";
import { shouldShowOrderFinancialSection } from "@/lib/order-payment-ui-visibility";
import { openMapSearch, openPhoneDialer, openWhatsAppChat } from "@/lib/open-external";
import { AssignmentLogsTimeline } from "./components/assignment-logs-timeline";
import { DetailRow } from "./components/detail-row";
import { OrderStatusProgress } from "./components/order-status-progress";
import { isRtlLng } from "@/i18n/i18n";
import { formatOrderSerial } from "@/lib/order-serial";
import { mapOrderStatusDtoToBadgeVariant } from "@/lib/map-order-status-to-badge-variant";

export type OrderDetailContentProps = {
  order: OrderDetailDto;
  offerHint?: string | null;
  showAssignmentLogs?: boolean;
};

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

  const heroContactItems = [
    {
      key: "wa",
      icon: "logo-whatsapp" as const,
      onPress: () => void openWhatsAppChat(order.customerPhone),
      accessibilityLabel: t("whatsapp.a11y", { phone: order.customerPhone }),
    },
    {
      key: "call",
      icon: "call-outline" as const,
      onPress: () => void openPhoneDialer(order.customerPhone),
      accessibilityLabel: t("orderDetail.callA11y", { phone: order.customerPhone }),
    },
    {
      key: "drop-map",
      icon: "map-outline" as const,
      onPress: () => void openMapSearch(order.dropoffAddress),
      accessibilityLabel: t("orderDetail.mapHintDropoff"),
    },
  ];

  const restaurantMapItems = [
    {
      key: "pickup-map",
      icon: "map-outline" as const,
      onPress: () => void openMapSearch(order.pickupAddress),
      accessibilityLabel: t("orderDetail.mapHintPickup"),
    },
  ];

  const customerPanelItems = [
    {
      key: "wa2",
      icon: "logo-whatsapp" as const,
      onPress: () => void openWhatsAppChat(order.customerPhone),
      accessibilityLabel: t("whatsapp.a11y", { phone: order.customerPhone }),
    },
    {
      key: "call2",
      icon: "call-outline" as const,
      onPress: () => void openPhoneDialer(order.customerPhone),
      accessibilityLabel: t("orderDetail.callA11y", { phone: order.customerPhone }),
    },
    {
      key: "drop-map2",
      icon: "map-outline" as const,
      onPress: () => void openMapSearch(order.dropoffAddress),
      accessibilityLabel: t("orderDetail.mapHintDropoff"),
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
        <View style={styles.customerBlock}>
          <Text style={styles.customerNameLine} numberOfLines={2}>
            {t("orderDetail.customerLine", { name: order.customerName })}
          </Text>
          <ActionRow items={heroContactItems} style={styles.actionRowTight} />
          <Pressable
            onPress={() => void openWhatsAppChat(order.customerPhone)}
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel={t("orderDetail.callA11y", { phone: order.customerPhone })}
            style={({ pressed }) => [styles.phonePress, pressed && styles.phonePressed]}
          >
            <Text style={styles.phoneLink}>{order.customerPhone}</Text>
          </Pressable>
        </View>
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
          </View>
        ) : null}
        <OrderStatusProgress status={order.status} compact />
      </SectionCard>

      <View style={styles.infoGrid}>
        <SectionCard title={t("orderDetail.sectionRestaurant")} icon="storefront-outline" compact>
          <View style={styles.infoPanel}>
            <Text style={styles.infoTitle}>{order.store.name}</Text>
            <Text style={styles.infoSub}>{order.store.area}</Text>
            <ActionRow items={restaurantMapItems} style={styles.actionRowTight} />
            <Pressable
              onPress={() => void openMapSearch(order.pickupAddress)}
              hitSlop={8}
              style={({ pressed }) => [styles.addressButton, pressed && styles.phonePressed]}
            >
              <Text style={styles.addressButtonText}>{order.pickupAddress}</Text>
            </Pressable>
          </View>
        </SectionCard>

        <SectionCard title={t("orderDetail.sectionCustomer")} icon="person-outline" compact>
          <View style={styles.infoPanel}>
            <Text style={styles.infoTitle}>{order.customerName}</Text>
            <ActionRow items={customerPanelItems} style={styles.actionRowTight} />
            <Pressable
              onPress={() => void openWhatsAppChat(order.customerPhone)}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel={t("orderDetail.callA11y", { phone: order.customerPhone })}
              style={({ pressed }) => [styles.phonePress, pressed && styles.phonePressed]}
            >
              <Text style={styles.phoneLink}>{order.customerPhone}</Text>
            </Pressable>
            <Pressable
              onPress={() => void openMapSearch(order.dropoffAddress)}
              hitSlop={8}
              style={({ pressed }) => [styles.addressButton, pressed && styles.phonePressed]}
            >
              <Text style={styles.addressButtonText}>{order.dropoffAddress}</Text>
            </Pressable>
          </View>
        </SectionCard>
      </View>

      <SectionCard title={t("orderDetail.sectionAddresses")} icon="map-outline" compact>
        <DetailRow
          compact
          isFirst
          label={t(locationI18nKey.pickup)}
          value={order.pickupAddress}
          addressEmphasis
          hint={t("orderDetail.hintFromStore")}
          onPressValue={() => void openMapSearch(order.pickupAddress)}
          valueAccessibilityHint={t("orderDetail.mapHintPickup")}
        />
        <DetailRow
          compact
          label={t(locationI18nKey.dropoff)}
          value={order.dropoffAddress}
          addressEmphasis
          hint={t("orderDetail.hintCustomerAddress")}
          onPressValue={() => void openMapSearch(order.dropoffAddress)}
          valueAccessibilityHint={t("orderDetail.mapHintDropoff")}
        />
      </SectionCard>

      {order.notes ? (
        <SectionCard title={t("orderDetail.sectionNotes")} icon="document-text-outline" compact>
          <DetailRow compact isFirst label={t("orderDetail.notesField")} value={order.notes} />
        </SectionCard>
      ) : null}

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
  customerBlock: {
    alignItems: "flex-end",
    gap: captainSpacing.xs,
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
  infoGrid: {
    gap: captainSpacing.md,
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
  infoSub: {
    color: captainUiTheme.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
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
  customerNameLine: {
    color: captainUiTheme.textSubtle,
    fontSize: 11,
    textAlign: "right",
    lineHeight: 16,
    width: "100%",
  },
  phonePress: { alignSelf: "flex-end" },
  phonePressed: { opacity: 0.85 },
  phoneLink: {
    color: captainUiTheme.accent,
    fontSize: 11,
    fontWeight: "800",
    textDecorationLine: "underline",
    textDecorationColor: captainUiTheme.accentMuted,
    lineHeight: 16,
  },
});
