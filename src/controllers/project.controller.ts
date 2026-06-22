import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authOf } from '../utils/requestAuth';
import { ProjectService } from '../services/project/projectService';
import { createProjectSchema, listProjectsQuerySchema } from '../schemas/project.schema';

export function buildProjectController(service: ProjectService) {
  return {
    create: asyncHandler(async (req: Request, res: Response) => {
      const body = createProjectSchema.parse(req.body);
      const project = await service.create({ ...body, createdBy: authOf(req).uid });
      res.status(201).json(project);
    }),

    list: asyncHandler(async (req: Request, res: Response) => {
      const query = listProjectsQuerySchema.parse(req.query);
      res.status(200).json(await service.list(query));
    }),

    get: asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json(await service.getForUser(req.params.id, authOf(req)));
    }),

    complete: asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json(await service.complete(req.params.id));
    }),
  };
}
