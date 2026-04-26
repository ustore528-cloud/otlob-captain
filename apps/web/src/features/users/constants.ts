/** أدوار المستخدمين في الواجهة — مطابقة لـ enum الخادم */
export const USER_ROLE_FILTER_OPTIONS = [
  "",
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
] as const;

/** أدوار مسموح إنشاؤها من نموذج «إضافة مستخدم» (بدون تكرار خيار فارغ) */
export const USER_ROLE_CREATE_OPTIONS = [
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
] as const;
