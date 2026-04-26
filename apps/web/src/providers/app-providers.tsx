import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider, useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/query-client";
import i18n, { isRtlLang } from "@/i18n/i18n";
import { SyncDocumentLangDir } from "@/i18n/sync-document-lang-dir";

function AppToaster() {
  const { i18n: i18nInstance } = useTranslation();
  const rtl = isRtlLang(i18nInstance.resolvedLanguage ?? i18nInstance.language);
  return <Toaster dir={rtl ? "rtl" : "ltr"} position="top-center" richColors closeButton />;
}

export function AppProviders({ children }: { children: unknown }) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <SyncDocumentLangDir />
        {children as never}
        <AppToaster />
      </QueryClientProvider>
    </I18nextProvider>
  );
}
