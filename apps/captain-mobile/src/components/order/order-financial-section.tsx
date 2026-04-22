import { StyleSheet, Text, View } from "react-native";
import type { OrderStatusDto } from "@/services/api/dto";
import { homeTheme } from "@/features/home/theme";
import { ORDER_CURRENCY_SUFFIX_AR } from "@/lib/order-currency";
import {
  dtoToCaptainShape,
  inferOrderFinancialBreakdown,
  formatIlsAmount,
  type CaptainOrderFinancialBreakdown,
  type OrderFinancialBreakdownDto,
} from "@/lib/order-financial-breakdown";
import { IsraeliCashChangeCalculator } from "@/components/cash/israeli-cash-change-calculator";
import {
  shouldShowCashChangeCalculator,
  shouldShowOrderFinancialSection,
} from "@/lib/order-payment-ui-visibility";

export type OrderFinancialSectionProps = {
  amount: string;
  cashCollection: string;
  /** يحدد إن كان يُسمح بعرض المالية — يجب أن يطابق `order.status` من الطلب */
  orderStatus: OrderStatusDto;
  /** من `GET` تفاصيل الطلب عند توفرها — يطابق `inferOrderFinancialBreakdown` على الخادم */
  financialBreakdown?: OrderFinancialBreakdownDto | null;
  variant?: "default" | "compact";
  /** إخفاء عنوان القسم عند التغليف داخل `SectionCard` */
  hideTitle?: boolean;
};

function FinancialRows({
  b,
  compact,
  deliveryFeeSource,
}: {
  b: CaptainOrderFinancialBreakdown;
  compact: boolean;
  deliveryFeeSource: OrderFinancialBreakdownDto["deliveryFeeSource"];
}) {
  const rowStyle = compact ? styles.rowCompact : styles.row;
  const deliveryLabel =
    deliveryFeeSource === "inferred"
      ? "الفرق / رسوم التوصيل (مُستنتجة)"
      : "رسوم التوصيل";
  return (
    <>
      <View style={rowStyle}>
        <Text style={styles.label}>قيمة الطلب (دفع للمتجر)</Text>
        <Text style={styles.value}>
          {formatIlsAmount(b.payToStore)} {ORDER_CURRENCY_SUFFIX_AR}
        </Text>
      </View>
      <View style={rowStyle}>
        <Text style={styles.label}>{deliveryLabel}</Text>
        <Text style={styles.value}>
          {b.deliveryFee > 0 ? `${formatIlsAmount(b.deliveryFee)} ${ORDER_CURRENCY_SUFFIX_AR}` : "—"}
        </Text>
      </View>
      <View style={rowStyle}>
        <Text style={styles.label}>التحصيل من العميل</Text>
        <Text style={[styles.value, styles.valueAccent]}>
          {formatIlsAmount(b.collectFromCustomer)} {ORDER_CURRENCY_SUFFIX_AR}
        </Text>
      </View>
      <View style={[styles.totalStrip, compact && styles.totalStripCompact]}>
        <Text style={styles.totalLabel}>الإجمالي النهائي للعميل</Text>
        <Text style={styles.totalValue}>
          {formatIlsAmount(b.finalTotalFromCustomer)} {ORDER_CURRENCY_SUFFIX_AR}
        </Text>
      </View>
      {deliveryFeeSource === "inferred" ? (
        <Text style={styles.hintMuted}>
          الرسوم أعلاه مُستنتجة من الفرق بين «التحصيل من العميل» و«قيمة الطلب» — قد تشمل توصيلاً أو رسوماً
          أخرى؛ لا يوجد حقل منفصل في الخادم حالياً.
        </Text>
      ) : null}
      {b.isCashOnDelivery ? (
        <Text style={styles.hint}>نقد عند التسليم — استخدم الحاسبة أدناه للباقي</Text>
      ) : (
        <Text style={styles.hint}>لا يوجد مبلغ تحصيل نقدي منفصل — الإجمالي = قيمة الطلب</Text>
      )}
    </>
  );
}

/**
 * قسم مالي موحّد: قيمة الطلب، رسوم التوصيل المُشتقة، الإجمالي، وحاسبة نقد عند التوصيل.
 * لا يُعرض شيء إلا في مرحلة التوصيل للعميل (`IN_TRANSIT`) — انظر `order-payment-ui-visibility`.
 */
export function OrderFinancialSection({
  amount,
  cashCollection,
  orderStatus,
  financialBreakdown,
  variant = "default",
  hideTitle = false,
}: OrderFinancialSectionProps) {
  if (!shouldShowOrderFinancialSection(orderStatus)) {
    return null;
  }

  const dto = financialBreakdown ?? inferOrderFinancialBreakdown(amount, cashCollection);
  const b = dtoToCaptainShape(dto);
  const compact = variant === "compact";
  const showCalculator =
    shouldShowCashChangeCalculator(orderStatus) && b.finalTotalFromCustomer > 0;

  return (
    <View style={styles.wrap}>
      {hideTitle ? null : <Text style={styles.title}>المالية والتحصيل</Text>}
      <FinancialRows b={b} compact={compact} deliveryFeeSource={dto.deliveryFeeSource} />
      {showCalculator ? (
        <View style={styles.calcWrap}>
          <IsraeliCashChangeCalculator customerTotalIls={b.finalTotalFromCustomer} variant={compact ? "compact" : "default"} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  title: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  rowCompact: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  label: {
    flex: 1,
    color: homeTheme.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 18,
  },
  value: {
    color: homeTheme.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "left",
  },
  valueAccent: {
    color: homeTheme.accent,
  },
  totalStrip: {
    marginTop: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: homeTheme.accentSoft,
    borderWidth: 1,
    borderColor: homeTheme.accentMuted,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  totalStripCompact: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  totalLabel: {
    color: homeTheme.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    flex: 1,
  },
  totalValue: {
    color: homeTheme.accent,
    fontSize: 18,
    fontWeight: "900",
  },
  hint: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    textAlign: "right",
    lineHeight: 16,
    marginTop: 4,
  },
  hintMuted: {
    color: homeTheme.textMuted,
    fontSize: 10,
    textAlign: "right",
    lineHeight: 15,
    marginTop: 4,
  },
  calcWrap: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
  },
});
