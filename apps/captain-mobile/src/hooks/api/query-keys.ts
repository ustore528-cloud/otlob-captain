/**
 * Stable TanStack Query keys — use factories for parameterized lists.
 */
export const queryKeys = {
  root: ["captain-mobile"] as const,
  captain: {
    me: ["captain-mobile", "captain", "me"] as const,
    assignment: ["captain-mobile", "captain", "assignment"] as const,
    assignmentOverflow: ["captain-mobile", "captain", "assignment-overflow"] as const,
    workStatus: ["captain-mobile", "captain", "work-status"] as const,
  },
  orders: {
    history: (queryHash: string) => ["captain-mobile", "orders", "history", queryHash] as const,
    historyInfinite: (filterHash: string) =>
      ["captain-mobile", "orders", "historyInfinite", filterHash] as const,
    detail: (orderId: string) => ["captain-mobile", "orders", "detail", orderId] as const,
  },
  notifications: {
    list: (queryHash: string) => ["captain-mobile", "notifications", "list", queryHash] as const,
  },
  earnings: {
    summary: (queryHash: string) => ["captain-mobile", "earnings", "summary", queryHash] as const,
  },
} as const;
