export type ApiSuccess<T> = { success: true; data: T };
export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function fail(code: string, message: string, details?: unknown): ApiErrorBody {
  return { success: false, error: { code, message, ...(details !== undefined ? { details } : {}) } };
}
