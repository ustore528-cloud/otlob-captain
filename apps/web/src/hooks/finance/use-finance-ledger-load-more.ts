import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import * as finance from "@/lib/api/services/finance";
import { useAuthStore } from "@/stores/auth-store";
import type { FinanceLedgerEntryReadDto } from "@/types/api";

const PAGE_SIZE = 20;

/**
 * يحمّل الصفحة الأولى عبر React Query، ثم يلحق الصفحات عبر `nextOffset` (بدون طلب دفتر عند `walletAccountId === null`).
 */
export function useFinanceLedgerLoadMore(walletAccountId: string | null, options?: { enabled?: boolean }) {
  const token = useAuthStore((s) => s.token);
  const allow = options?.enabled ?? true;
  const enabled = Boolean(token && walletAccountId && allow);

  const [appendix, setAppendix] = useState<FinanceLedgerEntryReadDto[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);

  const first = useQuery({
    queryKey: walletAccountId
      ? queryKeys.finance.ledgerFirstPage(walletAccountId)
      : (["finance", "ledger", "off"] as const),
    queryFn: () => finance.getLedgerHistoryPage(token!, walletAccountId!, 0, PAGE_SIZE),
    enabled,
  });

  useEffect(() => {
    setAppendix([]);
  }, [walletAccountId]);

  useEffect(() => {
    if (first.data) {
      if (appendix.length === 0) {
        setNextOffset(first.data.nextOffset);
      }
    } else {
      setNextOffset(null);
    }
  }, [first.data, appendix.length, walletAccountId]);

  const items = first.data ? [...first.data.items, ...appendix] : appendix;

  const loadMore = useCallback(async () => {
    if (!token || !walletAccountId) return;
    if (nextOffset == null) return;
    const page = await finance.getLedgerHistoryPage(token, walletAccountId, nextOffset, PAGE_SIZE);
    setAppendix((a) => [...a, ...page.items]);
    setNextOffset(page.nextOffset);
  }, [nextOffset, token, walletAccountId]);

  return {
    items,
    isLoading: first.isLoading,
    isError: first.isError,
    error: first.error,
    loadMore,
    canLoadMore: nextOffset != null,
    isFetchingFirst: first.isFetching,
  };
}
