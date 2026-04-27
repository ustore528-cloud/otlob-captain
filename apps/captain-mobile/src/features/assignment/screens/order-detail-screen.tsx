import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOrderDetail } from "@/hooks/api/use-order-detail";
import { useAuth } from "@/hooks/use-auth";
import { OrderDetailContent } from "@/features/order-detail";
import { AssignmentActionsBar } from "../components/assignment-actions-bar";
import { useCaptainOrderMutations } from "../hooks/use-captain-order-mutations";
import { ScreenHeader } from "@/components/screen-header";
import { WorkStatusBanner } from "@/features/work-status";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { homeTheme } from "@/features/home/theme";
import { alertMutationError } from "@/lib/alert-mutation-error";
import { screenStyles } from "@/theme/screen-styles";
import { deriveFromOrder } from "../utils/captain-order-actions";

/**
 * تفاصيل طلب من deep link / إشعار: `captain://order/<orderId>` أو `/(app)/order/<orderId>`
 */
export function OrderDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { orderId: rawId } = useLocalSearchParams<{ orderId: string | string[] }>();
  const orderId = Array.isArray(rawId) ? rawId[0] : rawId;
  const { captain } = useAuth();
  const orderQuery = useOrderDetail(orderId);
  const { accept, reject, updateStatus, pending } = useCaptainOrderMutations();

  const derived = useMemo(() => {
    if (!orderQuery.data || !captain?.id) return null;
    return deriveFromOrder(orderQuery.data, captain.id);
  }, [orderQuery.data, captain?.id]);

  const run = async (fn: () => Promise<unknown>, errTitle: string) => {
    try {
      await fn();
    } catch (e) {
      alertMutationError(errTitle, e);
    }
  };

  const handleAccept = () => {
    if (derived?.mode !== "offer") return;
    void run(() => accept.mutateAsync(derived.orderId), t("assignmentDetail.mutationAccept"));
  };

  const handleReject = () => {
    if (derived?.mode !== "offer") return;
    void run(() => reject.mutateAsync(derived.orderId), t("assignmentDetail.mutationReject"));
  };

  const handleAdvance = () => {
    if (derived?.mode !== "active_patch") return;
    void run(
      () => updateStatus.mutateAsync({ orderId: derived.orderId, body: { status: derived.nextStatus } }),
      "تعذّر تحديث الحالة",
    );
  };

  const showActions = Boolean(orderQuery.data && derived);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/orders");
  };

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <View style={styles.page}>
        <ScreenHeader title={t("assignmentDetail.title")} onBack={goBack} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!orderId ? (
            <Text style={styles.err}>{t("assignmentDetail.invalidId")}</Text>
          ) : orderQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={homeTheme.accent} />
              <Text style={styles.muted}>{t("assignmentDetail.loading")}</Text>
            </View>
          ) : orderQuery.isError ? (
            <QueryErrorState
              title={t("assignmentDetail.errOpen")}
              error={orderQuery.error}
              onRetry={() => void orderQuery.refetch()}
              fallbackMessage={t("assignmentDetail.errOpenFallback")}
              style={{ marginHorizontal: 0 }}
            />
          ) : orderQuery.data && !captain?.id ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={homeTheme.accent} />
              <Text style={styles.muted}>{t("assignmentDetail.sessionPreparing")}</Text>
            </View>
          ) : orderQuery.data && derived ? (
            <OrderDetailContent order={orderQuery.data} showAssignmentLogs />
          ) : (
            <Text style={styles.err}>{t("assignmentDetail.cannotDisplay")}</Text>
          )}
        </ScrollView>

        {showActions ? (
          <SafeAreaView edges={["bottom"]} style={styles.actionDock}>
            <AssignmentActionsBar
              actions={derived!}
              busy={pending}
              onAccept={handleAccept}
              onReject={handleReject}
              onAdvance={handleAdvance}
            />
          </SafeAreaView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: homeTheme.bgSubtle,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  actionDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
    backgroundColor: homeTheme.surface,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  center: { paddingVertical: 40, alignItems: "center", gap: 10 },
  muted: { color: homeTheme.textMuted, fontSize: 13 },
  err: { color: homeTheme.textMuted, textAlign: "center", marginTop: 20, fontSize: 14 },
});
