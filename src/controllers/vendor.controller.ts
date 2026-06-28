import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authOf } from '../utils/requestAuth';
import { VendorService } from '../services/vendor/vendorService';
import {
  createVendorSchema,
  listVendorsQuerySchema,
  updateVendorSchema,
} from '../schemas/vendor.schema';

export function buildVendorController(service: VendorService) {
  return {
    create: asyncHandler(async (req: Request, res: Response) => {
      const body = createVendorSchema.parse(req.body);
      const vendor = await service.create({ ...body, createdBy: authOf(req).uid });
      res.status(201).json(vendor);
    }),

    list: asyncHandler(async (req: Request, res: Response) => {
      const query = listVendorsQuerySchema.parse(req.query);
      res.status(200).json(await service.list(query));
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
      const patch = updateVendorSchema.parse(req.body);
      res.status(200).json(await service.update(req.params.id, patch));
    }),
  };
}
