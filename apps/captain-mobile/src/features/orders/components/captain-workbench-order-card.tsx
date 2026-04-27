import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { OrderDetailDto } from "@/services/api/dto";
import { homeTheme } from "@/features/home/theme";
import { orderStatusTranslationKey } from "@/lib/order-status-i18n";
import { WhatsAppActionButton } from "@/components/ui/whatsapp-action-button";
import { openPhoneDialer } from "@/lib/open-external";
import { orderStatusAccent, type StatusAccent } from "../utils/order-status-accent";
import { OrderRouteTapRows } from "./order-route-tap-rows";
import { formatOrderSerial } from "@/lib/order-serial";

type Props = {
  order: OrderDetailDto;
  offerHint?: string | null;
  /** أقصر ارتفاعًا — تبويب الطلب الحالي */
  compact?: boolean;
  /** تخطيط أخفّ للشاشة الحية (لا يعني عدة طلبات حيّة؛ الـ API لقطة واحدة). */
  visualDensity?: "default" | "liveOperations";
  onOpenDetail: () => void;
};

/**
 * One card for the **single** live assignment from `/me/assignment` (not one row in a multi-order list).
 */
export function CaptainWorkbenchOrderCard({
  order,
  offerHint,
  compact,
  visualDensity = "default",
  onOpenDetail,
}: Props) {
  const { t } = useTranslation();
  const accent: StatusAccent = orderStatusAccent(order.status);
  const statusLabel = t(orderStatusTranslationKey(order.status));
  const liveOps = visualDensity === "liveOperations";
  const compactEffective = Boolean(compact || liveOps);

  return (
    <View style={[styles.card, compact && styles.cardCompact, liveOps && styles.cardLiveOps]}>
      <Pressable
        onPress={onOpenDetail}
        style={({ pressed }) => [styles.headerRow, liveOps && styles.headerRowLiveOps, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("workbenchOrderCard.openDetailsA11y", { n: formatOrderSerial(order.orderNumber, order.displayOrderNo) })}
      >
        <View style={styles.headerText}>
          <Text style={[styles.serialLabel, liveOps && styles.serialLabelLiveOps]}>{t("orderCard.serialLabel")}</Text>
          <Text style={[styles.serial, liveOps && styles.serialLiveOps]} numberOfLines={1}>
            {formatOrderSerial(order.orderNumber, order.displayOrderNo)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: accent.bg, borderColor: accent.border }]}>
          <Text style={[styles.badgeText, { color: accent.text }]} numberOfLines={1}>
            {statusLabel}
          </Text>
        </View>
      </Pressable>

      {offerHint ? (
        <Text style={[styles.hintLine, compact && styles.hintLineCompact, liveOps && styles.hintLineLiveOps]} numberOfLines={2}>
          {offerHint}
        </Text>
      ) : null}

      <OrderRouteTapRows
        pickupAddress={order.pickupAddress}
        dropoffAddress={order.dropoffAddress}
        areaFallback={order.area}
        compact={compactEffective}
        dense={liveOps}
      />

      <View style={styles.divider} />

      <View style={[styles.actionsRow, liveOps && styles.actionsRowLiveOps]}>
        <Pressable
          onPress={() => void openPhoneDialer(order.customerPhone)}
          style={({ pressed }) => [styles.iconBtn, styles.callBtn, pressed && styles.pressed]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("workbenchOrderCard.callA11y", { phone: order.customerPhone })}
        >
          <Ionicons name="call-outline" size={liveOps ? 18 : 20} color={homeTheme.accent} />
        </Pressable>
        <WhatsAppActionButton phone={order.customerPhone} variant="icon" size={compactEffective ? "default" : "large"} />
        <Pressable
          onPress={onOpenDetail}
          style={({ pressed }) => [styles.detailBtn, liveOps && styles.detailBtnLiveOps, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("workbenchOrderCard.orderDetailsA11y")}
        >
          <Text style={[styles.detailBtnText, liveOps && styles.detailBtnTextLiveOps]}>
            {t("workbenchOrderCard.details")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeTheme.cardWhite,
    borderRadius: homeTheme.radiusMd,
    padding: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    marginBottom: 3,
    ...homeTheme.cardShadow,
  },
  cardCompact: {
    padding: 6,
    marginBottom: 3,
  },
  cardLiveOps: {
    padding: 5,
    marginBottom: 0,
  },
  pressed: { opacity: 0.96 },
  headerRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 3,
  },
  headerRowLiveOps: {
    marginBottom: 1,
  },
  headerText: { flex: 1, alignItems: "flex-end" },
  serialLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: homeTheme.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  serialLabelLiveOps: {
    fontSize: 9,
  },
  serial: {
    fontSize: 17,
    fontWeight: "900",
    color: homeTheme.text,
    textAlign: "right",
    marginTop: 1,
  },
  serialLiveOps: {
    fontSize: 15,
    marginTop: 0,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: "44%",
  },
  badgeText: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  hintLine: {
    fontSize: 11,
    color: homeTheme.textSubtle,
    textAlign: "right",
    lineHeight: 15,
    marginBottom: 7,
  },
  hintLineCompact: {
    fontSize: 12,
    fontWeight: "800",
    color: homeTheme.text,
    marginBottom: 3,
  },
  hintLineLiveOps: {
    marginBottom: 2,
    fontSize: 10,
    lineHeight: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: homeTheme.border,
    marginTop: 2,
    marginBottom: 4,
  },
  actionsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  actionsRowLiveOps: {
    gap: 4,
    marginBottom: 0,
  },
  iconBtn: {
    padding: 2,
  },
  callBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.accentMuted,
    backgroundColor: homeTheme.cardWhite,
  },
  detailBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginStart: 2,
  },
  detailBtnLiveOps: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  detailBtnText: {
    fontSize: 12,
    color: homeTheme.accent,
    fontWeight: "800",
    textAlign: "right",
  },
  detailBtnTextLiveOps: {
    fontSize: 11,
  },
});
