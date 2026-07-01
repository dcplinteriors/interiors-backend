import { Router } from 'express';
import { Container } from '../container';
import { authenticate, requireRole } from '../middlewares/auth';
import { buildSupervisorController } from '../controllers/supervisor.controller';

/** Admin-only supervisor management. */
export function buildSupervisorRoutes(container: Container): Router {
  const controller = buildSupervisorController(container.supervisorService);
  const router = Router();

  router.use(authenticate(container.tokenVerifier), requireRole('admin'));
  router.post('/', controller.create);
  router.post('/:id/reset-password', controller.resetPassword);
  router.get('/', controller.list);

  return router;
}
