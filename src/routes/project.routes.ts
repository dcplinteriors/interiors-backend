import { Router } from 'express';
import { Container } from '../container';
import { authenticate, requireRole } from '../middlewares/auth';
import { buildProjectController } from '../controllers/project.controller';
import { buildWorkOrderController } from '../controllers/workOrder.controller';

export function buildProjectRoutes(container: Container): Router {
  const controller = buildProjectController(container.projectService);
  const workOrders = buildWorkOrderController(container.workOrderService);
  const router = Router();

  router.use(authenticate(container.tokenVerifier));

  router.post('/', requireRole('admin'), controller.create);
  router.get('/', requireRole('admin'), controller.list);
  router.get('/:id', controller.get); // role-scoped inside the service
  router.post('/:id/complete', requireRole('admin'), controller.complete);
  router.post('/:id/work-orders', requireRole('admin'), workOrders.create);

  return router;
}
