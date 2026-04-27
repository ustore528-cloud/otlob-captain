import { Alert } from "react-native";
import i18n from "@/i18n/i18n";
import { formatUnknownError } from "./error-format";

export function alertMutationError(title: string, error: unknown, fallback?: string): void {
  Alert.alert(title, formatUnknownError(error, fallback ?? i18n.t("errors.mutationGeneric")));
}
