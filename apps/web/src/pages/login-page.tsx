import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { LoginBody, LoginResponse } from "@captain/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, paths } from "@/lib/api";
import { toastApiError } from "@/lib/toast";
import { useAuthStore } from "@/stores/auth-store";
import brandWordmark from "@/assets/brand-2in.png";

function parseLoginBody(identifier: string, password: string): LoginBody {
  const id = identifier.trim();
  if (id.includes("@")) return { email: id, password };
  return { phone: id, password };
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const login = useMutation({
    mutationFn: async (body: LoginBody) => {
      return apiFetch<LoginResponse>(paths.auth.login, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      void navigate("/", { replace: true });
    },
    onError: (e) => toastApiError(e, t("login.error")),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const identifier = String(form.get("identifier") ?? "");
    const password = String(form.get("password") ?? "");
    login.mutate(parseLoginBody(identifier, password));
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-md border-card-border bg-card shadow-lg">
        <CardHeader>
          <img src={brandWordmark} alt="2in" className="mb-1 h-10 w-auto object-contain self-start" />
          <CardTitle>2in</CardTitle>
          <CardDescription>{t("login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="identifier">{t("login.identifierLabel")}</Label>
              <Input
                id="identifier"
                name="identifier"
                autoComplete="username"
                required
                dir="ltr"
                className="text-left"
                placeholder={t("login.identifierPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t("login.passwordLabel")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                dir="ltr"
                className="text-left"
              />
            </div>
            {login.isError ? (
              <p className="text-sm text-red-600">{(login.error as Error).message ?? t("login.error")}</p>
            ) : null}
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
