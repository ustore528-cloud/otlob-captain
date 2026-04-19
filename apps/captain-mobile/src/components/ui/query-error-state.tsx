import Ionicons from "@expo/vector-icons/Ionicons";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { homeTheme } from "@/features/home/theme";
import { formatUnknownError } from "@/lib/error-format";

type Props = {
  title?: string;
  error: unknown;
  onRetry?: () => void;
  /** نص بديل إن لم يكن الخطأ Error */
  fallbackMessage?: string;
  /** دمج مع الحاوية — مثلاً `{ marginHorizontal: 0 }` داخل ScrollView بها padding */
  style?: StyleProp<ViewStyle>;
};

/**
 * حالة خطأ موحّدة لاستعلامات React Query — بدون تكرار أنماط في كل شاشة.
 */
export function QueryErrorState({
  title = "تعذّر التحميل",
  error,
  onRetry,
  fallbackMessage = "تحقق من الاتصال ثم أعد المحاولة.",
  style,
}: Props) {
  const message = formatUnknownError(error, fallbackMessage);

  return (
    <View style={[styles.box, style]} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={40} color={homeTheme.dangerText} style={styles.icon} />
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorBody}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.retry} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retryText}>إعادة المحاولة</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: homeTheme.radiusLg,
    backgroundColor: homeTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: homeTheme.dangerBorder,
    gap: 8,
  },
  icon: { alignSelf: "center", marginBottom: 4 },
  errorTitle: {
    color: homeTheme.dangerText,
    fontWeight: "800",
    fontSize: 17,
    textAlign: "center",
  },
  errorBody: {
    color: homeTheme.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  retry: {
    alignSelf: "center",
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: homeTheme.radiusMd,
    backgroundColor: homeTheme.accentSoft,
    borderWidth: 1,
    borderColor: homeTheme.borderStrong,
  },
  retryText: { color: homeTheme.accent, fontWeight: "800", fontSize: 15 },
});
