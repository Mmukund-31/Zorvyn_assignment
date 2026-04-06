import { z } from 'zod';
import { Role } from '@prisma/client';

export const updateRoleSchema = z.object({
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Role must be VIEWER, ANALYST, or ADMIN' }),
  }),
});

export const listUsersQuerySchema = z.object({
  role: z.nativeEnum(Role).optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
