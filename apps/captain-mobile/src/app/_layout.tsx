import { I18nextProvider, useTranslation } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { I18nManager, View, type StyleProp, type ViewStyle } from "react-native";
import { homeTheme } from "@/features/home/theme";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/features/auth/auth-provider";
import { queryClient } from "@/lib/query-client";
import i18n, { isRtlLng } from "@/i18n/i18n";

I18nManager.allowRTL(true);

function DirectionShell({ children }: { children: React.ReactNode }) {
  const { i18n: i18nInstance } = useTranslation();
  const rtl = isRtlLng(i18nInstance.resolvedLanguage ?? i18nInstance.language);
  const shellStyle: StyleProp<ViewStyle> = {
    flex: 1,
    flexDirection: "column",
    direction: rtl ? "rtl" : "ltr",
    backgroundColor: homeTheme.pageBackground,
  };
  return <View style={shellStyle}>{children}</View>;
}

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <DirectionShell>
              <Stack screenOptions={{ headerShown: false }} />
            </DirectionShell>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </I18nextProvider>
  );
}
