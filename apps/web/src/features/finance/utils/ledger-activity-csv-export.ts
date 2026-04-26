import { getLedgerActivityReport } from "@/lib/api/services/finance";
import type { FinanceLedgerEntryReadDto, FinanceLedgerEntryType } from "@/types/api";

const PAGE = 20;

const ENTRY_TYPE_LABEL_AR: Record<FinanceLedgerEntryType, string> = {
  SUPER_ADMIN_TOP_UP: "شحن (مدير)",
  WALLET_TRANSFER: "تحويل",
  ORDER_DELIVERED_STORE_DEBIT: "خصم طلب (متجر)",
  ORDER_DELIVERED_CAPTAIN_DEDUCTION: "خصم تسليم (كابتن)",
  ADJUSTMENT: "تسوية",
  CAPTAIN_PREPAID_CHARGE: "شحن باقة كابتن",
  CAPTAIN_PREPAID_ADJUSTMENT: "تسوية باقة كابتن",
};

function entryTypeLabelAr(t: FinanceLedgerEntryType): string {
  return ENTRY_TYPE_LABEL_AR[t] ?? t;
}

/** CSV field per RFC 4180-style (quote if needed). */
function cell(v: string | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s) || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const KNOWN_METADATA_KEYS = [
  "orderNumber",
  "leg",
  "kind",
  "captainId",
  "transferIdempotencyKey",
  "transferGroup",
] as const;

const HEADER = [
  "id",
  "createdAt",
  "entryType",
  "entryTypeLabelAr",
  "amount",
  "currency",
  "orderId",
  "referenceType",
  "referenceId",
  "counterpartyAccountId",
  ...KNOWN_METADATA_KEYS,
  "metadataExtra",
].join(",");

function formatUnknownMetadata(meta: Record<string, string> | null): string {
  if (!meta) return "";
  const unknownPairs = Object.entries(meta).filter(([k]) => !KNOWN_METADATA_KEYS.includes(k as (typeof KNOWN_METADATA_KEYS)[number]));
  if (unknownPairs.length === 0) return "";
  return unknownPairs.map(([k, v]) => `${k}=${v}`).join(" | ");
}

function rowToLine(row: FinanceLedgerEntryReadDto): string {
  const meta = row.metadata ?? null;
  return [
    cell(row.id),
    cell(row.createdAt),
    cell(row.entryType),
    cell(entryTypeLabelAr(row.entryType)),
    cell(row.amount),
    cell(row.currency),
    cell(row.orderId),
    cell(row.referenceType),
    cell(row.referenceId),
    cell(row.counterpartyAccountId),
    ...KNOWN_METADATA_KEYS.map((k) => cell(meta?.[k] ?? "")),
    cell(formatUnknownMetadata(meta)),
  ].join(",");
}

function safeFilePart(iso: string): string {
  return iso.replace(/[:.]/g, "-").replace(/\+/g, "Z");
}

/**
 * Fetches all pages for the same range, then builds UTF-8 CSV. Throws on any failed request;
 * the caller must not start a download until this resolves.
 */
export async function fetchAllLedgerActivityRows(
  token: string,
  walletAccountId: string,
  from: string,
  to: string,
): Promise<FinanceLedgerEntryReadDto[]> {
  const rows: FinanceLedgerEntryReadDto[] = [];
  let offset = 0;
  for (;;) {
    const page = await getLedgerActivityReport(token, walletAccountId, { from, to, offset, limit: PAGE });
    rows.push(...page.items);
    if (page.nextOffset == null) break;
    offset = page.nextOffset;
  }
  return rows;
}

export function buildLedgerActivityCsvString(rows: FinanceLedgerEntryReadDto[]): string {
  const lines = [HEADER, ...rows.map(rowToLine)];
  return lines.join("\r\n");
}

export function triggerLedgerActivityCsvDownload(
  rows: FinanceLedgerEntryReadDto[],
  walletAccountId: string,
  from: string,
  to: string,
): void {
  const csv = buildLedgerActivityCsvString(rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-activity-${safeFilePart(from)}_to_${safeFilePart(to)}-${walletAccountId.slice(0, 8)}.csv`;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * One-shot: fetch all pages, then download. Rethrows on any failure; no file is written in that case.
 */
export async function runLedgerActivityCsvExport(
  token: string,
  walletAccountId: string,
  from: string,
  to: string,
): Promise<void> {
  const rows = await fetchAllLedgerActivityRows(token, walletAccountId, from, to);
  triggerLedgerActivityCsvDownload(rows, walletAccountId, from, to);
}
