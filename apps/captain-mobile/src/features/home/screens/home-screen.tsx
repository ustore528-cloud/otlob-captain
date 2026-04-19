import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCaptainMe } from "@/hooks/api/use-captain-me";
import { useNotificationsList } from "@/hooks/api/use-notifications";
import { useAuth } from "@/hooks/use-auth";
import { AvailabilityControl, useUpdateAvailability } from "@/features/availability";
import type { CaptainAvailabilityStatus } from "@/services/api/dto";
import { CaptainSummaryCard } from "../components/captain-summary-card";
import { LastNotificationCard } from "../components/last-notification-card";
import { parseAvailabilityStatus } from "../labels";
import { ScreenHeader } from "@/components/screen-header";
import { WorkStatusBanner } from "@/features/work-status";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { useInnerToolBack } from "@/hooks/use-inner-tool-back";
import { alertMutationError } from "@/lib/alert-mutation-error";
import { screenStyles } from "@/theme/screen-styles";
import { homeTheme } from "../theme";

export function HomeScreen() {
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
        onError: (e) => alertMutationError("تعذّر التحديث", e, "حاول مرة أخرى."),
      });
    },
    [updateAv],
  );

  const refreshing = meQuery.isFetching && !meQuery.isLoading;

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <ScreenHeader title="لوحة الكابتن" onBack={goBack} />
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
            tintColor={homeTheme.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greet}>مرحبًا</Text>
          <Text style={styles.sub}>نظرة سريعة على حالتك — التنفيذ من «الطلبات المتاحة»</Text>
        </View>

        {meQuery.isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={homeTheme.accent} />
            <Text style={styles.loaderText}>جاري تحميل بياناتك…</Text>
          </View>
        ) : meQuery.isError ? (
          <QueryErrorState
            title="تعذّر تحميل الملف"
            error={meQuery.error}
            onRetry={() => void meQuery.refetch()}
            style={{ marginHorizontal: 0 }}
          />
        ) : meQuery.data ? (
          <>
            <CaptainSummaryCard user={meQuery.data.user} captain={meQuery.data.captain} />

            <View style={styles.sectionGap} />

            <AvailabilityControl
              value={currentAvailability}
              pending={updateAv.isPending}
              onChange={onAvailability}
            />

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
              <Text style={styles.hintText}>
                لتنفيذ الطلبات والعروض استخدم «الطلبات المتاحة». للإعدادات والأرباح والتتبع: «الإعدادات».
              </Text>
            </View>
          </>
        ) : null}

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  accentBar: {
    height: 3,
    marginHorizontal: 20,
    borderRadius: 3,
    backgroundColor: homeTheme.accent,
    opacity: 0.35,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  header: { marginBottom: 20 },
  greet: {
    color: homeTheme.textMuted,
    fontSize: 14,
    textAlign: "right",
    marginBottom: 4,
  },
  sub: {
    color: homeTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    marginTop: 6,
  },
  sectionGap: { height: 16 },
  loader: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 12,
  },
  loaderText: { color: homeTheme.textMuted, fontSize: 14 },
  hintBox: {
    marginTop: 8,
    padding: 14,
    borderRadius: homeTheme.radiusMd,
    backgroundColor: homeTheme.neutralSoft,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  hintText: {
    color: homeTheme.textSubtle,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "right",
  },
});
