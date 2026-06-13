import { Router } from 'express';
import { Container } from '../container';
import { authenticate, requireRole } from '../middlewares/auth';
import { buildMaterialRequestController } from '../controllers/materialRequest.controller';

export function buildMaterialRequestRoutes(container: Container): Router {
  const controller = buildMaterialRequestController(container.materialRequestService);
  const router = Router();

  router.use(authenticate(container.tokenVerifier));

  router.post('/', requireRole('supervisor'), controller.submit); // body: { projectId, items }
  router.get('/', controller.list); // role-scoped inside the service
  router.post('/:id/accept', requireRole('admin'), controller.accept);
  router.post('/:id/decline', requireRole('admin'), controller.decline);
  router.post('/:id/cancel', requireRole('supervisor'), controller.cancel);

  return router;
}
