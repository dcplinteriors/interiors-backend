import request from 'supertest';
import { adminVerifier, buildApp, bearer, supervisorVerifier } from '../helpers/testApp';
import { FakeStorageService } from '../fakes/fakeStorageService';
import { TokenVerifier } from '../../src/services/auth/tokenVerifier';

function setup(verifier: TokenVerifier) {
  const storageService = new FakeStorageService();
  const app = buildApp({ tokenVerifier: verifier, storageService });
  return { app, storageService };
}

describe('POST /api/uploads/sign', () => {
  it('returns an upload URL + path for a supervisor', async () => {
    const { app, storageService } = setup(supervisorVerifier('sup7'));

    const res = await request(app)
      .post('/api/uploads/sign')
      .set(...bearer())
      .send({ kind: 'photo', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBeTruthy();
    expect(res.body.path).toMatch(/^material-requests\/sup7\//);
    expect(storageService.uploads).toEqual([
      { supervisorUid: 'sup7', kind: 'photo', contentType: 'image/jpeg' },
    ]);
  });

  it('returns an upload URL + path for an audio note', async () => {
    const { app, storageService } = setup(supervisorVerifier('sup7'));

    const res = await request(app)
      .post('/api/uploads/sign')
      .set(...bearer())
      .send({ kind: 'audio', contentType: 'audio/mpeg' });

    expect(res.status).toBe(200);
    expect(res.body.path).toMatch(/^material-requests\/sup7\/.*\.m4a$/);
    expect(storageService.uploads).toEqual([
      { supervisorUid: 'sup7', kind: 'audio', contentType: 'audio/mpeg' },
    ]);
  });

  it('returns a profile-image upload URL + path (scope: profile)', async () => {
    const { app, storageService } = setup(supervisorVerifier('sup7'));

    const res = await request(app)
      .post('/api/uploads/sign')
      .set(...bearer())
      .send({ kind: 'photo', contentType: 'image/jpeg', scope: 'profile' });

    expect(res.status).toBe(200);
    expect(res.body.path).toMatch(/^profiles\/sup7\//);
    expect(storageService.uploads[0]).toMatchObject({ scope: 'profile' });
  });

  it('forbids admins (only supervisors upload)', async () => {
    const { app } = setup(adminVerifier);
    const res = await request(app)
      .post('/api/uploads/sign')
      .set(...bearer())
      .send({ kind: 'photo', contentType: 'image/jpeg' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid kind (400)', async () => {
    const { app } = setup(supervisorVerifier());
    const res = await request(app)
      .post('/api/uploads/sign')
      .set(...bearer())
      .send({ kind: 'video', contentType: 'video/mp4' });
    expect(res.status).toBe(400);
  });

  it('requires authentication (401)', async () => {
    const { app } = setup(supervisorVerifier());
    const res = await request(app).post('/api/uploads/sign').send({ kind: 'photo', contentType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/uploads/download-url', () => {
  it('signs a read URL for the supervisor’s own attachment', async () => {
    const { app, storageService } = setup(supervisorVerifier('sup7'));
    const res = await request(app)
      .post('/api/uploads/download-url')
      .set(...bearer())
      .send({ path: 'material-requests/sup7/abc.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('fake-storage/download');
    expect(storageService.downloads).toEqual(['material-requests/sup7/abc.jpg']);
  });

  it('forbids a supervisor reading another supervisor’s attachment', async () => {
    const { app, storageService } = setup(supervisorVerifier('sup7'));
    const res = await request(app)
      .post('/api/uploads/download-url')
      .set(...bearer())
      .send({ path: 'material-requests/other/abc.jpg' });

    expect(res.status).toBe(403);
    expect(storageService.downloads).toEqual([]);
  });

  it('lets an admin read any attachment', async () => {
    const { app } = setup(adminVerifier);
    const res = await request(app)
      .post('/api/uploads/download-url')
      .set(...bearer())
      .send({ path: 'material-requests/anyone/abc.jpg' });
    expect(res.status).toBe(200);
  });

  it('signs a read URL for the supervisor’s own profile image', async () => {
    const { app, storageService } = setup(supervisorVerifier('sup7'));
    const res = await request(app)
      .post('/api/uploads/download-url')
      .set(...bearer())
      .send({ path: 'profiles/sup7/avatar.jpg' });

    expect(res.status).toBe(200);
    expect(storageService.downloads).toEqual(['profiles/sup7/avatar.jpg']);
  });

  it('forbids reading another supervisor’s profile image (403)', async () => {
    const { app } = setup(supervisorVerifier('sup7'));
    const res = await request(app)
      .post('/api/uploads/download-url')
      .set(...bearer())
      .send({ path: 'profiles/other/avatar.jpg' });
    expect(res.status).toBe(403);
  });

  it('rejects a path outside the attachments prefix — even for an admin (400)', async () => {
    const { app, storageService } = setup(adminVerifier);
    const res = await request(app)
      .post('/api/uploads/download-url')
      .set(...bearer())
      .send({ path: 'config/secrets.json' });
    expect(res.status).toBe(400);
    expect(storageService.downloads).toEqual([]);
  });

  it('rejects a traversal path (400)', async () => {
    const { app } = setup(supervisorVerifier('sup7'));
    const res = await request(app)
      .post('/api/uploads/download-url')
      .set(...bearer())
      .send({ path: 'material-requests/sup7/../../config/secrets.json' });
    expect(res.status).toBe(400);
  });
});
