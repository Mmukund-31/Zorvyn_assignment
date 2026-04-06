import { Request, Response } from 'express';
import { registerUser, loginUser, getMe } from './auth.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerUser(req.body);
  res.status(201).json({
    success: true,
    message: 'Account created successfully.',
    data: result,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await loginUser(req.body);
  res.status(200).json({
    success: true,
    message: 'Login successful.',
    data: result,
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await getMe(req.user!.id);
  res.status(200).json({
    success: true,
    message: 'User profile retrieved.',
    data: { user },
  });
});
