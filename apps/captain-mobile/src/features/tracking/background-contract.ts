/**
 * عقد التتبع في الخلفية — للتوسعة لاحقًا دون كسر الواجهات.
 *
 * الخطوات المتوقعة (ليس مُفعّلًا في هذا الإصدار):
 * 1. `expo-task-manager.defineTask(BACKGROUND_LOCATION_TASK_NAME, ...)`
 * 2. `expo-location.startLocationUpdatesAsync` مع `UIBackgroundModes` على iOS
 * 3. دمج نفس `sendCaptainLocationReliable` + `LocationOutbox` داخل المهمة
 *
 * @see TRACKING_CONFIG و `config.ts` للفترات
 */
import { BACKGROUND_LOCATION_TASK_NAME } from "./config";

export { BACKGROUND_LOCATION_TASK_NAME };

export type BackgroundTrackingRegistration = {
  /** هل سجّلنا مهمة الخلفية في هذا الجهاز */
  isRegistered: boolean;
};

/** Placeholder — يُستدعى عند تفعيل التتبع بالخلفية لاحقًا */
export async function registerBackgroundTrackingPlaceholder(): Promise<BackgroundTrackingRegistration> {
  return { isRegistered: false };
}
