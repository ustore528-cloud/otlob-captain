import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { formatNotificationTime } from "@/features/home/utils/format";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { homeTheme } from "@/features/home/theme";
import { screenStyles } from "@/theme/screen-styles";
import { useNotificationsList } from "@/hooks/api/use-notifications";
import { routes } from "@/navigation/routes";
import type { NotificationItemDto } from "@/services/api/dto";

export function NotificationsListScreen() {
  const router = useRouter();
  const query = useNotificationsList({ page: 1, pageSize: 30 });
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
      return;
    }
  };

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
          <Text style={styles.time}>{formatNotificationTime(item.createdAt)}</Text>
          {!item.isRead ? <View style={styles.unread} /> : <View style={{ width: 8 }} />}
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardBody}>{item.body}</Text>
        {tappable ? (
          <Text style={styles.hint}>اضغط لفتح تفاصيل الطلب</Text>
        ) : (
          <Text style={styles.mutedHint}>لا يوجد ربط بطلب — عرض فقط</Text>
        )}
      </Pressable>
    );
  };

  if (query.isLoading) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={homeTheme.accent} />
          <Text style={styles.muted}>جاري التحميل…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <Text style={styles.title}>الإشعارات</Text>
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </SafeAreaView>
    );
  }

  const items = query.data?.items ?? [];

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <Text style={styles.title}>الإشعارات</Text>
      <Text style={styles.sub}>عند ربط الإشعار بطلب من الخادم، يمكن فتح تفاصيل الطلب مباشرة</Text>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={homeTheme.accent} />
        }
        ListEmptyComponent={<Text style={styles.empty}>لا توجد إشعارات.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    color: homeTheme.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "right",
    paddingHorizontal: 20,
    marginTop: 8,
  },
  sub: {
    color: homeTheme.textSubtle,
    fontSize: 13,
    textAlign: "right",
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 20,
  },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  cardPressed: { opacity: 0.9 },
  cardTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  time: { color: homeTheme.textMuted, fontSize: 12 },
  unread: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: homeTheme.accent,
  },
  cardTitle: { color: homeTheme.text, fontSize: 16, fontWeight: "800", textAlign: "right" },
  cardBody: { color: homeTheme.textMuted, fontSize: 14, marginTop: 6, textAlign: "right", lineHeight: 22 },
  hint: { color: homeTheme.accent, fontSize: 12, marginTop: 10, fontWeight: "700", textAlign: "right" },
  mutedHint: { color: homeTheme.textSubtle, fontSize: 12, marginTop: 10, textAlign: "right" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  muted: { color: homeTheme.textMuted },
  empty: { color: homeTheme.textMuted, textAlign: "center", marginTop: 40 },
});
