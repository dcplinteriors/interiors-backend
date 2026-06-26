import { Router } from 'express';
import { Container } from '../container';
import { authenticate, requireRole } from '../middlewares/auth';
import { buildMaterialRequestController } from '../controllers/materialRequest.controller';

export function buildMaterialRequestRoutes(container: Container): Router {
  const controller = buildMaterialRequestController(container.materialRequestService);
  const router = Router();

  router.use(authenticate(container.tokenVerifier));

  router.post('/', requireRole('supervisor'), controller.submit); // body: { workOrderId, items }
  router.get('/', controller.list); // role-scoped inside the service
  router.get('/count', controller.count); // role-scoped; e.g. ?status=requested for the badge

  // Admin transitions
  router.post('/:id/accept', requireRole('admin'), controller.accept); // requested → processing
  router.post('/:id/assign-vendor', requireRole('admin'), controller.assignVendor); // processing → accepted
  router.post('/:id/decline', requireRole('admin'), controller.decline);
  router.patch('/:id', requireRole('admin'), controller.editItem); // fix item details (pre-vendor)

  // Supervisor transitions
  router.post('/:id/cancel', requireRole('supervisor'), controller.cancel); // requested → cancelled
  router.post('/:id/close', requireRole('supervisor'), controller.close); // accepted → closed

  return router;
}
