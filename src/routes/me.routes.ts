import { Router } from 'express';
import { Container } from '../container';
import { authenticate } from '../middlewares/auth';
import { meController } from '../controllers/me.controller';

export function buildMeRoutes(container: Container): Router {
  const router = Router();
  router.get('/', authenticate(container.tokenVerifier), meController);
  return router;
}
