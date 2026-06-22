import {
  extensionFor,
  FirebaseStorageService,
} from '../../src/services/storage/storageService';
import { AppError } from '../../src/utils/AppError';

describe('extensionFor', () => {
  it('maps supported photo types', () => {
    expect(extensionFor('photo', 'image/jpeg')).toBe('jpg');
    expect(extensionFor('photo', 'image/png')).toBe('png');
    expect(extensionFor('photo', 'image/webp')).toBe('webp');
    expect(extensionFor('photo', 'IMAGE/JPEG')).toBe('jpg'); // case-insensitive
  });

  it('maps supported audio types', () => {
    expect(extensionFor('audio', 'audio/mpeg')).toBe('mp3');
    expect(extensionFor('audio', 'audio/mp4')).toBe('m4a');
    expect(extensionFor('audio', 'audio/wav')).toBe('wav');
  });

  it('returns null for unsupported or cross-kind types', () => {
    expect(extensionFor('photo', 'application/pdf')).toBeNull();
    expect(extensionFor('photo', 'audio/mpeg')).toBeNull(); // audio type under photo
    expect(extensionFor('audio', 'image/png')).toBeNull();
  });
});

describe('FirebaseStorageService.signUpload', () => {
  it('rejects an unsupported content type before touching Storage', async () => {
    // The type check runs before any bucket access, so this is safe without credentials.
    const service = new FirebaseStorageService();
    await expect(
      service.signUpload({ supervisorUid: 'sup1', kind: 'photo', contentType: 'application/pdf' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.signUpload({ supervisorUid: 'sup1', kind: 'photo', contentType: 'application/pdf' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a profile-scope upload that is not a photo (400, before Storage)', async () => {
    const service = new FirebaseStorageService();
    await expect(
      service.signUpload({
        supervisorUid: 'sup1',
        kind: 'audio',
        contentType: 'audio/mpeg',
        scope: 'profile',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
