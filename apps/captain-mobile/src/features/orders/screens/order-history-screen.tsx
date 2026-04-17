import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { homeTheme } from "@/features/home/theme";
import { screenStyles } from "@/theme/screen-styles";
import { useOrderHistoryInfinite, type OrderHistoryFilters } from "@/hooks/api/use-order-history-infinite";
import { routes } from "@/navigation/routes";
import type { OrderListItemDto, OrderStatusDto } from "@/services/api/dto";
import { orderStatusAr } from "@/lib/order-status-ar";
import { formatOrderListDate } from "../utils/format-order-date";

const PAGE_SIZE = 20;

type StatusFilterValue = "all" | OrderStatusDto;

const STATUS_CHIPS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "DELIVERED", label: "تم التسليم" },
  { value: "IN_TRANSIT", label: "قيد التوصيل" },
  { value: "PICKED_UP", label: "تم الاستلام" },
  { value: "ACCEPTED", label: "مقبول" },
  { value: "ASSIGNED", label: "معروض" },
  { value: "CANCELLED", label: "ملغى" },
];

type RangePreset = "all" | "7d" | "30d";

const RANGE_CHIPS: { value: RangePreset; label: string }[] = [
  { value: "all", label: "كل الفترات" },
  { value: "7d", label: "آخر 7 أيام" },
  { value: "30d", label: "آخر 30 يومًا" },
];

function buildApiFilters(status: StatusFilterValue, range: RangePreset): OrderHistoryFilters {
  const f: OrderHistoryFilters = {};
  if (status !== "all") f.status = status;
  if (range !== "all") {
    const to = new Date();
    const from = new Date();
    if (range === "7d") from.setDate(from.getDate() - 7);
    if (range === "30d") from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    f.from = from.toISOString();
    f.to = to.toISOString();
  }
  return f;
}

function statusAccent(status: OrderStatusDto): { bg: string; border: string; text: string } {
  switch (status) {
    case "DELIVERED":
      return { bg: "rgba(52, 211, 153, 0.12)", border: "rgba(52, 211, 153, 0.35)", text: "#6ee7b7" };
    case "CANCELLED":
      return { bg: "rgba(248, 113, 113, 0.1)", border: "rgba(248, 113, 113, 0.35)", text: "#fecaca" };
    case "IN_TRANSIT":
    case "PICKED_UP":
      return { bg: "rgba(56, 189, 248, 0.1)", border: homeTheme.borderStrong, text: homeTheme.accent };
    case "ASSIGNED":
    case "ACCEPTED":
      return { bg: homeTheme.accentSoft, border: homeTheme.borderStrong, text: homeTheme.accent };
    default:
      return { bg: "rgba(148, 163, 184, 0.1)", border: homeTheme.border, text: homeTheme.textMuted };
  }
}

