import { PaginatedResponse, PaginationParams } from '../types';

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}

export function getPaginationSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}
