import { useTranslation } from "react-i18next";
import type { OrderFinancialBreakdownDto } from "@captain/shared";
import { inferCanonicalOrderFinancialBreakdown, inferLegacyOrderFinancialBreakdown } from "@captain/shared";

type Props = {
  amount: string;
  cashCollection: string;
  deliveryFee: string | null;
  /** When set (e.g. order detail API), avoids re-inferring on the client. */
  breakdown?: OrderFinancialBreakdownDto;
  /** Larger typography for list row vs compact modal line */
  variant?: "list" | "modal";
};

export function OrderFinancialStrip({ amount, cashCollection, deliveryFee, breakdown, variant = "list" }: Props) {
  const { t } = useTranslation();
  const br =
    breakdown ??
    (deliveryFee != null
      ? inferCanonicalOrderFinancialBreakdown(amount, deliveryFee, cashCollection)
      : inferLegacyOrderFinancialBreakdown(amount, cashCollection));
  const inferred = br.deliveryFeeSource === "inferred";
  const labelClass = variant === "modal" ? "text-xs text-muted-foreground" : "text-[11px] text-muted-foreground";
  const mono = "font-mono tabular-nums text-foreground";
  const totalRow =
    variant === "modal"
      ? "mt-3 flex flex-col gap-1 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
      : "mt-2 flex flex-col gap-0.5 border-t border-card-border pt-2 sm:flex-row sm:items-baseline sm:justify-between";

  return (
    <div className="rounded-md border border-card-border bg-muted/15 p-2 text-left" dir="ltr">
      <div className={`grid gap-1 ${labelClass}`}>
        <div className="flex justify-between gap-3">
          <span>{t("financial.storeAmount")}</span>
          <span className={mono}>{br.orderAmount}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>
            {inferred ? t("financial.deliveryFeeInferred") : t("financial.deliveryFee")}
          </span>
          <span className={mono}>{br.deliveryFee}</span>
        </div>
      </div>
      <div className={totalRow}>
        <span className={`font-medium text-foreground ${variant === "modal" ? "text-sm" : "text-xs"}`}>
          {t("financial.customerCollection")}
        </span>
        <span className={`${mono} ${variant === "modal" ? "text-lg font-semibold" : "text-sm font-semibold"}`}>
          {br.customerTotal}
        </span>
      </div>
    </div>
  );
}
