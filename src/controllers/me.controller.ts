import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { authOf } from '../utils/requestAuth';
import { isOwnProfilePath } from '../utils/attachmentPath';
import { AuthUser } from '../types/auth';
import { UserRecord } from '../models/user';
import { UserRepository } from '../repositories/userRepository';
import { updateMeSchema } from '../schemas/me.schema';

/** The caller's profile: identity from the verified token + name/photo from the user record. */
function profile(auth: AuthUser, record: UserRecord | null) {
  return {
    uid: auth.uid,
    email: auth.email,
    role: auth.role,
    name: record?.name ?? null,
    photoUrl: record?.photoUrl ?? null,
  };
}

export function buildMeController(userRepository: UserRepository) {
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
      // A non-null photoUrl must be the caller's own uploaded profile image (issued by
      // /uploads/sign with scope=profile) — same own-path rule as attachments.
      if (patch.photoUrl != null && !isOwnProfilePath(patch.photoUrl, auth.uid)) {
        throw new AppError(400, 'photoUrl must be your own uploaded profile image');
      }
      const record = await userRepository.update(auth.uid, patch);
      if (!record) throw new AppError(404, 'User not found');
      res.status(200).json(profile(auth, record));
    }),
  };
}
