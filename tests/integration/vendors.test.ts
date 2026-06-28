import request from 'supertest';
import { adminVerifier, buildApp, bearer, supervisorVerifier } from '../helpers/testApp';
import { FakeVendorRepository } from '../fakes/fakeVendorRepository';
import { Vendor } from '../../src/models/vendor';

const vendor = (over: Partial<Vendor> = {}): Vendor => ({
  id: 'v1',
  name: 'Steel Co',
  phone: '99999',
  email: 'sales@steel.test',
  isActive: true,
  createdAt: '2026-06-01T00:00:00.000Z',
  createdBy: 'admin1',
  ...over,
});

function setup(verifier = adminVerifier, seed: Vendor[] = []) {
  const vendorRepository = new FakeVendorRepository(seed);
  const app = buildApp({ tokenVerifier: verifier, vendorRepository });
  return { app, vendorRepository };
}

describe('POST /api/vendors', () => {
  it('creates a vendor (active by default)', async () => {
    const res = await request(setup().app)
      .post('/api/vendors')
      .set(...bearer())
      .send({ name: 'Hettich India', phone: '12345' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Hettich India',
      phone: '12345',
      email: null,
      isActive: true,
      createdBy: 'admin1',
    });
    expect(res.body.id).toBeTruthy();
  });

  it('400 without a name; 400 on a malformed email', async () => {
    const noName = await request(setup().app)
      .post('/api/vendors')
      .set(...bearer())
      .send({ phone: '1' });
    expect(noName.status).toBe(400);

    const badEmail = await request(setup().app)
      .post('/api/vendors')
      .set(...bearer())
      .send({ name: 'X', email: 'not-an-email' });
    expect(badEmail.status).toBe(400);
  });

  it('403 for a supervisor (admin-only)', async () => {
    const res = await request(setup(supervisorVerifier('sup1')).app)
      .post('/api/vendors')
      .set(...bearer())
      .send({ name: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/vendors', () => {
  it('lists vendors', async () => {
    const res = await request(setup(adminVerifier, [vendor({ id: 'v1' }), vendor({ id: 'v2' })]).app)
      .get('/api/vendors')
      .set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body.items.map((v: { id: string }) => v.id).sort()).toEqual(['v1', 'v2']);
  });
});

describe('PATCH /api/vendors/:id', () => {
  it('edits fields and toggles active state', async () => {
    const edited = await request(setup(adminVerifier, [vendor({ id: 'v1' })]).app)
      .patch('/api/vendors/v1')
      .set(...bearer())
      .send({ name: 'Steel & Co', email: null });
    expect(edited.body).toMatchObject({ name: 'Steel & Co', email: null });

    const deactivated = await request(setup(adminVerifier, [vendor({ id: 'v1' })]).app)
      .patch('/api/vendors/v1')
      .set(...bearer())
      .send({ isActive: false });
    expect(deactivated.body.isActive).toBe(false);
  });

  it('400 on an empty patch, 404 for a missing vendor, 403 for a supervisor', async () => {
    const empty = await request(setup(adminVerifier, [vendor({ id: 'v1' })]).app)
      .patch('/api/vendors/v1')
      .set(...bearer())
      .send({});
    expect(empty.status).toBe(400);

    const missing = await request(setup().app)
      .patch('/api/vendors/nope')
      .set(...bearer())
      .send({ name: 'X' });
    expect(missing.status).toBe(404);

    const sup = await request(setup(supervisorVerifier('sup1'), [vendor({ id: 'v1' })]).app)
      .patch('/api/vendors/v1')
      .set(...bearer())
      .send({ name: 'X' });
    expect(sup.status).toBe(403);
  });
});
