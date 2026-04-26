import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import * as finance from "@/lib/api/services/finance";
import { useAuthStore } from "@/stores/auth-store";
import type { FinanceLedgerEntryReadDto } from "@/types/api";

const PAGE_SIZE = 20;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 90 * MS_PER_DAY;

/** `from` / `to` — سلاسل `Date.toISOString()` (UTC) بعد التحقق. */
export function isValidLedgerActivityRange(fromIso: string, toIso: string): boolean {
  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIso);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) return false;
  if (toMs - fromMs > MAX_RANGE_MS) return false;
  return true;
}

/**
 * نطاق افتراضي: آخر 7 أيام حتى «الآن» (UTC عبر toISOString).
 */
export function defaultLedgerActivityRangeUtc(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * MS_PER_DAY);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * يحمّل الصفحة الأولى عبر React Query (offset 0)، ثم يلحق الصفحات عبر `nextOffset` و`from`/`to` ثابتين.
 * يُصفّر الملحق عند تغيّر `scopeKey` أو `fromUtc` / `toUtc` أو `walletAccountId` (مفعّل من الاستدعاء).
 */
export function useLedgerActivityReport(
  walletAccountId: string | null,
  fromUtc: string,
  toUtc: string,
  options?: { enabled?: boolean; scopeKey: string },
) {
  const token = useAuthStore((s) => s.token);
  const allow = options?.enabled ?? true;
  const scopeKey = options?.scopeKey ?? "";
  const rangeOk = isValidLedgerActivityRange(fromUtc, toUtc);
  const enabled = Boolean(
    token && walletAccountId && allow && rangeOk && fromUtc && toUtc,
  );

  const [appendix, setAppendix] = useState<FinanceLedgerEntryReadDto[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);

  useEffect(() => {
    setAppendix([]);
  }, [walletAccountId, fromUtc, toUtc, scopeKey]);

  const first = useQuery({
    queryKey: walletAccountId
      ? queryKeys.finance.ledgerActivityFirstPage(walletAccountId, fromUtc, toUtc)
      : (["finance", "ledger-activity", "off"] as const),
    queryFn: () =>
      finance.getLedgerActivityReport(token!, walletAccountId!, {
        from: fromUtc,
        to: toUtc,
        offset: 0,
        limit: PAGE_SIZE,
      }),
    enabled,
  });

  useEffect(() => {
    if (first.data) {
      if (appendix.length === 0) {
        setNextOffset(first.data.nextOffset);
      }
    } else {
      setNextOffset(null);
    }
  }, [first.data, appendix.length, walletAccountId, fromUtc, toUtc, scopeKey]);

  const items = first.data ? [...first.data.items, ...appendix] : appendix;
  const totalInRange = first.data?.totalInRange;

  const loadMore = useCallback(async () => {
    if (!token || !walletAccountId || !rangeOk) return;
    if (nextOffset == null) return;
    const page = await finance.getLedgerActivityReport(token, walletAccountId, {
      from: fromUtc,
      to: toUtc,
      offset: nextOffset,
      limit: PAGE_SIZE,
    });
    setAppendix((a) => [...a, ...page.items]);
    setNextOffset(page.nextOffset);
  }, [nextOffset, token, walletAccountId, fromUtc, toUtc, rangeOk]);

  return {
    items,
    totalInRange,
    reportRange: first.data?.range,
    isLoading: first.isLoading,
    isError: first.isError,
    error: first.error,
    loadMore,
    canLoadMore: nextOffset != null,
    isFetchingFirst: first.isFetching,
  };
}
