import { paths } from "@captain/shared";
import { authRequest, buildQueryString } from "../client";
import type {
  CaptainOrderStatusBody,
  EarningsSummaryQuery,
  EarningsSummaryResponse,
  OrderDetailDto,
  OrderHistoryQuery,
  OrderHistoryResponse,
} from "../dto";

export const ordersService = {
  getById(orderId: string): Promise<OrderDetailDto> {
    return authRequest<OrderDetailDto>(paths.mobileCaptain.orderById(orderId), { method: "GET" });
  },

  accept(orderId: string): Promise<OrderDetailDto> {
    return authRequest<OrderDetailDto>(paths.mobileCaptain.acceptOrder(orderId), {
      method: "POST",
    });
  },

  reject(orderId: string): Promise<OrderDetailDto | null> {
    return authRequest<OrderDetailDto | null>(paths.mobileCaptain.rejectOrder(orderId), {
      method: "POST",
    });
  },

  updateStatus(orderId: string, body: CaptainOrderStatusBody): Promise<OrderDetailDto> {
    return authRequest<OrderDetailDto>(paths.mobileCaptain.orderStatus(orderId), {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  history(query?: OrderHistoryQuery): Promise<OrderHistoryResponse> {
    const qs = buildQueryString({
      page: query?.page,
      pageSize: query?.pageSize,
      status: query?.status,
      from: query?.from,
      to: query?.to,
    });
    return authRequest<OrderHistoryResponse>(`${paths.mobileCaptain.orderHistory}${qs}`, { method: "GET" });
  },

  earningsSummary(query?: EarningsSummaryQuery): Promise<EarningsSummaryResponse> {
    const qs = buildQueryString({
      from: query?.from,
      to: query?.to,
    });
    return authRequest<EarningsSummaryResponse>(`${paths.mobileCaptain.earningsSummary}${qs}`, {
      method: "GET",
    });
  },
};
