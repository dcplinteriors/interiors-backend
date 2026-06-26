import { randomUUID } from 'node:crypto';
import { getBucket } from '../../config/firebase';
import { AppError } from '../../utils/AppError';
import { TMP_PREFIX } from '../../utils/attachmentPath';

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
  /**
   * Promotes a freshly-uploaded object out of the staging prefix to its permanent key, returning
   * that key. Called when a saved request/profile commits to an upload — so anything NOT finalized
   * stays in staging and is swept by the bucket lifecycle rule. No-op (returns the path unchanged)
   * for an already-permanent key, so it's safe to call idempotently.
   */
  finalizeUpload(path: string): Promise<string>;
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
    // Organized + scalable: partition by supervisor; UUID filenames avoid collisions and keep
    // paths unguessable. Lands in the staging prefix — finalizeUpload moves it to its permanent
    // key (`<prefix>/<uid>/...`) once a request/profile references it; otherwise the lifecycle
    // rule sweeps it.
    const prefix = scope === 'profile' ? 'profiles' : 'material-requests';
    const path = `${TMP_PREFIX}${prefix}/${supervisorUid}/${randomUUID()}.${ext}`;
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

  async finalizeUpload(path: string): Promise<string> {
    if (!path.startsWith(TMP_PREFIX)) return path; // already permanent — nothing to move
    const dest = path.slice(TMP_PREFIX.length);
    const bucket = getBucket();
    try {
      // move = server-side copy + delete of the source; cheap for our small files.
      await bucket.file(path).move(dest);
    } catch {
      // Source gone. If the permanent object already exists, a prior call (e.g. a retried
      // submit) already moved it — treat as success (idempotent). Otherwise the upload never
      // landed, or has expired / been swept.
      const [committed] = await bucket.file(dest).exists();
      if (!committed) throw new AppError(400, 'Attachment upload not found or expired');
    }
    return dest;
  }
}
