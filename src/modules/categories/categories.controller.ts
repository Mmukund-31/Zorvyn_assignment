import { Request, Response } from 'express';
import { listCategories, createCategory } from './categories.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await listCategories();
  res.status(200).json({
    success: true,
    message: 'Categories retrieved.',
    data: { categories },
  });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const category = await createCategory(req.body);
  res.status(201).json({
    success: true,
    message: 'Category created.',
    data: { category },
  });
});
