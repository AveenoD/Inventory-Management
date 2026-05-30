import type { PaginationQuery } from "@sk-mobile/shared";

export function paginate(page: number, limit: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const skip = (page - 1) * limit;
  return { skip, take: limit, totalPages, total };
}

export function dateRangeFilter(query: PaginationQuery) {
  const where: { gte?: Date; lte?: Date } = {};
  if (query.from) where.gte = new Date(query.from);
  if (query.to) where.lte = new Date(query.to);
  return Object.keys(where).length ? where : undefined;
}
