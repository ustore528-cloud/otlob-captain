import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { logCaptainAssignment } from "@/lib/captain-assignment-debug";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { formatLastSeenAr } from "@/features/home/utils/format";
import { homeTheme } from "@/features/home/theme";
import { alertMutationError } from "@/lib/alert-mutation-error";
import { formatUnknownError } from "@/lib/error-format";
import { useCaptainAssignment } from "@/hooks/api/use-captain-assignment";
import { routes } from "@/navigation/routes";
import { CaptainWorkbenchOrderCard } from "@/features/orders/components/captain-workbench-order-card";
import { AssignmentActionsBar } from "../components/assignment-actions-bar";
import { AssignmentEmptyState } from "../components/assignment-empty-state";
import { useCaptainOrderMutations } from "./use-captain-order-mutations";
import { deriveFromAssignment } from "../utils/captain-order-actions";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAssignmentOfferSecondsTick } from "@/hooks/use-assignment-offer-seconds-tick";
import { queryKeys } from "@/hooks/api/query-keys";
import { formatAssignmentOfferCountdownAr } from "@/lib/assignment-offer-seconds-left";

/**
 * منطق الطلب الحالي (عرض + شريط الإجراءات) لاستخدامه في شاشة مستقلة أو داخل تبويب الطلبات.
 * لا يغيّر سلوك القبول/الرفض/تحديث الحالة.
 */
