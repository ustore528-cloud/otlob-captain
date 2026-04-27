import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { OrderStatusDto } from "@/services/api/dto";
import { homeTheme } from "@/features/home/theme";
import { ORDER_CURRENCY_SUFFIX_AR } from "@/lib/order-currency";
import {
  dtoToCaptainShape,
  formatIlsAmount,
  resolveOrderFinancialBreakdownDto,
  type CaptainOrderFinancialBreakdown,
  type OrderFinancialBreakdownDto,
} from "@/lib/order-financial-breakdown";
import { IsraeliCashChangeCalculator } from "@/components/cash/israeli-cash-change-calculator";
import {
  shouldShowCashChangeCalculator,
  shouldShowOrderFinancialSection,
} from "@/lib/order-payment-ui-visibility";
import { isRtlLng } from "@/i18n/i18n";
import type { TFunction } from "i18next";

export type OrderFinancialSectionProps = {
  amount: string;
  cashCollection: string;
  deliveryFee?: string | null;
  orderStatus: OrderStatusDto;
  financialBreakdown?: OrderFinancialBreakdownDto | null;
  variant?: "default" | "compact";
  hideTitle?: boolean;
};

function FinancialRows({
  b,
  compact,
  deliveryFeeSource,
  rowFlex,
  rtl,
  t,
}: {
  b: CaptainOrderFinancialBreakdown;
  compact: boolean;
  deliveryFeeSource: OrderFinancialBreakdownDto["deliveryFeeSource"];
  rowFlex: "row" | "row-reverse";
  rtl: boolean;
  t: TFunction;
}) {
  const rowBase = compact ? styles.rowCompactBase : styles.rowBase;
  const alignEnd = rtl ? "right" : "left";
  const alignStart = rtl ? "left" : "right";
  const deliveryLabel =
    deliveryFeeSource === "inferred" ? t("money.deliveryFeeInferred") : t("money.deliveryFee");
  const suffix = ` ${ORDER_CURRENCY_SUFFIX_AR}`;
  return (
    <>
      <View style={[rowBase, { flexDirection: rowFlex }]}>
        <Text style={[styles.label, { textAlign: alignEnd }]}>{t("money.storeAmount")}</Text>
        <Text style={[styles.value, { textAlign: alignStart }]}>
          {formatIlsAmount(b.payToStore)}
          {suffix}
        </Text>
      </View>
      <View style={[rowBase, { flexDirection: rowFlex }]}>
        <Text style={[styles.label, { textAlign: alignEnd }]}>{deliveryLabel}</Text>
        <Text style={[styles.value, { textAlign: alignStart }]}>
          {b.deliveryFee > 0 ? `${formatIlsAmount(b.deliveryFee)}${suffix}` : `0.00${suffix}`}
        </Text>
      </View>
      <View style={[styles.customerCollectStrip, compact && styles.customerCollectStripCompact, { flexDirection: rowFlex }]}>
        <Text style={[styles.customerCollectLabel, { textAlign: alignEnd }]}>{t("money.customerCollection")}</Text>
        <Text style={[styles.customerCollectValue, { textAlign: alignStart }]}>
          {formatIlsAmount(b.collectFromCustomer)}
          {suffix}
        </Text>
      </View>
      {deliveryFeeSource === "inferred" ? (
        <Text style={[styles.hintMuted, { textAlign: alignEnd }]}>{t("money.hintInferred")}</Text>
      ) : null}
      {b.isCashOnDelivery ? (
        <Text style={[styles.hint, { textAlign: alignEnd }]}>{t("money.hintCod")}</Text>
      ) : (
        <Text style={[styles.hint, { textAlign: alignEnd }]}>{t("money.hintNoCod")}</Text>
      )}
    </>
  );
}

export function OrderFinancialSection({
  amount,
  cashCollection,
  deliveryFee,
  orderStatus,
  financialBreakdown,
  variant = "default",
  hideTitle = false,
}: OrderFinancialSectionProps) {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? i18n.language;
  const rtl = isRtlLng(lng);
  const rowFlex: "row" | "row-reverse" = rtl ? "row-reverse" : "row";
  const titleAlign = rtl ? "right" : "left";

  if (!shouldShowOrderFinancialSection(orderStatus)) {
    return null;
  }

  const dto = resolveOrderFinancialBreakdownDto({ amount, cashCollection, deliveryFee, financialBreakdown });
  const b = dtoToCaptainShape(dto);
  const compact = variant === "compact";
  const showCalculator = shouldShowCashChangeCalculator(orderStatus) && b.finalTotalFromCustomer > 0;

  return (
    <View style={styles.wrap}>
      {hideTitle ? null : (
        <Text style={[styles.title, { textAlign: titleAlign }]}>{t("money.sectionTitle")}</Text>
      )}
      <FinancialRows
        b={b}
        compact={compact}
        deliveryFeeSource={dto.deliveryFeeSource}
        rowFlex={rowFlex}
        rtl={rtl}
        t={t}
      />
      {showCalculator ? (
        <View style={styles.calcWrap}>
          <IsraeliCashChangeCalculator
            customerTotalIls={b.finalTotalFromCustomer}
            variant={compact ? "compact" : "default"}
          />
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
    marginBottom: 4,
  },
  rowBase: {
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: homeTheme.neutralSoft,
    borderWidth: 1,
    borderBottomColor: homeTheme.border,
    borderColor: homeTheme.border,
  },
  rowCompactBase: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: homeTheme.neutralSoft,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  label: {
    flex: 1,
    color: homeTheme.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  value: {
    color: homeTheme.text,
    fontSize: 16,
    fontWeight: "900",
  },
  customerCollectStrip: {
    marginTop: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: homeTheme.accentSoft,
    borderWidth: 2,
    borderColor: homeTheme.accent,
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  customerCollectStripCompact: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  customerCollectLabel: {
    color: homeTheme.text,
    fontSize: 13,
    fontWeight: "900",
    flex: 1,
    lineHeight: 18,
  },
  customerCollectValue: {
    color: homeTheme.accent,
    fontSize: 20,
    fontWeight: "900",
  },
  hint: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  hintMuted: {
    color: homeTheme.textMuted,
    fontSize: 10,
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
