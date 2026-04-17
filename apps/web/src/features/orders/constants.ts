/** خيارات تصفية حالة الطلب — مطابقة لـ OrderStatus في الـ API */
export const ORDER_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "كل الحالات" },
  { value: "PENDING", label: "بانتظار التوزيع" },
  { value: "CONFIRMED", label: "تجهيز" },
  { value: "ASSIGNED", label: "مُعيَّن" },
  { value: "ACCEPTED", label: "مقبول" },
  { value: "PICKED_UP", label: "تم الاستلام" },
  { value: "IN_TRANSIT", label: "قيد التوصيل" },
  { value: "DELIVERED", label: "تم التسليم" },
  { value: "CANCELLED", label: "ملغى" },
];
