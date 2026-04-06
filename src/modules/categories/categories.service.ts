import { prisma } from '../../lib/prisma';
import { CreateCategoryInput } from './categories.schema';

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
}

export async function createCategory(input: CreateCategoryInput) {
  return prisma.category.create({ data: input });
}
