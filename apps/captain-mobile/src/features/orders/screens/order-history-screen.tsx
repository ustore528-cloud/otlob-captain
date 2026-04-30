import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { EmptyState, ScreenContainer } from "@/components/ui";
import { formatUnknownError } from "@/lib/error-format";
import { captainRadius, captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";
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

const STATUS_FILTER_VALUES: StatusFilterValue[] = [
  "all",
  "DELIVERED",
  "IN_TRANSIT",
  "PICKED_UP",
  "ACCEPTED",
  "ASSIGNED",
  "CANCELLED",
];

type RangePreset = "all" | "7d" | "30d";

const RANGE_CHIPS: { value: RangePreset; i18nKey: string }[] = [
  { value: "all", i18nKey: "ordersHistory.rangeAll" },
  { value: "7d", i18nKey: "ordersHistory.range7d" },
  { value: "30d", i18nKey: "ordersHistory.range30d" },
];

function statusFilterLabel(t: (key: string) => string, value: StatusFilterValue): string {
  if (value === "all") return t("ordersHistory.statusAll");
  return t(`orderStatus.${value}`);
}

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
  /** تبويب الأرشيف: طلبات بحالة DELIVERED فقط + فلتر الفترة */
  archiveMode?: boolean;
  /** بطاقة طلب العرض النشط: عدّاد إلغاء على البطاقة المطابقة */
  activeOfferOrderId?: string | null;
  activeOfferSecondsRemaining?: number;
  /** يطابق الطلب المعروض في شريط التعيين — لتمييز الصف في السجل دون إخفاء */
  workbenchOrderId?: string | null;
};

