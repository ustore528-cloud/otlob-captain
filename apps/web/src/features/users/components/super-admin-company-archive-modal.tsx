import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { queryClient } from "@/lib/query-client";
import { toastSuccess, toast } from "@/lib/toast";
import { ARCHIVE_COMPANY_PHRASE } from "@/lib/api/services/companies";

const MSGS = {
  activeOrders: "لا يمكن أرشفة الشركة لأنها تحتوي على طلبات غير منتهية.",
  invalidPhrase: "عبارة التأكيد غير صحيحة. يجب إدخال العبارة بالحروف الكبيرة: ARCHIVE COMPANY",
} as const;

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string | null;
  companyName?: string | null;
};

function mapArchiveError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409 && err.code === "COMPANY_HAS_ACTIVE_ORDERS") return MSGS.activeOrders;
    if (err.status === 400 && err.code === "INVALID_ARCHIVE_CONFIRMATION") return MSGS.invalidPhrase;
  }
  if (err instanceof Error) return err.message;
  return "تعذّر إكمال الأرشفة";
}

const FORM_ID = "super-admin-archive-company-form";

export function SuperAdminCompanyArchiveModal({ open, onClose, companyId, companyName }: Props) {
  const [confirmPhrase, setConfirmPhrase] = useState("");

  const previewQ = useQuery({
    queryKey: queryKeys.companies.deletePreview(companyId ?? "__none__"),
    queryFn: () => {
      if (!companyId) throw new Error("no company");
      return api.companies.getDeletePreview(companyId);
    },
    enabled: open && Boolean(companyId),
  });

  const {
    reset: resetArchive,
    isPending: archivePending,
    isError: archiveError,
    error: archiveErr,
    mutate: archiveSubmit,
  } = useMutation({
    mutationFn: () => {
      if (!companyId) throw new Error("no company");
      return api.companies.archive(companyId, { confirmPhrase: ARCHIVE_COMPANY_PHRASE });
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.companies.root });
      if (data.alreadyArchived) {
        toastSuccess("الشركة مؤرشفة مسبقاً.");
      } else {
        toastSuccess("تم أرشفة الشركة (تعطيل الظهور في القائمة النشطة) دون حذف أي بيانات.");
      }
      onClose();
    },
  });

  useEffect(() => {
    if (!open) {
      setConfirmPhrase("");
      return;
    }
    setConfirmPhrase("");
    resetArchive();
  }, [open, companyId, resetArchive]);

  const preview = previewQ.data;
  const blockedByOrders = (preview?.activeNonTerminalOrdersCount ?? 0) > 0;
  const alreadyInactive = preview ? !preview.isActive : false;
  const showArchiveForm =
    Boolean(preview) && !previewQ.isError && !alreadyInactive && !blockedByOrders && !previewQ.isLoading;
  const phraseValid = confirmPhrase === ARCHIVE_COMPANY_PHRASE;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={companyName ? `أرشفة الشركة: ${companyName}` : "أرشفة الشركة"}
      description="هذه عملية أرشفة (تعطيل الشركة) وليست حذفاً نهائياً. لا تُحذف مستخدمون أو طلبات أو محافظ."
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      {previewQ.isLoading ? <p className="text-sm text-muted">جارٍ جلب تفاصيل الاعتماد…</p> : null}
      {previewQ.isError ? (
        <InlineAlert variant="error">
          {previewQ.error instanceof Error ? previewQ.error.message : "تعذّر تحميل المعاينة"}
        </InlineAlert>
      ) : null}

      {preview && !previewQ.isError ? (
        <div className="space-y-4">
          {blockedByOrders ? <InlineAlert variant="warning">{MSGS.activeOrders}</InlineAlert> : null}
          {alreadyInactive ? (
            <InlineAlert variant="info">هذه الشركة معطّلة مسبقاً (مؤرشفة) وستظهر تفاصيلها للمعلومات فقط.</InlineAlert>
          ) : null}

          <div className="grid gap-2 rounded-lg border border-card-border p-3 text-sm sm:grid-cols-2">
            <div className="text-muted">المستخدمون</div>
            <div className="font-medium tabular-nums">{preview.usersCount}</div>
            <div className="text-muted">مستخدمون نشطون</div>
            <div className="font-medium tabular-nums">{preview.activeUsersCount}</div>
            <div className="text-muted">الكباتن</div>
            <div className="font-medium tabular-nums">{preview.captainsCount}</div>
            <div className="text-muted">كباتن نشطون</div>
            <div className="font-medium tabular-nums">{preview.activeCaptainsCount}</div>
            <div className="text-muted">المتاجر</div>
            <div className="font-medium tabular-nums">{preview.storesCount}</div>
            <div className="text-muted">الطلبات (الكل)</div>
            <div className="font-medium tabular-nums">{preview.ordersCount}</div>
            <div className="text-muted">طلبات غير منتهية</div>
            <div className="font-medium tabular-nums text-amber-700 dark:text-amber-400">
              {preview.activeNonTerminalOrdersCount}
            </div>
            <div className="text-muted">حسابات المحفظة</div>
            <div className="font-medium tabular-nums">{preview.walletAccountsCount}</div>
            <div className="text-muted">قيود دفتر الأستاذ</div>
            <div className="font-medium tabular-nums">{preview.ledgerEntriesCount}</div>
            <div className="text-muted">سجلات النشاط (مستخدمو الشركة)</div>
            <div className="font-medium tabular-nums">{preview.activityLogsByCompanyUserCount}</div>
            <div className="text-muted">رصيد محفظة الشركة</div>
            <div className="font-mono font-medium tabular-nums">{preview.companyWalletBalance}</div>
          </div>

          {preview.riskNotes.length > 0 ? (
            <div>
              <p className="text-sm font-medium">ملاحظات المخاطر</p>
              <ul className="mt-1 list-inside list-disc text-sm text-muted">
                {preview.riskNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {showArchiveForm ? (
        <form
          id={FORM_ID}
          className="mt-4 space-y-3 border-t border-card-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!phraseValid) {
              toast.error(MSGS.invalidPhrase);
              return;
            }
            if (blockedByOrders) {
              toast.error(MSGS.activeOrders);
              return;
            }
            void archiveSubmit();
          }}
        >
          <Label htmlFor="archive-confirm-phrase" className="text-sm">
            للمتابعة اكتب بالضبط: <span className="font-mono text-foreground">{ARCHIVE_COMPANY_PHRASE}</span>
          </Label>
          <Input
            id="archive-confirm-phrase"
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            autoComplete="off"
            className="font-mono"
            placeholder={ARCHIVE_COMPANY_PHRASE}
            disabled={archivePending}
          />
        </form>
      ) : null}

      {archiveError ? <InlineAlert variant="error">{mapArchiveError(archiveErr)}</InlineAlert> : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={archivePending}>
          إلغاء
        </Button>
        {showArchiveForm ? (
          <Button
            type="submit"
            form={FORM_ID}
            variant="destructive"
            disabled={!phraseValid || archivePending}
          >
            {archivePending ? "جارٍ الأرشفة…" : "تأكيد أرشفة الشركة"}
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
