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
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/screen-header";
import { WorkStatusBanner } from "@/features/work-status";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { useInnerToolBack } from "@/hooks/use-inner-tool-back";
import { captainSpacing, captainRadius, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";
import { formatOrderAmountAr } from "@/lib/order-currency";
import { useEarningsSummary } from "@/hooks/api/use-earnings-summary";
import { useAuth } from "@/hooks/use-auth";
import type { EarningsSummaryQuery } from "@/services/api/dto";
import { ScreenContainer, SectionCard, MetricCard, EmptyState } from "@/components/ui";

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
      <ScreenContainer edges={["top", "left", "right"]} contentStyle={{ flex: 1 }}>
        <WorkStatusBanner />
        <ScreenHeader title={t("earnings.title")} onBack={goBack} />
        <Text style={[styles.muted, styles.guestPad]}>{t("earnings.guest")}</Text>
      </ScreenContainer>
    );
  }

  if (query.isLoading) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} contentStyle={{ flex: 1 }}>
        <WorkStatusBanner />
        <ScreenHeader title={t("earnings.title")} onBack={goBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={captainUiTheme.accent} />
          <Text style={styles.muted}>{t("earnings.loading")}</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (query.isError) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} contentStyle={{ flex: 1 }}>
        <WorkStatusBanner />
        <ScreenHeader title={t("earnings.title")} onBack={goBack} />
        <View style={styles.heroPad}>
          <Text style={styles.sub}>{t("earnings.subServer")}</Text>
        </View>
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} contentStyle={{ flex: 1 }}>
      <WorkStatusBanner />
      <ScreenHeader title={t("earnings.title")} onBack={goBack} />
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={captainUiTheme.accent}
          />
        }
      >
        <View style={styles.heroPad}>
          <Text style={styles.kicker}>{t("earnings.kicker")}</Text>
          <Text style={styles.sub}>{t(rangeDescriptionI18nKey(preset))}</Text>
        </View>

        <Text style={styles.filterLabel}>{t("earnings.filterPeriod")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
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
          <EmptyState
            icon={
              <View style={styles.emptyIconBubble}>
                <Ionicons name="wallet-outline" size={44} color={captainUiTheme.textSubtle} />
              </View>
            }
            title={t("earnings.emptyTitle")}
            body={t("earnings.emptyBody")}
            style={styles.emptyStatePad}
          />
        ) : (
          <>
            <SectionCard title={t("earnings.sectionPerformance")} icon="analytics-outline" compact style={styles.metricsSection}>
              <MetricCard
                title={t("earnings.totalCollection")}
                value={formatOrderAmountAr(data?.totalCashCollection ?? "0")}
                hint={t("earnings.totalCollectionHint")}
              />
              <View style={styles.statsRow}>
                <MetricCard
                  dense
                  style={styles.statCell}
                  title={t("earnings.statDelivered")}
                  value={String(data?.deliveredCount ?? 0)}
                  accessory={<Ionicons name="layers-outline" size={20} color={captainUiTheme.accent} />}
                />
                <MetricCard
                  dense
                  style={styles.statCell}
                  title={t("earnings.statOrderValue")}
                  value={formatOrderAmountAr(data?.totalAmount ?? "0")}
                  accessory={<Ionicons name="pricetag-outline" size={20} color={captainUiTheme.accent} />}
                />
              </View>
            </SectionCard>

            <SectionCard title={t("earnings.noteSectionTitle")} icon="information-circle-outline" compact style={styles.noteSection}>
              <Text style={styles.noteBody}>{t("earnings.note")}</Text>
            </SectionCard>
          </>
        )}

        <View style={{ height: captainSpacing.xxxl }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollFlex: { flex: 1 },
  scroll: { paddingBottom: captainSpacing.xxl },
  guestPad: {
    paddingHorizontal: captainSpacing.screenHorizontal,
    paddingTop: captainSpacing.md,
  },
  heroPad: { paddingHorizontal: captainSpacing.screenHorizontal, paddingTop: captainSpacing.sm },
  kicker: {
    ...captainTypography.cardTitle,
    color: captainUiTheme.accent,
    textAlign: "right",
    marginBottom: captainSpacing.xs,
  },
  sub: {
    ...captainTypography.body,
    color: captainUiTheme.textSubtle,
    lineHeight: 22,
    textAlign: "right",
    marginTop: captainSpacing.sm,
  },
  filterLabel: {
    color: captainUiTheme.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    marginTop: captainSpacing.xl,
    marginBottom: captainSpacing.sm,
    paddingHorizontal: captainSpacing.screenHorizontal,
  },
  chipsRow: {
    flexDirection: "row-reverse",
    gap: captainSpacing.sm,
    paddingHorizontal: captainSpacing.screenHorizontal,
    paddingBottom: captainSpacing.sm,
  },
  chip: {
    paddingVertical: captainSpacing.sm + 2,
    paddingHorizontal: captainSpacing.md + 4,
    borderRadius: captainRadius.pill,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    backgroundColor: captainUiTheme.surfaceElevated,
  },
  chipActive: {
    borderColor: captainUiTheme.borderStrong,
    backgroundColor: captainUiTheme.accentSoft,
  },
  chipText: { color: captainUiTheme.textMuted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: captainUiTheme.accent, fontWeight: "800" },
  statsRow: {
    flexDirection: "row-reverse",
    gap: captainSpacing.sm + 4,
    marginTop: captainSpacing.md,
    alignItems: "stretch",
  },
  statCell: {
    flex: 1,
    minWidth: 0,
  },
  metricsSection: {
    marginHorizontal: captainSpacing.screenHorizontal,
    marginTop: captainSpacing.sm,
  },
  noteSection: {
    marginHorizontal: captainSpacing.screenHorizontal,
    marginTop: captainSpacing.md,
  },
  noteBody: {
    ...captainTypography.body,
    fontSize: 12,
    lineHeight: 18,
    color: captainUiTheme.textSubtle,
    textAlign: "right",
  },
  emptyStatePad: {
    paddingVertical: captainSpacing.lg,
  },
  emptyIconBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: captainUiTheme.neutralSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: captainSpacing.sm + 6,
    minHeight: 280,
  },
  muted: { color: captainUiTheme.textMuted, fontSize: 14 },
});
