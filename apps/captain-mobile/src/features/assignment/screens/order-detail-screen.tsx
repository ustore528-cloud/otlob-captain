import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useOrderDetail } from "@/hooks/api/use-order-detail";
import { useAuth } from "@/hooks/use-auth";
import { OrderDetailContent } from "@/features/order-detail";
import { AssignmentActionsBar } from "../components/assignment-actions-bar";
import { useCaptainOrderMutations } from "../hooks/use-captain-order-mutations";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { homeTheme } from "@/features/home/theme";
import { alertMutationError } from "@/lib/alert-mutation-error";
import { screenStyles } from "@/theme/screen-styles";
import { deriveFromOrder } from "../utils/captain-order-actions";

/**
 * تفاصيل طلب من deep link / إشعار: `captain://order/<orderId>` أو `/(app)/order/<orderId>`
 */
export function OrderDetailScreen() {
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
    void run(() => accept.mutateAsync(derived.orderId), "تعذّر القبول");
  };

  const handleReject = () => {
    if (derived?.mode !== "offer") return;
    void run(() => reject.mutateAsync(derived.orderId), "تعذّر الرفض");
  };

  const handleAdvance = () => {
    if (derived?.mode !== "active_patch") return;
    void run(
      () => updateStatus.mutateAsync({ orderId: derived.orderId, body: { status: derived.nextStatus } }),
      "تعذّر تحديث الحالة",
    );
  };

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/assignment"))}
          hitSlop={12}
        >
          <Ionicons name="chevron-forward" size={26} color={homeTheme.text} />
          <Text style={styles.backText}>رجوع</Text>
        </Pressable>
        <Text style={styles.topTitle}>تفاصيل الطلب</Text>
        <View style={{ width: 72 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!orderId ? (
          <Text style={styles.err}>معرّف الطلب غير صالح</Text>
        ) : orderQuery.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={homeTheme.accent} />
            <Text style={styles.muted}>جاري التحميل…</Text>
          </View>
        ) : orderQuery.isError ? (
          <QueryErrorState
            title="تعذّر فتح الطلب"
            error={orderQuery.error}
            onRetry={() => void orderQuery.refetch()}
            fallbackMessage="تحقق من الصلاحيات أو الرابط."
            style={{ marginHorizontal: 0 }}
          />
        ) : orderQuery.data && !captain?.id ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={homeTheme.accent} />
            <Text style={styles.muted}>جاري تجهيز الجلسة…</Text>
          </View>
        ) : orderQuery.data && derived ? (
          <>
            <OrderDetailContent order={orderQuery.data} showAssignmentLogs />
            <View style={{ height: 16 }} />
            <AssignmentActionsBar
              actions={derived}
              busy={pending}
              onAccept={handleAccept}
              onReject={handleReject}
              onAdvance={handleAdvance}
            />
          </>
        ) : (
          <Text style={styles.err}>لا يمكن عرض الطلب</Text>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  backBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    width: 72,
  },
  backText: { color: homeTheme.accent, fontSize: 16, fontWeight: "700" },
  topTitle: {
    flex: 1,
    textAlign: "center",
    color: homeTheme.text,
    fontSize: 17,
    fontWeight: "800",
  },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  center: { paddingVertical: 48, alignItems: "center", gap: 12 },
  muted: { color: homeTheme.textMuted },
  err: { color: homeTheme.textMuted, textAlign: "center", marginTop: 24 },
});
