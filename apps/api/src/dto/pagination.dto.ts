export type PaginationMetaDto = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMetaDto {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return { page, pageSize, total, totalPages };
}

export type PaginatedDto<T> = {
  items: T[];
  pagination: PaginationMetaDto;
};

export function buildPaginatedDto<T>(items: T[], page: number, pageSize: number, total: number): PaginatedDto<T> {
  return {
    items,
    pagination: buildPaginationMeta(page, pageSize, total),
  };
}
