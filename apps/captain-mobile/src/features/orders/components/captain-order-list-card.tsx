import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { OrderListItemDto } from "@/services/api/dto";
import { StatusBadge } from "@/components/ui";
import { captainSpacing, captainUiTheme } from "@/theme/captain-ui-theme";
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
import { mapOrderStatusDtoToBadgeVariant } from "@/lib/map-order-status-to-badge-variant";

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
  void statusAccent;
  const dash = t("common.emDash");
  const statusLabel = t(orderStatusTranslationKey(item.status));
  const showMainCta = primary != null && primary.kind !== "view_only";
  const statusBadgeVariant = mapOrderStatusDtoToBadgeVariant(item.status);

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
                <StatusBadge variant={statusBadgeVariant} label={statusLabel} compact />
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
              <Ionicons name="call-outline" size={20} color={captainUiTheme.accent} />
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
                  <ActivityIndicator color={captainUiTheme.accent} size="small" />
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
        <View style={styles.defaultStatusWrap}>
          <StatusBadge variant={statusBadgeVariant} label={statusLabel} />
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
            <Ionicons name="call-outline" size={20} color={captainUiTheme.accent} />
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
                <ActivityIndicator color={captainUiTheme.accent} size="small" />
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
    backgroundColor: captainUiTheme.surfaceElevated,
    borderRadius: captainUiTheme.radiusLg,
    padding: captainSpacing.md,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    marginBottom: captainSpacing.sm,
    ...captainUiTheme.cardShadow,
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
  defaultStatusWrap: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    maxWidth: "42%",
    minWidth: 0,
    flexShrink: 0,
  },
  serialLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: captainUiTheme.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  serial: {
    fontSize: 18,
    fontWeight: "900",
    color: captainUiTheme.text,
    textAlign: "right",
    marginTop: 2,
  },
  primaryDisabled: { opacity: 0.6 },
  /** —— تبويب الطلبات: بطاقة قابلة للمسح بصرياً (إطار أيقونة، استلام/تسليم، تذييل) —— */
  refCard: {
    backgroundColor: captainUiTheme.surfaceElevated,
    borderRadius: captainUiTheme.radiusMd,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 0,
    marginBottom: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.border,
    ...captainUiTheme.cardShadow,
    overflow: "hidden",
  },
  refCardWorkbench: {
    borderColor: captainUiTheme.accentMuted,
    borderWidth: 1.5,
  },
  refWorkbenchRibbon: {
    backgroundColor: captainUiTheme.accentSoft,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginHorizontal: -8,
    marginTop: -4,
    marginBottom: 4,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: captainUiTheme.border,
  },
  refWorkbenchRibbonText: {
    fontSize: 9,
    fontWeight: "800",
    color: captainUiTheme.accent,
    textAlign: "right",
    lineHeight: 13,
  },
  refTopRow: {
    marginBottom: 2,
  },
  /** رقم + شارة — فاصل سفلي خفيف */
  refHeaderSheet: {
    backgroundColor: captainUiTheme.surfaceElevated,
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 4,
    gap: 3,
    marginBottom: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: captainUiTheme.border,
  },
  refHeaderMeta: {
    gap: 2,
    alignItems: "flex-end",
  },
  refOrderId: {
    fontSize: 15,
    fontWeight: "800",
    color: captainUiTheme.text,
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
    backgroundColor: captainUiTheme.neutralSoft,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
  },
  refCancelBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: captainUiTheme.dangerText,
    textAlign: "right",
    lineHeight: 14,
  },
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
    borderStartColor: captainUiTheme.accent,
  },
  refSegStartDrop: {
    borderStartColor: captainUiTheme.gold,
  },
  refSegAfterPickup: {
    marginTop: 2,
    paddingTop: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: captainUiTheme.border,
  },
  refSegHead: {
    marginBottom: 2,
  },
  refSegLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: "900",
    color: captainUiTheme.textMuted,
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
    color: captainUiTheme.text,
    textAlign: "right",
  },
  listFinancialWrap: {
    marginTop: 4,
    marginBottom: 2,
  },
  refDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: captainUiTheme.border,
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
    borderRadius: captainUiTheme.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.accentMuted,
    backgroundColor: captainUiTheme.surfaceElevated,
  },
  refOutlineCta: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: captainSpacing.sm,
    paddingHorizontal: captainSpacing.md,
    borderRadius: captainUiTheme.radiusMd,
    borderWidth: 1.5,
    borderColor: captainUiTheme.accent,
    backgroundColor: captainUiTheme.surfaceElevated,
    minHeight: 40,
    maxWidth: 160,
  },
  refOutlineCtaText: {
    color: captainUiTheme.accent,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    flexShrink: 1,
  },
});
