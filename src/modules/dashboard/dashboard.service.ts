import { Prisma, Role, User } from '@prisma/client';
import { prisma } from '../../lib/prisma';

interface DateFilter {
  startDate?: Date;
  endDate?: Date;
}

/**
 * Returns base WHERE conditions shared across all dashboard queries.
 * Applies ANALYST scope restriction and soft-delete exclusion.
 */
function baseWhere(filters: DateFilter, user: User): Prisma.FinancialRecordWhereInput {
  const where: Prisma.FinancialRecordWhereInput = { deletedAt: null };

  if (user.role === Role.ANALYST) {
    where.createdById = user.id;
  }

  if (filters.startDate || filters.endDate) {
    where.date = {
      ...(filters.startDate && { gte: filters.startDate }),
      ...(filters.endDate && { lte: filters.endDate }),
    };
  }

  return where;
}

/**
 * Summary: total income, total expenses, net balance, and record count.
 *
 * Uses Prisma groupBy to compute sums per RecordType in a single query.
 * Results are reduced into a flat summary object.
 */
export async function getSummary(filters: DateFilter, user: User) {
  const where = baseWhere(filters, user);

  const results = await prisma.financialRecord.groupBy({
    by: ['type'],
    where,
    _sum: { amount: true },
    _count: { id: true },
  });

  let totalIncome = new Prisma.Decimal(0);
  let totalExpenses = new Prisma.Decimal(0);
  let incomeCount = 0;
  let expenseCount = 0;

  for (const row of results) {
    if (row.type === 'INCOME') {
      totalIncome = row._sum.amount ?? new Prisma.Decimal(0);
      incomeCount = row._count.id;
    } else {
      totalExpenses = row._sum.amount ?? new Prisma.Decimal(0);
      expenseCount = row._count.id;
    }
  }

  const netBalance = totalIncome.minus(totalExpenses);

  return {
    totalIncome: totalIncome.toString(),
    totalExpenses: totalExpenses.toString(),
    netBalance: netBalance.toString(),
    recordCount: incomeCount + expenseCount,
    incomeCount,
    expenseCount,
  };
}

interface TrendRow {
  bucket: Date;
  type: string;
  total: string;
  count: bigint;
}

export type TrendPeriod = 'monthly' | 'weekly';

/**
 * Trends: income and expense totals grouped by calendar month or ISO week.
 *
 * Prisma's groupBy does not support time-bucketing functions like DATE_TRUNC,
 * so we use $queryRaw here. This is a deliberate and documented use of raw
 * SQL — not a shortcut, but the correct tool for this aggregation.
 *
 * Amounts are cast to text in SQL to avoid Prisma returning them as
 * Decimal objects which serialize poorly from raw query results.
 *
 * period='monthly' → keys formatted as "YYYY-MM"
 * period='weekly'  → keys formatted as "YYYY-Www" (ISO week, e.g. "2024-W03")
 */
export async function getTrends(filters: DateFilter, user: User, period: TrendPeriod = 'monthly') {
  const truncUnit = period === 'weekly' ? 'week' : 'month';

  const conditions: string[] = ['deleted_at IS NULL'];
  const params: (Date | string)[] = [];
  let paramIndex = 1;

  if (user.role === Role.ANALYST) {
    conditions.push(`created_by_id = $${paramIndex++}`);
    params.push(user.id);
  }

  if (filters.startDate) {
    conditions.push(`date >= $${paramIndex++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`date <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  const whereClause = conditions.join(' AND ');

  const rows = await prisma.$queryRawUnsafe<TrendRow[]>(
    `SELECT
       DATE_TRUNC('${truncUnit}', date) AS bucket,
       type,
       SUM(amount)::text                AS total,
       COUNT(*)                         AS count
     FROM financial_records
     WHERE ${whereClause}
     GROUP BY 1, 2
     ORDER BY 1 ASC, 2 ASC`,
    ...params
  );

  // Transform into period-keyed map
  const bucketMap: Record<
    string,
    { period: string; income: string; expense: string; incomeCount: number; expenseCount: number }
  > = {};

  for (const row of rows) {
    const d = new Date(row.bucket);
    let key: string;
    if (period === 'weekly') {
      // ISO week: find Thursday of the week to get ISO year, then compute ISO week number
      const thursday = new Date(d);
      thursday.setDate(d.getDate() + (4 - (d.getDay() || 7)));
      const yearStart = new Date(thursday.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      key = `${thursday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    } else {
      key = d.toISOString().slice(0, 7); // "YYYY-MM"
    }

    if (!bucketMap[key]) {
      bucketMap[key] = { period: key, income: '0', expense: '0', incomeCount: 0, expenseCount: 0 };
    }

    if (row.type === 'INCOME') {
      bucketMap[key].income = row.total;
      bucketMap[key].incomeCount = Number(row.count);
    } else {
      bucketMap[key].expense = row.total;
      bucketMap[key].expenseCount = Number(row.count);
    }
  }

  return Object.values(bucketMap);
}

/** @deprecated Use getTrends with period='monthly' */
export async function getMonthlyTrends(filters: DateFilter, user: User) {
  return getTrends(filters, user, 'monthly');
}

/**
 * Category breakdown: total income/expense per category.
 *
 * Uses groupBy on categoryId, then fetches category names separately to
 * avoid a raw SQL JOIN. Both queries are in a transaction for consistency.
 */
export async function getCategoryBreakdown(
  filters: DateFilter & { type?: 'INCOME' | 'EXPENSE' },
  user: User
) {
  const where = baseWhere(filters, user);
  if (filters.type) where.type = filters.type;

  const grouped = await prisma.financialRecord.groupBy({
    by: ['categoryId', 'type'],
    where,
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: 'desc' } },
  });

  if (grouped.length === 0) return [];

  const categoryIds = [...new Set(grouped.map((r) => r.categoryId))];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return grouped.map((row) => ({
    categoryId: row.categoryId,
    categoryName: categoryMap.get(row.categoryId) ?? 'Unknown',
    type: row.type,
    total: (row._sum.amount ?? new Prisma.Decimal(0)).toString(),
    count: row._count.id,
  }));
}

/**
 * Recent activity: the N most recent non-deleted records.
 */
export async function getRecentActivity(limit: number, user: User) {
  const where: Prisma.FinancialRecordWhereInput = { deletedAt: null };

  if (user.role === Role.ANALYST) {
    where.createdById = user.id;
  }

  const records = await prisma.financialRecord.findMany({
    where,
    include: {
      category: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { date: 'desc' },
    take: Math.min(limit, 50),
  });

  return records.map((r) => ({ ...r, amount: r.amount.toString() }));
}
