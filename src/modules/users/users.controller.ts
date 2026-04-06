import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  listUsers,
  getUserById,
  updateUserRole,
  setUserStatus,
  softDeleteUser,
} from './users.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listUsers(req.query as never);
  res.status(200).json({ success: true, message: 'Users retrieved.', ...result });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserById(req.params['id'] as string);
  res.status(200).json({ success: true, message: 'User retrieved.', data: { user } });
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateUserRole(req.params['id'] as string, req.body, req.user!.id);
  res.status(200).json({ success: true, message: 'User role updated.', data: { user } });
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const isActive = req.body.isActive as boolean;
  const user = await setUserStatus(req.params['id'] as string, isActive, req.user!.id);
  res.status(200).json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'}.`,
    data: { user },
  });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await softDeleteUser(req.params['id'] as string, req.user!.id);
  res.status(200).json({ success: true, message: 'User deleted.', data: null });
});
