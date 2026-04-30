import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  fetchComplaints,
  patchComplaintStatus,
  type ComplaintListItem,
} from "@/lib/api/services/complaints";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api/http";

const STATUSES: ComplaintListItem["status"][] = ["NEW", "REVIEWED", "RESOLVED"];

export function ComplaintsPage() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const [items, setItems] = useState<ComplaintListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchComplaints(token);
      setItems(data);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : t("complaints.page.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const table = useMemo(() => items, [items]);

  const onPatch = async (id: string, status: ComplaintListItem["status"]) => {
    if (!token) return;
    try {
      await patchComplaintStatus(token, id, { status });
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : t("complaints.page.patchError"));
      await load();
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t("complaints.page.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("complaints.page.description")}</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-3 text-muted">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          {t("complaints.page.loading")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-card-border bg-muted/30 text-start text-muted">
                <th className="whitespace-nowrap px-4 py-3">{t("complaints.page.colCompany")}</th>
                <th className="whitespace-nowrap px-4 py-3">{t("complaints.page.colName")}</th>
                <th className="whitespace-nowrap px-4 py-3">{t("complaints.page.colPhone")}</th>
                <th className="whitespace-nowrap px-4 py-3">{t("complaints.page.colType")}</th>
                <th className="min-w-[12rem] px-4 py-3">{t("complaints.page.colMessage")}</th>
                <th className="whitespace-nowrap px-4 py-3">{t("complaints.page.colCreated")}</th>
                <th className="whitespace-nowrap px-4 py-3">{t("complaints.page.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.id} className="border-b border-card-border align-top hover:bg-accent/40">
                  <td className="px-4 py-3 font-medium">{row.companyName}</td>
                  <td className="px-4 py-3">{row.customerName}</td>
                  <td className="px-4 py-3" dir="ltr">
                    {row.customerPhone}
                  </td>
                  <td className="max-w-[10rem] px-4 py-3">{row.complaintType}</td>
                  <td className="max-w-xl px-4 py-3 text-muted">{row.message}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted" dir="ltr">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="w-full rounded-lg border border-input bg-background px-2 py-2 text-xs"
                      value={row.status}
                      aria-label={`${t("complaints.page.colStatus")} ${row.id}`}
                      onChange={(ev) => void onPatch(row.id, ev.target.value as ComplaintListItem["status"])}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`complaints.status.${s}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {table.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-muted">
                    {t("complaints.page.empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
