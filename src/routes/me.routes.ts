import { Router } from 'express';
import { Container } from '../container';
import { authenticate, requireRole } from '../middlewares/auth';
import { buildMeController } from '../controllers/me.controller';

export function buildMeRoutes(container: Container): Router {
  const controller = buildMeController(container.userRepository, container.storageService);
  const router = Router();

  router.use(authenticate(container.tokenVerifier));

  router.get('/', controller.get);
  router.patch('/', requireRole('supervisor'), controller.update); // supervisor edits own profile

  return router;
}
