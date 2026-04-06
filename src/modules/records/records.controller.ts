import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} from './records.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listRecords(req.query as never, req.user!);
  res.status(200).json({
    success: true,
    message: 'Records retrieved.',
    ...result,
  });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const record = await getRecord(req.params['id'] as string, req.user!);
  res.status(200).json({
    success: true,
    message: 'Record retrieved.',
    data: { record },
  });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const record = await createRecord(req.body, req.user!);
  res.status(201).json({
    success: true,
    message: 'Record created.',
    data: { record },
  });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const record = await updateRecord(req.params['id'] as string, req.body, req.user!);
  res.status(200).json({
    success: true,
    message: 'Record updated.',
    data: { record },
  });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteRecord(req.params['id'] as string, req.user!);
  res.status(200).json({
    success: true,
    message: 'Record deleted.',
    data: null,
  });
});
