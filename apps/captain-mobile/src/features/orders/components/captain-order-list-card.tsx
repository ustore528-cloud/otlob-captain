import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { OrderListItemDto } from "@/services/api/dto";
import { homeTheme } from "@/features/home/theme";
import { locationI18nKey } from "@/lib/order-location-i18n";
import { orderStatusTranslationKey } from "@/lib/order-status-i18n";
import { WhatsAppActionButton } from "@/components/ui/whatsapp-action-button";
import { openMapSearch, openPhoneDialer } from "@/lib/open-external";
import { OrderRouteTapRows } from "./order-route-tap-rows";
import { formatAssignmentOfferCountdown } from "@/lib/assignment-offer-seconds-left";
import { type ListPrimaryAction } from "../utils/order-list-primary-action";
import { formatOrderSerial } from "@/lib/order-serial";
import { OrderFinancialSection } from "@/components/order/order-financial-section";
import { shouldShowOrderFinancialSection } from "@/lib/order-payment-ui-visibility";

type Props = {
  item: OrderListItemDto;
  statusAccent: { bg: string; border: string; text: string };
  primary: ListPrimaryAction | null;
  busy: boolean;
  onOpenDetail: () => void;
  onPrimary: () => void;
  /** Lighter border, no shadow — Orders tab minimal layout */
  flatVisual?: boolean;
  /** قائمة داخل منطقة تمرير ثابتة الارتفاع — بطاقة أقصر (~3 ظاهرة) */
  compactList?: boolean;
  /** طلب عرض نشط: يظهر شارة «سيتم الإلغاء خلال…» على هذه البطاقة فقط */
  compactOfferCountdownSeconds?: number;
  /** نفس الطلب المعروض في شريط التعيين — إطار وشارة توضيحية */
  isWorkbenchLinked?: boolean;
};

