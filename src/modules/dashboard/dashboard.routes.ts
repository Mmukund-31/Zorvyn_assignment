import { Router } from 'express';
import { summary, trends, categories, recent } from './dashboard.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Dashboard
 *     description: Aggregated financial analytics and summaries
 */

/**
 * @openapi
 * /dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Total income, expenses, and net balance
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Financial summary
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 totalIncome: "50000.0000"
 *                 totalExpenses: "32000.0000"
 *                 netBalance: "18000.0000"
 *                 recordCount: 47
 */
router.get('/summary', authorize([Role.ANALYST, Role.ADMIN]), summary);

/**
 * @openapi
 * /dashboard/trends:
 *   get:
 *     tags: [Dashboard]
 *     summary: Income vs. expense trends (monthly or weekly)
 *     description: >
 *       Returns per-period totals for income and expenses.
 *       Uses DATE_TRUNC via raw SQL for time-bucketing.
 *       Monthly keys are formatted as "YYYY-MM"; weekly keys as "YYYY-Www" (ISO week).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [monthly, weekly]
 *           default: monthly
 *         description: Aggregation period — monthly (default) or weekly
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Trend data grouped by period
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - period: "2024-01"
 *                   income: "15000.0000"
 *                   expense: "9500.0000"
 *                   incomeCount: 5
 *                   expenseCount: 8
 */
router.get('/trends', authorize([Role.ANALYST, Role.ADMIN]), trends);

/**
 * @openapi
 * /dashboard/categories:
 *   get:
 *     tags: [Dashboard]
 *     summary: Category-wise totals
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [INCOME, EXPENSE]
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Category breakdown
 */
router.get('/categories', authorize([Role.ANALYST, Role.ADMIN]), categories);

/**
 * @openapi
 * /dashboard/recent:
 *   get:
 *     tags: [Dashboard]
 *     summary: Recent transactions (all roles)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Recent financial records
 */
router.get('/recent', recent);

export default router;
