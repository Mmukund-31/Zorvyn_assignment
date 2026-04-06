import { z } from 'zod';
import { RecordType } from '@prisma/client';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.nativeEnum(RecordType, {
    errorMap: () => ({ message: 'Type must be INCOME or EXPENSE' }),
  }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
