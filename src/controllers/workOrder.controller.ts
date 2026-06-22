import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authOf } from '../utils/requestAuth';
import { WorkOrderService } from '../services/workOrder/workOrderService';
import {
  assignWorkOrderSchema,
  createWorkOrderSchema,
  listWorkOrderQuerySchema,
} from '../schemas/workOrder.schema';

export function buildWorkOrderController(service: WorkOrderService) {
  return {
    list: asyncHandler(async (req: Request, res: Response) => {
      const query = listWorkOrderQuerySchema.parse(req.query);
      res.status(200).json(await service.listForUser(authOf(req), query));
    }),

    get: asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json(await service.getForUser(req.params.id, authOf(req)));
    }),

    // POST /projects/:id/work-orders — add a work order to an existing project.
    create: asyncHandler(async (req: Request, res: Response) => {
      const body = createWorkOrderSchema.parse(req.body);
      const workOrder = await service.addToProject(req.params.id, {
        ...body,
        createdBy: authOf(req).uid,
      });
      res.status(201).json(workOrder);
    }),

    assign: asyncHandler(async (req: Request, res: Response) => {
      const { supervisorId } = assignWorkOrderSchema.parse(req.body);
      res.status(200).json(await service.assign(req.params.id, supervisorId));
    }),

    unassign: asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json(await service.unassign(req.params.id));
    }),

    complete: asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json(await service.complete(req.params.id));
    }),

    cancel: asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json(await service.cancel(req.params.id));
    }),
  };
}
