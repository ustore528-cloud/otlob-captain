import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { OrderDetailDto } from "@/services/api/dto";
import { SecondaryButton, StatusBadge } from "@/components/ui";
import {
  captainSpacing,
  captainTypography,
  captainUiTheme,
} from "@/theme/captain-ui-theme";
import { orderStatusTranslationKey } from "@/lib/order-status-i18n";
import { WhatsAppActionButton } from "@/components/ui/whatsapp-action-button";
import { openPhoneDialer } from "@/lib/open-external";
import { OrderRouteTapRows } from "./order-route-tap-rows";
import { formatOrderSerial } from "@/lib/order-serial";
import { mapOrderStatusDtoToBadgeVariant } from "@/lib/map-order-status-to-badge-variant";

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
  const statusLabel = t(orderStatusTranslationKey(order.status));
  const badgeVariant = mapOrderStatusDtoToBadgeVariant(order.status);
  const liveOps = visualDensity === "liveOperations";
  const compactEffective = Boolean(compact || liveOps);
  const dash = t("common.emDash");

  const storeLine = t("orderDetail.storeLine", {
    name: (order.store?.name ?? "").trim() || dash,
    area: (order.store?.area ?? "").trim() || dash,
  });
  const customerLine = t("orderDetail.customerLine", {
    name: (order.customerName ?? "").trim() || dash,
  });

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        liveOps && styles.cardLiveOps,
        captainUiTheme.cardShadow,
      ]}
    >
      <Pressable
        onPress={onOpenDetail}
        style={({ pressed }) => [styles.headerRow, liveOps && styles.headerRowLiveOps, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("workbenchOrderCard.openDetailsA11y", {
          n: formatOrderSerial(order.orderNumber, order.displayOrderNo),
        })}
      >
        <View style={styles.headerText}>
          <Text style={[styles.serialLabel, liveOps && styles.serialLabelLiveOps]}>
            {t("orderCard.serialLabel")}
          </Text>
          <Text style={[styles.serial, liveOps && styles.serialLiveOps]} numberOfLines={1}>
            {formatOrderSerial(order.orderNumber, order.displayOrderNo)}
          </Text>
        </View>
        <StatusBadge variant={badgeVariant} label={statusLabel} compact={compactEffective} />
      </Pressable>

      <View style={styles.metaBlock}>
        <Text style={[styles.metaLine, liveOps && styles.metaLineLiveOps]} numberOfLines={2}>
          {storeLine}
        </Text>
        <Text style={[styles.metaLine, liveOps && styles.metaLineLiveOps]} numberOfLines={1}>
          {customerLine}
        </Text>
      </View>

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
          style={({ pressed }) => [styles.callBtn, liveOps && styles.callBtnLiveOps, pressed && styles.pressed]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("workbenchOrderCard.callA11y", { phone: order.customerPhone })}
        >
          <Ionicons name="call-outline" size={liveOps ? 20 : 22} color={captainUiTheme.accent} />
        </Pressable>
        <WhatsAppActionButton phone={order.customerPhone} variant="icon" size={compactEffective ? "default" : "large"} />
        <SecondaryButton
          label={t("workbenchOrderCard.details")}
          onPress={onOpenDetail}
          icon="document-text-outline"
          compact={compactEffective}
          style={liveOps ? styles.detailBtnLiveOps : styles.detailBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: captainUiTheme.cardWhite,
    borderRadius: captainUiTheme.radiusLg,
    padding: captainSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.border,
    marginBottom: captainSpacing.xs,
  },
  cardCompact: {
    padding: captainSpacing.md,
    marginBottom: captainSpacing.xs,
  },
  cardLiveOps: {
    padding: captainSpacing.sm + 1,
    marginBottom: 0,
  },
  pressed: { opacity: 0.96 },
  headerRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: captainSpacing.sm,
    marginBottom: captainSpacing.sm,
  },
  headerRowLiveOps: {
    marginBottom: captainSpacing.xs,
  },
  headerText: { flex: 1, alignItems: "flex-end", minWidth: 0 },
  serialLabel: {
    ...captainTypography.caption,
    fontSize: 10,
    color: captainUiTheme.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "right",
  },
  serialLabelLiveOps: {
    fontSize: 9,
  },
  serial: {
    ...captainTypography.sectionTitle,
    fontSize: 18,
    color: captainUiTheme.text,
    textAlign: "right",
    marginTop: 2,
  },
  serialLiveOps: {
    fontSize: 15,
    marginTop: 0,
  },
  metaBlock: {
    gap: captainSpacing.xs,
    marginBottom: captainSpacing.sm,
    paddingVertical: captainSpacing.xs,
    paddingHorizontal: captainSpacing.sm,
    borderRadius: captainUiTheme.radiusMd,
    backgroundColor: captainUiTheme.neutralSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.border,
  },
  metaLine: {
    ...captainTypography.body,
    fontSize: 13,
    fontWeight: "600",
    color: captainUiTheme.text,
    textAlign: "right",
    lineHeight: 20,
  },
  metaLineLiveOps: {
    fontSize: 11,
    lineHeight: 16,
  },
  hintLine: {
    ...captainTypography.caption,
    fontWeight: "500",
    color: captainUiTheme.textSubtle,
    textAlign: "right",
    lineHeight: 16,
    marginBottom: captainSpacing.sm + 1,
  },
  hintLineCompact: {
    fontSize: 12,
    fontWeight: "800",
    color: captainUiTheme.text,
    marginBottom: captainSpacing.xs + 1,
  },
  hintLineLiveOps: {
    marginBottom: captainSpacing.xs,
    fontSize: 10,
    lineHeight: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: captainUiTheme.border,
    marginVertical: captainSpacing.sm,
  },
  actionsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: captainSpacing.sm,
    flexWrap: "wrap",
  },
  actionsRowLiveOps: {
    gap: captainSpacing.xs + 2,
    marginBottom: 0,
  },
  callBtn: {
    minWidth: captainSpacing.xxxl + 12,
    minHeight: captainSpacing.xxxl + 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: captainUiTheme.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.accentMuted,
    backgroundColor: captainUiTheme.surfaceElevated,
  },
  callBtnLiveOps: {
    minWidth: captainSpacing.xxxl + 8,
    minHeight: captainSpacing.xxxl + 8,
  },
  detailBtn: {
    minHeight: captainSpacing.xxxl + 4,
    flexGrow: 1,
    flexBasis: "36%",
    maxWidth: 200,
  },
  detailBtnLiveOps: {
    minHeight: captainSpacing.xxxl + 2,
    flexGrow: 1,
    flexBasis: "44%",
    maxWidth: 160,
  },
});
