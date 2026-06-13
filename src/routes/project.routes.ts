import { Router } from 'express';
import { Container } from '../container';
import { authenticate, requireRole } from '../middlewares/auth';
import { buildProjectController } from '../controllers/project.controller';

export function buildProjectRoutes(container: Container): Router {
  const controller = buildProjectController(container.projectService);
  const router = Router();

  router.use(authenticate(container.tokenVerifier));

  router.post('/', requireRole('admin'), controller.create);
  router.get('/', controller.list); // role-scoped inside the service
  router.get('/:id', controller.get);
  router.post('/:id/assign', requireRole('admin'), controller.assign);

  return router;
}
