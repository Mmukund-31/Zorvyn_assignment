import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  getSummary,
  getTrends,
  getCategoryBreakdown,
  getRecentActivity,
  TrendPeriod,
} from './dashboard.service';

function parseDateFilter(query: Record<string, unknown>) {
  return {
    startDate: query.startDate ? new Date(query.startDate as string) : undefined,
    endDate: query.endDate ? new Date(query.endDate as string) : undefined,
  };
}

export const summary = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseDateFilter(req.query);
  const data = await getSummary(filters, req.user!);
  res.status(200).json({ success: true, message: 'Summary retrieved.', data });
});

export const trends = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseDateFilter(req.query);
  const period = (req.query.period as TrendPeriod) ?? 'monthly';
  const data = await getTrends(filters, req.user!, period);
  const label = period === 'weekly' ? 'Weekly' : 'Monthly';
  res.status(200).json({ success: true, message: `${label} trends retrieved.`, data });
});

export const categories = asyncHandler(async (req: Request, res: Response) => {
  const filters = {
    ...parseDateFilter(req.query),
    type: req.query.type as 'INCOME' | 'EXPENSE' | undefined,
  };
  const data = await getCategoryBreakdown(filters, req.user!);
  res.status(200).json({ success: true, message: 'Category breakdown retrieved.', data });
});

export const recent = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string ?? '10', 10), 50);
  const data = await getRecentActivity(limit, req.user!);
  res.status(200).json({ success: true, message: 'Recent activity retrieved.', data });
});
