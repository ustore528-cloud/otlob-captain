/** أدوار المستخدمين في الواجهة — مطابقة لـ enum الخادم */
export const USER_ROLE_FILTER_OPTIONS = [
  "",
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "BRANCH_MANAGER",
  "STORE_ADMIN",
  "DISPATCHER",
  "CAPTAIN",
  "CUSTOMER",
] as const;

/** أدوار مسموح إنشاؤها من نموذج «إضافة مستخدم» (بدون تكرار خيار فارغ) */
export const USER_ROLE_CREATE_OPTIONS = ["DISPATCHER", "CUSTOMER"] as const;
