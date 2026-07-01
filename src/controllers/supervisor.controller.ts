import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authOf } from '../utils/requestAuth';
import { SupervisorService } from '../services/supervisor/supervisorService';
import {
  createSupervisorSchema,
  listSupervisorsQuerySchema,
} from '../schemas/supervisor.schema';

export function buildSupervisorController(service: SupervisorService) {
  return {
    create: asyncHandler(async (req: Request, res: Response) => {
      const body = createSupervisorSchema.parse(req.body);
      const record = await service.create({ ...body, createdBy: authOf(req).uid });
      res.status(201).json(record);
    }),

    resetPassword: asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json(await service.resetPassword(req.params.id));
    }),

    list: asyncHandler(async (req: Request, res: Response) => {
      const query = listSupervisorsQuerySchema.parse(req.query);
      res.status(200).json(await service.list(query));
    }),
  };
}
