import i18n from "@/i18n/i18n";
import { ApiClientError } from "@/services/api/errors";

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "INVALID_CREDENTIALS") {
      return i18n.t("auth.invalidCredentials");
    }
    if (error.code === "FORBIDDEN_ROLE") {
      return i18n.t("auth.forbiddenRole");
    }
    if (error.code === "FORBIDDEN") {
      return i18n.t("auth.forbidden");
    }
    return error.message || i18n.t("auth.loginFailed");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return i18n.t("auth.unexpected");
}
