import { randomUUID } from 'node:crypto';
import { getBucket } from '../../config/firebase';
import { AppError } from '../../utils/AppError';

export type AttachmentKind = 'photo' | 'audio';
/** Where an uploaded object lives: a material-request attachment, or a supervisor profile image. */
export type UploadScope = 'attachment' | 'profile';

const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

const AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
};

/** File extension for a (kind, contentType) pair, or null if the type isn't allowed. */
export function extensionFor(kind: AttachmentKind, contentType: string): string | null {
  const map = kind === 'photo' ? PHOTO_TYPES : AUDIO_TYPES;
  return map[contentType.toLowerCase()] ?? null;
}

export interface SignUploadInput {
  supervisorUid: string;
  kind: AttachmentKind;
  contentType: string;
  /** `attachment` (default) → material-request file; `profile` → a profile image (photo only). */
  scope?: UploadScope;
}

export interface SignedUpload {
  /** Short-lived signed URL the client PUTs the file bytes to. */
  uploadUrl: string;
  /** The object path to persist (a request attachment, or the user's `photoUrl`). */
  path: string;
}

/**
 * Issues short-lived signed URLs so clients upload/read attachments WITHOUT direct Storage
 * SDK access — the backend stays the single trusted boundary (same model as Firestore).
 */
export interface StorageService {
  signUpload(input: SignUploadInput): Promise<SignedUpload>;
  signDownload(path: string): Promise<string>;
}

const UPLOAD_TTL_MS = 15 * 60 * 1000; // 15 min — enough to upload, short enough to be safe
const DOWNLOAD_TTL_MS = 60 * 60 * 1000; // 1 hour

export class FirebaseStorageService implements StorageService {
  async signUpload({
    supervisorUid,
    kind,
    contentType,
    scope = 'attachment',
  }: SignUploadInput): Promise<SignedUpload> {
    if (scope === 'profile' && kind !== 'photo') {
      throw new AppError(400, 'A profile image must be a photo');
    }
    const ext = extensionFor(kind, contentType);
    if (!ext) {
      throw new AppError(400, `Unsupported ${kind} content type: ${contentType}`);
    }
    // Organized + scalable: partition by supervisor; UUID filenames avoid collisions and
    // keep paths unguessable. Stored (on a request, or as the user's photoUrl) and resolved to a
    // read URL on demand.
    const prefix = scope === 'profile' ? 'profiles' : 'material-requests';
    const path = `${prefix}/${supervisorUid}/${randomUUID()}.${ext}`;
    const [uploadUrl] = await getBucket().file(path).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + UPLOAD_TTL_MS,
      contentType,
    });
    return { uploadUrl, path };
  }

  async signDownload(path: string): Promise<string> {
    const [url] = await getBucket().file(path).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + DOWNLOAD_TTL_MS,
    });
    return url;
  }
}
