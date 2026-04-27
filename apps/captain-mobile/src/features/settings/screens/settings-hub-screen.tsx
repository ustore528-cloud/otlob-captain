import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, type Href } from "expo-router";
import { useMemo } from "react";
import * as Linking from "expo-linking";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ScreenHeader } from "@/components/screen-header";
import { WorkStatusBanner } from "@/features/work-status";
import { homeTheme } from "@/features/home/theme";
import { screenStyles } from "@/theme/screen-styles";
import i18n, { type CaptainLang, isRtlLng, persistCaptainLanguage, SUPPORTED_LANGS } from "@/i18n/i18n";

type Row = {
  href?: Href;
  onPress?: () => void;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** صف غير تفاعلي — قريبًا */
  disabled?: boolean;
};

function SettingsSection({ title, rows }: { title: string; rows: Row[] }) {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {rows.map((row, i) => (
          <Pressable
            key={row.label}
            disabled={row.disabled || (!row.href && !row.onPress)}
            style={({ pressed }) => [
              styles.row,
              i < rows.length - 1 && styles.rowBorder,
              pressed && (row.href || row.onPress) && !row.disabled && styles.rowPressed,
              row.disabled && styles.rowDisabled,
            ]}
            onPress={() => {
              if (row.disabled) return;
              if (row.href) {
                router.push(row.href);
                return;
              }
              row.onPress?.();
            }}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={row.disabled ? homeTheme.textSubtle : homeTheme.textSubtle}
            />
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, row.disabled && styles.rowLabelMuted]}>{row.label}</Text>
              <Text style={styles.rowHint}>{row.hint}</Text>
            </View>
            <View style={[styles.iconBubble, row.disabled && styles.iconBubbleMuted]}>
              <Ionicons name={row.icon} size={22} color={row.disabled ? homeTheme.textSubtle : homeTheme.accent} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const LANG_CHIPS: { code: CaptainLang; labelKey: "settings.langEn" | "settings.langAr" | "settings.langHe" }[] = [
  { code: "en", labelKey: "settings.langEn" },
  { code: "ar", labelKey: "settings.langAr" },
  { code: "he", labelKey: "settings.langHe" },
];

function LanguagePickerSection() {
  const { t, i18n: i18nInstance } = useTranslation();
  const raw = (i18nInstance.resolvedLanguage ?? i18nInstance.language).split("-")[0];
  const current: CaptainLang = SUPPORTED_LANGS.includes(raw as CaptainLang) ? (raw as CaptainLang) : "en";
  const rtl = isRtlLng(i18nInstance.resolvedLanguage ?? i18nInstance.language);

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { textAlign: rtl ? "right" : "left" }]}>{t("settings.language")}</Text>
      <View style={styles.card}>
        <Text style={[styles.langHint, { textAlign: rtl ? "right" : "left" }]}>{t("settings.languageHint")}</Text>
        <View style={[styles.langRow, !rtl && styles.langRowLtr]}>
          {LANG_CHIPS.map(({ code, labelKey }) => {
            const active = current === code;
            return (
              <Pressable
                key={code}
                onPress={() => {
                  void (async () => {
                    await i18n.changeLanguage(code);
                    await persistCaptainLanguage(code);
                  })();
                }}
                style={({ pressed }) => [
                  styles.langChip,
                  active && styles.langChipActive,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(labelKey)}
              >
                <Text style={[styles.langChipText, active && styles.langChipTextActive]} numberOfLines={1}>
                  {t(labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function SettingsHubScreen() {
  const { t, i18n: i18nInstance } = useTranslation();
  const rtl = isRtlLng(i18nInstance.resolvedLanguage ?? i18nInstance.language);

  const accountRows = useMemo((): Row[] => {
    const profile = "/(app)/(tabs)/profile" as Href;
    return [
      {
        href: profile,
        label: t("settings.hubProfileLabel"),
        hint: t("settings.hubProfileHint"),
        icon: "person-outline",
      },
      {
        href: profile,
        label: t("settings.hubAvailabilityLabel"),
        hint: t("settings.hubAvailabilityHint"),
        icon: "radio-button-on-outline",
      },
      {
        href: profile,
        label: t("settings.hubSignOutLabel"),
        hint: t("settings.hubSignOutHint"),
        icon: "log-out-outline",
      },
    ];
  }, [t]);

  const toolsRows = useMemo((): Row[] => {
    return [
      {
        href: "/(app)/(tabs)/earnings" as Href,
        label: t("settings.hubEarningsLabel"),
        hint: t("settings.hubEarningsHint"),
        icon: "wallet-outline",
      },
      {
        href: "/(app)/(tabs)/tracking" as Href,
        label: t("settings.hubTrackingLabel"),
        hint: t("settings.hubTrackingHint"),
        icon: "navigate-outline",
      },
    ];
  }, [t]);

  const appRows = useMemo((): Row[] => {
    return [
      {
        onPress: () => {
          void Linking.openSettings();
        },
        label: t("settings.hubAppNotifLabel"),
        hint: t("settings.hubAppNotifHint"),
        icon: "notifications-outline",
      },
    ];
  }, [t]);

  const extraRows = useMemo((): Row[] => {
    return [
      {
        href: "/(app)/(tabs)/home" as Href,
        label: t("settings.hubQuickHomeLabel"),
        hint: t("settings.hubQuickHomeHint"),
        icon: "home-outline",
      },
    ];
  }, [t]);

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <ScreenHeader title={t("settings.title")} />
      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sub, { textAlign: rtl ? "right" : "left" }]}>{t("settings.hubSub")}</Text>

        <LanguagePickerSection />
        <SettingsSection title={t("settings.hubSectionAccount")} rows={accountRows} />
        <SettingsSection title={t("settings.hubSectionTools")} rows={toolsRows} />
        <SettingsSection title={t("settings.hubSectionApp")} rows={appRows} />
        <SettingsSection title={t("settings.hubSectionExtra")} rows={extraRows} />

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollFlex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  sub: {
    color: homeTheme.textSubtle,
    fontSize: 14,
    textAlign: "right",
    marginBottom: 20,
    lineHeight: 22,
  },
  langHint: {
    color: homeTheme.textSubtle,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  langRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  langRowLtr: {
    flexDirection: "row",
  },
  langChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.neutralSoft,
  },
  langChipActive: {
    borderColor: homeTheme.accent,
    backgroundColor: homeTheme.accentSoft,
  },
  langChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: homeTheme.text,
  },
  langChipTextActive: {
    color: homeTheme.accent,
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    color: homeTheme.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 8,
  },
  card: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    borderWidth: 1,
    borderColor: homeTheme.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  rowPressed: { opacity: 0.92 },
  rowDisabled: { opacity: 0.75 },
  rowText: { flex: 1, alignItems: "flex-end" },
  rowLabel: {
    color: homeTheme.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
  rowLabelMuted: {
    color: homeTheme.textMuted,
  },
  rowHint: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    textAlign: "right",
    marginTop: 2,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: homeTheme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubbleMuted: {
    backgroundColor: homeTheme.neutralSoft,
  },
});
