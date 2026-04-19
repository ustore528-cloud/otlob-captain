import { useCallback, useMemo, useState, type ReactNode } from "react";
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
import { formatUnknownError } from "@/lib/error-format";
import { screenStyles } from "@/theme/screen-styles";
import { useCaptainOrderMutations } from "@/features/assignment/hooks/use-captain-order-mutations";
import { useOrderHistoryInfinite, type OrderHistoryFilters } from "@/hooks/api/use-order-history-infinite";
import { routes } from "@/navigation/routes";
import type { OrderListItemDto, OrderStatusDto } from "@/services/api/dto";
import { CaptainOrderListCard } from "../components/captain-order-list-card";
import { getOrderListPrimaryAction } from "../utils/order-list-primary-action";
import { orderStatusAccent } from "../utils/order-status-accent";
import { WorkStatusBanner } from "@/features/work-status";

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

export type OrderHistoryScreenProps = {
  /** يُدرَج تحت عنوان «الطلبات المتاحة» (مثل الطلب الحالي) */
  listHeaderTop?: ReactNode;
  /** شريط يُثبَّت أسفل الشاشة فوق التبويب (إجراءات الطلب الحالي) */
  fixedFooter?: ReactNode;
  /** شريط قبول/رفض/تقدّم — داخل رأس القائمة تحت العنوان (تبويب الطلبات) */
  inlineAssignmentBar?: ReactNode;
  /** يُستدعى مع تحديث السجل لمواءمة الطلب الحالي */
  syncRefetchWithAssignment?: () => Promise<unknown>;
  /** تبويب الطلبات المتاحة: خلفية بيضاء، بدون إطارات زائدة */
  minimalChrome?: boolean;
  /** بطاقة طلب العرض النشط: عدّاد إلغاء على البطاقة المطابقة */
  activeOfferOrderId?: string | null;
  activeOfferSecondsRemaining?: number;
};

