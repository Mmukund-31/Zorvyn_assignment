import { Router } from 'express';
import { list, getOne, create, update, remove } from './records.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import {
  createRecordSchema,
  updateRecordSchema,
  listRecordsQuerySchema,
} from './records.schema';
import { Role } from '@prisma/client';

const router = Router();

// All records routes require authentication
router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Records
 *     description: Financial record management (transactions/entries)
 */

/**
 * @openapi
 * /records:
 *   get:
 *     tags: [Records]
 *     summary: List financial records
 *     description: |
 *       Returns a paginated list of financial records.
 *       - VIEWER and ADMIN see all records (ADMIN can also filter by createdById)
 *       - ANALYST sees only records they created
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [INCOME, EXPENSE]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-12-31"
 *       - in: query
 *         name: createdById
 *         description: Admin only — filter by creator user ID
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         description: Case-insensitive keyword search across title and description
 *         schema:
 *           type: string
 *           example: "salary"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [date, amount, createdAt]
 *           default: date
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Paginated list of records
 */
router.get('/', validate(listRecordsQuerySchema, 'query'), list);

/**
 * @openapi
 * /records/{id}:
 *   get:
 *     tags: [Records]
 *     summary: Get a single financial record
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Record details
 *       404:
 *         description: Record not found
 */
router.get('/:id', getOne);

/**
 * @openapi
 * /records:
 *   post:
 *     tags: [Records]
 *     summary: Create a financial record (Analyst, Admin)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, amount, type, categoryId, date]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Office supplies purchase
 *               description:
 *                 type: string
 *                 example: Purchased notebooks and pens
 *               amount:
 *                 type: number
 *                 example: 150.75
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *               categoryId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2024-03-15"
 *     responses:
 *       201:
 *         description: Record created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Viewer role cannot create records
 */
router.post(
  '/',
  authorize([Role.ADMIN, Role.ANALYST]),
  validate(createRecordSchema),
  create
);

/**
 * @openapi
 * /records/{id}:
 *   patch:
 *     tags: [Records]
 *     summary: Update a financial record (Analyst, Admin)
 *     description: Analysts can only update records they created. Admins can update any record.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *               categoryId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Record updated
 *       404:
 *         description: Record not found
 */
router.patch(
  '/:id',
  authorize([Role.ADMIN, Role.ANALYST]),
  validate(updateRecordSchema),
  update
);

/**
 * @openapi
 * /records/{id}:
 *   delete:
 *     tags: [Records]
 *     summary: Soft-delete a financial record (Admin only)
 *     description: Records are never hard-deleted. The deletedAt timestamp is set for audit trail purposes.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Record deleted
 *       403:
 *         description: Only admins can delete records
 *       404:
 *         description: Record not found
 */
router.delete('/:id', authorize([Role.ADMIN]), remove);

export default router;
