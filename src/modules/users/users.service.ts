import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { buildPaginatedResponse, getPaginationSkip } from '../../lib/pagination';
import { UpdateRoleInput, ListUsersQuery } from './users.schema';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export async function listUsers(query: ListUsersQuery) {
  const where: Prisma.UserWhereInput = { deletedAt: null };

  if (query.role) where.role = query.role;
  if (query.isActive !== undefined) where.isActive = query.isActive;

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      skip: getPaginationSkip(query.page, query.limit),
      take: query.limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return buildPaginatedResponse(users, total, {
    page: query.page,
    limit: query.limit,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: USER_SELECT,
  });

  if (!user) throw new AppError('User not found.', 404);
  return user;
}

export async function updateUserRole(id: string, input: UpdateRoleInput, requestingUserId: string) {
  if (id === requestingUserId) {
    throw new AppError('You cannot change your own role.', 400);
  }

  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new AppError('User not found.', 404);

  return prisma.user.update({
    where: { id },
    data: { role: input.role as Role },
    select: USER_SELECT,
  });
}

export async function setUserStatus(id: string, isActive: boolean, requestingUserId: string) {
  if (id === requestingUserId) {
    throw new AppError('You cannot change your own account status.', 400);
  }

  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new AppError('User not found.', 404);

  return prisma.user.update({
    where: { id },
    data: { isActive },
    select: USER_SELECT,
  });
}

export async function softDeleteUser(id: string, requestingUserId: string) {
  if (id === requestingUserId) {
    throw new AppError('You cannot delete your own account.', 400);
  }

  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new AppError('User not found.', 404);

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}
