import { Platform } from "react-native";

/**
 * API base URL (no trailing slash).
 * - Android emulator: غالبًا `http://10.0.2.2:4000` بدل localhost.
 * - جهاز حقيقي: عنوان IP الحاسوب على الشبكة المحلية، مثل `http://192.168.1.10:4000`.
 * @see docs/mobile-captain-api.md
 */
const defaultApiUrl = Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";
const raw = (process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl).replace(/\/$/, "");

export const env = {
  apiUrl: raw,
} as const;

if (__DEV__ && Platform.OS !== "web") {
  const isLoopback = /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/i.test(env.apiUrl);
  if (isLoopback) {
    // eslint-disable-next-line no-console
    console.warn(
      "[captain-mobile] EXPO_PUBLIC_API_URL يشير إلى localhost/127.0.0.1. على جهاز حقيقي لن يعمل — ضع IP شبكتك المحلية. على محاكي Android استخدم غالبًا http://10.0.2.2:4000",
    );
  }
}
