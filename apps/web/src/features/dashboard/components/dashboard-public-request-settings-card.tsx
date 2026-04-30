import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  getCompanyPublicPageSettings,
  patchCompanyPublicPageSettings,
} from "@/lib/api/services/company-public-page-settings";
import { useAuthStore } from "@/stores/auth-store";

export function DashboardPublicRequestSettingsCard() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["company", "public-page-settings"],
    queryFn: () => getCompanyPublicPageSettings(token!),
    enabled: Boolean(token),
  });

  const [introTitle, setIntroTitle] = useState("");
  const [bannerWelcome, setBannerWelcome] = useState("");
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(5);
  const [nearbyCaption, setNearbyCaption] = useState("");
  const [showCarousel, setShowCarousel] = useState(true);
  const [showComplaints, setShowComplaints] = useState(true);
  const [showBenefits, setShowBenefits] = useState(true);

  useEffect(() => {
    if (!q.data) return;
    setIntroTitle(q.data.introTitle ?? "");
    setBannerWelcome(q.data.bannerWelcome ?? "");
    setNearbyCaption(q.data.nearbyCaption ?? "");
    setNearbyRadiusKm(q.data.nearbyRadiusKm ?? 5);
    setShowCarousel(q.data.showCarousel);
    setShowComplaints(q.data.showComplaintsBox);
    setShowBenefits(q.data.showBenefitsRow);
  }, [q.data]);

  const mutate = useMutation({
    mutationFn: () =>
      patchCompanyPublicPageSettings(token!, {
        introTitle,
        bannerWelcome: bannerWelcome.trim() ? bannerWelcome : null,
        nearbyCaption: nearbyCaption.trim() ? nearbyCaption : null,
        nearbyRadiusKm: Number.isFinite(nearbyRadiusKm) ? Math.min(25, Math.max(2, nearbyRadiusKm)) : 5,
        showCarousel,
        showComplaintsBox: showComplaints,
        showBenefitsRow: showBenefits,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["company", "public-page-settings"] });
    },
  });

  if (!token) return null;

  return (
    <Card className="border-card-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="size-4 text-primary" aria-hidden />
          إعدادات صفحة الطلب العامّة
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          تسمح بتعديل عنوان الصفحة، التنبيه، نصف القطر، وعرض الشرائح وصندوق الشكاوى وصف المزايا.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {q.isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل…</p> : null}
        {q.error ? <p className="text-sm text-destructive">{(q.error as Error)?.message}</p> : null}

        <div className="grid gap-2">
          <Label htmlFor="p-intro">عنوان في أعلى صفحة الطلب</Label>
          <Input
            id="p-intro"
            value={introTitle}
            onChange={(e) => setIntroTitle(e.target.value)}
            placeholder="خدمة توصيل"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="p-banner">تنبيه داخلي (اختياري)</Label>
          <Input
            id="p-banner"
            value={bannerWelcome}
            onChange={(e) => setBannerWelcome(e.target.value)}
            placeholder="مثال: ساعات الذروة — زمن الوصول غير متوقّع"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="p-rad">نصف القطر لعرض الكباتن القريبين (كم)</Label>
            <Input
              id="p-rad"
              type="number"
              min={2}
              max={25}
              value={nearbyRadiusKm}
              onChange={(e) => setNearbyRadiusKm(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-cap">وصف نقاط القرب</Label>
            <Input id="p-cap" value={nearbyCaption} onChange={(e) => setNearbyCaption(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showCarousel} onChange={(e) => setShowCarousel(e.target.checked)} />
            عرض الشرائح
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showComplaints} onChange={(e) => setShowComplaints(e.target.checked)} />
            صندوق الشكاوى
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showBenefits} onChange={(e) => setShowBenefits(e.target.checked)} />
            بطاقات المزايا
          </label>
        </div>

        <Button type="button" disabled={mutate.isPending} onClick={() => mutate.mutate()}>
          <Save className="me-2 size-4" aria-hidden />
          {mutate.isPending ? "جاري الحفظ…" : "حفظ"}
        </Button>
      </CardContent>
    </Card>
  );
}
