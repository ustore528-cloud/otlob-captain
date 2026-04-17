/** Backend JSON envelope — @see docs/mobile-captain-api.md §0 */

export type ApiSuccessEnvelope<T> = { success: true; data: T };

export type ApiErrorEnvelope = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;
