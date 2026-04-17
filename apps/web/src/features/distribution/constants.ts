/** معاملات جلب قوائم التوزيع — مطابقة لـ `GET /api/v1/orders` مع تصفية الحالة */
export const PENDING_LIST_PARAMS = {
  page: 1,
  pageSize: 80,
  status: "PENDING" as const,
  orderNumber: "",
  customerPhone: "",
};

export const CONFIRMED_LIST_PARAMS = {
  page: 1,
  pageSize: 80,
  status: "CONFIRMED" as const,
  orderNumber: "",
  customerPhone: "",
};

export const ASSIGNED_LIST_PARAMS = {
  page: 1,
  pageSize: 80,
  status: "ASSIGNED" as const,
  orderNumber: "",
  customerPhone: "",
};
