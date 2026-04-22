import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { CaptainOrderStatusBody, CurrentAssignmentResponse, MeResponse, OrderDetailDto } from "@/services/api/dto";
import { ordersService } from "@/services/api/services/orders.service";
import { captainService } from "@/services/api/services/captain.service";
import { queryKeys } from "@/hooks/api/query-keys";
import { deriveFromAssignment, deriveFromOrder } from "../utils/captain-order-actions";
import { logCaptainOrderInteraction } from "@/lib/captain-assignment-debug";

async function assertOfferActionAllowed(
  queryClient: QueryClient,
  orderId: string,
  action: "accept" | "reject",
): Promise<void> {
  logCaptainOrderInteraction(`${action}_REFETCH`, { orderId });
  await queryClient.refetchQueries({ queryKey: queryKeys.captain.assignment });
  await queryClient.refetchQueries({ queryKey: queryKeys.captain.assignmentOverflow });
  await queryClient.refetchQueries({ queryKey: queryKeys.orders.detail(orderId) });
  const me =
    queryClient.getQueryData<MeResponse>(queryKeys.captain.me) ??
    (await queryClient.fetchQuery({
      queryKey: queryKeys.captain.me,
      queryFn: () => captainService.getMe(),
      staleTime: 10_000,
    }));
  const captainId = me?.captain?.id ?? null;
  if (!captainId) {
    logCaptainOrderInteraction(`${action}_BLOCKED`, { orderId, reason: "NO_CAPTAIN_SESSION_AFTER_FETCH" });
    throw new Error("تعذّر تجهيز الجلسة. جرّب تحديث الصفحة أو تسجيل الدخول مرة أخرى.");
  }

  const assignment = queryClient.getQueryData<CurrentAssignmentResponse>(queryKeys.captain.assignment);
  const order = queryClient.getQueryData<OrderDetailDto>(queryKeys.orders.detail(orderId));

  const fromA = assignment ? deriveFromAssignment(assignment) : null;
  const fromO = order ? deriveFromOrder(order, captainId) : null;

  const offerA = fromA?.mode === "offer" && fromA.orderId === orderId;
  const offerO = fromO?.mode === "offer" && fromO.orderId === orderId;

  logCaptainOrderInteraction(`${action}_VALIDATE`, {
    orderId,
    fromAssignmentMode: fromA?.mode,
    fromOrderMode: fromO?.mode,
    offerA,
    offerO,
    orderAssignedCaptainId: order?.assignedCaptainId ?? null,
  });

  if (!offerA && !offerO) {
    logCaptainOrderInteraction(`${action}_BLOCKED`, {
      orderId,
      reason: "NO_VALID_OFFER_AFTER_REFETCH",
      fromAssignmentMode: fromA?.mode,
      fromOrderMode: fromO?.mode,
    });
    throw new Error(
      "لا يوجد عرض نشط لهذا الطلب. قد تكون المهلة انتهت أو أُعيد التوزيع. اسحب للتحديث.",
    );
  }
}

export function useCaptainOrderMutations() {
  const queryClient = useQueryClient();

  const invalidateOrder = (orderId: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.captain.assignment });
    void queryClient.invalidateQueries({ queryKey: queryKeys.captain.assignmentOverflow });
    void queryClient.invalidateQueries({ queryKey: queryKeys.captain.me });
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
    void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "orders", "historyInfinite"] });
    void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "orders", "history"] });
    void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "earnings", "summary"] });
  };

  const accept = useMutation({
    mutationFn: async (orderId: string) => {
      logCaptainOrderInteraction("accept_CLICK", { orderId });
      await assertOfferActionAllowed(queryClient, orderId, "accept");
      try {
        const data = await ordersService.accept(orderId);
        logCaptainOrderInteraction("accept_HTTP_OK", { orderId, status: data.status });
        return data;
      } catch (e) {
        logCaptainOrderInteraction("accept_HTTP_ERR", {
          orderId,
          message: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    },
    onSuccess: (_data, orderId) => invalidateOrder(orderId),
  });

  const reject = useMutation({
    mutationFn: async (orderId: string) => {
      logCaptainOrderInteraction("reject_CLICK", { orderId });
      await assertOfferActionAllowed(queryClient, orderId, "reject");
      try {
        const data = await ordersService.reject(orderId);
        logCaptainOrderInteraction("reject_HTTP_OK", { orderId, status: data?.status ?? null });
        return data;
      } catch (e) {
        logCaptainOrderInteraction("reject_HTTP_ERR", {
          orderId,
          message: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    },
    onSuccess: (_data, orderId) => invalidateOrder(orderId),
  });

  const updateStatus = useMutation({
    mutationFn: (args: { orderId: string; body: CaptainOrderStatusBody }) =>
      ordersService.updateStatus(args.orderId, args.body),
    onSuccess: (_data, args) => invalidateOrder(args.orderId),
  });

  const pending = accept.isPending || reject.isPending || updateStatus.isPending;
  const acceptPendingOrderId = accept.isPending ? accept.variables ?? null : null;
  const rejectPendingOrderId = reject.isPending ? reject.variables ?? null : null;
  const updatePendingOrderId = updateStatus.isPending ? updateStatus.variables?.orderId ?? null : null;

  return {
    accept,
    reject,
    updateStatus,
    pending,
    acceptPendingOrderId,
    rejectPendingOrderId,
    updatePendingOrderId,
  };
}
