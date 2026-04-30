import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, type Href } from "expo-router";
import { useMemo, type ReactNode } from "react";
import * as Linking from "expo-linking";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ScreenContainer, SectionCard } from "@/components/ui";
import { ScreenHeader } from "@/components/screen-header";
import { WorkStatusBanner } from "@/features/work-status";
import i18n, { type CaptainLang, isRtlLng, persistCaptainLanguage, SUPPORTED_LANGS } from "@/i18n/i18n";
import {
  captainRadius,
  captainSpacing,
  captainTypography,
  captainUiTheme,
} from "@/theme/captain-ui-theme";

type Row = {
  href?: Href;
  onPress?: () => void;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** صف غير تفاعلي — قريبًا */
  disabled?: boolean;
};

const BODY_BLEED = -captainSpacing.md;

function SettingsSurface({ title, rtl, children }: { title: string; rtl: boolean; children: ReactNode }) {
  return (
    <View style={styles.surface}>
      <Text style={[styles.surfaceTitle, { textAlign: rtl ? "right" : "left" }]}>{title}</Text>
      <SectionCard compact>{children}</SectionCard>
    </View>
  );
}

function SettingsRows({ rows, rtl }: { rows: Row[]; rtl: boolean }) {
  const router = useRouter();

  return (
    <View style={[styles.rowsBleed, { marginHorizontal: BODY_BLEED }]}>
      {rows.map((row, i) => {
        const logoutRow = row.icon === "log-out-outline";
        const chevron = (
          <Ionicons
            name={rtl ? "chevron-back" : "chevron-forward"}
            size={20}
            color={captainUiTheme.textSubtle}
            style={row.disabled ? styles.iconDisabled : undefined}
          />
        );
        const textBlock = (
          <View style={[styles.rowText, rtl ? styles.rowTextRtl : styles.rowTextLtr]}>
            <Text
              style={[
                styles.rowLabel,
                { textAlign: rtl ? "right" : "left" },
                row.disabled && styles.rowLabelMuted,
                logoutRow && styles.rowLabelLogout,
              ]}
            >
              {row.label}
            </Text>
            <Text style={[styles.rowHint, { textAlign: rtl ? "right" : "left" }]}>{row.hint}</Text>
          </View>
        );
        const bubble = (
          <View
            style={[
              styles.iconBubble,
              logoutRow ? styles.iconBubbleLogout : null,
              row.disabled && styles.iconBubbleMuted,
            ]}
          >
            <Ionicons
              name={row.icon}
              size={22}
              color={
                row.disabled
                  ? captainUiTheme.textSubtle
                  : logoutRow
                    ? captainUiTheme.danger
                    : captainUiTheme.accent
              }
            />
          </View>
        );
        return (
          <Pressable
            key={row.label}
            disabled={row.disabled || (!row.href && !row.onPress)}
            accessibilityRole={(row.href || row.onPress) && !row.disabled ? "button" : undefined}
            style={({ pressed }) => [
              styles.rowBase,
              { flexDirection: rtl ? "row-reverse" : "row" },
              i < rows.length - 1 && styles.rowDivider,
              pressed && (row.href || row.onPress) && !row.disabled && styles.rowPressed,
              row.disabled && styles.rowDisabled,
              logoutRow && styles.rowLogout,
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
            {rtl ? (
              <>
                {chevron}
                {textBlock}
                {bubble}
              </>
            ) : (
              <>
                {bubble}
                {textBlock}
                {chevron}
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const LANG_CHIPS: { code: CaptainLang; labelKey: "settings.langEn" | "settings.langAr" | "settings.langHe" }[] = [
  { code: "en", labelKey: "settings.langEn" },
  { code: "ar", labelKey: "settings.langAr" },
  { code: "he", labelKey: "settings.langHe" },
];

function LanguagePickerSection({ rtl }: { rtl: boolean }) {
  const { t, i18n: i18nInstance } = useTranslation();
  const raw = (i18nInstance.resolvedLanguage ?? i18nInstance.language).split("-")[0];
  const current: CaptainLang = SUPPORTED_LANGS.includes(raw as CaptainLang) ? (raw as CaptainLang) : "en";

  return (
    <SettingsSurface title={t("settings.language")} rtl={rtl}>
      <View style={[styles.rowsBleed, { marginHorizontal: BODY_BLEED, paddingBottom: captainSpacing.sm }]}>
        <Text style={[styles.langHint, { textAlign: rtl ? "right" : "left" }]}>{t("settings.languageHint")}</Text>
        <View style={[styles.langRow, rtl ? styles.langRowRtl : styles.langRowLtr]}>
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
                  rtl ? styles.langChipRtl : styles.langChipLtr,
                  active && styles.langChipActive,
                  pressed && styles.langChipPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(labelKey)}
              >
                <Text style={[styles.langChipText, active && styles.langChipTextActive]} numberOfLines={1}>
                  {t(labelKey)}
                </Text>
                {active ? <View style={styles.langChipDot} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </SettingsSurface>
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
    <ScreenContainer edges={["top", "left", "right"]} contentStyle={styles.screenInner}>
      <WorkStatusBanner />
      <ScreenHeader title={t("settings.title")} />
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sub, { textAlign: rtl ? "right" : "left" }]}>{t("settings.hubSub")}</Text>

        <LanguagePickerSection rtl={rtl} />
        <SettingsSurface title={t("settings.hubSectionAccount")} rtl={rtl}>
          <SettingsRows rows={accountRows} rtl={rtl} />
        </SettingsSurface>
        <SettingsSurface title={t("settings.hubSectionTools")} rtl={rtl}>
          <SettingsRows rows={toolsRows} rtl={rtl} />
        </SettingsSurface>
        <SettingsSurface title={t("settings.hubSectionApp")} rtl={rtl}>
          <SettingsRows rows={appRows} rtl={rtl} />
        </SettingsSurface>
        <SettingsSurface title={t("settings.hubSectionExtra")} rtl={rtl}>
          <SettingsRows rows={extraRows} rtl={rtl} />
        </SettingsSurface>

        <View style={styles.scrollPadBottom} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenInner: { flex: 1 },
  scrollFlex: { flex: 1 },
  scroll: {
    paddingHorizontal: captainSpacing.screenHorizontal,
    paddingBottom: captainSpacing.xxxl,
    paddingTop: captainSpacing.sm,
  },
  scrollPadBottom: { height: captainSpacing.lg },
  sub: {
    ...captainTypography.body,
    color: captainUiTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: captainSpacing.lg,
  },
  surface: { marginBottom: captainSpacing.lg },
  surfaceTitle: {
    ...captainTypography.caption,
    color: captainUiTheme.textMuted,
    marginBottom: captainSpacing.sm,
  },
  langHint: {
    ...captainTypography.body,
    color: captainUiTheme.textSubtle,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: captainSpacing.md,
    paddingTop: captainSpacing.md,
    paddingBottom: captainSpacing.sm,
  },
  langRow: {
    flexWrap: "wrap",
    gap: captainSpacing.sm,
    paddingHorizontal: captainSpacing.md,
    paddingBottom: captainSpacing.sm,
    paddingTop: 2,
    alignItems: "center",
  },
  langRowRtl: {
    flexDirection: "row-reverse",
    justifyContent: "flex-end",
  },
  langRowLtr: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  langChip: {
    alignItems: "center",
    gap: captainSpacing.xs,
    paddingVertical: captainSpacing.sm,
    paddingHorizontal: captainSpacing.md,
    borderRadius: captainRadius.pill,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    backgroundColor: captainUiTheme.neutralSoft,
  },
  langChipLtr: {
    flexDirection: "row",
  },
  langChipRtl: {
    flexDirection: "row-reverse",
  },
  langChipActive: {
    borderColor: captainUiTheme.borderStrong,
    backgroundColor: captainUiTheme.accentSoft,
    borderWidth: 1.5,
  },
  langChipPressed: { opacity: 0.94 },
  langChipText: {
    ...captainTypography.bodyStrong,
    fontSize: 14,
    color: captainUiTheme.text,
  },
  langChipTextActive: {
    color: captainUiTheme.accent,
  },
  langChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: captainUiTheme.accent,
  },
  rowsBleed: {},
  rowBase: {
    alignItems: "center",
    paddingVertical: captainSpacing.md + 2,
    paddingHorizontal: captainSpacing.md,
    gap: captainSpacing.md,
    minHeight: 56,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: captainUiTheme.border,
  },
  rowPressed: { opacity: 0.92 },
  rowDisabled: { opacity: 0.75 },
  rowLogout: {
    backgroundColor: captainUiTheme.dangerSoft,
  },
  rowText: { flex: 1 },
  rowTextRtl: { alignItems: "flex-end" },
  rowTextLtr: { alignItems: "flex-start" },
  rowLabel: {
    ...captainTypography.cardTitle,
    fontSize: 16,
    color: captainUiTheme.text,
  },
  rowLabelMuted: {
    color: captainUiTheme.textMuted,
  },
  rowLabelLogout: {
    color: captainUiTheme.dangerText,
  },
  rowHint: {
    ...captainTypography.caption,
    fontWeight: "500",
    color: captainUiTheme.textSubtle,
    fontSize: 12,
    marginTop: captainSpacing.xs / 2,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: captainRadius.sm + 4,
    backgroundColor: captainUiTheme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubbleMuted: {
    backgroundColor: captainUiTheme.neutralSoft,
  },
  iconBubbleLogout: {
    backgroundColor: captainUiTheme.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.dangerBorder,
  },
  iconDisabled: { opacity: 0.7 },
});
