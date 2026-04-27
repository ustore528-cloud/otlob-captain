import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { formatNotificationSectionDateLabel, formatNotificationTime } from "@/features/home/utils/format";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { homeTheme } from "@/features/home/theme";
import { screenStyles } from "@/theme/screen-styles";
import { WorkStatusBanner } from "@/features/work-status";
import { useNotificationsList } from "@/hooks/api/use-notifications";
import { routes } from "@/navigation/routes";
import type { NotificationItemDto } from "@/services/api/dto";

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
  const { t } = useTranslation();
  const router = useRouter();
  const query = useNotificationsList({ page: 1, pageSize: 50 });
  const [refreshing, setRefreshing] = useState(false);

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
                <Ionicons name="receipt-outline" size={14} color={homeTheme.accent} />
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
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <WorkStatusBanner />
        <View style={styles.screenHead}>
          <Text style={styles.title}>{t("notifications.title")}</Text>
          <Text style={styles.sub}>{t("notifications.subLoading")}</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={homeTheme.accent} />
          <Text style={styles.muted}>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <WorkStatusBanner />
        <View style={styles.screenHead}>
          <Text style={styles.title}>{t("notifications.title")}</Text>
        </View>
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <View style={styles.screenHead}>
        <Text style={styles.title}>{t("notifications.title")}</Text>
        <Text style={styles.sub}>{t("notifications.sub")}</Text>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={homeTheme.accent} />
        }
        ListEmptyComponent={<Text style={styles.empty}>{t("notifications.empty")}</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screenHead: {
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 8,
  },
  title: {
    color: homeTheme.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "right",
  },
  sub: {
    color: homeTheme.textSubtle,
    fontSize: 13,
    textAlign: "right",
    marginTop: 6,
    lineHeight: 20,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: homeTheme.surface,
  },
  sectionTitle: {
    color: homeTheme.textMuted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 0 },
  card: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: homeTheme.border,
    marginBottom: 12,
  },
  cardPressed: { opacity: 0.9 },
  cardTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  metaRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
    justifyContent: "flex-end",
  },
  time: { color: homeTheme.textMuted, fontSize: 12, textAlign: "left" },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: homeTheme.accentSoft,
    borderWidth: 1,
    borderColor: homeTheme.borderStrong,
  },
  unreadBadgeText: {
    color: homeTheme.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  readBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: homeTheme.neutralSoft,
  },
  readBadgeText: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    fontWeight: "600",
  },
  orderBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: homeTheme.goldSoft,
    borderWidth: 1,
    borderColor: homeTheme.goldMuted,
  },
  orderBadgeText: {
    color: homeTheme.gold,
    fontSize: 11,
    fontWeight: "800",
  },
  infoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: homeTheme.neutralSoft,
  },
  infoBadgeText: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    fontWeight: "600",
  },
  cardTitle: { color: homeTheme.text, fontSize: 16, fontWeight: "800", textAlign: "right" },
  cardBody: { color: homeTheme.textMuted, fontSize: 14, marginTop: 6, textAlign: "right", lineHeight: 22 },
  hint: { color: homeTheme.accent, fontSize: 12, marginTop: 10, fontWeight: "700", textAlign: "right" },
  mutedHint: { color: homeTheme.textSubtle, fontSize: 12, marginTop: 10, textAlign: "right" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  muted: { color: homeTheme.textMuted },
  empty: { color: homeTheme.textMuted, textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
});
