import { Prisma, Role, User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { buildPaginatedResponse, getPaginationSkip } from '../../lib/pagination';
import { PaginationParams } from '../../types';
import { CreateRecordInput, UpdateRecordInput, ListRecordsQuery } from './records.schema';

/**
 * Builds the Prisma WHERE clause for financial record queries.
 *
 * Centralises two critical pieces of logic in a single function:
 * 1. Always excludes soft-deleted records (deletedAt: null).
 * 2. Enforces role-based scope: ANALYSTs see only their own records;
 *    ADMINs see all records; VIEWERs also see all records (read-only access
 *    to the full dataset is their permitted scope).
 *
 * Keeping this in one place ensures soft-delete and RBAC filtering cannot
 * be accidentally omitted in individual queries.
 */
function buildWhereClause(
  filters: ListRecordsQuery,
  requestingUser: User
): Prisma.FinancialRecordWhereInput {
  const where: Prisma.FinancialRecordWhereInput = { deletedAt: null };

  // ANALYST scope: can only see records they created
  if (requestingUser.role === Role.ANALYST) {
    where.createdById = requestingUser.id;
  }

  // ADMIN override: if createdById filter is explicitly passed, honour it
  if (requestingUser.role === Role.ADMIN && filters.createdById) {
    where.createdById = filters.createdById;
  }

  if (filters.type) where.type = filters.type;
  if (filters.categoryId) where.categoryId = filters.categoryId;

  if (filters.startDate || filters.endDate) {
    where.date = {
      ...(filters.startDate && { gte: filters.startDate }),
      ...(filters.endDate && { lte: filters.endDate }),
    };
  }

  // Full-text search across title and description (case-insensitive)
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

const recordInclude = {
  category: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.FinancialRecordInclude;

export async function listRecords(filters: ListRecordsQuery, requestingUser: User) {
  const where = buildWhereClause(filters, requestingUser);
  const pagination: PaginationParams = {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  };

  // $transaction ensures the count and data query see the same DB snapshot,
  // preventing page-count drift on concurrent inserts
  const orderBy = {
    [pagination.sortBy]: pagination.sortOrder,
  } as Prisma.FinancialRecordOrderByWithRelationInput;

  const [total, records] = await prisma.$transaction([
    prisma.financialRecord.count({ where }),
    prisma.financialRecord.findMany({
      where,
      include: recordInclude,
      skip: getPaginationSkip(pagination.page, pagination.limit),
      take: pagination.limit,
      orderBy,
    }),
  ]);

  // Serialize Decimal amounts as strings to preserve precision in JSON
  const serialized = records.map(serializeRecord);
  return buildPaginatedResponse(serialized, total, pagination);
}

export async function getRecord(id: string, requestingUser: User) {
  const record = await prisma.financialRecord.findFirst({
    where: { id, deletedAt: null },
    include: recordInclude,
  });

  if (!record) throw new AppError('Record not found.', 404);

  // ANALYST can only view their own records
  if (requestingUser.role === Role.ANALYST && record.createdById !== requestingUser.id) {
    throw new AppError('Record not found.', 404); // 404 not 403 to avoid enumeration
  }

  return serializeRecord(record);
}

export async function createRecord(input: CreateRecordInput, requestingUser: User) {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new AppError('Category not found.', 404);

  const record = await prisma.financialRecord.create({
    data: {
      title: input.title,
      description: input.description,
      amount: input.amount,
      type: input.type,
      date: input.date,
      categoryId: input.categoryId,
      createdById: requestingUser.id,
    },
    include: recordInclude,
  });

  return serializeRecord(record);
}

export async function updateRecord(
  id: string,
  input: UpdateRecordInput,
  requestingUser: User
) {
  const record = await prisma.financialRecord.findFirst({
    where: { id, deletedAt: null },
  });

  if (!record) throw new AppError('Record not found.', 404);

  // ANALYST can only modify records they created
  if (requestingUser.role === Role.ANALYST && record.createdById !== requestingUser.id) {
    throw new AppError('Record not found.', 404);
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new AppError('Category not found.', 404);
  }

  const updated = await prisma.financialRecord.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.date !== undefined && { date: input.date }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
    },
    include: recordInclude,
  });

  return serializeRecord(updated);
}

export async function deleteRecord(id: string, requestingUser: User) {
  const record = await prisma.financialRecord.findFirst({
    where: { id, deletedAt: null },
  });

  if (!record) throw new AppError('Record not found.', 404);

  // Only ADMINs can delete — enforced at route level too, but defence in depth
  if (requestingUser.role !== Role.ADMIN) {
    throw new AppError('Only admins can delete records.', 403);
  }

  await prisma.financialRecord.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// Decimal amounts are serialized as strings to prevent JavaScript's floating-point
// number type from introducing precision errors during JSON serialization.
// e.g. Prisma returns Decimal("1234.5678") → JSON "1234.5678" not 1234.5678
//
// Prisma.FinancialRecordGetPayload gives us the exact shape returned when using
// `include: recordInclude`, which is more precise than a manual intersection type.
type RecordWithRelations = Prisma.FinancialRecordGetPayload<{
  include: typeof recordInclude;
}>;

function serializeRecord(record: RecordWithRelations) {
  return {
    ...record,
    amount: record.amount.toFixed(4),
  };
}
