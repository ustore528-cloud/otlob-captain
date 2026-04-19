import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { OrderListItemDto } from "@/services/api/dto";
import { homeTheme } from "@/features/home/theme";
import { ORDER_DROPOFF_LOCATION_LABEL, ORDER_PICKUP_LOCATION_LABEL } from "@/lib/order-location-labels";
import { orderStatusAr } from "@/lib/order-status-ar";
import { openMapSearch, openPhoneDialer } from "@/lib/open-external";
import { formatOrderListDate } from "../utils/format-order-date";
import { OrderRouteTapRows } from "./order-route-tap-rows";
import { formatAssignmentOfferCountdownAr } from "@/lib/assignment-offer-seconds-left";
import {
  type ListPrimaryAction,
  paymentSummaryLine,
  paymentSummaryLineAr,
} from "../utils/order-list-primary-action";

function listItemTotalDisplay(item: OrderListItemDto): string {
  const cash = parseFloat(item.cashCollection || "0");
  if (cash > 0) return String(item.cashCollection).trim();
  const amt = parseFloat(item.amount || "0");
  return Number.isFinite(amt) ? amt.toFixed(2) : item.amount;
}

function statusProgressPct(status: OrderListItemDto["status"]): number {
  const m: Partial<Record<OrderListItemDto["status"], number>> = {
    PENDING: 0.12,
    CONFIRMED: 0.18,
    ASSIGNED: 0.22,
    ACCEPTED: 0.48,
    PICKED_UP: 0.62,
    IN_TRANSIT: 0.82,
    DELIVERED: 1,
    CANCELLED: 0.05,
  };
  return m[status] ?? 0.2;
}

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
}: Props) {
  const statusLabel = orderStatusAr[item.status] ?? item.status;
  const showMainCta = primary != null && primary.kind !== "view_only";

  const dropLine = (item.dropoffAddress || item.area || "").trim();
  const pickupLine = item.pickupAddress.trim();
  const dropForMap = (item.dropoffAddress || item.area || "").trim();
  const showOfferCountdown = typeof compactOfferCountdownSeconds === "number";

  if (flatVisual && compactList) {
    const storeName = item.store?.name?.trim();
    const pickupPrimary = storeName || pickupLine || "—";
    const pickupSecondary =
      storeName && pickupLine && pickupLine !== storeName ? pickupLine : "";
    const dropPrimary = dropForMap || "—";
    const cust = item.customerName?.trim();
    const progressPct = Math.round(statusProgressPct(item.status) * 100);

    return (
      <View style={styles.refCard}>
        <View style={styles.refTopRow}>
          <View
            style={[styles.refOrderIconFrame, { borderColor: statusAccent.border, backgroundColor: statusAccent.bg }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Ionicons name="receipt-outline" size={24} color={statusAccent.text} />
          </View>
          <View style={styles.refTopMain}>
            <View style={styles.refHeaderSheet}>
              <View style={styles.refHeaderMeta}>
                <Pressable onPress={onOpenDetail} accessibilityRole="button" accessibilityLabel={`تفاصيل الطلب ${item.orderNumber}`}>
                  <Text style={styles.refOrderId} numberOfLines={1}>
                    طلب #{item.orderNumber}
                  </Text>
                </Pressable>
                <Text style={styles.refOrderDate} numberOfLines={1}>
                  {formatOrderListDate(item.createdAt)}
                </Text>
              </View>
              <View style={styles.refBadgeRow}>
                {showOfferCountdown ? (
                  <View style={styles.refCancelBadge}>
                    <Text style={styles.refCancelBadgeText} numberOfLines={2}>
                      سيتم الإلغاء خلال {formatAssignmentOfferCountdownAr(compactOfferCountdownSeconds)}
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
        </View>

        <View style={styles.refMiddle}>
          <View style={[styles.refSegUnified, styles.refSegStartPickup]}>
            <View style={styles.refSegHead}>
              <View style={[styles.refSegIconCircle, styles.refSegIconPickup]}>
                <Ionicons name="storefront-outline" size={13} color={homeTheme.accent} />
              </View>
              <Text style={styles.refSegLabel}>{ORDER_PICKUP_LOCATION_LABEL}</Text>
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
              accessibilityLabel={`${ORDER_PICKUP_LOCATION_LABEL}: ${pickupPrimary}`}
            >
              <View style={styles.refSegValueCol}>
                <Text style={styles.refSegValue} numberOfLines={2} ellipsizeMode="tail">
                  {pickupPrimary}
                </Text>
                {pickupSecondary ? (
                  <Text style={styles.refSegSub} numberOfLines={1} ellipsizeMode="tail">
                    {pickupSecondary}
                  </Text>
                ) : null}
              </View>
              {pickupLine ? <Ionicons name="map-outline" size={16} color={homeTheme.accent} /> : null}
            </Pressable>
          </View>

          <View style={[styles.refSegUnified, styles.refSegStartDrop, styles.refSegAfterPickup]}>
            <View style={styles.refSegHead}>
              <View style={[styles.refSegIconCircle, styles.refSegIconDrop]}>
                <Ionicons name="navigate-circle-outline" size={13} color={homeTheme.gold} />
              </View>
              <Text style={styles.refSegLabel}>{ORDER_DROPOFF_LOCATION_LABEL}</Text>
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
              accessibilityLabel={`${ORDER_DROPOFF_LOCATION_LABEL}: ${dropPrimary}`}
            >
              <View style={styles.refSegValueCol}>
                <Text style={styles.refSegValue} numberOfLines={2} ellipsizeMode="tail">
                  {dropPrimary}
                </Text>
                {cust ? (
                  <Text style={styles.refSegCustomer} numberOfLines={1} ellipsizeMode="tail">
                    العميل: {cust}
                  </Text>
                ) : null}
              </View>
              {dropLine || pickupLine ? <Ionicons name="map-outline" size={16} color={homeTheme.gold} /> : null}
            </Pressable>
          </View>

          <View style={styles.refProgressBlock}>
            <Text style={styles.refProgressLabel}>التقدّم</Text>
            <View style={styles.refProgressTrack}>
              <View style={[styles.refProgressFill, { width: `${progressPct}%` }]} />
            </View>
          </View>

          <Pressable onPress={onOpenDetail} style={({ pressed }) => [styles.refDetailLink, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={styles.refDetailLinkText}>التفاصيل والمسار</Text>
          </Pressable>
        </View>

        <View style={styles.refDivider} />

        <View style={styles.refFooterRow}>
          <View style={styles.refFooterPrice}>
            <Ionicons name="cash-outline" size={18} color={homeTheme.gold} />
            <View style={styles.refFooterPriceText}>
              <Text style={styles.refPayHint} numberOfLines={1}>
                {paymentSummaryLineAr(item)}
              </Text>
              <Text style={styles.refPriceBig} numberOfLines={1}>
                {listItemTotalDisplay(item)}{" "}
                <Text style={styles.refCurrency}>ر.س</Text>
              </Text>
            </View>
          </View>

          <View style={styles.refFooterBtns}>
            <Pressable
              onPress={() => void openPhoneDialer(item.customerPhone)}
              style={({ pressed }) => [styles.refIconBtn, pressed && styles.pressed]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`اتصال ${item.customerPhone}`}
            >
              <Ionicons name="call-outline" size={20} color={homeTheme.accent} />
            </Pressable>
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
                accessibilityLabel={primary.labelEn}
              >
                {busy ? (
                  <ActivityIndicator color={homeTheme.accent} size="small" />
                ) : (
                  <>
                    <Text style={styles.refOutlineCtaText} numberOfLines={1}>
                      {primary.labelAr}
                    </Text>
                    <Ionicons name="chevron-back" size={18} color={homeTheme.accent} />
                  </>
                )}
              </Pressable>
            ) : null}
            {!showMainCta && primary?.kind === "view_only" ? (
              <Pressable
                style={({ pressed }) => [styles.refOutlineCta, pressed && styles.pressed]}
                onPress={onOpenDetail}
              >
                <Text style={styles.refOutlineCtaText} numberOfLines={1}>
                  {primary.labelAr}
                </Text>
                <Ionicons name="chevron-back" size={18} color={homeTheme.accent} />
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
        accessibilityLabel={`تفاصيل الطلب ${item.orderNumber}`}
      >
        <View style={styles.headerText}>
          <Text style={styles.serialLabel}>Order #</Text>
          <Text style={styles.serial} numberOfLines={1}>
            {item.orderNumber}
          </Text>
          <Text style={styles.dateMuted}>{formatOrderListDate(item.createdAt)}</Text>
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

      <View style={styles.customerRow}>
        <Text style={styles.customerName} numberOfLines={1}>
          {item.customerName}
          {" · "}
        </Text>
        <Pressable
          onPress={() => void openPhoneDialer(item.customerPhone)}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={`اتصال ${item.customerPhone}`}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text style={styles.phoneLink}>{item.customerPhone}</Text>
        </Pressable>
      </View>

      <View style={[styles.moneyRow, flatVisual && styles.moneyRowDense]}>
        <Ionicons name="cash-outline" size={18} color={homeTheme.accent} />
        <View style={styles.moneyText}>
          <Text style={styles.paymentEn}>{paymentSummaryLine(item)}</Text>
          <Text style={styles.paymentAr}>{paymentSummaryLineAr(item)}</Text>
        </View>
      </View>

      {showMainCta && primary && (
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, busy && styles.primaryDisabled]}
          onPress={onPrimary}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={primary.labelEn}
        >
          {busy ? (
            <ActivityIndicator color={homeTheme.onAccent} />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>{primary.labelEn}</Text>
              <Text style={styles.primaryBtnSub}>{primary.labelAr}</Text>
            </>
          )}
        </Pressable>
      )}

      {primary?.kind === "view_only" && (
        <Pressable
          style={({ pressed }) => [
            styles.secondaryOutline,
            flatVisual && styles.secondaryOutlineFlat,
            pressed && styles.pressed,
          ]}
          onPress={onOpenDetail}
        >
          <Text style={styles.secondaryOutlineText}>{primary.labelEn}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeTheme.cardWhite,
    borderRadius: homeTheme.radiusMd,
    padding: 14,
    borderWidth: 1,
    borderColor: homeTheme.border,
    marginBottom: 10,
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
    marginBottom: 6,
    padding: 10,
  },
  headerRowDense: { marginBottom: 6 },
  moneyRowDense: { paddingVertical: 6, marginBottom: 8 },
  pressed: { opacity: 0.94 },
  headerRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
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
  dateMuted: { fontSize: 11, color: homeTheme.textSubtle, marginTop: 4 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: "42%",
  },
  badgeText: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  customerRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  customerName: {
    fontSize: 13,
    color: homeTheme.textMuted,
    textAlign: "right",
  },
  phoneLink: {
    fontSize: 13,
    fontWeight: "800",
    color: homeTheme.accent,
    textDecorationLine: "underline",
    textDecorationColor: homeTheme.accentMuted,
    textAlign: "right",
  },
  moneyRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
    marginBottom: 12,
  },
  moneyText: { flex: 1, alignItems: "flex-end" },
  paymentEn: { fontSize: 12, color: homeTheme.text, fontWeight: "700", textAlign: "right" },
  paymentAr: { fontSize: 11, color: homeTheme.textMuted, textAlign: "right", marginTop: 2 },
  primaryBtn: {
    backgroundColor: homeTheme.accent,
    borderRadius: homeTheme.radiusMd,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: homeTheme.onAccent,
    fontSize: 15,
    fontWeight: "800",
  },
  primaryBtnSub: {
    color: "rgba(250,247,240,0.85)",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  secondaryOutline: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.accentMuted,
    borderRadius: homeTheme.radiusMd,
    backgroundColor: homeTheme.cardWhite,
  },
  secondaryOutlineFlat: {
    backgroundColor: homeTheme.cardWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
  },
  secondaryOutlineText: { color: homeTheme.accent, fontWeight: "800", fontSize: 14 },
  /** —— تبويب الطلبات: بطاقة قابلة للمسح بصرياً (إطار أيقونة، استلام/تسليم، تذييل) —— */
  refCard: {
    backgroundColor: homeTheme.cardWhite,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 0,
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    overflow: "hidden",
  },
  refTopRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  refOrderIconFrame: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.14,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  refTopMain: {
    flex: 1,
    minWidth: 0,
  },
  /** رقم + تاريخ + شارة — نفس خلفية البطاقة، فاصل سفلي خفيف فقط */
  refHeaderSheet: {
    backgroundColor: homeTheme.cardWhite,
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 6,
    gap: 4,
    marginBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  refHeaderMeta: {
    gap: 3,
    alignItems: "flex-end",
  },
  refOrderId: {
    fontSize: 16,
    fontWeight: "800",
    color: homeTheme.text,
    textAlign: "right",
    letterSpacing: -0.2,
  },
  refOrderDate: {
    fontSize: 10,
    fontWeight: "600",
    color: homeTheme.textSubtle,
    textAlign: "right",
    lineHeight: 14,
  },
  refBadgeRow: {
    alignItems: "flex-end",
    width: "100%",
  },
  refCancelBadge: {
    alignSelf: "flex-end",
    maxWidth: "100%",
    backgroundColor: homeTheme.neutralSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  refCancelBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: homeTheme.dangerText,
    textAlign: "right",
    lineHeight: 16,
  },
  refStatusPill: {
    alignSelf: "flex-end",
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  refStatusPillText: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  /** تدفق: رأس → استلام → تسليم → تقدّم الحالة → رابط تفاصيل → دفع/إجراءات */
  refMiddle: {
    gap: 5,
    marginBottom: 2,
  },
  refRoutePressDisabled: { opacity: 0.55 },
  /** استلام/تسليم: خلفية موحّدة مع شريط بداية ملوّن (بدون كتل خلفية ثقيلة) */
  refSegUnified: {
    paddingVertical: 3,
    paddingEnd: 2,
    paddingStart: 10,
    borderStartWidth: 3,
    backgroundColor: "transparent",
  },
  refSegStartPickup: {
    borderStartColor: homeTheme.accent,
  },
  refSegStartDrop: {
    borderStartColor: homeTheme.gold,
  },
  refSegAfterPickup: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
  },
  refSegHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    minHeight: 22,
  },
  refSegIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  refSegIconPickup: {
    backgroundColor: homeTheme.cardWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.accentMuted,
  },
  refSegIconDrop: {
    backgroundColor: homeTheme.cardWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.goldMuted,
  },
  refSegLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "900",
    color: homeTheme.textMuted,
    textAlign: "right",
    letterSpacing: -0.1,
    lineHeight: 15,
  },
  refSegBody: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 0,
  },
  refSegValueCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  refSegValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: homeTheme.text,
    textAlign: "right",
  },
  refSegSub: {
    fontSize: 10,
    fontWeight: "600",
    color: homeTheme.textMuted,
    textAlign: "right",
    lineHeight: 14,
  },
  refSegCustomer: {
    fontSize: 10,
    fontWeight: "700",
    color: homeTheme.accent,
    textAlign: "right",
    lineHeight: 14,
  },
  refProgressBlock: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingVertical: 0,
    marginVertical: 0,
  },
  refProgressLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: homeTheme.textSubtle,
    minWidth: 44,
    textAlign: "right",
  },
  refProgressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: homeTheme.neutralSoft,
    overflow: "hidden",
  },
  refProgressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: homeTheme.accent,
  },
  refDetailLink: {
    alignSelf: "flex-end",
    paddingVertical: 2,
    marginTop: 0,
  },
  refDetailLinkText: {
    fontSize: 11,
    fontWeight: "700",
    color: homeTheme.accent,
    textAlign: "right",
    textDecorationLine: "underline",
  },
  refDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: homeTheme.border,
    marginTop: 0,
    marginBottom: 4,
  },
  refFooterRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 0,
    paddingBottom: 6,
  },
  refFooterPrice: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  refFooterPriceText: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
  },
  refPayHint: {
    fontSize: 11,
    fontWeight: "600",
    color: homeTheme.textMuted,
    textAlign: "right",
  },
  refPriceBig: {
    fontSize: 15,
    fontWeight: "900",
    color: homeTheme.text,
    textAlign: "right",
    marginTop: 0,
  },
  refCurrency: {
    fontSize: 13,
    fontWeight: "800",
    color: homeTheme.gold,
  },
  refFooterBtns: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  refIconBtn: {
    padding: 4,
  },
  refOutlineCta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: homeTheme.radiusMd,
    borderWidth: 1.5,
    borderColor: homeTheme.accent,
    backgroundColor: homeTheme.cardWhite,
    minHeight: 36,
    maxWidth: 158,
  },
  refOutlineCtaText: {
    color: homeTheme.accent,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    flexShrink: 1,
  },
});
