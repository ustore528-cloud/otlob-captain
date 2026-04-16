import { createApiClient } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

/** عميل API افتراضي للويب — يقرأ التوكن من Zustand في كل طلب */
export const api = createApiClient(() => useAuthStore.getState().token);
