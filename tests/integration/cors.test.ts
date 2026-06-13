import request from 'supertest';
import { buildApp } from '../helpers/testApp';

describe('CORS', () => {
  it('reflects the request origin on a simple request', async () => {
    const res = await request(buildApp())
      .get('/api/health')
      .set('Origin', 'https://admin.dcpl.test');

    expect(res.headers['access-control-allow-origin']).toBe('https://admin.dcpl.test');
  });

  it('allows the Authorization header on preflight (needed for Flutter web)', async () => {
    const res = await request(buildApp())
      .options('/api/me')
      .set('Origin', 'https://admin.dcpl.test')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');

    expect([200, 204]).toContain(res.status);
    expect((res.headers['access-control-allow-headers'] ?? '').toLowerCase()).toContain(
      'authorization',
    );
  });
});
