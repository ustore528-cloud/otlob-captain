import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { formatNotificationSectionDateLabel, formatNotificationTime } from "@/features/home/utils/format";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { EmptyState, ScreenContainer, SecondaryButton } from "@/components/ui";
import { WorkStatusBanner } from "@/features/work-status";
import { useNotificationsList } from "@/hooks/api/use-notifications";
import { routes } from "@/navigation/routes";
import type { NotificationItemDto } from "@/services/api/dto";
import { captainService } from "@/services/api/services/captain.service";
import { env } from "@/utils/env";
import { resolveCaptainPushLanguage } from "@/i18n/i18n";
import { captainRadius, captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";

const ANDROID_CHANNEL_ID = "captain-orders-v9-strong";
const ORDER_NOTIFICATION_SOUND = "new_order_strong_alert";
const NOTIFICATION_VIBRATION_PATTERN = [0, 280, 120, 280, 120, 360] as const;

function resolveProjectId(): string | null {
  const fromEas = (Constants.easConfig as { projectId?: string } | null)?.projectId;
  if (fromEas) return fromEas;
  const fromExpoExtra = (
    Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null
  )?.extra?.eas?.projectId;
  return fromExpoExtra ?? null;
}

type Section = { title: string; data: NotificationItemDto[] };

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function bucketLabel(iso: string, now: Date, tr: TFunction): string {
  const d = new Date(iso);
  const t0 = startOfDay(now).getTime();
  const tDay = startOfDay(d).getTime();
  const dayMs = 86400000;
  if (tDay === t0) return tr("notifications.today");
  if (tDay === t0 - dayMs) return tr("notifications.yesterday");
  return formatNotificationSectionDateLabel(iso);
}

function buildSections(items: NotificationItemDto[], now: Date, tr: TFunction): Section[] {
  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const map = new Map<string, NotificationItemDto[]>();
  for (const it of sorted) {
    const label = bucketLabel(it.createdAt, now, tr);
    const prev = map.get(label) ?? [];
    prev.push(it);
    map.set(label, prev);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

export function NotificationsListScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const query = useNotificationsList({ page: 1, pageSize: 50 });
  const [refreshing, setRefreshing] = useState(false);
  const [retryingPush, setRetryingPush] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const openItem = (item: NotificationItemDto) => {
    if (item.orderId) {
      router.push(routes.app.order(item.orderId));
    }
  };

  const retryPushRegistration = useCallback(async () => {
    if (retryingPush) return;
    setRetryingPush(true);
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
          name: t("push.androidChannelName"),
          importance: Notifications.AndroidImportance.MAX,
          sound: ORDER_NOTIFICATION_SOUND,
          vibrationPattern: [...NOTIFICATION_VIBRATION_PATTERN],
          enableVibrate: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }
      const currentPerm = await Notifications.getPermissionsAsync();
      const finalPerm =
        currentPerm.status === "granted" ? currentPerm : await Notifications.requestPermissionsAsync();
      if (finalPerm.status !== "granted") {
        Alert.alert(t("notifications.retryPushDeniedTitle"), t("notifications.retryPushDeniedBody"));
        return;
      }
      const projectId = resolveProjectId();
      if (!projectId) {
        Alert.alert(t("notifications.retryPushNoProjectTitle"), t("notifications.retryPushNoProjectBody"));
        return;
      }
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      const language = await resolveCaptainPushLanguage(i18n.resolvedLanguage ?? i18n.language);
      const result = await captainService.registerPushToken({
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: Constants.expoConfig?.version,
        language,
      });
      Alert.alert(
        result.registered ? t("notifications.retryPushOkTitle") : t("notifications.retryPushFailTitle"),
        result.registered
          ? `${t("notifications.retryPushOkBody")}\n${t("notifications.apiLine", { url: env.apiUrl })}`
          : `${t("notifications.retryPushRejectedBody")}\n${t("notifications.apiLine", { url: env.apiUrl })}`,
      );
    } catch (error) {
      Alert.alert(
        t("notifications.retryPushErrorTitle"),
        t("notifications.retryPushErrorBody", {
          message: error instanceof Error ? error.message : t("errors.unexpected"),
        }),
      );
    } finally {
      setRetryingPush(false);
    }
  }, [i18n.language, i18n.resolvedLanguage, retryingPush, t]);

  const sections = useMemo(() => {
    const items = query.data?.items ?? [];
    return buildSections(items, new Date(), t);
  }, [query.data?.items, t]);

  const renderItem = ({ item }: { item: NotificationItemDto }) => {
    const tappable = Boolean(item.orderId);
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && tappable && styles.cardPressed]}
        onPress={() => (tappable ? openItem(item) : undefined)}
        disabled={!tappable}
        accessibilityRole={tappable ? "button" : "text"}
      >
        <View style={styles.cardTop}>
          <View style={styles.metaRow}>
            {!item.isRead ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{t("notifications.new")}</Text>
              </View>
            ) : (
              <View style={styles.readBadge}>
                <Text style={styles.readBadgeText}>{t("notifications.read")}</Text>
              </View>
            )}
            {item.orderId ? (
              <View style={styles.orderBadge}>
                <Ionicons name="receipt-outline" size={14} color={captainUiTheme.accent} />
                <Text style={styles.orderBadgeText}>{t("notifications.orderLinked")}</Text>
              </View>
            ) : (
              <View style={styles.infoBadge}>
                <Text style={styles.infoBadgeText}>{t("notifications.notLinked")}</Text>
              </View>
            )}
          </View>
          <Text style={styles.time}>{formatNotificationTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardBody}>{item.body}</Text>
        {tappable ? (
          <Text style={styles.hint}>{t("notifications.hintTappable")}</Text>
        ) : (
          <Text style={styles.mutedHint}>{t("notifications.hintGeneral")}</Text>
        )}
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  if (query.isLoading) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} contentStyle={{ flex: 1 }}>
        <WorkStatusBanner />
        <View style={styles.screenHead}>
          <Text style={styles.title}>{t("notifications.title")}</Text>
          <Text style={styles.sub}>{t("notifications.subLoading")}</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={captainUiTheme.accent} />
          <Text style={styles.muted}>{t("common.loading")}</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (query.isError) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} contentStyle={{ flex: 1 }}>
        <WorkStatusBanner />
        <View style={styles.screenHead}>
          <Text style={styles.title}>{t("notifications.title")}</Text>
          <Text style={styles.sub}>{t("notifications.sub")}</Text>
        </View>
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} contentStyle={{ flex: 1 }}>
      <WorkStatusBanner />
      <View style={styles.screenHead}>
        <Text style={styles.title}>{t("notifications.title")}</Text>
        <Text style={styles.sub}>{t("notifications.sub")}</Text>
        <SecondaryButton
          compact
          label={retryingPush ? t("notifications.retryPushProgress") : t("notifications.retryPushCta")}
          onPress={() => void retryPushRegistration()}
          disabled={retryingPush}
          icon="notifications-outline"
          style={styles.retrySecondary}
        />
        <Text style={styles.apiHint}>{t("notifications.apiLine", { url: env.apiUrl })}</Text>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={captainUiTheme.accent}
            colors={[captainUiTheme.accent]}
            progressBackgroundColor={captainUiTheme.surfaceElevated}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={
              <View style={styles.emptyIconBubble}>
                <Ionicons name="notifications-off-outline" size={44} color={captainUiTheme.textSubtle} />
              </View>
            }
            title={t("notifications.empty")}
            minHeight={220}
          />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenHead: {
    paddingHorizontal: captainSpacing.screenHorizontal,
    paddingTop: captainSpacing.sm,
    marginBottom: captainSpacing.sm,
  },
  title: {
    ...captainTypography.screenTitle,
    color: captainUiTheme.text,
    textAlign: "right",
    fontSize: 22,
    lineHeight: 30,
  },
  sub: {
    ...captainTypography.body,
    color: captainUiTheme.textSubtle,
    fontSize: 13,
    textAlign: "right",
    marginTop: captainSpacing.sm - 2,
    lineHeight: 20,
  },
  retrySecondary: {
    alignSelf: "flex-end",
    marginTop: captainSpacing.sm + 2,
  },
  apiHint: {
    marginTop: captainSpacing.sm - 2,
    color: captainUiTheme.textMuted,
    fontSize: 11,
    textAlign: "right",
  },
  sectionHeader: {
    paddingHorizontal: captainSpacing.xs,
    paddingVertical: captainSpacing.sm + 2,
    backgroundColor: captainUiTheme.bgSubtle,
    borderRadius: captainRadius.sm,
    marginBottom: captainSpacing.sm,
  },
  sectionTitle: {
    color: captainUiTheme.textMuted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  list: {
    paddingHorizontal: captainSpacing.screenHorizontal,
    paddingBottom: captainSpacing.screenBottom + 8,
    flexGrow: 1,
    gap: 0,
  },
  card: {
    backgroundColor: captainUiTheme.surfaceElevated,
    borderRadius: captainUiTheme.radiusLg,
    padding: captainSpacing.md,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    marginBottom: captainSpacing.sm + 4,
    ...captainUiTheme.cardShadow,
  },
  cardPressed: { opacity: 0.92 },
  cardTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: captainSpacing.sm + 2,
    gap: captainSpacing.sm,
  },
  metaRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: captainSpacing.sm,
    flex: 1,
    justifyContent: "flex-end",
  },
  time: { color: captainUiTheme.textMuted, fontSize: 12, textAlign: "right" },
  unreadBadge: {
    paddingHorizontal: captainSpacing.sm,
    paddingVertical: captainSpacing.xs,
    borderRadius: captainRadius.sm,
    backgroundColor: captainUiTheme.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.borderStrong,
  },
  unreadBadgeText: {
    color: captainUiTheme.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  readBadge: {
    paddingHorizontal: captainSpacing.sm,
    paddingVertical: captainSpacing.xs,
    borderRadius: captainRadius.sm,
    backgroundColor: captainUiTheme.neutralSoft,
  },
  readBadgeText: {
    color: captainUiTheme.textSubtle,
    fontSize: 11,
    fontWeight: "600",
  },
  orderBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: captainSpacing.xs,
    paddingHorizontal: captainSpacing.sm,
    paddingVertical: captainSpacing.xs,
    borderRadius: captainRadius.sm,
    backgroundColor: captainUiTheme.goldSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.goldMuted,
  },
  orderBadgeText: {
    color: captainUiTheme.gold,
    fontSize: 11,
    fontWeight: "800",
  },
  infoBadge: {
    paddingHorizontal: captainSpacing.sm,
    paddingVertical: captainSpacing.xs,
    borderRadius: captainRadius.sm,
    backgroundColor: captainUiTheme.neutralSoft,
  },
  infoBadgeText: {
    color: captainUiTheme.textSubtle,
    fontSize: 11,
    fontWeight: "600",
  },
  cardTitle: {
    ...captainTypography.cardTitle,
    color: captainUiTheme.text,
    textAlign: "right",
  },
  cardBody: {
    color: captainUiTheme.textMuted,
    fontSize: 14,
    marginTop: captainSpacing.sm - 2,
    textAlign: "right",
    lineHeight: 22,
  },
  hint: {
    color: captainUiTheme.accent,
    fontSize: 12,
    marginTop: captainSpacing.sm + 2,
    fontWeight: "700",
    textAlign: "right",
  },
  mutedHint: { color: captainUiTheme.textSubtle, fontSize: 12, marginTop: captainSpacing.sm + 2, textAlign: "right" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: captainSpacing.md },
  muted: { color: captainUiTheme.textMuted },
  emptyIconBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: captainUiTheme.neutralSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
