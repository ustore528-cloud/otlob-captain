import { useFocusEffect } from "@react-navigation/native";
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
import { useRouter } from "expo-router";
import { OrderDetailContent } from "@/features/order-detail";
import { formatLastSeenAr } from "@/features/home/utils/format";
import { useCaptainAssignment } from "@/hooks/api/use-captain-assignment";
import { routes } from "@/navigation/routes";
import { AssignmentActionsBar } from "../components/assignment-actions-bar";
import { AssignmentEmptyState } from "../components/assignment-empty-state";
import { useCaptainOrderMutations } from "../hooks/use-captain-order-mutations";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { homeTheme } from "@/features/home/theme";
import { alertMutationError } from "@/lib/alert-mutation-error";
import { screenStyles } from "@/theme/screen-styles";
import { deriveFromAssignment } from "../utils/captain-order-actions";

function OpenFullDetailLink({ onOpen }: { onOpen: () => void }) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.detailLink, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel="فتح صفحة التفاصيل الكاملة"
    >
      <Text style={styles.detailLinkText}>فتح صفحة التفاصيل الكاملة ←</Text>
    </Pressable>
  );
}

export function CurrentAssignmentScreen() {
  const router = useRouter();
  const assignmentQuery = useCaptainAssignment({ staleTime: 15_000 });
  const { accept, reject, updateStatus, pending } = useCaptainOrderMutations();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void assignmentQuery.refetch();
    }, [assignmentQuery]),
  );

  const derived = useMemo(() => {
    if (!assignmentQuery.data) return null;
    return deriveFromAssignment(assignmentQuery.data);
  }, [assignmentQuery.data]);

  const offerHint = useMemo(() => {
    if (derived?.mode !== "offer") return null;
    const parts: string[] = [];
    if (derived.timeoutSeconds > 0) {
      parts.push(`زمن تقريبي للقرار: ${derived.timeoutSeconds} ثانية`);
    }
    if (derived.expiresAt) {
      const t = formatLastSeenAr(derived.expiresAt);
      if (t) parts.push(`انتهاء العرض: ${t}`);
    }
    return parts.length ? parts.join(" · ") : "لديك عرض جديد — اقبل أو ارفض";
  }, [derived]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await assignmentQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [assignmentQuery]);

  const run = async (fn: () => Promise<unknown>, errTitle: string) => {
    try {
      await fn();
    } catch (e) {
      alertMutationError(errTitle, e);
    }
  };

  const handleAccept = () => {
    if (derived?.mode !== "offer") return;
    void run(() => accept.mutateAsync(derived.orderId), "تعذّر القبول");
  };

  const handleReject = () => {
    if (derived?.mode !== "offer") return;
    void run(() => reject.mutateAsync(derived.orderId), "تعذّر الرفض");
  };

  const handleAdvance = () => {
    if (derived?.mode !== "active_patch") return;
    const { orderId, nextStatus } = derived;
    void run(
      () => updateStatus.mutateAsync({ orderId, body: { status: nextStatus } }),
      "تعذّر تحديث الحالة",
    );
  };

  const renderBody = () => {
    if (assignmentQuery.isLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={homeTheme.accent} />
          <Text style={styles.muted}>جاري التحميل…</Text>
        </View>
      );
    }

    if (assignmentQuery.isError) {
      return (
        <QueryErrorState
          title="تعذّر الجلب"
          error={assignmentQuery.error}
          onRetry={() => void assignmentQuery.refetch()}
          style={{ marginHorizontal: 0 }}
        />
      );
    }

    const data = assignmentQuery.data;
    if (!data || data.state === "NONE") {
      return <AssignmentEmptyState />;
    }

    if (!derived) {
      return <AssignmentEmptyState />;
    }

    if (derived.mode === "none" && derived.readOnly && derived.order) {
      const ro = derived.order;
      return (
        <>
          <OrderDetailContent order={ro} offerHint={offerHint} showAssignmentLogs={false} />
          <OpenFullDetailLink onOpen={() => router.push(routes.app.order(ro.id))} />
          <View style={{ height: 12 }} />
          <AssignmentActionsBar
            actions={derived}
            busy={pending}
            onAccept={handleAccept}
            onReject={handleReject}
            onAdvance={handleAdvance}
          />
        </>
      );
    }

    if (derived.mode === "offer" || derived.mode === "active_patch") {
      return (
        <>
          <OrderDetailContent order={derived.order} offerHint={offerHint} showAssignmentLogs={false} />
          <OpenFullDetailLink onOpen={() => router.push(routes.app.order(derived.order.id))} />
          <View style={{ height: 16 }} />
          <AssignmentActionsBar
            actions={derived}
            busy={pending}
            onAccept={handleAccept}
            onReject={handleReject}
            onAdvance={handleAdvance}
          />
        </>
      );
    }

    return <AssignmentEmptyState />;
  };

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <View style={styles.accentBar} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={homeTheme.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>الطلب الحالي</Text>
        <Text style={styles.sub}>التعيين النشط من الخادم — يتبع دورة حياة الطلب</Text>
        {renderBody()}
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
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  title: {
    color: homeTheme.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 6,
  },
  sub: {
    color: homeTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    marginBottom: 18,
  },
  center: { paddingVertical: 40, alignItems: "center", gap: 12 },
  muted: { color: homeTheme.textMuted, fontSize: 14 },
  detailLink: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "flex-end",
  },
  detailLinkText: {
    color: homeTheme.accent,
    fontWeight: "800",
    fontSize: 15,
    textAlign: "right",
  },
});
