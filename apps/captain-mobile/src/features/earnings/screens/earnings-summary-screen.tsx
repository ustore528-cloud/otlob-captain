import { useCallback, useMemo, useState } from "react";
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
import { useEarningsSummary } from "@/hooks/api/use-earnings-summary";
import { useAuth } from "@/hooks/use-auth";
import type { EarningsSummaryQuery } from "@/services/api/dto";

type RangePreset = "all" | "7d" | "30d" | "month";

const RANGE_CHIPS: { value: RangePreset; label: string }[] = [
  { value: "all", label: "كل الفترات" },
  { value: "7d", label: "آخر 7 أيام" },
  { value: "30d", label: "آخر 30 يومًا" },
  { value: "month", label: "هذا الشهر" },
];

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

function rangeDescription(preset: RangePreset): string {
  switch (preset) {
    case "all":
      return "كل طلباتك المسلّمة المسجّلة";
    case "7d":
      return "الطلبات المسلّمة خلال آخر سبعة أيام";
    case "30d":
      return "الطلبات المسلّمة خلال آخر ثلاثين يومًا";
    case "month":
      return "الطلبات المسلّمة منذ بداية الشهر الحالي";
    default:
      return "";
  }
}

export function EarningsSummaryScreen() {
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
        <ScreenHeader title="ملخص الأرباح" onBack={goBack} />
        <Text style={[styles.muted, styles.guestPad]}>سجّل الدخول لعرض إحصائياتك.</Text>
      </SafeAreaView>
    );
  }

  if (query.isLoading) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <ScreenHeader title="ملخص الأرباح" onBack={goBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={homeTheme.accent} />
          <Text style={styles.muted}>جاري تحميل الملخص…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <WorkStatusBanner />
        <ScreenHeader title="ملخص الأرباح" onBack={goBack} />
        <View style={styles.heroPad}>
          <Text style={styles.sub}>طلبات مسلّمة فقط — من الخادم</Text>
        </View>
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <ScreenHeader title="ملخص الأرباح" onBack={goBack} />
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={homeTheme.accent} />
        }
      >
        <View style={styles.heroPad}>
          <Text style={styles.kicker}>أداؤك</Text>
          <Text style={styles.sub}>{rangeDescription(preset)}</Text>
        </View>

        <Text style={styles.filterLabel}>الفترة</Text>
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
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isEmpty ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="wallet-outline" size={44} color={homeTheme.textSubtle} />
            </View>
            <Text style={styles.emptyTitle}>لا بيانات في هذه الفترة</Text>
            <Text style={styles.emptyBody}>
              عند تسليم الطلبات ستظهر هنا أرقام التحصيل والإجمالي. جرّب «كل الفترات» أو غيّر نطاق التاريخ.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>إجمالي التحصيل</Text>
              <Text style={styles.heroValue}>{data?.totalCashCollection ?? "0"}</Text>
              <Text style={styles.heroUnit}>ر.س</Text>
              <Text style={styles.heroHint}>مجموع المبالغ المطلوب تحصيلها من الطلبات المسلّمة</Text>
            </View>

            <View style={styles.grid}>
              <View style={styles.statCard}>
                <Ionicons name="layers-outline" size={22} color={homeTheme.accent} />
                <Text style={styles.statLabel}>طلبات مسلّمة</Text>
                <Text style={styles.statValue}>{data?.deliveredCount ?? 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="pricetag-outline" size={22} color={homeTheme.accent} />
                <Text style={styles.statLabel}>قيمة الطلبات</Text>
                <Text style={styles.statValueSmall}>{data?.totalAmount ?? "0"} ر.س</Text>
              </View>
            </View>

            <View style={styles.noteCard}>
              <Ionicons name="information-circle-outline" size={20} color={homeTheme.textMuted} />
              <Text style={styles.noteText}>
                الأرقام من الخادم لطلبات بحالة «تم التسليم» ضمن الفترة المختارة. قد تختلف عن الرصيد الفعلي حسب
                التسويات.
              </Text>
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
  heroUnit: {
    color: homeTheme.accent,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
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
