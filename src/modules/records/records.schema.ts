import { z } from 'zod';
import { RecordType } from '@prisma/client';

export const createRecordSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than zero')
    .max(999_999_999_999, 'Amount is too large')
    // multipleOf(0.0001) enforces at most 4 decimal places cleanly without
    // relying on toString() which can produce scientific notation for edge values
    .multipleOf(0.0001, 'Amount must have at most 4 decimal places'),
  type: z.nativeEnum(RecordType, {
    errorMap: () => ({ message: 'Type must be INCOME or EXPENSE' }),
  }),
  categoryId: z.string().min(1, 'Category is required'),
  date: z.coerce.date({ invalid_type_error: 'Date must be a valid date' }),
});

export const updateRecordSchema = createRecordSchema.partial();

export const listRecordsQuerySchema = z.object({
  type: z.nativeEnum(RecordType).optional(),
  categoryId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  createdById: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['date', 'amount', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;
