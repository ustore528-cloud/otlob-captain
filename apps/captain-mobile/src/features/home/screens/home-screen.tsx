import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useCaptainMe } from "@/hooks/api/use-captain-me";
import { useNotificationsList } from "@/hooks/api/use-notifications";
import { useAuth } from "@/hooks/use-auth";
import { useInnerToolBack } from "@/hooks/use-inner-tool-back";
import { AvailabilityControl, useUpdateAvailability } from "@/features/availability";
import type { CaptainAvailabilityStatus } from "@/services/api/dto";
import { CaptainSummaryCard } from "../components/captain-summary-card";
import { LastNotificationCard } from "../components/last-notification-card";
import { PrepaidBalanceCard } from "../components/prepaid-balance-card";
import { parseAvailabilityStatus } from "../labels";
import { ScreenHeader } from "@/components/screen-header";
import { WorkStatusBanner } from "@/features/work-status";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { ScreenContainer, SectionCard } from "@/components/ui";
import { alertMutationError } from "@/lib/alert-mutation-error";
import { captainSpacing, captainUiTheme } from "@/theme/captain-ui-theme";

export function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const goBack = useInnerToolBack();
  const { isAuthenticated } = useAuth();

  const meQuery = useCaptainMe({
    enabled: isAuthenticated,
    staleTime: 20_000,
  });

  const notifQuery = useNotificationsList(
    { page: 1, pageSize: 1 },
    { enabled: isAuthenticated, staleTime: 30_000 },
  );

  const updateAv = useUpdateAvailability();

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      void meQuery.refetch();
      void notifQuery.refetch();
    }, [isAuthenticated, meQuery, notifQuery]),
  );

  const latestNotif = notifQuery.data?.items?.[0];

  const currentAvailability: CaptainAvailabilityStatus = useMemo(() => {
    const raw = meQuery.data?.captain.availabilityStatus;
    return parseAvailabilityStatus(raw ?? "") ?? "OFFLINE";
  }, [meQuery.data?.captain.availabilityStatus]);

  const onAvailability = useCallback(
    (next: CaptainAvailabilityStatus) => {
      updateAv.mutate(next, {
        onError: (e) => alertMutationError(t("profile.updateErrorTitle"), e, t("profile.updateErrorHint")),
      });
    },
    [updateAv, t],
  );

  const refreshing = meQuery.isFetching && !meQuery.isLoading;

  const greetingName = meQuery.data?.user.fullName?.trim();

  return (
    <ScreenContainer edges={["top", "left", "right"]} contentStyle={{ flex: 1 }}>
      <WorkStatusBanner />
      <ScreenHeader title={t("home.title")} onBack={goBack} />
      <View style={styles.accentBar} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void meQuery.refetch();
              void notifQuery.refetch();
            }}
            tintColor={captainUiTheme.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greet}>
            {greetingName ? t("home.greetNamed", { name: greetingName }) : t("home.greet")}
          </Text>
          <Text style={styles.sub}>{t("home.sub")}</Text>
        </View>

        {meQuery.isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={captainUiTheme.accent} />
            <Text style={styles.loaderText}>{t("home.loadingMe")}</Text>
          </View>
        ) : meQuery.isError ? (
          <QueryErrorState
            title={t("home.loadProfileErrorTitle")}
            error={meQuery.error}
            onRetry={() => void meQuery.refetch()}
            style={{ marginHorizontal: 0 }}
          />
        ) : meQuery.data ? (
          <>
            <CaptainSummaryCard
              user={meQuery.data.user}
              captain={meQuery.data.captain}
              prepaidBalance={meQuery.data.captain.prepaidBalance ?? null}
            />

            <View style={styles.sectionGap} />

            <PrepaidBalanceCard balance={meQuery.data.captain.prepaidBalance} />

            <View style={styles.sectionGap} />

            <SectionCard
              title={t("home.workStatusSection")}
              subtitle={t("availability.controlSubtitle")}
              icon="radio-outline"
              compact
            >
              <AvailabilityControl
                embedded
                value={currentAvailability}
                pending={updateAv.isPending}
                onChange={onAvailability}
              />
            </SectionCard>

            <View style={styles.sectionGap} />

            <LastNotificationCard
              loading={notifQuery.isLoading}
              empty={!notifQuery.data?.items?.length}
              title={latestNotif?.title}
              body={latestNotif?.body}
              createdAt={latestNotif?.createdAt}
              onOpenNotifications={() => router.push("/(app)/(tabs)/notifications")}
            />

            <View style={styles.hintBox}>
              <Text style={styles.hintText}>{t("home.hintFooter")}</Text>
            </View>
          </>
        ) : null}

        <View style={{ height: captainSpacing.screenBottom }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  accentBar: {
    height: 3,
    marginHorizontal: captainSpacing.screenHorizontal,
    borderRadius: 3,
    backgroundColor: captainUiTheme.accent,
    opacity: 0.28,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: captainSpacing.screenHorizontal, paddingTop: captainSpacing.md },
  header: { marginBottom: captainSpacing.xl },
  greet: {
    color: captainUiTheme.textMuted,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: captainSpacing.xs,
  },
  sub: {
    color: captainUiTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    marginTop: captainSpacing.sm - 2,
  },
  sectionGap: { height: captainSpacing.lg },
  loader: {
    paddingVertical: 48,
    alignItems: "center",
    gap: captainSpacing.md,
  },
  loaderText: { color: captainUiTheme.textMuted, fontSize: 14 },
  hintBox: {
    marginTop: captainSpacing.sm,
    padding: captainSpacing.md - 2,
    borderRadius: captainUiTheme.radiusMd,
    backgroundColor: captainUiTheme.neutralSoft,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
  },
  hintText: {
    color: captainUiTheme.textSubtle,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "right",
  },
});
