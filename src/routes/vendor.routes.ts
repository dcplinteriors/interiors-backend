import { Router } from 'express';
import { Container } from '../container';
import { authenticate, requireRole } from '../middlewares/auth';
import { buildVendorController } from '../controllers/vendor.controller';

/** Admin-only vendor management (a supplier directory; no login). */
export function buildVendorRoutes(container: Container): Router {
  const controller = buildVendorController(container.vendorService);
  const router = Router();

  router.use(authenticate(container.tokenVerifier), requireRole('admin'));
  router.post('/', controller.create);
  router.get('/', controller.list);
  router.patch('/:id', controller.update); // edit / deactivate / reactivate

  return router;
}
