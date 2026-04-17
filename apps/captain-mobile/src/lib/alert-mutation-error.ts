import { Alert } from "react-native";
import { formatUnknownError } from "./error-format";

/** رسالة خطأ موحّدة بعد فشل طلبات المستخدم (توفر، طلبات، إلخ) */
export function alertMutationError(title: string, error: unknown, fallback?: string): void {
  Alert.alert(title, formatUnknownError(error, fallback ?? "تعذّر إكمال العملية."));
}
