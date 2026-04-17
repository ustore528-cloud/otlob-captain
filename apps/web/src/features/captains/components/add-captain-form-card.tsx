import { type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { useCreateCaptain } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const VEHICLE_TYPES = ["بسكليت", "دراجه ناريه", "سيارة", "شحن نقل"] as const;
const selectClass =
  "h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function AddCaptainFormCard() {
  const create = useCreateCaptain();

  function onCreateCaptain(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const emailRaw = String(f.get("email") ?? "").trim();
    create.mutate(
      {
        fullName: String(f.get("fullName") ?? "").trim(),
        phone: String(f.get("phone") ?? "").trim(),
        password: String(f.get("password") ?? ""),
        vehicleType: String(f.get("vehicleType") ?? "").trim(),
        area: String(f.get("area") ?? "").trim(),
        ...(emailRaw ? { email: emailRaw } : {}),
      },
      {
        onSuccess: () => {
          e.currentTarget.reset();
        },
      },
    );
  }

  return (
    <Card className="border-card-border shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <UserPlus className="size-5 text-primary" />
        <div>
          <CardTitle className="text-base">إضافة كابتن</CardTitle>
          <CardDescription>ينشئ مستخدمًا بدور كابتن وكلمة مرور أولية</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onCreateCaptain}>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="fullName">الاسم الكامل</Label>
            <Input id="fullName" name="fullName" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">الهاتف</Label>
            <Input id="phone" name="phone" required dir="ltr" className="text-left" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">البريد (اختياري)</Label>
            <Input id="email" name="email" type="email" dir="ltr" className="text-left" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="password">كلمة المرور الأولية</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vehicleType">نوع المركبة</Label>
            <select id="vehicleType" name="vehicleType" required className={selectClass} defaultValue="دراجه ناريه">
              {VEHICLE_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="area">المنطقة</Label>
            <Input id="area" name="area" required />
          </div>
          {create.isError ? <p className="text-sm text-red-600 sm:col-span-2">{(create.error as Error).message}</p> : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "جارٍ الإنشاء…" : "حفظ الكابتن"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
