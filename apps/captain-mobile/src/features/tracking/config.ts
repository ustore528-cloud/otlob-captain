/**
 * إعدادات التتبع — اضبط الفترات هنا دون لمس منطق التشغيل.
 * لاحقًا: يمكن ربط `intervalMsForeground` بـ AppState أو نوع الجلسة.
 */
export const TRACKING_CONFIG = {
  /** فترة إرسال الموقع أثناء عمل التطبيق في المقدّمة */
  intervalMsForeground: 30_000,
  /** أقل فترة مسموحة (حماية من إفراط في الطلبات) */
  minIntervalMs: 10_000,
  /** محاولات إرسال لكل نقطة عند فشل مؤقت */
  sendMaxAttempts: 4,
  /** تأخير أسيّي بين المحاولات (ملّي ثانية) */
  sendRetryBaseMs: 700,
  /** حد أقصى لطابور النقاط عند انقطاع الشبكة */
  outboxMax: 30,
  /** تجاهل نقاط متطابقة تقريبًا (درجات ≈ أقل من ~11م عند خط العرض 24) */
  minCoordinateDelta: 0.0001,
} as const;

/** اسم مهمة الخلفية المستقبلية — يُستخدم مع expo-task-manager عند التفعيل */
export const BACKGROUND_LOCATION_TASK_NAME = "captain-location-background-v1";
