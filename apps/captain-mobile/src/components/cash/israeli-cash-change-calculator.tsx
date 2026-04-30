import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { homeTheme } from "@/features/home/theme";
import { isRtlLng } from "@/i18n/i18n";
import { ORDER_CURRENCY_SUFFIX_AR } from "@/lib/order-currency";
import { formatIlsAmount } from "@/lib/order-financial-breakdown";

export type IsraeliCashChangeCalculatorProps = {
  /** المبلغ المطلوب من العميل (إجمالي التحصيل) — للمقارنة داخلياً فقط */
  customerTotalIls: number;
  /** أصغر واجهة للبطاقة */
  variant?: "default" | "compact";
};

type SecondBoxTitleKey =
  | "cashCalculator.changeDue"
  | "cashCalculator.remainingAmount"
  | "cashCalculator.paidInFull";

type SecondBoxState = {
  tone: "ok" | "need" | "change";
  titleKey: SecondBoxTitleKey;
  /** `null` when no extra amount line (e.g. paid in full). */
  amountLine: string | null;
};

/**
 * حاسبة باقي النقد — صندوقان فقط (بدون أزرار أو عناصر زائدة): إدخال المدفوع، والنتيجة من الإجمالي المستحق.
 */
export function IsraeliCashChangeCalculator({ customerTotalIls, variant = "default" }: IsraeliCashChangeCalculatorProps) {
  const { t, i18n } = useTranslation();
  const rtl = isRtlLng(i18n.resolvedLanguage ?? i18n.language);
  const textAlign = rtl ? "right" : "left";
  const [paidRaw, setPaidRaw] = useState("");
  const totalDue = useMemo(() => Math.max(0, round2(customerTotalIls)), [customerTotalIls]);

  const paid = useMemo(() => parsePaidAmount(paidRaw), [paidRaw]);

  const onChangePaidText = useCallback((s: string) => {
    setPaidRaw(sanitizePaidInput(s));
  }, []);

  const secondBox = useMemo(() => computeSecondBoxFromPaidAndTotal(paid, totalDue), [paid, totalDue]);

  const compact = variant === "compact";

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.box}>
        <Text style={[styles.boxLabel, { textAlign }]}>
          {t("cashCalculator.paidInputLabel", { currency: ORDER_CURRENCY_SUFFIX_AR })}
        </Text>
        <TextInput
          value={paidRaw}
          onChangeText={onChangePaidText}
          keyboardType="decimal-pad"
          inputMode="decimal"
          autoCorrect={false}
          autoCapitalize="none"
          placeholder="0"
          placeholderTextColor={homeTheme.textMuted}
          style={[styles.input, compact && styles.inputCompact, { textAlign }]}
          accessibilityLabel={t("cashCalculator.inputA11y", { currency: ORDER_CURRENCY_SUFFIX_AR })}
          accessibilityHint={t("cashCalculator.inputA11yHint")}
        />
      </View>

      <View style={[styles.box, styles.resultBox, styles[`resultTone_${secondBox.tone}`]]}>
        <Text style={[styles.resultTitle, { textAlign }]}>{t(secondBox.titleKey)}</Text>
        {secondBox.amountLine ? <Text style={[styles.resultAmount, { textAlign }]}>{secondBox.amountLine}</Text> : null}
      </View>
    </View>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Second box is derived only from amount paid vs total due from customer (no side effects).
 * - paid &gt; total → change due
 * - paid &lt; total → remaining amount
 * - paid == total → paid in full
 */
function computeSecondBoxFromPaidAndTotal(paidIls: number, totalDueIls: number): SecondBoxState {
  const paid = round2(paidIls);
  const total = round2(totalDueIls);

  if (paid > total) {
    const change = round2(paid - total);
    return {
      tone: "change",
      titleKey: "cashCalculator.changeDue",
      amountLine: `${formatIlsAmount(change)} ${ORDER_CURRENCY_SUFFIX_AR}`,
    };
  }
  if (paid < total) {
    const remaining = round2(total - paid);
    return {
      tone: "need",
      titleKey: "cashCalculator.remainingAmount",
      amountLine: `${formatIlsAmount(remaining)} ${ORDER_CURRENCY_SUFFIX_AR}`,
    };
  }
  return {
    tone: "ok",
    titleKey: "cashCalculator.paidInFull",
    amountLine: null,
  };
}

/**
 * Numbers only: digits and at most one decimal separator (`.` or `,` pasted from locale).
 * Empty string allowed while editing.
 */
function sanitizePaidInput(s: string): string {
  const normalized = s.replace(/,/g, ".");
  const cleaned = normalized.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  const intPart = cleaned.slice(0, firstDot).replace(/\./g, "");
  const fracRaw = cleaned.slice(firstDot + 1).replace(/\./g, "");
  const frac = fracRaw.slice(0, 2);
  return frac.length > 0 ? `${intPart}.${frac}` : `${intPart}.`;
}

function parsePaidAmount(raw: string): number {
  if (!raw || raw === ".") return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? round2(Math.max(0, n)) : 0;
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  wrapCompact: {
    gap: 6,
  },
  box: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.cardWhite,
    padding: 10,
    gap: 4,
  },
  resultBox: {
    gap: 2,
  },
  /** Light left/start bar only — no full tinted “money widget” panels */
  resultTone_need: {
    borderStartWidth: 3,
    borderStartColor: homeTheme.gold,
  },
  resultTone_ok: {
    borderStartWidth: 3,
    borderStartColor: homeTheme.accentMuted,
  },
  resultTone_change: {
    borderStartWidth: 3,
    borderStartColor: homeTheme.accent,
  },
  boxLabel: {
    color: homeTheme.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.bg,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 18,
    fontWeight: "800",
    color: homeTheme.text,
  },
  inputCompact: {
    paddingVertical: 8,
    fontSize: 17,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: homeTheme.text,
  },
  resultAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: homeTheme.text,
  },
});
