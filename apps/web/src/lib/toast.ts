import { toast } from "sonner";
import i18n from "@/i18n/i18n";
import { ApiError } from "@/lib/api/http";

export function toastApiError(err: unknown, fallback = String(i18n.t("common.toastErrorFallback"))) {
  if (err instanceof ApiError) {
    toast.error(err.message);
    return;
  }
  if (err instanceof Error) {
    toast.error(err.message || fallback);
    return;
  }
  toast.error(fallback);
}

export function toastSuccess(message: string) {
  toast.success(message);
}

export { toast };
