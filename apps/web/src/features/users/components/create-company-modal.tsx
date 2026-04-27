import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Modal } from "@/components/ui/modal";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";
import type { CompanyListItem } from "@/lib/api/services/companies";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with the new company; parent should select it in the dropdown */
  onCreated: (c: CompanyListItem) => void;
};

export function CreateCompanyModal({ open, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: (name: string) => api.companies.create({ name }),
    onSuccess: async (c) => {
      await qc.invalidateQueries({ queryKey: queryKeys.companies.root });
      toastSuccess("تم إنشاء الشركة");
      onCreated(c);
      onClose();
    },
    onError: (e) => {
      toastApiError(e, "تعذّر إنشاء الشركة");
    },
  });

  useEffect(() => {
    if (!open) {
      setErr(null);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="إنشاء شركة جديدة"
      description="يُنشئ معرف الشركة تلقائياً. يمكنك بعدها اختيارها لمدير الشركة من القائمة."
      className="max-w-md"
    >
      <form
        className="space-y-3"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          setErr(null);
          const name = String(new FormData(e.currentTarget).get("companyName") ?? "").trim();
          if (!name) {
            setErr("يرجى إدخال اسم الشركة");
            return;
          }
          void m.mutate(name);
        }}
      >
        {err ? <InlineAlert variant="error">{err}</InlineAlert> : null}
        <div className="grid gap-2">
          <Label htmlFor="create-company-name">اسم الشركة</Label>
          <Input
            id="create-company-name"
            name="companyName"
            maxLength={200}
            autoComplete="organization"
            disabled={m.isPending}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={m.isPending}>
            إلغاء
          </Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? "جارٍ الإنشاء…" : "حفظ الشركة"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
