import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/screen-header";
import { WorkStatusBanner } from "@/features/work-status";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { useInnerToolBack } from "@/hooks/use-inner-tool-back";
import { homeTheme } from "@/features/home/theme";
import { screenStyles } from "@/theme/screen-styles";
import { formatOrderAmountAr } from "@/lib/order-currency";
import { useEarningsSummary } from "@/hooks/api/use-earnings-summary";
import { useAuth } from "@/hooks/use-auth";
import type { EarningsSummaryQuery } from "@/services/api/dto";

type RangePreset = "all" | "7d" | "30d" | "month";

const RANGE_CHIPS: { value: RangePreset; i18nKey: string }[] = [
  { value: "all", i18nKey: "earnings.rangeAll" },
  { value: "7d", i18nKey: "earnings.range7d" },
  { value: "30d", i18nKey: "earnings.range30d" },
  { value: "month", i18nKey: "earnings.rangeMonth" },
];

function rangeDescriptionI18nKey(preset: RangePreset):
  | "earnings.rangeDescAll"
  | "earnings.rangeDesc7d"
  | "earnings.rangeDesc30d"
  | "earnings.rangeDescMonth" {
  switch (preset) {
    case "all":
      return "earnings.rangeDescAll";
    case "7d":
      return "earnings.rangeDesc7d";
    case "30d":
      return "earnings.rangeDesc30d";
    case "month":
      return "earnings.rangeDescMonth";
    default:
      return "earnings.rangeDescAll";
  }
}

function buildQuery(preset: RangePreset): EarningsSummaryQuery | undefined {
  if (preset === "all") return undefined;
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(from.getDate() - 7);
  if (preset === "30d") from.setDate(from.getDate() - 30);
  if (preset === "month") {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setHours(0, 0, 0, 0);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export function EarningsSummaryScreen() {
  const { t } = useTranslation();
  const goBack = useInnerToolBack();
  const { isAuthenticated } = useAuth();
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [refreshing, setRefreshing] = useState(false);

  const queryParams = useMemo(() => buildQuery(preset), [preset]);

  const query = useEarningsSummary(queryParams, {
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const data = query.data;

  const isEmpty = data != null && data.deliveredCount === 0;

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <WorkStatusBanner />
        <ScreenHeader title={t("earnings.title")} onBack={goBack} />
        <Text style={[styles.muted, styles.guestPad]}>{t("earnings.guest")}</Text>
      </SafeAreaView>
    );
  }

  if (query.isLoading) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <ScreenHeader title={t("earnings.title")} onBack={goBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={homeTheme.accent} />
          <Text style={styles.muted}>{t("earnings.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <WorkStatusBanner />
        <ScreenHeader title={t("earnings.title")} onBack={goBack} />
        <View style={styles.heroPad}>
          <Text style={styles.sub}>{t("earnings.subServer")}</Text>
        </View>
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <ScreenHeader title={t("earnings.title")} onBack={goBack} />
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={homeTheme.accent} />
        }
      >
        <View style={styles.heroPad}>
          <Text style={styles.kicker}>{t("earnings.kicker")}</Text>
          <Text style={styles.sub}>{t(rangeDescriptionI18nKey(preset))}</Text>
        </View>

        <Text style={styles.filterLabel}>{t("earnings.filterPeriod")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {RANGE_CHIPS.map((c) => {
            const active = preset === c.value;
            return (
              <Pressable
                key={c.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setPreset(c.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(c.i18nKey)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isEmpty ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="wallet-outline" size={44} color={homeTheme.textSubtle} />
            </View>
            <Text style={styles.emptyTitle}>{t("earnings.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("earnings.emptyBody")}</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>{t("earnings.totalCollection")}</Text>
              <Text style={styles.heroValue}>{formatOrderAmountAr(data?.totalCashCollection ?? "0")}</Text>
              <Text style={styles.heroHint}>{t("earnings.totalCollectionHint")}</Text>
            </View>

            <View style={styles.grid}>
              <View style={styles.statCard}>
                <Ionicons name="layers-outline" size={22} color={homeTheme.accent} />
                <Text style={styles.statLabel}>{t("earnings.statDelivered")}</Text>
                <Text style={styles.statValue}>{data?.deliveredCount ?? 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="pricetag-outline" size={22} color={homeTheme.accent} />
                <Text style={styles.statLabel}>{t("earnings.statOrderValue")}</Text>
                <Text style={styles.statValueSmall}>{formatOrderAmountAr(data?.totalAmount ?? "0")}</Text>
              </View>
            </View>

            <View style={styles.noteCard}>
              <Ionicons name="information-circle-outline" size={20} color={homeTheme.textMuted} />
              <Text style={styles.noteText}>{t("earnings.note")}</Text>
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollFlex: { flex: 1 },
  scroll: { paddingBottom: 24 },
  guestPad: { paddingHorizontal: 20, paddingTop: 12 },
  heroPad: { paddingHorizontal: 20, paddingTop: 8 },
  kicker: {
    color: homeTheme.accent,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  sub: {
    color: homeTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    marginTop: 8,
  },
  filterLabel: {
    color: homeTheme.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  chipsRow: {
    flexDirection: "row-reverse",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.surfaceElevated,
  },
  chipActive: {
    borderColor: homeTheme.borderStrong,
    backgroundColor: homeTheme.accentSoft,
  },
  chipText: { color: homeTheme.textMuted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: homeTheme.accent, fontWeight: "800" },
  heroCard: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 24,
    borderRadius: homeTheme.radiusLg,
    backgroundColor: homeTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: homeTheme.borderStrong,
    alignItems: "flex-end",
  },
  heroLabel: { color: homeTheme.textMuted, fontSize: 14, fontWeight: "600" },
  heroValue: {
    color: homeTheme.text,
    fontSize: 40,
    fontWeight: "900",
    marginTop: 8,
    letterSpacing: -1,
  },
  heroHint: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
    marginTop: 14,
  },
  grid: {
    flexDirection: "row-reverse",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: homeTheme.border,
    alignItems: "flex-end",
    gap: 8,
  },
  statLabel: { color: homeTheme.textMuted, fontSize: 12, fontWeight: "600", textAlign: "right" },
  statValue: { color: homeTheme.text, fontSize: 26, fontWeight: "900", textAlign: "right" },
  statValueSmall: { color: homeTheme.text, fontSize: 17, fontWeight: "800", textAlign: "right" },
  noteCard: {
    flexDirection: "row-reverse",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: homeTheme.radiusMd,
    backgroundColor: homeTheme.neutralSoft,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  noteText: {
    flex: 1,
    color: homeTheme.textSubtle,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, minHeight: 280 },
  muted: { color: homeTheme.textMuted, fontSize: 14 },
  emptyCard: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 28,
    borderRadius: homeTheme.radiusLg,
    backgroundColor: homeTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: homeTheme.border,
    alignItems: "center",
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: homeTheme.neutralSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { color: homeTheme.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyBody: {
    color: homeTheme.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
});
