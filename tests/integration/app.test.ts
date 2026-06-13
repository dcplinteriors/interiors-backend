import request from 'supertest';
import { buildApp } from '../helpers/testApp';

describe('app-level error handling', () => {
  it('returns 400 (not 500) for a malformed JSON body', async () => {
    const res = await request(buildApp())
      .post('/api/supervisors')
      .set('Content-Type', 'application/json')
      .send('{"name": '); // invalid JSON

    expect(res.status).toBe(400);
  });
});
