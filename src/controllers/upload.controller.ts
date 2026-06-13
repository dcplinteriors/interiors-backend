import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authOf } from '../utils/requestAuth';
import { AppError } from '../utils/AppError';
import { isAttachmentPath, isOwnAttachmentPath } from '../utils/attachmentPath';
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
      });
      res.status(200).json(result);
    }),

    /** Resolves a stored attachment path to a short-lived signed read URL. */
    downloadUrl: asyncHandler(async (req: Request, res: Response) => {
      const { path } = signDownloadSchema.parse(req.body);
      // Only ever sign attachment object keys — never an arbitrary bucket object.
      if (!isAttachmentPath(path)) {
        throw new AppError(400, 'Invalid attachment path');
      }
      const auth = authOf(req);
      // Admins may read any attachment; supervisors only their own (paths are uid-scoped).
      if (auth.role !== 'admin' && !isOwnAttachmentPath(path, auth.uid)) {
        throw new AppError(403, 'Forbidden');
      }
      const url = await service.signDownload(path);
      res.status(200).json({ url });
    }),
  };
}
