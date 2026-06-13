import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authOf } from '../utils/requestAuth';
import { ProjectService } from '../services/project/projectService';
import {
  assignSupervisorSchema,
  createProjectSchema,
  listProjectsQuerySchema,
} from '../schemas/project.schema';

export function buildProjectController(service: ProjectService) {
  return {
    create: asyncHandler(async (req: Request, res: Response) => {
      const body = createProjectSchema.parse(req.body);
      const project = await service.create({ ...body, createdBy: authOf(req).uid });
      res.status(201).json(project);
    }),

    list: asyncHandler(async (req: Request, res: Response) => {
      const query = listProjectsQuerySchema.parse(req.query);
      res.status(200).json(await service.listForUser(authOf(req), query));
    }),

    get: asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json(await service.getForUser(req.params.id, authOf(req)));
    }),

    assign: asyncHandler(async (req: Request, res: Response) => {
      const { supervisorId } = assignSupervisorSchema.parse(req.body);
      const project = await service.assignSupervisor(req.params.id, supervisorId);
      res.status(200).json(project);
    }),
  };
}