export function OrderHistoryScreen({
  listHeaderTop,
  fixedFooter,
  inlineAssignmentBar,
  syncRefetchWithAssignment,
  minimalChrome = false,
  archiveMode = false,
  activeOfferOrderId = null,
  activeOfferSecondsRemaining,
  workbenchOrderId = null,
}: OrderHistoryScreenProps = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { updateStatus } = useCaptainOrderMutations();
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [rangePreset, setRangePreset] = useState<RangePreset>("all");
  const [refreshing, setRefreshing] = useState(false);

  const apiFilters = useMemo((): OrderHistoryFilters => {
    if (archiveMode) {
      return buildApiFilters("DELIVERED", rangePreset);
    }
    if (minimalChrome) return {};
    return buildApiFilters(statusFilter, rangePreset);
  }, [archiveMode, minimalChrome, statusFilter, rangePreset]);

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
      const isWorkbenchLinked =
        Boolean(minimalChrome && workbenchOrderId && item.id === workbenchOrderId);
      return (
        <CaptainOrderListCard
          item={item}
          statusAccent={accent}
          primary={primary}
          busy={busyOrderId === item.id}
          flatVisual={minimalChrome}
          compactList={minimalChrome}
          compactOfferCountdownSeconds={offerCountdown}
          isWorkbenchLinked={isWorkbenchLinked}
          onOpenDetail={() => router.push(routes.app.order(item.id))}
          onPrimary={() => void onCardPrimary(item)}
        />
      );
    },
    [
      router,
      busyOrderId,
      onCardPrimary,
      minimalChrome,
      activeOfferOrderId,
      activeOfferSecondsRemaining,
      workbenchOrderId,
    ],
  );

  const listHeader = useMemo(() => {
    if (minimalChrome) return null;
    if (archiveMode) {
      return (
        <View style={styles.filtersBlock}>
          <Text style={styles.filterLabel}>{t("ordersHistory.filterRange")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {RANGE_CHIPS.map((c) => {
              const active = rangePreset === c.value;
              return (
                <Pressable
                  key={c.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setRangePreset(c.value)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(c.i18nKey)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {query.isSuccess ? (
            <Text style={styles.countLine}>
              {totalCount === 0
                ? t("ordersHistory.countNone")
                : t("ordersHistory.countDelivered", { count: totalCount })}
            </Text>
          ) : null}
        </View>
      );
    }
    return (
      <View style={styles.filtersBlock}>
        {listHeaderTop ? (
          <View style={styles.registryHeader}>
            <Text style={styles.registryLabel}>{t("ordersHistory.registryLabel")}</Text>
            <Text style={styles.registryHint}>{t("ordersHistory.registryHint")}</Text>
          </View>
        ) : null}
        <Text style={styles.filterLabel}>{t("ordersHistory.filterStatus")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {STATUS_FILTER_VALUES.map((value) => {
            const active = statusFilter === value;
            return (
              <Pressable
                key={value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setStatusFilter(value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {statusFilterLabel(t, value)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={[styles.filterLabel, styles.filterLabelSecond]}>{t("ordersHistory.filterRange")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {RANGE_CHIPS.map((c) => {
            const active = rangePreset === c.value;
            return (
              <Pressable
                key={c.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setRangePreset(c.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(c.i18nKey)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {query.isSuccess ? (
          <Text style={styles.countLine}>
            {totalCount === 0
              ? t("ordersHistory.countNone")
              : t("ordersHistory.countOrders", { count: totalCount })}
          </Text>
        ) : null}
      </View>
    );
  }, [archiveMode, minimalChrome, statusFilter, rangePreset, query.isSuccess, totalCount, listHeaderTop, t]);

  const listHeaderMain = useMemo(
    () => (
      <View>
        {!archiveMode && minimalChrome ? (
          <View style={[styles.minimalScreenTitle, styles.minimalScreenTitleDense]}>
            <Text style={styles.minimalScreenTitleTextDense}>{t("ordersHistory.minimalTitle")}</Text>
            <Text style={styles.minimalScreenSubtitle} numberOfLines={3}>
              {t("ordersHistory.minimalSub")}
            </Text>
          </View>
        ) : null}
        {!archiveMode && minimalChrome && inlineAssignmentBar ? (
          <View style={styles.assignmentSection}>
            <Text style={styles.assignmentSectionLabel}>{t("ordersHistory.assignmentSectionLabel")}</Text>
            <View style={styles.assignmentSectionCard}>
              {inlineAssignmentBar}
            </View>
          </View>
        ) : null}
        {!archiveMode && minimalChrome ? (
          <View
            style={[
              styles.minimalListSectionHeader,
              inlineAssignmentBar ? styles.minimalListSectionHeaderAfterAssignment : null,
            ]}
          >
            <Text style={styles.minimalListSectionTitle}>{t("ordersHistory.listSectionTitle")}</Text>
            <Text style={styles.minimalListSectionHint} numberOfLines={2}>
              {t("ordersHistory.listSectionHint")}
            </Text>
          </View>
        ) : null}
        {listHeaderTop ? (
          listHeaderTop
        ) : !minimalChrome ? (
          <View style={styles.hero}>
            <Text style={styles.title}>
              {archiveMode ? t("ordersHistory.titleArchive") : t("ordersHistory.titleAvailable")}
            </Text>
            <Text style={styles.sub}>
              {archiveMode ? t("ordersHistory.heroSubArchive") : t("ordersHistory.heroSubAvailable")}
            </Text>
          </View>
        ) : null}
        {listHeader}
      </View>
    ),
    [archiveMode, listHeaderTop, listHeader, minimalChrome, inlineAssignmentBar, t],
  );

  if (query.isLoading) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} contentStyle={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: minimalChrome ? captainUiTheme.bgSubtle : undefined,
          }}
        >
          <WorkStatusBanner />
          {minimalChrome ? (
            <>
              {listHeaderMain}
              <View style={[styles.listScrollShell, styles.center, styles.centerMinimal]}>
                <ActivityIndicator size="small" color={captainUiTheme.accent} />
                <Text style={styles.muted}>{t("ordersHistory.loading")}</Text>
              </View>
            </>
          ) : (
            <>
              {listHeaderTop ?? (
                <View style={styles.hero}>
                  <Text style={styles.title}>
                    {archiveMode ? t("ordersHistory.titleArchive") : t("ordersHistory.titleAvailable")}
                  </Text>
                  <Text style={styles.sub}>{t("ordersHistory.loadingInitial")}</Text>
                </View>
              )}
              <View style={styles.center}>
                <ActivityIndicator size="large" color={captainUiTheme.accent} />
                <Text style={styles.muted}>{t("ordersHistory.loading")}</Text>
              </View>
            </>
          )}
        </View>
      </ScreenContainer>
    );
  }

  if (query.isError) {
    const errMsg = formatUnknownError(query.error, t("ordersHistory.loadError"));
    return (
      <ScreenContainer edges={["top", "left", "right"]} contentStyle={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: minimalChrome ? captainUiTheme.bgSubtle : undefined,
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
                    <Text style={styles.historyInlineRetryText}>{t("ordersHistory.retry")}</Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <>
              {listHeaderTop ?? (
                <View style={styles.hero}>
                  <Text style={styles.title}>
                    {archiveMode ? t("ordersHistory.titleArchive") : t("ordersHistory.titleAvailable")}
                  </Text>
                  <Text style={styles.sub}>{t("ordersHistory.errorListSub")}</Text>
                </View>
              )}
              <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
            </>
          )}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} contentStyle={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: minimalChrome ? captainUiTheme.bgSubtle : undefined }}>
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
              tintColor={captainUiTheme.accent}
              colors={[captainUiTheme.accent]}
              progressBackgroundColor={captainUiTheme.surfaceElevated}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View style={styles.footerLoad}>
                <ActivityIndicator color={captainUiTheme.accent} />
                <Text style={styles.muted}>{t("ordersHistory.loadMore")}</Text>
              </View>
            ) : (
              <View style={{ height: captainSpacing.md }} />
            )
          }
          ListEmptyComponent={
            minimalChrome ? (
              <Text style={styles.emptyMinimal}>{t("ordersHistory.emptyMinimal")}</Text>
            ) : archiveMode ? (
              <EmptyState
                icon={
                  <View style={styles.emptyIconBubble}>
                    <Ionicons name="archive-outline" size={48} color={captainUiTheme.textSubtle} />
                  </View>
                }
                title={t("ordersHistory.emptyArchiveTitle")}
                body={t("ordersHistory.emptyArchiveBody")}
                minHeight={220}
                style={styles.emptyStateSlot}
              />
            ) : (
              <EmptyState
                icon={
                  <View style={styles.emptyIconBubble}>
                    <Ionicons name="receipt-outline" size={48} color={captainUiTheme.textSubtle} />
                  </View>
                }
                title={t("ordersHistory.emptyListTitle")}
                body={t("ordersHistory.emptyListBody")}
                minHeight={220}
                style={styles.emptyStateSlot}
              />
            )
          }
        />
        {fixedFooter}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  minimalScreenTitle: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 4,
  },
  /** Tighter title row — Orders tab / minimalChrome */
  minimalScreenTitleDense: {
    paddingTop: 2,
    paddingBottom: 2,
  },
  minimalScreenTitleText: {
    color: captainUiTheme.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "right",
    letterSpacing: -0.35,
  },
  minimalScreenTitleTextDense: {
    color: captainUiTheme.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
    letterSpacing: -0.35,
  },
  minimalScreenSubtitle: {
    color: captainUiTheme.textSubtle,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
    marginTop: 6,
  },
  assignmentSection: {
    marginBottom: 4,
  },
  assignmentSectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: captainUiTheme.textMuted,
    textAlign: "right",
    marginBottom: 6,
  },
  assignmentSectionCard: {
    borderRadius: captainUiTheme.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.borderStrong,
    backgroundColor: captainUiTheme.surfaceElevated,
    overflow: "hidden",
  },
  minimalListSectionHeader: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  minimalListSectionHeaderAfterAssignment: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: captainUiTheme.border,
  },
  minimalListSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: captainUiTheme.text,
    textAlign: "right",
  },
  minimalListSectionHint: {
    fontSize: 11,
    color: captainUiTheme.textMuted,
    textAlign: "right",
    marginTop: 4,
    lineHeight: 16,
  },
  hero: {
    paddingHorizontal: captainSpacing.screenHorizontal,
    paddingTop: captainSpacing.sm,
    paddingBottom: captainSpacing.xs,
  },
  title: {
    ...captainTypography.screenTitle,
    color: captainUiTheme.text,
    textAlign: "right",
    letterSpacing: -0.3,
  },
  sub: {
    color: captainUiTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    marginTop: 6,
  },
  filtersBlock: {
    paddingHorizontal: captainSpacing.screenHorizontal,
    marginBottom: captainSpacing.xs,
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
    color: captainUiTheme.textMuted,
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
    backgroundColor: captainUiTheme.surfaceElevated,
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
    color: captainUiTheme.textMuted,
    textAlign: "right",
  },
  otherOrdersHintTextDense: {
    fontSize: 10,
    fontWeight: "700",
    color: captainUiTheme.textMuted,
    textAlign: "right",
    lineHeight: 14,
  },
  emptyMinimal: {
    textAlign: "right",
    color: captainUiTheme.textSubtle,
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
    paddingHorizontal: captainSpacing.screenHorizontal,
    paddingTop: captainSpacing.md,
    gap: captainSpacing.sm + 2,
    alignItems: "flex-end",
  },
  historyInlineErrorText: {
    color: captainUiTheme.dangerText,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
  historyInlineRetry: {
    paddingVertical: 4,
  },
  historyInlineRetryText: {
    color: captainUiTheme.accent,
    fontWeight: "800",
    fontSize: 14,
  },
  registryHeader: {
    marginTop: 6,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: captainUiTheme.border,
  },
  registryLabel: {
    color: captainUiTheme.textMuted,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  registryHint: {
    color: captainUiTheme.textSubtle,
    fontSize: 11,
    textAlign: "right",
    marginTop: 2,
  },
  filterLabel: {
    color: captainUiTheme.text,
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
    paddingVertical: captainSpacing.sm - 2,
    paddingHorizontal: captainSpacing.md,
    borderRadius: captainRadius.pill,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    backgroundColor: captainUiTheme.surface,
  },
  chipActive: {
    borderColor: captainUiTheme.borderStrong,
    backgroundColor: captainUiTheme.accentSoft,
  },
  chipText: {
    color: captainUiTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: captainUiTheme.accent,
    fontWeight: "800",
  },
  countLine: {
    color: captainUiTheme.textSubtle,
    fontSize: 11,
    textAlign: "right",
    marginTop: 8,
    marginBottom: 4,
  },
  listContent: {
    paddingHorizontal: captainSpacing.screenHorizontal - 4,
    paddingBottom: captainSpacing.screenBottom,
    flexGrow: 1,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  muted: { color: captainUiTheme.textMuted, fontSize: 14 },
  footerLoad: {
    paddingVertical: captainSpacing.lg + 4,
    alignItems: "center",
    gap: captainSpacing.sm,
  },
  emptyStateSlot: {
    paddingVertical: captainSpacing.sm,
    paddingHorizontal: captainSpacing.xs,
  },
  emptyIconBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: captainUiTheme.neutralSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
