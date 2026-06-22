import { z } from 'zod';
import { nonEmptyString } from './common';

export const signUploadSchema = z.object({
  kind: z.enum(['photo', 'audio']),
  contentType: nonEmptyString,
  // Omitted → a material-request attachment; `profile` → a supervisor profile image (photo only).
  scope: z.enum(['attachment', 'profile']).optional(),
});

export const signDownloadSchema = z.object({
  path: nonEmptyString,
});
