import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { homeTheme } from "@/features/home/theme";
import type { AssignmentOverflowItemDto } from "@/services/api/dto";
import { routes } from "@/navigation/routes";
import { formatOrderSerial } from "@/lib/order-serial";

type Props = {
  items: AssignmentOverflowItemDto[];
  warningVisible?: boolean;
  onRetryWarning?: () => void;
};

/**
 * Option C: visible notice when assignable or in-flight orders exist beyond the primary live card.
 */
export function AssignmentOverflowBanner({ items, warningVisible = false, onRetryWarning }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  if (items.length === 0 && !warningVisible) return null;

  const n = items.length;
  const label = n === 1 ? t("overflow.titleOne") : t("overflow.titleMany", { count: n });

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {warningVisible ? (
        <View style={styles.warningWrap}>
          <Text style={styles.warningTitle}>تعذّر التحقق من الطلبات الإضافية الآن</Text>
          <Text style={styles.warningHint}>قد تكون هناك طلبات ثانوية غير معروضة حالياً.</Text>
          {onRetryWarning ? (
            <Pressable
              onPress={onRetryWarning}
              style={({ pressed }) => [styles.warningRetry, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel="إعادة محاولة جلب الطلبات الإضافية"
            >
              <Text style={styles.warningRetryText}>إعادة المحاولة</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {items.length > 0 ? (
        <>
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.hint}>{t("overflow.detailsHint")}</Text>
      {items.map((it) => (
        <Pressable
          key={it.orderId}
          onPress={() => router.push(routes.app.order(it.orderId))}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          accessibilityRole="button"
          accessibilityLabel={t("overflow.orderA11y", {
            serial: formatOrderSerial(it.orderNumber, it.displayOrderNo),
            kind: it.kind === "OFFER" ? t("overflow.kindOffer") : t("overflow.kindActive"),
          })}
        >
          <Text style={styles.rowMain} numberOfLines={1}>
            {formatOrderSerial(it.orderNumber, it.displayOrderNo)}
            <Text style={styles.badge}>
              {" "}
              {it.kind === "OFFER" ? t("overflow.kindOffer") : t("overflow.kindActive")}
            </Text>
          </Text>
        </Pressable>
      ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: homeTheme.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.accent,
    alignItems: "flex-end",
    gap: 6,
  },
  warningWrap: {
    alignSelf: "stretch",
    borderRadius: 8,
    backgroundColor: "rgba(180, 83, 9, 0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.goldMuted,
    padding: 10,
    marginBottom: 2,
    alignItems: "flex-end",
    gap: 4,
  },
  warningTitle: {
    color: homeTheme.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  warningHint: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "right",
  },
  warningRetry: {
    marginTop: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: homeTheme.bg,
  },
  warningRetryText: {
    color: homeTheme.accent,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  title: {
    color: homeTheme.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  hint: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "right",
    marginBottom: 4,
  },
  row: {
    alignSelf: "stretch",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  rowPressed: { opacity: 0.85 },
  rowMain: {
    color: homeTheme.text,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  badge: {
    color: homeTheme.accent,
    fontWeight: "800",
    fontSize: 12,
  },
});
