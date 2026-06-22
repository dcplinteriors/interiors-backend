import { Router } from 'express';
import { Container } from '../container';
import { authenticate, requireRole } from '../middlewares/auth';
import { buildWorkOrderController } from '../controllers/workOrder.controller';

export function buildWorkOrderRoutes(container: Container): Router {
  const controller = buildWorkOrderController(container.workOrderService);
  const router = Router();

  router.use(authenticate(container.tokenVerifier));

  router.get('/', controller.list); // role-scoped inside the service
  router.get('/:id', controller.get);
  router.post('/:id/assign', requireRole('admin'), controller.assign);
  router.post('/:id/unassign', requireRole('admin'), controller.unassign);
  router.post('/:id/complete', requireRole('admin'), controller.complete);
  router.post('/:id/cancel', requireRole('admin'), controller.cancel);

  return router;
}
