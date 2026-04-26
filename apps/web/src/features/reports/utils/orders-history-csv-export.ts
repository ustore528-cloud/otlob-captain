import type { TFunction } from "i18next";
import type { OrdersHistoryReportRow } from "@/types/api";

const UTF8_BOM = "\uFEFF";

const HEADER_KEYS: Array<[keyof OrdersHistoryReportRow, string]> = [
  ["orderNumber", "csv.orderNumber"],
  ["storeName", "csv.storeName"],
  ["captainName", "csv.captainName"],
  ["captainPhone", "csv.captainPhone"],
  ["customerName", "csv.customerName"],
  ["status", "csv.status"],
  ["assignedAt", "csv.assignedAt"],
  ["acceptedAt", "csv.acceptedAt"],
  ["pickupAt", "csv.pickupAt"],
  ["deliveredAt", "csv.deliveredAt"],
  ["storeAmount", "csv.storeAmount"],
  ["deliveryFee", "csv.deliveryFee"],
  ["customerCollectionAmount", "csv.customerCollectionAmount"],
  ["profitOrCommission", "csv.profitOrCommission"],
];

function esc(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

const EM_DASH = "—";

function formatCsvCell(
  key: keyof OrdersHistoryReportRow,
  row: OrdersHistoryReportRow,
  t: TFunction,
  dateLocale: string,
): string {
  const v = row[key];

  if (key === "captainName" || key === "captainPhone" || key === "customerName") {
    if (v == null || String(v).trim() === "") return esc(EM_DASH);
    return esc(String(v));
  }

  if (key === "pickupAt") {
    if (v == null || String(v).trim() === "") return esc(t("csv.pickupNotRecordedCell"));
    const s = String(v).trim();
    const time = Date.parse(s);
    if (Number.isNaN(time)) return esc(s);
    return esc(new Date(time).toLocaleString(dateLocale, { hour12: false }));
  }

  if (key === "assignedAt" || key === "acceptedAt" || key === "deliveredAt") {
    if (v == null) return esc(EM_DASH);
    const s = String(v).trim();
    if (!s) return esc(EM_DASH);
    const time = Date.parse(s);
    if (Number.isNaN(time)) return esc(s);
    return esc(new Date(time).toLocaleString(dateLocale, { hour12: false }));
  }

  if (typeof v === "number") return esc(v.toFixed(2));
  if (v == null) return esc("");
  return esc(String(v));
}

function line(row: OrdersHistoryReportRow, t: TFunction, dateLocale: string): string {
  return HEADER_KEYS.map(([k]) => formatCsvCell(k, row, t, dateLocale)).join(",");
}

export function buildOrdersHistoryCsv(rows: OrdersHistoryReportRow[], t: TFunction, dateLocale = "en-GB"): string {
  const header = HEADER_KEYS.map(([, tk]) => esc(t(tk))).join(",");
  const lines = rows.map((r) => line(r, t, dateLocale));
  return `${UTF8_BOM}${[header, ...lines].join("\r\n")}\r\n`;
}

export function downloadOrdersHistoryCsv(
  rows: OrdersHistoryReportRow[],
  filename: string,
  t: TFunction,
  dateLocale = "en-GB",
): void {
  const content = buildOrdersHistoryCsv(rows, t, dateLocale);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
