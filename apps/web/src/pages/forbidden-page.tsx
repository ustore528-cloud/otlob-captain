import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { isStandaloneDisplayMode } from "@/lib/customer-surface";

export function ForbiddenPage() {
  const role = useAuthStore((s) => s.user?.role ?? null);
  const token = useAuthStore((s) => s.token);
  const { t } = useTranslation();

  const standalone = isStandaloneDisplayMode();

  if (standalone && !token) {
    return <Navigate to="/customer-order" replace />;
  }

  if (standalone) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">{t("public.forbiddenStandalone.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("public.forbiddenStandalone.description")}</p>
        <Link
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          to="/customer-order"
        >
          {t("public.forbiddenStandalone.back")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Access Restricted</h1>
      <p className="text-sm text-muted-foreground">
        This web admin is available to platform and company admins only.
      </p>
      <p className="text-xs text-muted-foreground">
        Current role: <span className="font-mono">{role ?? "unknown"}</span>
      </p>
      <Link to="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to login
      </Link>
    </main>
  );
}
