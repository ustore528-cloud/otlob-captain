import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/http";
import {
  submitCaptainJoinApplication,
  type CaptainApplicationAvailability,
} from "@/lib/api/services/captain-applications";
import { toast } from "@/lib/toast";
import { isRtlLang } from "@/i18n/i18n";
import brandWordmark from "@/assets/brand-2in.png";

const LANG_CODES = ["ar", "en", "he"] as const;

/** Join-as-captain form — standalone public page; submissions are admin-review only */
export function JoinCaptainPage() {
  const { t, i18n } = useTranslation();
  const rtl = isRtlLang(i18n.resolvedLanguage ?? i18n.language);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = t("captainJoin.pageTitle");
    return () => {
      document.title = prevTitle;
    };
  }, [t]);

  const vehicleOptions = useMemo(
    () => ["motorcycle", "car", "bicycle", "scooter", "other"] as const,
    [],
  );

  const [langs, setLangs] = useState<Record<string, boolean>>({ ar: false, en: false, he: false });
  const [languagesOther, setLanguagesOther] = useState("");
  const [availability, setAvailability] = useState<CaptainApplicationAvailability>("FULL_TIME");
  const [vehicleTypeKey, setVehicleTypeKey] = useState<(typeof vehicleOptions)[number]>("motorcycle");

  const [fullName, setFullName] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [ageYears, setAgeYears] = useState("");
  const [city, setCity] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [preferredWorkAreas, setPreferredWorkAreas] = useState("");
  const [canJerusalem, setCanJerusalem] = useState<boolean>(false);
  const [canInterior, setCanInterior] = useState<boolean>(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const toggleLang = (code: string) => setLangs((p) => ({ ...p, [code]: !p[code] }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const picked: string[] = [];
    for (const c of LANG_CODES) {
      if (langs[c]) picked.push(c);
    }
    const extras = languagesOther
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    const languagesSpoken = [...picked, ...extras.filter((x) => !picked.includes(x))];

    let ageParsed: number | null = null;
    if (ageYears.trim() !== "") {
      ageParsed = Number.parseInt(ageYears.trim(), 10);
      if (!Number.isFinite(ageParsed) || ageParsed < 16 || ageParsed > 90) {
        toast.error(t("captainJoin.validation.ageYears"));
        return;
      }
    }

    let dobSent = dateOfBirth.trim().length >= 10 ? dateOfBirth.trim().slice(0, 10) : "";

    if ((!dobSent || dobSent.length !== 10) && ageParsed == null) {
      toast.error(t("captainJoin.validation.dobOrAge"));
      return;
    }

    if (languagesSpoken.length === 0) {
      toast.error(t("captainJoin.validation.languages"));
      return;
    }

    try {
      setSubmitting(true);
      await submitCaptainJoinApplication({
        fullName,
        primaryPhone,
        whatsappPhone,
        dateOfBirth: dobSent !== "" ? dobSent : "",
        ageYears: ageParsed,
        city,
        fullAddress,
        languagesSpoken,
        vehicleType: t(`captainJoin.vehicle.${vehicleTypeKey}`),
        vehicleNumber: vehicleNumber.trim() !== "" ? vehicleNumber.trim() : "",
        preferredWorkAreas,
        canEnterJerusalem: canJerusalem,
        canEnterInterior: canInterior,
        availability,
        notes: notes.trim() !== "" ? notes.trim() : "",
      });
      setDone(true);
      toast.success(t("captainJoin.toast.success"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("captainJoin.toast.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-slate-100 pb-14" dir={rtl ? "rtl" : "ltr"}>
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <img src={brandWordmark} alt="2in" className="h-9 w-auto object-contain" loading="lazy" />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link to="/customer-order">{t("captainJoin.backOrderHome")}</Link>
            </Button>
            <LanguageSwitcher />
          </div>
        </div>

        {done ? (
          <Card className="rounded-3xl border border-emerald-200/80 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl text-emerald-900">{t("captainJoin.successTitle")}</CardTitle>
              <CardDescription className="text-base text-emerald-900/80">{t("captainJoin.successBody")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link to="/customer-order">{t("captainJoin.backOrderHome")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl text-slate-900">{t("captainJoin.pageTitle")}</CardTitle>
              <CardDescription className="text-base text-slate-600">{t("captainJoin.pageIntro")}</CardDescription>
              <CardDescription className="text-xs text-slate-500">{t("captainJoin.phaseNote")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={(ev) => void onSubmit(ev)}>
                <Field label={t("captainJoin.field.fullName")}>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} />
                </Field>
                <Field label={t("captainJoin.field.primaryPhone")}>
                  <Input inputMode="tel" autoComplete="tel" value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)} required />
                </Field>
                <Field label={t("captainJoin.field.whatsappPhone")}>
                  <Input inputMode="tel" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("captainJoin.field.dateOfBirth")}>
                    <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                  </Field>
                  <Field label={t("captainJoin.field.ageYearsPlaceholder")}>
                    <Input inputMode="numeric" value={ageYears} onChange={(e) => setAgeYears(e.target.value)} />
                  </Field>
                </div>
                <Field label={t("captainJoin.field.city")}>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} required />
                </Field>
                <Field label={t("captainJoin.field.fullAddress")}>
                  <textarea
                    className="border-input placeholder:text-muted-foreground focus-visible:ring-ring min-h-[100px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] disabled:opacity-60"
                    value={fullAddress}
                    onChange={(e) => setFullAddress(e.target.value)}
                    required
                  />
                </Field>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-foreground">{t("captainJoin.field.languages")}</legend>
                  <div className="flex flex-wrap gap-4">
                    {LANG_CODES.map((c) => (
                      <label key={c} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 rounded border border-slate-300"
                          checked={Boolean(langs[c])}
                          onChange={() => toggleLang(c)}
                        />
                        {t(`captainJoin.lang.${c}`)}
                      </label>
                    ))}
                  </div>
                  <Field label={t("captainJoin.field.languagesExtra")}>
                    <Input
                      value={languagesOther}
                      onChange={(e) => setLanguagesOther(e.target.value)}
                      placeholder={t("captainJoin.field.languagesPlaceholder")}
                    />
                  </Field>
                </fieldset>
                <Field label={t("captainJoin.field.vehicleType")}>
                  <select
                    className="border-input bg-background h-11 w-full rounded-md border px-3 text-base shadow-xs"
                    value={vehicleTypeKey}
                    onChange={(e) => setVehicleTypeKey(e.target.value as (typeof vehicleOptions)[number])}
                  >
                    {vehicleOptions.map((k) => (
                      <option key={k} value={k}>
                        {t(`captainJoin.vehicle.${k}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("captainJoin.field.vehicleNumber")}>
                  <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
                </Field>
                <Field label={t("captainJoin.field.preferredWorkAreas")}>
                  <textarea
                    className="border-input placeholder:text-muted-foreground focus-visible:ring-ring min-h-[88px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px]"
                    value={preferredWorkAreas}
                    onChange={(e) => setPreferredWorkAreas(e.target.value)}
                    required
                  />
                </Field>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-foreground">{t("captainJoin.field.availability")}</legend>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="captain_avail"
                      checked={availability === "FULL_TIME"}
                      onChange={() => setAvailability("FULL_TIME")}
                    />
                    {t("captainJoin.availability.FULL_TIME")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="captain_avail"
                      checked={availability === "PART_TIME"}
                      onChange={() => setAvailability("PART_TIME")}
                    />
                    {t("captainJoin.availability.PART_TIME")}
                  </label>
                </fieldset>
                <BooleanRadioField
                  legend={t("captainJoin.field.canEnterJerusalem")}
                  value={canJerusalem}
                  onChange={setCanJerusalem}
                  yes={t("captainJoin.yes")}
                  no={t("captainJoin.no")}
                  name="jer"
                />
                <BooleanRadioField
                  legend={t("captainJoin.field.canEnterInterior")}
                  value={canInterior}
                  onChange={setCanInterior}
                  yes={t("captainJoin.yes")}
                  no={t("captainJoin.no")}
                  name="interior"
                />
                <Field label={t("captainJoin.field.notes")}>
                  <textarea
                    className="border-input placeholder:text-muted-foreground focus-visible:ring-ring min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>
                <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : t("captainJoin.submit")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function BooleanRadioField({
  legend,
  value,
  onChange,
  yes,
  no,
  name,
}: {
  legend: string;
  value: boolean;
  onChange: (v: boolean) => void;
  yes: string;
  no: string;
  name: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name={name} checked={value === true} onChange={() => onChange(true)} />
        {yes}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name={name} checked={value === false} onChange={() => onChange(false)} />
        {no}
      </label>
    </fieldset>
  );
}
