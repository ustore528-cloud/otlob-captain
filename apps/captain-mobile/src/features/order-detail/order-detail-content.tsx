import { StyleSheet, View } from "react-native";
import type { OrderDetailDto } from "@/services/api/dto";
import { orderStatusAr } from "@/lib/order-status-ar";
import { AssignmentLogsTimeline } from "./components/assignment-logs-timeline";
import { DetailRow } from "./components/detail-row";
import { OrderDetailHeader } from "./components/order-detail-header";
import { OrderStatusProgress } from "./components/order-status-progress";
import { SectionCard } from "./components/section-card";
import { rtlLayout } from "@/theme/rtl";

export type OrderDetailContentProps = {
  order: OrderDetailDto;
  /** تلميح مهلة العرض — يُمرَّر من شاشة التعيين الحالي فقط عادةً */
  offerHint?: string | null;
  /** إظهار سجل التعيينات (مفيد في شاشة التفاصيل الكاملة) */
  showAssignmentLogs?: boolean;
};

/**
 * عرض موحّد لبيانات الطلب — يُستخدم من الطلب الحالي، السجل، التفاصيل، والروابط العميقة.
 */
export function OrderDetailContent({ order, offerHint, showAssignmentLogs = true }: OrderDetailContentProps) {
  const statusLabel = orderStatusAr[order.status] ?? order.status;

  return (
    <View style={styles.stack}>
      <OrderDetailHeader order={order} offerHint={offerHint} />

      <OrderStatusProgress status={order.status} />

      <SectionCard title="الحالة" icon="flag-outline">
        <DetailRow isFirst label="حالة الطلب" value={statusLabel} />
      </SectionCard>

      <SectionCard title="معلومات العميل" icon="person-outline">
        <DetailRow isFirst label="الاسم" value={order.customerName} />
        <DetailRow label="رقم الجوال" value={order.customerPhone} />
        <DetailRow label="المنطقة" value={order.area} />
      </SectionCard>

      <SectionCard title="معلومات المتجر" icon="storefront-outline">
        <DetailRow isFirst label="اسم المتجر" value={order.store.name} />
        <DetailRow label="المنطقة" value={order.store.area} />
        {order.store.phone ? <DetailRow label="هاتف المتجر" value={order.store.phone} /> : null}
      </SectionCard>

      <SectionCard title="المسارات" icon="map-outline">
        <DetailRow
          isFirst
          label="نقطة الاستلام"
          value={order.pickupAddress}
          hint="من المتجر أو نقطة التجميع"
        />
        <DetailRow label="نقطة التسليم" value={order.dropoffAddress} hint="عنوان العميل" />
      </SectionCard>

      <SectionCard title="المبالغ والتحصيل" icon="cash-outline">
        <DetailRow isFirst label="قيمة الطلب" value={`${order.amount} ر.س`} />
        <DetailRow label="المبلغ المطلوب تحصيله" value={`${order.cashCollection} ر.س`} />
      </SectionCard>

      {order.notes ? (
        <SectionCard title="ملاحظات" icon="document-text-outline">
          <DetailRow isFirst label="ملاحظات على الطلب" value={order.notes} />
        </SectionCard>
      ) : null}

      {showAssignmentLogs ? <AssignmentLogsTimeline logs={order.assignmentLogs} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
    ...rtlLayout,
  },
});
