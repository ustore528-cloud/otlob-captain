import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { OrderDetailDto } from "@/services/api/dto";
import { homeTheme } from "@/features/home/theme";
import { orderStatusAr } from "@/lib/order-status-ar";
import { openPhoneDialer } from "@/lib/open-external";
import { orderStatusAccent, type StatusAccent } from "../utils/order-status-accent";
import {
  paymentSummaryLineArFromDetail,
  paymentSummaryLineFromDetail,
} from "../utils/order-list-primary-action";
import { OrderRouteTapRows } from "./order-route-tap-rows";

type Props = {
  order: OrderDetailDto;
  offerHint?: string | null;
  /** أقصر ارتفاعًا — يُستخدم في رأس تبويب الطلبات مع قائمة طلبات أخرى */
  compact?: boolean;
  onOpenDetail: () => void;
};

/**
 * Single focused block for the active assignment on the Orders tab — matches list card info density without nested section cards.
 */
export function CaptainWorkbenchOrderCard({ order, offerHint, compact, onOpenDetail }: Props) {
  const accent: StatusAccent = orderStatusAccent(order.status);
  const statusLabel = orderStatusAr[order.status] ?? order.status;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Pressable
        onPress={onOpenDetail}
        style={({ pressed }) => [styles.headerRow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Order ${order.orderNumber}, open details`}
      >
        <View style={styles.headerText}>
          <Text style={styles.serialLabel}>Order #</Text>
          <Text style={styles.serial} numberOfLines={1}>
            {order.orderNumber}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: accent.bg, borderColor: accent.border }]}>
          <Text style={[styles.badgeText, { color: accent.text }]} numberOfLines={1}>
            {statusLabel}
          </Text>
        </View>
      </Pressable>

      {offerHint ? (
        <Text style={[styles.hintLine, compact && styles.hintLineCompact]} numberOfLines={2}>
          {offerHint}
        </Text>
      ) : null}

      <OrderRouteTapRows
        pickupAddress={order.pickupAddress}
        dropoffAddress={order.dropoffAddress}
        areaFallback={order.area}
        compact={compact}
      />

      <View style={styles.customerRow}>
        <Text style={styles.customerName} numberOfLines={1}>
          {order.customerName}
          {" · "}
        </Text>
        <Pressable
          onPress={() => void openPhoneDialer(order.customerPhone)}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={`اتصال ${order.customerPhone}`}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text style={styles.phoneLink}>{order.customerPhone}</Text>
        </Pressable>
      </View>

      <View style={[styles.moneyRow, compact && styles.moneyRowCompact]}>
        <Ionicons name="cash-outline" size={compact ? 16 : 18} color={homeTheme.accent} />
        <View style={styles.moneyText}>
          <Text style={[styles.paymentEn, compact && styles.paymentEnCompact]}>
            {paymentSummaryLineFromDetail(order)}
          </Text>
          {!compact ? <Text style={styles.paymentAr}>{paymentSummaryLineArFromDetail(order)}</Text> : null}
        </View>
      </View>

      {!compact ? (
        <Pressable onPress={onOpenDetail} style={({ pressed }) => [styles.footerTap, pressed && styles.pressed]}>
          <Text style={styles.tapHint}>Tap for full details</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onOpenDetail} style={({ pressed }) => [styles.footerTapCompact, pressed && styles.pressed]}>
          <Text style={styles.tapHintCompact}>التفاصيل</Text>
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    marginBottom: 4,
  },
  cardCompact: {
    padding: 8,
    marginBottom: 4,
  },
  pressed: { opacity: 0.96 },
  headerRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 4,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: "44%",
  },
  badgeText: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  hintLine: {
    fontSize: 11,
    color: homeTheme.textSubtle,
    textAlign: "right",
    lineHeight: 16,
    marginBottom: 10,
  },
  hintLineCompact: {
    fontSize: 12,
    fontWeight: "800",
    color: homeTheme.text,
    marginBottom: 4,
  },
  customerRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 12,
    color: homeTheme.textMuted,
    textAlign: "right",
  },
  phoneLink: {
    fontSize: 12,
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
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
  },
  moneyRowCompact: {
    paddingTop: 4,
    gap: 4,
  },
  moneyText: { flex: 1, alignItems: "flex-end" },
  paymentEn: { fontSize: 12, color: homeTheme.text, fontWeight: "700", textAlign: "right" },
  paymentEnCompact: { fontSize: 11 },
  paymentAr: { fontSize: 11, color: homeTheme.textMuted, textAlign: "right", marginTop: 2 },
  footerTap: {
    marginTop: 8,
    paddingVertical: 4,
    alignSelf: "stretch",
    alignItems: "flex-end",
  },
  footerTapCompact: {
    marginTop: 2,
    paddingVertical: 2,
    alignSelf: "flex-end",
  },
  tapHint: {
    fontSize: 11,
    color: homeTheme.textSubtle,
    textAlign: "right",
    fontWeight: "600",
  },
  tapHintCompact: {
    fontSize: 11,
    color: homeTheme.accent,
    fontWeight: "800",
    textAlign: "right",
  },
});
