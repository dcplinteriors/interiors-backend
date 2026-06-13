import {
  SignedUpload,
  SignUploadInput,
  StorageService,
} from '../../src/services/storage/storageService';

/** In-memory StorageService for tests — records calls, returns predictable URLs/paths. */
export class FakeStorageService implements StorageService {
  uploads: SignUploadInput[] = [];
  downloads: string[] = [];

  async signUpload(input: SignUploadInput): Promise<SignedUpload> {
    this.uploads.push(input);
    const ext = input.kind === 'photo' ? 'jpg' : 'm4a';
    return {
      uploadUrl: `https://fake-storage/upload/${this.uploads.length}`,
      path: `material-requests/${input.supervisorUid}/fake-${this.uploads.length}.${ext}`,
    };
  }

  async signDownload(path: string): Promise<string> {
    this.downloads.push(path);
    return `https://fake-storage/download?path=${encodeURIComponent(path)}`;
  }
}
