import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authOf } from '../utils/requestAuth';
import { AppError } from '../utils/AppError';
import {
  isAttachmentPath,
  isOwnAttachmentPath,
  isOwnProfilePath,
  isProfilePath,
} from '../utils/attachmentPath';
import { StorageService } from '../services/storage/storageService';
import { signDownloadSchema, signUploadSchema } from '../schemas/upload.schema';

export function buildUploadController(service: StorageService) {
  return {
    /** Supervisor requests a signed URL to upload one attachment, then PUTs the bytes to it. */
    sign: asyncHandler(async (req: Request, res: Response) => {
      const body = signUploadSchema.parse(req.body);
      const result = await service.signUpload({
        supervisorUid: authOf(req).uid,
        kind: body.kind,
        contentType: body.contentType,
        scope: body.scope,
      });
      res.status(200).json(result);
    }),

    /** Resolves a stored attachment path to a short-lived signed read URL. */
    downloadUrl: asyncHandler(async (req: Request, res: Response) => {
      const { path } = signDownloadSchema.parse(req.body);
      // Only ever sign known object keys (attachments or profile images) — never an arbitrary
      // bucket object.
      if (!isAttachmentPath(path) && !isProfilePath(path)) {
        throw new AppError(400, 'Invalid storage path');
      }
      const auth = authOf(req);
      // Admins may read any; supervisors only their own (paths are uid-scoped).
      const ownsIt = isOwnAttachmentPath(path, auth.uid) || isOwnProfilePath(path, auth.uid);
      if (auth.role !== 'admin' && !ownsIt) {
        throw new AppError(403, 'Forbidden');
      }
      const url = await service.signDownload(path);
      res.status(200).json({ url });
    }),
  };
}