export function useCaptainAssignmentWorkbench() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const assignmentQuery = useCaptainAssignment({ staleTime: 15_000 });
  const { accept, reject, updateStatus, pending } = useCaptainOrderMutations();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      logCaptainAssignment("FOCUS_REFETCH", { screen: "assignment-workbench" });
      void assignmentQuery.refetch();
    }, [assignmentQuery]),
  );

  const derived = useMemo(() => {
    if (!assignmentQuery.data) return null;
    return deriveFromAssignment(assignmentQuery.data);
  }, [assignmentQuery.data]);

  /** Same second-by-second math as dispatcher map (`assignmentOfferSecondsLeft`). */
  const offerSecondsLeft = useAssignmentOfferSecondsTick(
    derived?.mode === "offer" ? (derived.expiresAt ?? null) : null,
    derived?.mode === "offer",
  );

  /** When local wall-clock reaches expiry (`0` ث), refetch once so UI clears before the next 12s assignment poll (aligns with dashboard map refresh cadence). */
  const offerZeroRefetchDoneForOrderId = useRef<string | null>(null);
  useEffect(() => {
    if (derived?.mode !== "offer") {
      offerZeroRefetchDoneForOrderId.current = null;
      return;
    }
    if (offerSecondsLeft !== 0) return;
    const oid = derived.orderId;
    if (offerZeroRefetchDoneForOrderId.current === oid) return;
    offerZeroRefetchDoneForOrderId.current = oid;
    void queryClient.invalidateQueries({ queryKey: queryKeys.captain.assignment });
    void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "orders", "detail"] });
  }, [derived, offerSecondsLeft, queryClient]);

  const offerHint = useMemo(() => {
    if (derived?.mode !== "offer") return null;
    const parts: string[] = [];
    if (offerSecondsLeft !== null) {
      parts.push(`المتبقي: ${formatAssignmentOfferCountdownAr(offerSecondsLeft)}`);
    }
    if (derived.expiresAt) {
      const t = formatLastSeenAr(derived.expiresAt);
      if (t) parts.push(`انتهاء العرض: ${t}`);
    }
    return parts.length ? parts.join(" · ") : "لديك عرض جديد — اقبل أو ارفض";
  }, [derived, offerSecondsLeft]);

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

  const handleAccept = useCallback(() => {
    if (derived?.mode !== "offer") return;
    void run(() => accept.mutateAsync(derived.orderId), "تعذّر القبول");
  }, [derived, accept]);

  const handleReject = useCallback(() => {
    if (derived?.mode !== "offer") return;
    void run(() => reject.mutateAsync(derived.orderId), "تعذّر الرفض");
  }, [derived, reject]);

  const handleAdvance = useCallback(() => {
    if (derived?.mode !== "active_patch") return;
    const { orderId, nextStatus } = derived;
    void run(
      () => updateStatus.mutateAsync({ orderId, body: { status: nextStatus } }),
      "تعذّر تحديث الحالة",
    );
  }, [derived, updateStatus]);

  const openOrderDetailFromBar = useCallback(() => {
    if (derived?.mode === "offer" || derived?.mode === "active_patch") {
      router.push(routes.app.order(derived.order.id));
    }
  }, [derived, router]);

  const showActionDock =
    derived &&
    (derived.mode === "offer" ||
      derived.mode === "active_patch" ||
      (derived.mode === "none" && derived.readOnly));

  /** Id of the order shown in the workbench — for deduping against order-history lists. */
  const workbenchOrderId = useMemo((): string | null => {
    if (!derived) return null;
    if (derived.mode === "offer" || derived.mode === "active_patch") return derived.orderId;
    if (derived.mode === "none" && derived.readOnly && derived.order) return derived.order.id;
    return null;
  }, [derived]);

  const bodyContent: ReactNode = useMemo(() => {
    if (assignmentQuery.isLoading) {
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={homeTheme.accent} />
          <Text style={styles.muted}>Loading…</Text>
        </View>
      );
    }

    if (assignmentQuery.isError) {
      const message = formatUnknownError(assignmentQuery.error, "Could not load assignment.");
      return (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{message}</Text>
          <Pressable onPress={() => void assignmentQuery.refetch()} style={styles.inlineRetry}>
            <Text style={styles.inlineRetryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    const data = assignmentQuery.data;
    if (!data || data.state === "NONE" || !derived) {
      return <AssignmentEmptyState />;
    }

    if (derived.mode === "none" && derived.readOnly && derived.order) {
      const ro = derived.order;
      return (
        <CaptainWorkbenchOrderCard
          order={ro}
          offerHint={offerHint}
          compact
          onOpenDetail={() => router.push(routes.app.order(ro.id))}
        />
      );
    }

    if (derived.mode === "offer" || derived.mode === "active_patch") {
      return (
        <CaptainWorkbenchOrderCard
          order={derived.order}
          offerHint={offerHint}
          compact
          onOpenDetail={() => router.push(routes.app.order(derived.order.id))}
        />
      );
    }

    return <AssignmentEmptyState />;
  }, [assignmentQuery.isLoading, assignmentQuery.isError, assignmentQuery.error, assignmentQuery.data, derived, offerHint, router]);

  /** شريط إجراءات الطلب الحالي — للتثبيت أسفل الشاشة (شاشة التعيين) */
  const dock: ReactNode =
    showActionDock && derived ? (
      <SafeAreaView edges={["bottom"]} style={styles.dockSafe}>
        <AssignmentActionsBar
          actions={derived}
          busy={pending}
          onAccept={handleAccept}
          onReject={handleReject}
          onAdvance={handleAdvance}
          offerSecondsRemaining={derived.mode === "offer" ? offerSecondsLeft : undefined}
        />
      </SafeAreaView>
    ) : null;

  /** نفس المنطق داخل رأس قائمة الطلبات — يظهر تحت العنوان ويمرّ مع التمرير */
  const assignmentActionsBar: ReactNode =
    showActionDock && derived ? (
      <View style={styles.dockInlineWrap}>
        <AssignmentActionsBar
          actions={derived}
          busy={pending}
          onAccept={handleAccept}
          onReject={handleReject}
          onAdvance={handleAdvance}
          offerSecondsRemaining={derived.mode === "offer" ? offerSecondsLeft : undefined}
          compactSummary
          onOpenOrderDetail={openOrderDetailFromBar}
        />
      </View>
    ) : null;

  /** لعرض «سيتم الإلغاء خلال…» على بطاقة طلب العرض في القائمة فقط */
  const offerListCountdown = useMemo(() => {
    if (!derived || derived.mode !== "offer")
      return { orderId: null as string | null, seconds: undefined as number | undefined };
    if (offerSecondsLeft == null) return { orderId: derived.orderId, seconds: undefined };
    return { orderId: derived.orderId, seconds: offerSecondsLeft };
  }, [derived, offerSecondsLeft]);

  return {
    bodyContent,
    dock,
    assignmentActionsBar,
    refreshing,
    onRefresh,
    workbenchOrderId,
    offerListCountdown,
    /** لدمج السحب للتحديث مع قائمة الطلبات */
    refetchAssignment: () => assignmentQuery.refetch(),
  };
}

const styles = StyleSheet.create({
  dockSafe: {
    backgroundColor: "transparent",
  },
  dockInlineWrap: {
    backgroundColor: homeTheme.cardWhite,
    marginHorizontal: 0,
  },
  loadingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingVertical: 8,
  },
  muted: { color: homeTheme.textMuted, fontSize: 13 },
  inlineError: {
    paddingVertical: 8,
    gap: 8,
    alignItems: "flex-end",
  },
  inlineErrorText: {
    color: homeTheme.dangerText,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
  inlineRetry: {
    paddingVertical: 4,
  },
  inlineRetryText: {
    color: homeTheme.accent,
    fontWeight: "800",
    fontSize: 14,
  },
});
