import { Router } from 'express';
import { Container } from '../container';
import { authenticate, requireRole } from '../middlewares/auth';
import { buildUploadController } from '../controllers/upload.controller';

export function buildUploadRoutes(container: Container): Router {
  const controller = buildUploadController(container.storageService);
  const router = Router();

  router.use(authenticate(container.tokenVerifier));

  router.post('/sign', requireRole('supervisor'), controller.sign); // body: { kind, contentType, scope? }
  router.post('/download-url', controller.downloadUrl); // body: { path } — role-scoped inside

  return router;
}
