import type { PaginationDto } from "./pagination.dto";
import type { OrderFinancialBreakdownDto } from "@captain/shared";

export type OrderStatusDto =
  | "PENDING"
  | "CONFIRMED"
  | "ASSIGNED"
  | "ACCEPTED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export type StoreSummaryDto = {
  id: string;
  name: string;
  area: string;
  phone?: string;
};

export type AssignmentLogEntryDto = {
  id: string;
  captainId: string;
  assignmentType: string;
  assignedAt: string;
  responseStatus: string;
  expiredAt: string | null;
  notes: string | null;
};

/** Full order payload returned from mobile captain order endpoints — extend as UI needs grow. */
export type OrderDetailDto = {
  id: string;
  orderNumber: string;
  /** الكابتن المعيّن حاليًا — يُطابق واجهة الخادم */
  assignedCaptainId: string | null;
  status: OrderStatusDto;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: string;
  cashCollection: string;
  /** Snapshot aligned with API `toOrderDetailDto` — inferred fees until explicit backend fields exist. */
  financialBreakdown?: OrderFinancialBreakdownDto;
  notes: string | null;
  store: StoreSummaryDto;
  createdAt: string;
  updatedAt: string;
  assignmentLogs?: AssignmentLogEntryDto[];
};

export type OrderListItemDto = {
  id: string;
  orderNumber: string;
  status: OrderStatusDto;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: string;
  cashCollection: string;
  store: Pick<StoreSummaryDto, "id" | "name" | "area">;
  createdAt: string;
  updatedAt: string;
};

export type OrderHistoryQuery = {
  page?: number;
  pageSize?: number;
  status?: OrderStatusDto;
  from?: string;
  to?: string;
};

export type OrderHistoryResponse = {
  items: OrderListItemDto[];
  pagination: PaginationDto;
};

export type CaptainOrderStatusBody = {
  status: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED";
};

export type EarningsSummaryQuery = {
  from?: string;
  to?: string;
};

export type EarningsSummaryResponse = {
  deliveredCount: number;
  totalAmount: string;
  totalCashCollection: string;
};
