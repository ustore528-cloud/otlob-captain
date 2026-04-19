import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/ui/text-field";
import { useLogin } from "@/features/auth/hooks/use-login";
import { loginFormSchema } from "@/features/auth/validation/login-schema";
import { homeTheme } from "@/features/home/theme";

export function LoginScreen() {
  const { login, loading, error } = useLogin();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});

  const onSubmit = useCallback(async () => {
    setFieldErrors({});
    const parsed = loginFormSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        identifier: flat.identifier?.[0],
        password: flat.password?.[0],
      });
      return;
    }
    try {
      await login(parsed.data.identifier, parsed.data.password);
      router.replace("/(app)/(tabs)/orders");
    } catch {
      // Error message set inside useLogin
    }
  }, [identifier, password, login]);

  return (
    <Screen title="اطلب كابتن" subtitle="تسجيل دخول الكابتن">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.lead}>
            أدخل رقم الجوال أو البريد الإلكتروني المسجّل لدينا، وكلمة المرور.
          </Text>

          <TextField
            label="رقم الجوال أو البريد"
            value={identifier}
            onChangeText={(t) => {
              setIdentifier(t);
              setFieldErrors((e) => ({ ...e, identifier: undefined }));
            }}
            error={fieldErrors.identifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />

          <TextField
            label="كلمة المرور"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setFieldErrors((e) => ({ ...e, password: undefined }));
            }}
            error={fieldErrors.password}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          {error ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primary, loading && styles.primaryDisabled]}
            onPress={() => {
              void onSubmit();
            }}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={homeTheme.onAccent} />
            ) : (
              <Text style={styles.primaryText}>تسجيل الدخول</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: 32, paddingTop: 8 },
  lead: {
    color: homeTheme.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 20,
  },
  banner: {
    backgroundColor: homeTheme.dangerSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: homeTheme.dangerBorder,
  },
  bannerText: {
    color: homeTheme.dangerText,
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 20,
  },
  primary: {
    marginTop: 8,
    backgroundColor: homeTheme.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryDisabled: { opacity: 0.75 },
  primaryText: { color: homeTheme.onAccent, fontWeight: "800", fontSize: 16 },
});