export function OrderHistoryScreen({
  listHeaderTop,
  fixedFooter,
  inlineAssignmentBar,
  syncRefetchWithAssignment,
  minimalChrome = false,
  activeOfferOrderId = null,
  activeOfferSecondsRemaining,
}: OrderHistoryScreenProps = {}) {
  const router = useRouter();
  const { updateStatus } = useCaptainOrderMutations();
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [rangePreset, setRangePreset] = useState<RangePreset>("all");
  const [refreshing, setRefreshing] = useState(false);

  const apiFilters = useMemo((): OrderHistoryFilters => {
    if (minimalChrome) return {};
    return buildApiFilters(statusFilter, rangePreset);
  }, [minimalChrome, statusFilter, rangePreset]);

  const query = useOrderHistoryInfinite(apiFilters, PAGE_SIZE, { staleTime: 30_000 });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data?.pages]);

  const totalCount = query.data?.pages[0]?.pagination.total ?? 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
      if (syncRefetchWithAssignment) {
        await syncRefetchWithAssignment();
      }
    } finally {
      setRefreshing(false);
    }
  }, [query, syncRefetchWithAssignment]);

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  const busyOrderId =
    updateStatus.isPending && updateStatus.variables ? updateStatus.variables.orderId : null;

  const onCardPrimary = useCallback(
    async (item: OrderListItemDto) => {
      const act = getOrderListPrimaryAction(item.status);
      if (!act) return;
      if (act.kind === "navigate_detail" || act.kind === "view_only") {
        router.push(routes.app.order(item.id));
        return;
      }
      const body =
        act.kind === "pickup"
          ? ({ status: "PICKED_UP" } as const)
          : act.kind === "in_transit"
            ? ({ status: "IN_TRANSIT" } as const)
            : ({ status: "DELIVERED" } as const);
      await updateStatus.mutateAsync({ orderId: item.id, body });
    },
    [router, updateStatus],
  );

  const renderItem = useCallback(
    ({ item }: { item: OrderListItemDto }) => {
      const accent = orderStatusAccent(item.status);
      const primary = getOrderListPrimaryAction(item.status);
      const offerCountdown =
        minimalChrome &&
        activeOfferOrderId &&
        item.id === activeOfferOrderId &&
        typeof activeOfferSecondsRemaining === "number"
          ? activeOfferSecondsRemaining
          : undefined;
      return (
        <CaptainOrderListCard
          item={item}
          statusAccent={accent}
          primary={primary}
          busy={busyOrderId === item.id}
          flatVisual={minimalChrome}
          compactList={minimalChrome}
          compactOfferCountdownSeconds={offerCountdown}
          onOpenDetail={() => router.push(routes.app.order(item.id))}
          onPrimary={() => void onCardPrimary(item)}
        />
      );
    },
    [router, busyOrderId, onCardPrimary, minimalChrome, activeOfferOrderId, activeOfferSecondsRemaining],
  );

  const listHeader = useMemo(() => {
    if (minimalChrome) return null;
    return (
      <View style={styles.filtersBlock}>
        {listHeaderTop ? (
          <View style={styles.registryHeader}>
            <Text style={styles.registryLabel}>سجل الطلبات</Text>
            <Text style={styles.registryHint}>اضغط البطاقة للتفاصيل</Text>
          </View>
        ) : null}
        <Text style={styles.filterLabel}>الحالة</Text>
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
        <Text style={[styles.filterLabel, styles.filterLabelSecond]}>الفترة</Text>
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
            {totalCount === 0 ? "لا نتائج" : `${totalCount} طلب`}
          </Text>
        ) : null}
      </View>
    );
  }, [minimalChrome, statusFilter, rangePreset, query.isSuccess, totalCount, listHeaderTop]);

  const listHeaderMain = useMemo(
    () => (
      <View>
        {minimalChrome ? (
          <View style={[styles.minimalScreenTitle, styles.minimalScreenTitleDense]}>
            <Text style={styles.minimalScreenTitleTextDense}>الطلبات المتاحة</Text>
          </View>
        ) : null}
        {minimalChrome && inlineAssignmentBar ? (
          <View style={styles.inlineAssignmentSlot}>{inlineAssignmentBar}</View>
        ) : null}
        {listHeaderTop ? (
          listHeaderTop
        ) : !minimalChrome ? (
          <View style={styles.hero}>
            <Text style={styles.title}>الطلبات المتاحة</Text>
            <Text style={styles.sub}>الطلبات المسندة والسجل — اضغط للتفاصيل والمسار</Text>
          </View>
        ) : null}
        {listHeader}
      </View>
    ),
    [listHeaderTop, listHeader, minimalChrome, inlineAssignmentBar],
  );

  const safeStyle = screenStyles.safe;

  if (query.isLoading) {
    return (
      <SafeAreaView style={safeStyle} edges={["top", "left", "right"]}>
        <View
          style={{
            flex: 1,
            backgroundColor: minimalChrome ? homeTheme.bgSubtle : undefined,
          }}
        >
          <WorkStatusBanner />
          {minimalChrome ? (
            <>
              {listHeaderMain}
              <View style={[styles.listScrollShell, styles.center, styles.centerMinimal]}>
                <ActivityIndicator size="small" color={homeTheme.accent} />
                <Text style={styles.muted}>Loading orders…</Text>
              </View>
            </>
          ) : (
            <>
              {listHeaderTop ?? (
                <View style={styles.hero}>
                  <Text style={styles.title}>الطلبات المتاحة</Text>
                  <Text style={styles.sub}>جاري التحميل…</Text>
                </View>
              )}
              <View style={styles.center}>
                <ActivityIndicator size="large" color={homeTheme.accent} />
                <Text style={styles.muted}>جاري جلب الطلبات…</Text>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError) {
    const errMsg = formatUnknownError(query.error, "Could not load orders.");
    return (
      <SafeAreaView style={safeStyle} edges={["top", "left", "right"]}>
        <View
          style={{
            flex: 1,
            backgroundColor: minimalChrome ? homeTheme.bgSubtle : undefined,
          }}
        >
          <WorkStatusBanner />
          {minimalChrome ? (
            <>
              {listHeaderMain}
              <View style={styles.listScrollShell}>
                <View style={styles.historyInlineError}>
                  <Text style={styles.historyInlineErrorText}>{errMsg}</Text>
                  <Pressable onPress={() => void query.refetch()} style={styles.historyInlineRetry}>
                    <Text style={styles.historyInlineRetryText}>Retry</Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <>
              {listHeaderTop ?? (
                <View style={styles.hero}>
                  <Text style={styles.title}>الطلبات المتاحة</Text>
                  <Text style={styles.sub}>تعذّر تحميل القائمة</Text>
                </View>
              )}
              <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={safeStyle} edges={["top", "left", "right"]}>
      <View style={{ flex: 1, backgroundColor: minimalChrome ? homeTheme.bgSubtle : undefined }}>
        <WorkStatusBanner />
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeaderMain}
          contentContainerStyle={[
            styles.listContent,
            minimalChrome && styles.listContentMinimal,
            fixedFooter && minimalChrome && !inlineAssignmentBar ? styles.listContentWithDock : null,
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={8}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={homeTheme.accent}
              colors={[homeTheme.accent]}
              progressBackgroundColor={homeTheme.cardWhite}
            />
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
            minimalChrome ? (
              <Text style={styles.emptyMinimal}>لا توجد طلبات حاليًا.</Text>
            ) : (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="receipt-outline" size={48} color={homeTheme.textSubtle} />
                </View>
                <Text style={styles.emptyTitle}>لا توجد طلبات</Text>
                <Text style={styles.emptyBody}>
                  جرّب تغيير الفلاتر أعلاه، أو عد لاحقًا بعد تنفيذ طلبات جديدة.
                </Text>
              </View>
            )
          }
        />
        {fixedFooter}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  minimalScreenTitle: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  /** Tighter title row — Orders tab / minimalChrome */
  minimalScreenTitleDense: {
    paddingTop: 2,
    paddingBottom: 2,
  },
  /** شريط قبول/رفض داخل القائمة — عرض كامل مثل الشريط السابق */
  inlineAssignmentSlot: {
    marginHorizontal: -16,
    marginBottom: 4,
  },
  minimalScreenTitleText: {
    color: homeTheme.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "right",
    letterSpacing: -0.35,
  },
  minimalScreenTitleTextDense: {
    color: homeTheme.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
    letterSpacing: -0.35,
  },
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
    marginBottom: 4,
  },
  filtersBlockMinimal: {
    paddingTop: 4,
    marginBottom: 0,
  },
  /** Align with workbench width; less top padding — Orders tab */
  filtersBlockMinimalDense: {
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  filterLabelMinimal: {
    marginTop: 4,
    fontWeight: "700",
    color: homeTheme.textMuted,
  },
  filterLabelDenseFirst: {
    marginTop: 4,
    marginBottom: 4,
  },
  filterLabelDenseSecond: {
    marginTop: 6,
    marginBottom: 4,
  },
  chipsRowDense: {
    paddingVertical: 0,
    gap: 4,
  },
  chipDense: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipTextDense: {
    fontSize: 11,
  },
  chipMinimal: {
    backgroundColor: homeTheme.cardWhite,
  },
  countLineMinimal: {
    marginTop: 6,
    opacity: 0.9,
  },
  countLineDense: {
    marginTop: 4,
    marginBottom: 2,
  },
  listContentMinimal: {
    paddingBottom: 16,
  },
  /** مساحة فوق شريط الإجراءات الثابت (قبول/رفض) حتى لا يُحجب آخر بطاقة */
  listContentWithDock: {
    paddingBottom: 100,
  },
  otherOrdersHint: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 6,
  },
  otherOrdersHintDense: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 4,
  },
  otherOrdersHintText: {
    fontSize: 11,
    fontWeight: "700",
    color: homeTheme.textMuted,
    textAlign: "right",
  },
  otherOrdersHintTextDense: {
    fontSize: 10,
    fontWeight: "700",
    color: homeTheme.textMuted,
    textAlign: "right",
    lineHeight: 14,
  },
  emptyMinimal: {
    textAlign: "right",
    color: homeTheme.textSubtle,
    fontSize: 13,
    paddingVertical: 20,
    paddingHorizontal: 4,
    lineHeight: 20,
  },
  centerMinimal: {
    minHeight: 120,
    gap: 10,
  },
  /** Remaining area under the header when history query is loading/error (minimalChrome). */
  listScrollShell: {
    flex: 1,
  },
  historyInlineError: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    alignItems: "flex-end",
  },
  historyInlineErrorText: {
    color: homeTheme.dangerText,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
  historyInlineRetry: {
    paddingVertical: 4,
  },
  historyInlineRetryText: {
    color: homeTheme.accent,
    fontWeight: "800",
    fontSize: 14,
  },
  registryHeader: {
    marginTop: 6,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  registryLabel: {
    color: homeTheme.textMuted,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  registryHint: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    textAlign: "right",
    marginTop: 2,
  },
  filterLabel: {
    color: homeTheme.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 6,
    marginTop: 8,
  },
  filterLabelSecond: {
    marginTop: 12,
  },
  chipsRow: {
    flexDirection: "row-reverse",
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.surface,
  },
  chipActive: {
    borderColor: homeTheme.borderStrong,
    backgroundColor: homeTheme.accentSoft,
  },
  chipText: {
    color: homeTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: homeTheme.accent,
    fontWeight: "800",
  },
  countLine: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    textAlign: "right",
    marginTop: 8,
    marginBottom: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    flexGrow: 1,
  },
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
    backgroundColor: homeTheme.neutralSoft,
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
