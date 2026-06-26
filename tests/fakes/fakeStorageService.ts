import {
  SignedUpload,
  SignUploadInput,
  StorageService,
} from '../../src/services/storage/storageService';

/** In-memory StorageService for tests — records calls, returns predictable URLs/paths. */
export class FakeStorageService implements StorageService {
  uploads: SignUploadInput[] = [];
  downloads: string[] = [];
  finalized: string[] = [];

  async signUpload(input: SignUploadInput): Promise<SignedUpload> {
    this.uploads.push(input);
    const ext = input.kind === 'photo' ? 'jpg' : 'm4a';
    const prefix = input.scope === 'profile' ? 'profiles' : 'material-requests';
    return {
      uploadUrl: `https://fake-storage/upload/${this.uploads.length}`,
      path: `tmp/${prefix}/${input.supervisorUid}/fake-${this.uploads.length}.${ext}`,
    };
  }

  async signDownload(path: string): Promise<string> {
    this.downloads.push(path);
    return `https://fake-storage/download?path=${encodeURIComponent(path)}`;
  }

  async finalizeUpload(path: string): Promise<string> {
    this.finalized.push(path);
    return path.startsWith('tmp/') ? path.slice('tmp/'.length) : path;
  }
}
