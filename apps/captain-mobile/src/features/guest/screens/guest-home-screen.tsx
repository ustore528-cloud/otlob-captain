import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenHeader } from "@/components/screen-header";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { ScreenContainer } from "@/components/ui/screen-container";
import { showGuestLoginRequiredAlert } from "@/features/guest/guest-login-required-alert";
import { isRtlLng } from "@/i18n/i18n";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";

/**
 * Limited demo-only entry for guests — no tokens, no captain APIs, no tracking provider.
 */
export function GuestHomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const rtl = isRtlLng(i18n.resolvedLanguage ?? i18n.language);

  return (
    <ScreenContainer edges={["top", "left", "right"]} contentStyle={styles.flex} padded>
      <ScreenHeader title={t("guestMode.title")} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lead, { textAlign: rtl ? "right" : "left" }]}>{t("guestMode.lead")}</Text>
        <Text style={[styles.body, { textAlign: rtl ? "right" : "left" }]}>{t("guestMode.body")}</Text>
        <View style={styles.cta}>
          <SecondaryButton
            label={t("guestMode.previewProtectedCta")}
            onPress={() => {
              showGuestLoginRequiredAlert({
                t,
                onStayGuest: () => {},
                onSignIn: () => {
                  router.replace("/(auth)/login" as Href);
                },
              });
            }}
          />
          <View style={styles.ctaDivider} />
          <PrimaryButton
            label={t("guestMode.signInCta")}
            onPress={() => {
              router.replace("/(auth)/login" as Href);
            }}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: captainSpacing.xxxl, paddingTop: captainSpacing.md, gap: captainSpacing.md },
  lead: {
    ...captainTypography.body,
    color: captainUiTheme.text,
    fontSize: 16,
    lineHeight: 24,
  },
  body: {
    ...captainTypography.body,
    color: captainUiTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
  },
  cta: { marginTop: captainSpacing.lg, paddingTop: captainSpacing.sm },
  ctaDivider: { height: captainSpacing.md },
});
