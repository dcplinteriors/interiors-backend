import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authOf } from '../utils/requestAuth';
import { MaterialRequestService } from '../services/materialRequest/materialRequestService';
import {
  acceptMaterialRequestSchema,
  assignVendorSchema,
  closeMaterialRequestSchema,
  countMaterialRequestQuerySchema,
  declineMaterialRequestSchema,
  editMaterialRequestSchema,
  listMaterialRequestQuerySchema,
  submitMaterialRequestSchema,
} from '../schemas/materialRequest.schema';

export function buildMaterialRequestController(service: MaterialRequestService) {
  return {
    submit: asyncHandler(async (req: Request, res: Response) => {
      const body = submitMaterialRequestSchema.parse(req.body);
      const created = await service.submit({
        workOrderId: body.workOrderId,
        supervisorUid: authOf(req).uid,
        items: body.items,
      });
      res.status(201).json(created);
    }),

    list: asyncHandler(async (req: Request, res: Response) => {
      const query = listMaterialRequestQuerySchema.parse(req.query);
      res.status(200).json(await service.listForUser(authOf(req), query));
    }),

    count: asyncHandler(async (req: Request, res: Response) => {
      const filter = countMaterialRequestQuerySchema.parse(req.query);
      res.status(200).json({ count: await service.countForUser(authOf(req), filter) });
    }),

    accept: asyncHandler(async (req: Request, res: Response) => {
      const { remarks } = acceptMaterialRequestSchema.parse(req.body);
      res.status(200).json(await service.accept(req.params.id, remarks));
    }),

    assignVendor: asyncHandler(async (req: Request, res: Response) => {
      const body = assignVendorSchema.parse(req.body);
      res.status(200).json(await service.assignVendor(req.params.id, body));
    }),

    decline: asyncHandler(async (req: Request, res: Response) => {
      const { remarks } = declineMaterialRequestSchema.parse(req.body);
      res.status(200).json(await service.decline(req.params.id, remarks));
    }),

    editItem: asyncHandler(async (req: Request, res: Response) => {
      const patch = editMaterialRequestSchema.parse(req.body);
      res.status(200).json(await service.editItem(req.params.id, patch));
    }),

    cancel: asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json(await service.cancel(req.params.id, authOf(req).uid));
    }),

    close: asyncHandler(async (req: Request, res: Response) => {
      const input = closeMaterialRequestSchema.parse(req.body);
      res.status(200).json(await service.close(req.params.id, authOf(req).uid, input));
    }),
  };
}
