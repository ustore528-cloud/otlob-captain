import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchCaptainApplicationsList,
  patchCaptainApplicationAdmin,
  type CaptainApplicationListItem,
  type CaptainApplicationStatus,
} from "@/lib/api/services/captain-applications";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api/http";

const STATUSES: (CaptainApplicationStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "REVIEWING",
  "APPROVED",
  "REJECTED",
  "CONVERTED_TO_CAPTAIN",
];

function formatLanguages(raw: unknown, tFallback: string): string {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).join(", ");
  if (typeof raw === "string") return raw;
  return tFallback;
}

export function CaptainApplicationsAdminPage() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const [items, setItems] = useState<CaptainApplicationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaptainApplicationStatus | "ALL">("ALL");

  const [detail, setDetail] = useState<CaptainApplicationListItem | null>(null);
  const [draftStatus, setDraftStatus] = useState<CaptainApplicationStatus>("PENDING");
  const [draftInternal, setDraftInternal] = useState("");
  const [patching, setPatching] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCaptainApplicationsList(token, {
        page,
        pageSize,
        status: statusFilter === "ALL" ? "ALL" : statusFilter,
        q: qApplied.trim() !== "" ? qApplied : undefined,
      });
      setItems(data.applications);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : t("captainJoin.admin.loadError"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, qApplied, statusFilter, t, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!detail) return;
    setDraftStatus(detail.status);
    setDraftInternal(detail.internalNotes ?? "");
  }, [detail]);

  const maxPage = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function submitPatch(closeAfter: boolean) {
    if (!token || !detail) return;
    setPatching(true);
    try {
      const updated = await patchCaptainApplicationAdmin(token, detail.id, {
        status: draftStatus,
        internalNotes: draftInternal,
      });
      await load();
      if (closeAfter) setDetail(null);
      else setDetail(updated);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : t("captainJoin.admin.patchError"));
    } finally {
      setPatching(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t("captainJoin.admin.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("captainJoin.admin.description")}</p>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label>{t("captainJoin.admin.search")}</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("captainJoin.admin.searchPlaceholder")} className="w-64 min-w-[12rem]" />
            </div>
            <Button type="button" variant="secondary" onClick={() => setQApplied(q)}>
              {t("captainJoin.admin.apply")}
            </Button>
            <div className="grid gap-2">
              <Label>{t("captainJoin.admin.statusFilter")}</Label>
              <select
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CaptainApplicationStatus | "ALL")}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "ALL" ? t("captainJoin.admin.allStatuses") : t(`captainJoin.admin.status.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <CardDescription>{t("captainJoin.admin.count", { total })}</CardDescription>
          <CardTitle className="text-base">{t("captainJoin.admin.tableTitle")}</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto border-t border-card-border px-4 pb-4">
          {loading ? (
            <div className="flex items-center gap-2 pt-6 text-muted">
              <Loader2 className="size-5 animate-spin" />
              {t("captainJoin.admin.loading")}
            </div>
          ) : (
            <table className="mt-4 min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-start">
                  <th className="px-3 py-2">{t("captainJoin.admin.col.name")}</th>
                  <th className="px-3 py-2">{t("captainJoin.admin.col.phone")}</th>
                  <th className="px-3 py-2">{t("captainJoin.admin.col.city")}</th>
                  <th className="px-3 py-2">{t("captainJoin.admin.col.status")}</th>
                  <th className="px-3 py-2">{t("captainJoin.admin.col.created")}</th>
                  <th className="px-3 py-2">{t("captainJoin.admin.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2">{row.fullName}</td>
                    <td className="px-3 py-2">{row.primaryPhone}</td>
                    <td className="px-3 py-2">{row.city}</td>
                    <td className="px-3 py-2">{t(`captainJoin.admin.status.${row.status}`)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => setDetail(row)}>
                        <Eye className="size-3.5" aria-hidden />
                        {t("captainJoin.admin.open")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-card-border px-4 py-3">
          <Button type="button" variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {t("captainJoin.admin.prev")}
          </Button>
          <span className="text-sm text-muted">
            {page} / {maxPage}
          </span>
          <Button type="button" variant="secondary" size="sm" disabled={page >= maxPage || loading} onClick={() => setPage((p) => p + 1)}>
            {t("captainJoin.admin.next")}
          </Button>
        </div>
      </Card>

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            className="absolute inset-0 cursor-default"
            role="presentation"
            onClick={() => (patching ? undefined : setDetail(null))}
            onKeyDown={() => {}}
          />
          <Card className="relative z-[1] flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-hidden shadow-xl">
            <CardHeader>
              <CardTitle>{t("captainJoin.admin.detailTitle")}</CardTitle>
              <CardDescription className="text-xs">{detail.id}</CardDescription>
            </CardHeader>
            <div className="space-y-3 overflow-y-auto px-6 pb-2 text-sm">
              <Dl label={t("captainJoin.field.fullName")} value={detail.fullName} />
              <Dl label={t("captainJoin.field.primaryPhone")} value={detail.primaryPhone} />
              <Dl label={t("captainJoin.field.whatsappPhone")} value={detail.whatsappPhone} />
              <Dl
                label={t("captainJoin.detail.dob")}
                value={detail.dateOfBirth ? detail.dateOfBirth.slice(0, 10) : "—"}
              />
              <Dl label={t("captainJoin.field.ageYearsPlaceholder")} value={detail.ageYears?.toString() ?? "—"} />
              <Dl label={t("captainJoin.field.city")} value={detail.city} />
              <Dl label={t("captainJoin.field.fullAddress")} value={detail.fullAddress} multiline />
              <Dl label={t("captainJoin.field.languages")} value={formatLanguages(detail.languagesSpoken, "—")} />
              <Dl label={t("captainJoin.field.vehicleType")} value={detail.vehicleType} />
              <Dl label={t("captainJoin.field.vehicleNumber")} value={detail.vehicleNumber ?? "—"} />
              <Dl label={t("captainJoin.field.preferredWorkAreas")} value={detail.preferredWorkAreas} multiline />
              <Dl label={t("captainJoin.field.canEnterJerusalem")} value={detail.canEnterJerusalem ? t("captainJoin.yes") : t("captainJoin.no")} />
              <Dl label={t("captainJoin.field.canEnterInterior")} value={detail.canEnterInterior ? t("captainJoin.yes") : t("captainJoin.no")} />
              <Dl
                label={t("captainJoin.field.availability")}
                value={
                  detail.availability === "FULL_TIME" ? t("captainJoin.availability.FULL_TIME") : t("captainJoin.availability.PART_TIME")
                }
              />
              <Dl label={t("captainJoin.field.notes")} value={detail.notes ?? "—"} multiline />

              <div className="grid gap-2 border-t pt-4">
                <Label>{t("captainJoin.admin.statusLabel")}</Label>
                <select
                  className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as CaptainApplicationStatus)}
                >
                  {STATUSES.filter((s) => s !== "ALL").map((s) => (
                    <option key={s} value={s}>
                      {t(`captainJoin.admin.status.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>{t("captainJoin.admin.internalNotes")}</Label>
                <textarea
                  className="border-input min-h-[100px] w-full rounded-md border px-3 py-2 text-sm"
                  value={draftInternal}
                  onChange={(e) => setDraftInternal(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-card-border p-4">
              <Button type="button" variant="secondary" disabled={patching} onClick={() => setDetail(null)}>
                {t("captainJoin.admin.close")}
              </Button>
              <Button type="button" variant="destructive" disabled={patching} onClick={() => void submitPatch(false)}>
                {patching ? <Loader2 className="size-4 animate-spin" /> : t("captainJoin.admin.save")}
              </Button>
              <Button type="button" disabled={patching} onClick={() => void submitPatch(true)}>
                {patching ? <Loader2 className="size-4 animate-spin" /> : t("captainJoin.admin.saveClose")}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </section>
  );
}

function Dl({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={multiline ? "mt-1 whitespace-pre-wrap break-words" : "font-medium"}>{value}</div>
    </div>
  );
}
