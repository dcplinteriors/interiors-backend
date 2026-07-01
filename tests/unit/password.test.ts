import { generateTempPassword } from '../../src/utils/password';

const ALLOWED = /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789]+$/;
const AMBIGUOUS = ['0', 'O', 'o', '1', 'l', 'I'];

describe('generateTempPassword', () => {
  it('defaults to a length that clears Firebase’s 6-char minimum', () => {
    expect(generateTempPassword().length).toBe(10);
  });

  it('honours an explicit length', () => {
    expect(generateTempPassword(16)).toHaveLength(16);
  });

  it('uses only the readable charset (no ambiguous glyphs) across many samples', () => {
    for (let i = 0; i < 500; i += 1) {
      const pw = generateTempPassword();
      expect(pw).toMatch(ALLOWED);
      for (const ch of AMBIGUOUS) {
        expect(pw).not.toContain(ch);
      }
    }
  });
});
