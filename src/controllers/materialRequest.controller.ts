import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authOf } from '../utils/requestAuth';
import { MaterialRequestService } from '../services/materialRequest/materialRequestService';
import {
  acceptMaterialRequestSchema,
  declineMaterialRequestSchema,
  listMaterialRequestQuerySchema,
  submitMaterialRequestSchema,
} from '../schemas/materialRequest.schema';

export function buildMaterialRequestController(service: MaterialRequestService) {
  return {
    submit: asyncHandler(async (req: Request, res: Response) => {
      const body = submitMaterialRequestSchema.parse(req.body);
      const created = await service.submit({
        projectId: body.projectId,
        supervisorUid: authOf(req).uid,
        items: body.items,
      });
      res.status(201).json(created);
    }),

    list: asyncHandler(async (req: Request, res: Response) => {
      const query = listMaterialRequestQuerySchema.parse(req.query);
      res.status(200).json(await service.listForUser(authOf(req), query));
    }),

    accept: asyncHandler(async (req: Request, res: Response) => {
      const body = acceptMaterialRequestSchema.parse(req.body);
      res.status(200).json(await service.accept(req.params.id, body));
    }),

    decline: asyncHandler(async (req: Request, res: Response) => {
      const body = declineMaterialRequestSchema.parse(req.body);
      res.status(200).json(await service.decline(req.params.id, body));
    }),

    cancel: asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json(await service.cancel(req.params.id, authOf(req).uid));
    }),
  };
}
