import { Router } from 'express';
import { Container } from '../container';
import healthRoutes from './health.routes';
import { buildMeRoutes } from './me.routes';
import { buildSupervisorRoutes } from './supervisor.routes';
import { buildProjectRoutes } from './project.routes';
import { buildMaterialRequestRoutes } from './materialRequest.routes';
import { buildUploadRoutes } from './upload.routes';

/**
 * Builds the API router from the container. Feature routers mount here and receive
 * whatever services they need from `container`.
 */
export function buildRoutes(container: Container): Router {
  const router = Router();

  router.use('/health', healthRoutes);
  router.use('/me', buildMeRoutes(container));
  router.use('/supervisors', buildSupervisorRoutes(container));
  router.use('/projects', buildProjectRoutes(container));
  router.use('/material-requests', buildMaterialRequestRoutes(container));
  router.use('/uploads', buildUploadRoutes(container));

  return router;
}
