import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { authOf } from '../utils/requestAuth';
import { isOwnStagedProfilePath } from '../utils/attachmentPath';
import { AuthUser } from '../types/auth';
import { UserRecord } from '../models/user';
import { UserRepository } from '../repositories/userRepository';
import { StorageService } from '../services/storage/storageService';
import { updateMeSchema } from '../schemas/me.schema';

/** The caller's profile: identity from the verified token + name/photo from the user record. */
function profile(auth: AuthUser, record: UserRecord | null) {
  return {
    uid: auth.uid,
    email: auth.email,
    role: auth.role,
    name: record?.name ?? null,
    phone: record?.phone ?? null,
    photoUrl: record?.photoUrl ?? null,
    // Drives the supervisor app's "set a new password" gate after a temp-password sign-in.
    mustChangePassword: record?.mustChangePassword ?? false,
  };
}

export function buildMeController(userRepository: UserRepository, storageService: StorageService) {
  return {
    get: asyncHandler(async (req: Request, res: Response) => {
      const auth = authOf(req);
      const record = await userRepository.findByUid(auth.uid);
      res.status(200).json(profile(auth, record));
    }),

    // Supervisor-only (route-gated): edit own display name + profile image.
    update: asyncHandler(async (req: Request, res: Response) => {
      const auth = authOf(req);
      const patch = updateMeSchema.parse(req.body);
      // A non-null photoUrl must be the caller's own freshly-uploaded (staged) profile image
      // (issued by /uploads/sign with scope=profile) — same own-path rule as attachments.
      if (patch.photoUrl != null && !isOwnStagedProfilePath(patch.photoUrl, auth.uid)) {
        throw new AppError(400, 'photoUrl must be your own uploaded profile image');
      }
      // Commit a new photo out of staging to its permanent key; null (clear) / undefined
      // (unchanged) pass through untouched.
      const photoUrl =
        patch.photoUrl == null ? patch.photoUrl : await storageService.finalizeUpload(patch.photoUrl);
      const record = await userRepository.update(auth.uid, { ...patch, photoUrl });
      if (!record) throw new AppError(404, 'User not found');
      res.status(200).json(profile(auth, record));
    }),

    // Any authenticated user: clear the flag once they've set their own password.
    passwordChanged: asyncHandler(async (req: Request, res: Response) => {
      const auth = authOf(req);
      const record = await userRepository.update(auth.uid, { mustChangePassword: false });
      if (!record) throw new AppError(404, 'User not found');
      res.status(200).json(profile(auth, record));
    }),
  };
}