export function CaptainOrderListCard({
  item,
  statusAccent,
  primary,
  busy,
  onOpenDetail,
  onPrimary,
  flatVisual = false,
  compactList = false,
  compactOfferCountdownSeconds,
  isWorkbenchLinked = false,
}: Props) {
  const { t } = useTranslation();
  const dash = t("common.emDash");
  const statusLabel = t(orderStatusTranslationKey(item.status));
  const showMainCta = primary != null && primary.kind !== "view_only";

  const dropLine = (item.dropoffAddress || item.area || "").trim();
  const pickupLine = item.pickupAddress.trim();
  const dropForMap = (item.dropoffAddress || item.area || "").trim();
  const showOfferCountdown = typeof compactOfferCountdownSeconds === "number";

  if (flatVisual && compactList) {
    const pickupDisplay = pickupLine || item.store?.name?.trim() || dash;
    const dropPrimary = dropForMap || dash;

    return (
      <View style={[styles.refCard, isWorkbenchLinked && styles.refCardWorkbench]}>
        {isWorkbenchLinked ? (
          <View
            style={styles.refWorkbenchRibbon}
            accessible
            accessibilityLabel={t("orderCard.workbenchLinkedRibbon")}
          >
            <Text style={styles.refWorkbenchRibbonText} numberOfLines={1}>
              {t("orderCard.workbenchLinkedRibbon")}
            </Text>
          </View>
        ) : null}
        <View style={styles.refTopRow}>
          <View style={styles.refHeaderSheet}>
            <View style={styles.refHeaderMeta}>
              <Pressable
                onPress={onOpenDetail}
                accessibilityRole="button"
                accessibilityLabel={t("orderCard.orderDetailsA11y", { id: formatOrderSerial(item.orderNumber, item.displayOrderNo) })}
              >
                <Text style={styles.refOrderId} numberOfLines={1}>
                  {t("orderCard.orderTitle", { id: formatOrderSerial(item.orderNumber, item.displayOrderNo) })}
                </Text>
              </Pressable>
            </View>
            <View style={styles.refBadgeRow}>
              {showOfferCountdown ? (
                <View style={styles.refCancelBadge}>
                  <Text style={styles.refCancelBadgeText} numberOfLines={2}>
                    {t("orderCard.cancelsIn", {
                      time: formatAssignmentOfferCountdown(t, compactOfferCountdownSeconds),
                    })}
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.refStatusPill,
                    { borderColor: statusAccent.border, backgroundColor: statusAccent.bg },
                  ]}
                >
                  <Text style={[styles.refStatusPillText, { color: statusAccent.text }]} numberOfLines={1}>
                    {statusLabel}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.refMiddle}>
          <View style={[styles.refSegUnified, styles.refSegStartPickup]}>
            <View style={styles.refSegHead}>
              <Text style={styles.refSegLabel}>{t(locationI18nKey.pickup)}</Text>
            </View>
            <Pressable
              onPress={() => {
                if (pickupLine) void openMapSearch(pickupLine);
              }}
              style={({ pressed }) => [
                styles.refSegBody,
                !pickupLine && styles.refRoutePressDisabled,
                pressed && pickupLine && styles.pressed,
              ]}
              disabled={!pickupLine}
              accessibilityRole="button"
              accessibilityLabel={t("assignmentBar.pickupA11y", { v: pickupDisplay })}
            >
              <View style={styles.refSegValueCol}>
                <Text style={styles.refSegValue} numberOfLines={2} ellipsizeMode="tail">
                  {pickupDisplay}
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={[styles.refSegUnified, styles.refSegStartDrop, styles.refSegAfterPickup]}>
            <View style={styles.refSegHead}>
              <Text style={styles.refSegLabel}>{t(locationI18nKey.dropoff)}</Text>
            </View>
            <Pressable
              onPress={() => {
                const q = dropLine || pickupLine;
                if (q) void openMapSearch(q);
              }}
              style={({ pressed }) => [
                styles.refSegBody,
                !dropLine && !pickupLine && styles.refRoutePressDisabled,
                pressed && (dropLine || pickupLine) && styles.pressed,
              ]}
              disabled={!dropLine && !pickupLine}
              accessibilityRole="button"
              accessibilityLabel={t("assignmentBar.dropoffA11y", { v: dropPrimary })}
            >
              <View style={styles.refSegValueCol}>
                <Text style={styles.refSegValue} numberOfLines={2} ellipsizeMode="tail">
                  {dropPrimary}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {shouldShowOrderFinancialSection(item.status) ? (
          <View style={styles.listFinancialWrap}>
            <OrderFinancialSection
              amount={item.amount}
              cashCollection={item.cashCollection}
              deliveryFee={item.deliveryFee ?? null}
              orderStatus={item.status}
              variant="compact"
              hideTitle
            />
          </View>
        ) : null}

        <View style={styles.refDivider} />

        <View style={styles.refFooterRow}>
          <View style={styles.refFooterBtns}>
            <Pressable
              onPress={() => void openPhoneDialer(item.customerPhone)}
              style={({ pressed }) => [styles.refIconBtn, styles.refCallBtn, pressed && styles.pressed]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("orderCard.callA11y", { phone: item.customerPhone })}
            >
              <Ionicons name="call-outline" size={20} color={homeTheme.accent} />
            </Pressable>
            <WhatsAppActionButton phone={item.customerPhone} variant="icon" size="default" />
            {showMainCta && primary ? (
              <Pressable
                style={({ pressed }) => [
                  styles.refOutlineCta,
                  pressed && styles.pressed,
                  busy && styles.primaryDisabled,
                ]}
                onPress={onPrimary}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t(primary.labelKey)}
              >
                {busy ? (
                  <ActivityIndicator color={homeTheme.accent} size="small" />
                ) : (
                  <Text style={styles.refOutlineCtaText} numberOfLines={1}>
                    {t(primary.labelKey)}
                  </Text>
                )}
              </Pressable>
            ) : null}
            {!showMainCta && primary?.kind === "view_only" ? (
              <Pressable
                style={({ pressed }) => [styles.refOutlineCta, pressed && styles.pressed]}
                onPress={onOpenDetail}
              >
                <Text style={styles.refOutlineCtaText} numberOfLines={1}>
                  {t(primary.labelKey)}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, flatVisual && styles.cardFlat]}>
      <Pressable
        onPress={onOpenDetail}
        style={({ pressed }) => [styles.headerRow, flatVisual && styles.headerRowDense, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("orderCard.orderDetailsA11y", { id: formatOrderSerial(item.orderNumber, item.displayOrderNo) })}
      >
        <View style={styles.headerText}>
          <Text style={styles.serialLabel}>{t("orderCard.serialLabel")}</Text>
          <Text style={styles.serial} numberOfLines={1}>
            {formatOrderSerial(item.orderNumber, item.displayOrderNo)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusAccent.bg, borderColor: statusAccent.border }]}>
          <Text style={[styles.badgeText, { color: statusAccent.text }]} numberOfLines={1}>
            {statusLabel}
          </Text>
        </View>
      </Pressable>

      <OrderRouteTapRows
        pickupAddress={item.pickupAddress}
        dropoffAddress={item.dropoffAddress}
        areaFallback={item.area}
        compact={flatVisual}
      />

      {shouldShowOrderFinancialSection(item.status) ? (
        <View style={styles.listFinancialWrap}>
          <OrderFinancialSection
            amount={item.amount}
            cashCollection={item.cashCollection}
            deliveryFee={item.deliveryFee ?? null}
            orderStatus={item.status}
            variant="compact"
            hideTitle
          />
        </View>
      ) : null}

      <View style={[styles.refDivider, styles.defaultCardDivider]} />

      <View style={styles.refFooterRow}>
        <View style={styles.refFooterBtns}>
          <Pressable
            onPress={() => void openPhoneDialer(item.customerPhone)}
            style={({ pressed }) => [styles.refIconBtn, styles.refCallBtn, pressed && styles.pressed]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("orderCard.callA11y", { phone: item.customerPhone })}
          >
            <Ionicons name="call-outline" size={20} color={homeTheme.accent} />
          </Pressable>
          <WhatsAppActionButton phone={item.customerPhone} variant="icon" size="default" />
          {showMainCta && primary ? (
            <Pressable
              style={({ pressed }) => [
                styles.refOutlineCta,
                pressed && styles.pressed,
                busy && styles.primaryDisabled,
              ]}
              onPress={onPrimary}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t(primary.labelKey)}
            >
              {busy ? (
                <ActivityIndicator color={homeTheme.accent} size="small" />
              ) : (
                <Text style={styles.refOutlineCtaText} numberOfLines={1}>
                  {t(primary.labelKey)}
                </Text>
              )}
            </Pressable>
          ) : null}
          {!showMainCta && primary?.kind === "view_only" ? (
            <Pressable
              style={({ pressed }) => [styles.refOutlineCta, pressed && styles.pressed]}
              onPress={onOpenDetail}
            >
              <Text style={styles.refOutlineCtaText} numberOfLines={1}>
                {t(primary.labelKey)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeTheme.cardWhite,
    borderRadius: homeTheme.radiusMd,
    padding: 11,
    borderWidth: 1,
    borderColor: homeTheme.border,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardFlat: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    marginBottom: 5,
    padding: 8,
  },
  headerRowDense: { marginBottom: 4 },
  defaultCardDivider: {
    marginTop: 2,
    marginBottom: 2,
  },
  pressed: { opacity: 0.94 },
  headerRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  headerText: { flex: 1, alignItems: "flex-end" },
  serialLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: homeTheme.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  serial: {
    fontSize: 18,
    fontWeight: "900",
    color: homeTheme.text,
    textAlign: "right",
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: "42%",
  },
  badgeText: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  primaryDisabled: { opacity: 0.6 },
  /** —— تبويب الطلبات: بطاقة قابلة للمسح بصرياً (إطار أيقونة، استلام/تسليم، تذييل) —— */
  refCard: {
    backgroundColor: homeTheme.cardWhite,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 0,
    marginBottom: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    ...homeTheme.cardShadow,
    overflow: "hidden",
  },
  refCardWorkbench: {
    borderColor: homeTheme.accentMuted,
    borderWidth: 1.5,
  },
  refWorkbenchRibbon: {
    backgroundColor: homeTheme.accentSoft,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginHorizontal: -8,
    marginTop: -4,
    marginBottom: 4,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  refWorkbenchRibbonText: {
    fontSize: 9,
    fontWeight: "800",
    color: homeTheme.accent,
    textAlign: "right",
    lineHeight: 13,
  },
  refTopRow: {
    marginBottom: 2,
  },
  /** رقم + شارة — فاصل سفلي خفيف */
  refHeaderSheet: {
    backgroundColor: homeTheme.cardWhite,
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 4,
    gap: 3,
    marginBottom: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  refHeaderMeta: {
    gap: 2,
    alignItems: "flex-end",
  },
  refOrderId: {
    fontSize: 15,
    fontWeight: "800",
    color: homeTheme.text,
    textAlign: "right",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  refBadgeRow: {
    alignItems: "flex-end",
    width: "100%",
  },
  refCancelBadge: {
    alignSelf: "flex-end",
    maxWidth: "100%",
    backgroundColor: homeTheme.neutralSoft,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  refCancelBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: homeTheme.dangerText,
    textAlign: "right",
    lineHeight: 14,
  },
  refStatusPill: {
    alignSelf: "flex-end",
    maxWidth: "100%",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  refStatusPillText: { fontSize: 10, fontWeight: "800", textAlign: "center" },
  /** تدفق: رأس → استلام → تسليم → إجراءات */
  refMiddle: {
    gap: 2,
    marginBottom: 0,
  },
  refRoutePressDisabled: { opacity: 0.55 },
  /** استلام/تسليم: خلفية موحّدة مع شريط بداية ملوّن (بدون كتل خلفية ثقيلة) */
  refSegUnified: {
    paddingVertical: 2,
    paddingEnd: 0,
    paddingStart: 8,
    borderStartWidth: 2,
    backgroundColor: "transparent",
  },
  refSegStartPickup: {
    borderStartColor: homeTheme.accent,
  },
  refSegStartDrop: {
    borderStartColor: homeTheme.gold,
  },
  refSegAfterPickup: {
    marginTop: 2,
    paddingTop: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
  },
  refSegHead: {
    marginBottom: 2,
  },
  refSegLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: "900",
    color: homeTheme.textMuted,
    textAlign: "right",
    letterSpacing: -0.1,
    lineHeight: 14,
  },
  refSegBody: {
    paddingTop: 0,
  },
  refSegValueCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  refSegValue: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    color: homeTheme.text,
    textAlign: "right",
  },
  listFinancialWrap: {
    marginTop: 4,
    marginBottom: 2,
  },
  refDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: homeTheme.border,
    marginTop: 0,
    marginBottom: 3,
  },
  refFooterRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
    paddingTop: 0,
    paddingBottom: 4,
  },
  refFooterBtns: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  refIconBtn: {
    padding: 2,
  },
  refCallBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.accentMuted,
    backgroundColor: homeTheme.cardWhite,
  },
  refOutlineCta: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: homeTheme.radiusMd,
    borderWidth: 1.5,
    borderColor: homeTheme.accent,
    backgroundColor: homeTheme.cardWhite,
    minHeight: 30,
    maxWidth: 148,
  },
  refOutlineCtaText: {
    color: homeTheme.accent,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    flexShrink: 1,
  },
});
