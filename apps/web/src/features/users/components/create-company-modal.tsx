import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: (input: {
      name: string;
      incubatorMotherName?: string;
      deliveryPricing: {
        deliveryPricingMode: "FIXED" | "DISTANCE_BASED";
        fixedDeliveryFee?: number;
        baseDeliveryFee?: number;
        pricePerKm?: number;
        deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
      };
    }) => api.companies.create(input),
    onSuccess: async (c) => {
      await qc.invalidateQueries({ queryKey: queryKeys.companies.root });
      toastSuccess(t("users.createCompany.success"));
      onCreated(c);
      onClose();
    },
    onError: (e) => {
      toastApiError(e, t("users.createCompany.error"));
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
      title={t("users.createCompany.title")}
      description={t("users.createCompany.description")}
      className="max-w-md"
    >
      <form
        className="space-y-3"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          setErr(null);
          const fd = new FormData(e.currentTarget);
          const name = String(fd.get("companyName") ?? "").trim();
          const incubatorMotherName = String(fd.get("incubatorMotherName") ?? "").trim();
          const deliveryPricingMode =
            String(fd.get("deliveryPricingMode") ?? "FIXED").trim() === "DISTANCE_BASED"
              ? "DISTANCE_BASED"
              : "FIXED";
          const fixedDeliveryFeeRaw = String(fd.get("fixedDeliveryFee") ?? "").trim();
          const baseDeliveryFeeRaw = String(fd.get("baseDeliveryFee") ?? "").trim();
          const pricePerKmRaw = String(fd.get("pricePerKm") ?? "").trim();
          const roundingModeRaw = String(fd.get("deliveryFeeRoundingMode") ?? "CEIL").trim();
          const deliveryFeeRoundingMode =
            roundingModeRaw === "ROUND" || roundingModeRaw === "NONE" ? roundingModeRaw : "CEIL";
          if (!name) {
            setErr(t("users.createCompany.nameRequired"));
            return;
          }
          if (deliveryPricingMode === "FIXED" && fixedDeliveryFeeRaw === "") {
            setErr("رسوم التوصيل الثابتة مطلوبة.");
            return;
          }
          if (deliveryPricingMode === "DISTANCE_BASED" && (baseDeliveryFeeRaw === "" || pricePerKmRaw === "")) {
            setErr("في وضع المسافة يجب إدخال السعر الأساسي وسعر كل كم.");
            return;
          }
          void m.mutate({
            name,
            ...(incubatorMotherName ? { incubatorMotherName } : {}),
            deliveryPricing: {
              deliveryPricingMode,
              ...(deliveryPricingMode === "FIXED"
                ? { fixedDeliveryFee: Number(fixedDeliveryFeeRaw || 0) }
                : {
                    baseDeliveryFee: Number(baseDeliveryFeeRaw || 0),
                    pricePerKm: Number(pricePerKmRaw || 0),
                  }),
              deliveryFeeRoundingMode,
            },
          });
        }}
      >
        {err ? <InlineAlert variant="error">{err}</InlineAlert> : null}
        <div className="grid gap-2">
          <Label htmlFor="create-company-name">{t("users.createCompany.nameLabel")}</Label>
          <Input
            id="create-company-name"
            name="companyName"
            maxLength={200}
            autoComplete="organization"
            disabled={m.isPending}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="create-company-incubator-mother">الأم الحاضنة</Label>
          <Input
            id="create-company-incubator-mother"
            name="incubatorMotherName"
            maxLength={200}
            disabled={m.isPending}
            placeholder="اسم الأم الحاضنة الخاصة بالشركة"
          />
        </div>
        <div className="grid gap-2 rounded-lg border border-card-border p-3">
          <p className="text-sm font-semibold">إعدادات رسوم التوصيل</p>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="deliveryPricingMode" value="FIXED" defaultChecked className="mt-1" />
            <span>
              سعر توصيل ثابت
              <span className="mt-0.5 block text-xs text-muted">مثال: 15 ₪</span>
            </span>
          </label>
          <div className="grid gap-1">
            <Label htmlFor="create-company-fixed-fee">fixedDeliveryFee</Label>
            <Input
              id="create-company-fixed-fee"
              name="fixedDeliveryFee"
              type="number"
              min={0}
              step="0.01"
              defaultValue="15"
              disabled={m.isPending}
            />
          </div>
          <label className="flex items-start gap-2 pt-2 text-sm">
            <input type="radio" name="deliveryPricingMode" value="DISTANCE_BASED" className="mt-1" />
            <span>
              سعر توصيل حسب المسافة
              <span className="mt-0.5 block text-xs text-muted">deliveryFee = baseDeliveryFee + distanceKm × pricePerKm</span>
            </span>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="create-company-base-fee">سعر التوصيل الأساسي (baseDeliveryFee)</Label>
              <Input
                id="create-company-base-fee"
                name="baseDeliveryFee"
                type="number"
                min={0}
                step="0.01"
                defaultValue="15"
                disabled={m.isPending}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="create-company-price-per-km">سعر كل كم (pricePerKm)</Label>
              <Input
                id="create-company-price-per-km"
                name="pricePerKm"
                type="number"
                min={0}
                step="0.01"
                defaultValue="3"
                disabled={m.isPending}
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="create-company-rounding">طريقة التقريب</Label>
            <select
              id="create-company-rounding"
              name="deliveryFeeRoundingMode"
              defaultValue="CEIL"
              className="h-10 rounded-md border border-card-border bg-background px-3 text-sm"
              disabled={m.isPending}
            >
              <option value="CEIL">CEIL</option>
              <option value="ROUND">ROUND</option>
              <option value="NONE">NONE</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={m.isPending}>
            {t("users.createCompany.cancel")}
          </Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? t("users.createCompany.creating") : t("users.createCompany.submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