export function OrderHistoryScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [rangePreset, setRangePreset] = useState<RangePreset>("all");
  const [refreshing, setRefreshing] = useState(false);

  const apiFilters = useMemo(
    () => buildApiFilters(statusFilter, rangePreset),
    [statusFilter, rangePreset],
  );

  const query = useOrderHistoryInfinite(apiFilters, PAGE_SIZE, { staleTime: 30_000 });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data?.pages]);

  const totalCount = query.data?.pages[0]?.pagination.total ?? 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  const renderItem = useCallback(
    ({ item }: { item: OrderListItemDto }) => {
      const statusLabel = orderStatusAr[item.status] ?? item.status;
      const accent = statusAccent(item.status);
      return (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => router.push(routes.app.order(item.id))}
          accessibilityRole="button"
          accessibilityLabel={`تفاصيل الطلب ${item.orderNumber}`}
        >
          <View style={styles.cardTop}>
            <View style={styles.orderBlock}>
              <Text style={styles.orderNo}>{item.orderNumber}</Text>
              <Text style={styles.dateText}>{formatOrderListDate(item.createdAt)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: accent.bg, borderColor: accent.border }]}>
              <Text style={[styles.badgeText, { color: accent.text }]}>{statusLabel}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Ionicons name="person-outline" size={18} color={homeTheme.textMuted} />
            <View style={styles.rowText}>
              <Text style={styles.customer}>{item.customerName}</Text>
              <Text style={styles.phone} numberOfLines={1}>
                {item.customerPhone}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Ionicons name="storefront-outline" size={18} color={homeTheme.textMuted} />
            <Text style={styles.store}>
              {item.store.name} · {item.area}
            </Text>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.amountPill}>
              <Text style={styles.amountLabel}>التحصيل</Text>
              <Text style={styles.amountValue}>{item.cashCollection} ر.س</Text>
            </View>
            <Ionicons name="chevron-back" size={22} color={homeTheme.textSubtle} />
          </View>
        </Pressable>
      );
    },
    [router],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.filtersBlock}>
        <Text style={styles.filterLabel}>حالة الطلب</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {STATUS_CHIPS.map((c) => {
            const active = statusFilter === c.value;
            return (
              <Pressable
                key={c.label}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setStatusFilter(c.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={styles.filterLabel}>الفترة الزمنية</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {RANGE_CHIPS.map((c) => {
            const active = rangePreset === c.value;
            return (
              <Pressable
                key={c.label}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setRangePreset(c.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {query.isSuccess ? (
          <Text style={styles.countLine}>
            {totalCount === 0 ? "لا توجد نتائج" : `${totalCount} طلبًا مطابقًا`}
          </Text>
        ) : null}
      </View>
    ),
    [statusFilter, rangePreset, query.isSuccess, totalCount],
  );

  if (query.isLoading) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <View style={styles.hero}>
          <Text style={styles.title}>سجل الطلبات</Text>
          <Text style={styles.sub}>جاري التحميل…</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={homeTheme.accent} />
          <Text style={styles.muted}>جاري جلب الطلبات…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <View style={styles.hero}>
          <Text style={styles.title}>سجل الطلبات</Text>
          <Text style={styles.sub}>سجل الطلبات المرتبطة بحسابك</Text>
        </View>
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.title}>سجل الطلبات</Text>
              <Text style={styles.sub}>اضغط على أي طلب لعرض التفاصيل الكاملة والمسار</Text>
            </View>
            {listHeader}
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={homeTheme.accent} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View style={styles.footerLoad}>
              <ActivityIndicator color={homeTheme.accent} />
              <Text style={styles.muted}>تحميل المزيد…</Text>
            </View>
          ) : (
            <View style={{ height: 16 }} />
          )
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={48} color={homeTheme.textSubtle} />
            </View>
            <Text style={styles.emptyTitle}>لا توجد طلبات</Text>
            <Text style={styles.emptyBody}>
              جرّب تغيير الفلاتر أعلاه، أو عد لاحقًا بعد تنفيذ طلبات جديدة.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    color: homeTheme.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "right",
    letterSpacing: -0.3,
  },
  sub: {
    color: homeTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    marginTop: 6,
  },
  filtersBlock: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  filterLabel: {
    color: homeTheme.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 8,
    marginTop: 10,
  },
  chipsRow: {
    flexDirection: "row-reverse",
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.surface,
  },
  chipActive: {
    borderColor: homeTheme.borderStrong,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
  },
  chipText: {
    color: homeTheme.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: homeTheme.accent,
    fontWeight: "800",
  },
  countLine: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    textAlign: "right",
    marginTop: 10,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    flexGrow: 1,
  },
  card: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: homeTheme.border,
    marginBottom: 12,
  },
  cardPressed: { opacity: 0.94 },
  cardTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  orderBlock: { flex: 1, alignItems: "flex-end" },
  orderNo: { color: homeTheme.text, fontSize: 18, fontWeight: "900" },
  dateText: { color: homeTheme.textMuted, fontSize: 12, marginTop: 4, textAlign: "right" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: "42%",
  },
  badgeText: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: homeTheme.border,
    marginVertical: 12,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  rowText: { flex: 1, alignItems: "flex-end" },
  customer: { color: homeTheme.text, fontSize: 15, fontWeight: "700", textAlign: "right" },
  phone: { color: homeTheme.textMuted, fontSize: 13, marginTop: 2, textAlign: "right" },
  store: { flex: 1, color: homeTheme.textMuted, fontSize: 14, textAlign: "right", lineHeight: 20 },
  footerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  amountPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: homeTheme.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: homeTheme.radiusMd,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  amountLabel: { color: homeTheme.textSubtle, fontSize: 12 },
  amountValue: { color: homeTheme.text, fontSize: 15, fontWeight: "800" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  muted: { color: homeTheme.textMuted, fontSize: 14 },
  footerLoad: { paddingVertical: 20, alignItems: "center", gap: 8 },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 12,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { color: homeTheme.text, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  emptyBody: {
    color: homeTheme.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
});
