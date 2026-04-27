import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { OrderDetailDto } from "@/services/api/dto";
import { homeTheme } from "@/features/home/theme";
import { locationI18nKey } from "@/lib/order-location-i18n";
import { orderStatusTranslationKey } from "@/lib/order-status-i18n";
import { formatOrderEventTime } from "@/lib/order-timestamps";
import { WhatsAppActionButton } from "@/components/ui/whatsapp-action-button";
import { OrderFinancialSection } from "@/components/order/order-financial-section";
import { shouldShowOrderFinancialSection } from "@/lib/order-payment-ui-visibility";
import { openMapSearch, openPhoneDialer } from "@/lib/open-external";
import { AssignmentLogsTimeline } from "./components/assignment-logs-timeline";
import { DetailRow } from "./components/detail-row";
import { OrderStatusProgress } from "./components/order-status-progress";
import { SectionCard } from "./components/section-card";
import { isRtlLng } from "@/i18n/i18n";
import { formatOrderSerial } from "@/lib/order-serial";
import { orderStatusAccent } from "@/features/orders/utils/order-status-accent";

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
  const statusAccent = orderStatusAccent(order.status);
  return (
    <View style={[styles.stack, { direction: rtl ? "rtl" : "ltr" }]}>
      {/* بطاقة 1: رقم الطلب + الحالة + الوقت + ملخص سريع */}
      <SectionCard title={t("orderDetail.sectionOrder")} icon="receipt-outline" compact>
        <Text style={styles.orderNo}>{formatOrderSerial(order.orderNumber, order.displayOrderNo)}</Text>
        <View style={styles.pillRow}>
          <View
            style={[
              styles.pill,
              { backgroundColor: statusAccent.bg, borderColor: statusAccent.border },
            ]}
          >
            <Text style={[styles.pillText, { color: statusAccent.text }]}>{statusLabel}</Text>
          </View>
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
        <View style={styles.customerRow}>
          <Text style={styles.customerNameLine} numberOfLines={2}>
            {t("orderDetail.customerLine", { name: order.customerName })}
            {" · "}
          </Text>
          <View style={styles.phoneActionsRow}>
            <WhatsAppActionButton phone={order.customerPhone} variant="pill" />
            <Pressable
              onPress={() => void openPhoneDialer(order.customerPhone)}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel={t("orderDetail.callA11y", { phone: order.customerPhone })}
              style={({ pressed }) => [styles.phonePress, pressed && styles.phonePressed]}
            >
              <Text style={styles.phoneLink}>{order.customerPhone}</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.inlineMeta} numberOfLines={1}>
          {t("orderDetail.areaLine", { area: order.area })}
        </Text>
        <Text style={styles.inlineMeta} numberOfLines={2}>
          {t("orderDetail.storeLine", { name: order.store.name, area: order.store.area })}
        </Text>
        <OrderStatusProgress status={order.status} compact />
      </SectionCard>

      <View style={styles.infoGrid}>
        <SectionCard title={t("orderDetail.sectionRestaurant")} icon="storefront-outline" compact>
          <View style={styles.infoPanel}>
            <Text style={styles.infoTitle}>{order.store.name}</Text>
            <Text style={styles.infoSub}>{order.store.area}</Text>
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
            <View style={styles.phoneActionsRow}>
              <WhatsAppActionButton phone={order.customerPhone} variant="pill" />
              <Pressable
                onPress={() => void openPhoneDialer(order.customerPhone)}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel={t("orderDetail.callA11y", { phone: order.customerPhone })}
                style={({ pressed }) => [styles.phonePress, pressed && styles.phonePressed]}
              >
                <Text style={styles.phoneLink}>{order.customerPhone}</Text>
              </Pressable>
            </View>
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

      {/* بطاقة 2: المالية والتحصيل + حاسبة نقد — تظهر من مرحلة التوصيل للعميل فقط */}
      {shouldShowOrderFinancialSection(order.status) ? (
        <SectionCard title={t("money.sectionTitle")} icon="cash-outline" compact>
          <OrderFinancialSection
            amount={order.amount}
            cashCollection={order.cashCollection}
            deliveryFee={order.deliveryFee ?? null}
            orderStatus={order.status}
            financialBreakdown={order.financialBreakdown}
            variant="default"
            hideTitle
          />
        </SectionCard>
      ) : null}

      {/* بطاقة 3: العناوين */}
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

      {/* بطاقة 4: الملاحظات */}
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
    gap: 10,
  },
  orderNo: {
    color: homeTheme.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: "row-reverse",
    marginBottom: 6,
  },
  pill: {
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  timeLine: {
    color: homeTheme.textMuted,
    fontSize: 11,
    textAlign: "right",
    lineHeight: 16,
    marginBottom: 8,
  },
  offerBanner: {
    backgroundColor: homeTheme.goldSoft,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: homeTheme.goldMuted,
    marginBottom: 8,
  },
  offerText: {
    color: homeTheme.gold,
    fontSize: 11,
    textAlign: "right",
    lineHeight: 16,
  },
  inlineMeta: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    textAlign: "right",
    lineHeight: 16,
    marginBottom: 4,
  },
  infoGrid: {
    gap: 10,
  },
  infoPanel: {
    gap: 8,
    alignItems: "flex-end",
  },
  infoTitle: {
    color: homeTheme.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  infoSub: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  addressButton: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: homeTheme.neutralSoft,
    borderWidth: 1,
    borderColor: homeTheme.border,
    padding: 10,
  },
  addressButtonText: {
    color: homeTheme.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  customerRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  phoneActionsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  customerNameLine: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    textAlign: "right",
    lineHeight: 16,
  },
  phonePress: { alignSelf: "flex-end" },
  phonePressed: { opacity: 0.85 },
  phoneLink: {
    color: homeTheme.accent,
    fontSize: 11,
    fontWeight: "800",
    textDecorationLine: "underline",
    textDecorationColor: homeTheme.accentMuted,
    lineHeight: 16,
  },
});
