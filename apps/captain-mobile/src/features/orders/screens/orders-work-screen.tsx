import { useCaptainAssignmentWorkbench } from "@/features/assignment/hooks/use-captain-assignment-workbench";
import { useAndroidOrdersTabBackConfirm } from "@/hooks/use-android-orders-tab-back-confirm";
import { OrderHistoryScreen } from "./order-history-screen";

export function OrdersWorkScreen() {
  useAndroidOrdersTabBackConfirm();
  const wb = useCaptainAssignmentWorkbench();

  return (
    <OrderHistoryScreen
      minimalChrome
      inlineAssignmentBar={wb.assignmentActionsBar}
      syncRefetchWithAssignment={wb.refetchAssignment}
      activeOfferOrderId={wb.offerListCountdown.orderId}
      activeOfferSecondsRemaining={wb.offerListCountdown.seconds}
    />
  );
}