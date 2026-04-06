import { Router } from 'express';
import { list, create } from './categories.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { createCategorySchema } from './categories.schema';
import { Role } from '@prisma/client';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Categories
 *     description: Reference data for financial record classification
 */

/**
 * @openapi
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: List all categories
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get('/', authenticate, list);

/**
 * @openapi
 * /categories:
 *   post:
 *     tags: [Categories]
 *     summary: Create a new category (Admin only)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Salaries
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *     responses:
 *       201:
 *         description: Category created
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', authenticate, authorize([Role.ADMIN]), validate(createCategorySchema), create);

export default router;
