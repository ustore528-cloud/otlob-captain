/**
 * Normalized API failure — mirrors backend `{ success: false, error: { code, message, details } }`.
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** @deprecated Use ApiClientError — kept for gradual migration */
export const ApiError = ApiClientError;
