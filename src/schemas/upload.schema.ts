import { z } from 'zod';
import { nonEmptyString } from './common';

export const signUploadSchema = z.object({
  kind: z.enum(['photo', 'audio']),
  contentType: nonEmptyString,
});

export const signDownloadSchema = z.object({
  path: nonEmptyString,
});
