import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompaniesForSuperAdmin } from "@/hooks";
import { SuperAdminCompanyArchiveModal } from "./super-admin-company-archive-modal";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/singleton";
import { queryKeys } from "@/lib/api/query-keys";
import { toastApiError, toastSuccess } from "@/lib/toast";

type Props = {
  isSuperAdmin: boolean;
};

export function SuperAdminCompaniesArchiveSection({ isSuperAdmin }: Props) {
  const { t } = useTranslation();
  const companiesQ = useCompaniesForSuperAdmin({ enabled: isSuperAdmin });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const selectedEditCompany = companiesQ.data?.find((c) => c.id === selectedEditId) ?? null;
  const editMutation = useMutation({
    mutationFn: (input: {
      companyId: string;
      name: string;
      incubatorMotherName?: string | null;
      deliveryPricing: {
        deliveryPricingMode: "FIXED" | "DISTANCE_BASED";
        fixedDeliveryFee?: number;
        baseDeliveryFee?: number;
        pricePerKm?: number;
        deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
      };
    }) =>
      api.companies.update(input.companyId, {
        name: input.name,
        incubatorMotherName: input.incubatorMotherName ?? null,
        deliveryPricing: input.deliveryPricing,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.companies.root });
      toastSuccess("تم تحديث إعدادات الشركة ورسوم التوصيل");
      setEditOpen(false);
      setSelectedEditId(null);
    },
    onError: (e) => toastApiError(e, "فشل تحديث إعدادات الشركة"),
  });

  useEffect(() => {
    if (!editOpen) setSelectedEditId(null);
  }, [editOpen]);

  if (!isSuperAdmin) return null;

  return (
    <>
      <Card className="border-card-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("users.archiveSection.title")}</CardTitle>
          <CardDescription>{t("users.archiveSection.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {companiesQ.isLoading ? <p className="text-sm text-muted">{t("users.archiveSection.loading")}</p> : null}
          {companiesQ.isError ? (
            <p className="text-sm text-red-600">{(companiesQ.error as Error).message}</p>
          ) : null}
          {companiesQ.data && companiesQ.data.length === 0 ? (
            <p className="text-sm text-muted">{t("users.archiveSection.empty")}</p>
          ) : null}
          {companiesQ.data && companiesQ.data.length > 0 ? (
            <ul className="divide-y divide-card-border rounded-lg border border-card-border">
              {companiesQ.data.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      الأم الحاضنة: {c.incubatorMotherName?.trim() ? c.incubatorMotherName : "غير محددة"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedEditId(c.id);
                      setEditOpen(true);
                    }}
                  >
                    تعديل الإعدادات
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelected({ id: c.id, name: c.name });
                      setOpen(true);
                    }}
                  >
                    {t("users.archiveSection.archive")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
      <SuperAdminCompanyArchiveModal
        open={open}
        onClose={() => {
          setOpen(false);
          setSelected(null);
        }}
        companyId={selected?.id ?? null}
        companyName={selected?.name}
      />
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="تعديل الشركة"
        description="تعديل الاسم، الأم الحاضنة، وإعدادات رسوم التوصيل."
        className="max-w-xl"
      >
        {selectedEditCompany ? (
          <form
            className="space-y-3"
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get("companyName") ?? "").trim();
              const incubatorMotherName = String(fd.get("incubatorMotherName") ?? "").trim();
              const deliveryPricingMode =
                String(fd.get("deliveryPricingMode") ?? "FIXED").trim() === "DISTANCE_BASED"
                  ? "DISTANCE_BASED"
                  : "FIXED";
              const fixedDeliveryFee = Number(String(fd.get("fixedDeliveryFee") ?? "0").trim() || "0");
              const baseDeliveryFee = Number(String(fd.get("baseDeliveryFee") ?? "0").trim() || "0");
              const pricePerKm = Number(String(fd.get("pricePerKm") ?? "0").trim() || "0");
              const deliveryFeeRoundingModeRaw = String(fd.get("deliveryFeeRoundingMode") ?? "CEIL").trim();
              const deliveryFeeRoundingMode =
                deliveryFeeRoundingModeRaw === "ROUND" || deliveryFeeRoundingModeRaw === "NONE"
                  ? deliveryFeeRoundingModeRaw
                  : "CEIL";
              if (!name) return;
              editMutation.mutate({
                companyId: selectedEditCompany.id,
                name,
                incubatorMotherName: incubatorMotherName || null,
                deliveryPricing: {
                  deliveryPricingMode,
                  ...(deliveryPricingMode === "FIXED"
                    ? { fixedDeliveryFee }
                    : { baseDeliveryFee, pricePerKm }),
                  deliveryFeeRoundingMode,
                },
              });
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="edit-company-name">اسم الشركة</Label>
              <Input id="edit-company-name" name="companyName" defaultValue={selectedEditCompany.name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-company-incubator-mother">الأم الحاضنة</Label>
              <Input
                id="edit-company-incubator-mother"
                name="incubatorMotherName"
                defaultValue={selectedEditCompany.incubatorMotherName ?? ""}
              />
            </div>
            <div className="grid gap-2 rounded-lg border border-card-border p-3">
              <p className="text-sm font-semibold">إعدادات رسوم التوصيل</p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="deliveryPricingMode"
                  value="FIXED"
                  defaultChecked={selectedEditCompany.deliveryPricing.mode === "FIXED"}
                  className="mt-1"
                />
                <span>سعر توصيل ثابت</span>
              </label>
              <Input
                name="fixedDeliveryFee"
                type="number"
                min={0}
                step="0.01"
                defaultValue={selectedEditCompany.deliveryPricing.fixedDeliveryFee ?? "0"}
              />
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="deliveryPricingMode"
                  value="DISTANCE_BASED"
                  defaultChecked={selectedEditCompany.deliveryPricing.mode === "DISTANCE_BASED"}
                  className="mt-1"
                />
                <span>سعر توصيل حسب المسافة</span>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  name="baseDeliveryFee"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={selectedEditCompany.deliveryPricing.baseDeliveryFee ?? "0"}
                />
                <Input
                  name="pricePerKm"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={selectedEditCompany.deliveryPricing.pricePerKm ?? "0"}
                />
              </div>
              <select
                name="deliveryFeeRoundingMode"
                defaultValue={selectedEditCompany.deliveryPricing.roundingMode}
                className="h-10 rounded-md border border-card-border bg-background px-3 text-sm"
              >
                <option value="CEIL">CEIL</option>
                <option value="ROUND">ROUND</option>
                <option value="NONE">NONE</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={editMutation.isPending}>
                إلغاء
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
