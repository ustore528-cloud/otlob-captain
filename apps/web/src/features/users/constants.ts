/** أدوار المستخدمين في الواجهة — مطابقة لـ enum الخادم */
export const USER_ROLE_FILTER_OPTIONS = ["", "ADMIN", "DISPATCHER", "CAPTAIN", "STORE", "CUSTOMER"] as const;

/** أدوار مسموح إنشاؤها من نموذج «إضافة مستخدم» (بدون تكرار خيار فارغ) */
export const USER_ROLE_CREATE_OPTIONS = ["DISPATCHER", "STORE", "CUSTOMER", "ADMIN"] as const;
