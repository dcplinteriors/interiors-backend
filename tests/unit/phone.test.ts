import { normalizePhone, syntheticEmail, SYNTHETIC_EMAIL_DOMAIN } from '../../src/utils/phone';

describe('normalizePhone', () => {
  it('prepends 91 to a bare 10-digit number', () => {
    expect(normalizePhone('9876543210')).toBe('919876543210');
  });

  it('keeps a 12-digit number already prefixed with 91', () => {
    expect(normalizePhone('919876543210')).toBe('919876543210');
  });

  it('strips spaces, dashes, parens, and a + before counting digits', () => {
    expect(normalizePhone('+91 (98765) 43210')).toBe('919876543210');
    expect(normalizePhone('98765-43210')).toBe('919876543210');
  });

  it('returns null for the wrong number of digits', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('98765432101')).toBeNull(); // 11 digits
    expect(normalizePhone('921234567890')).toBeNull(); // 12 digits, wrong prefix
    expect(normalizePhone('')).toBeNull();
  });
});

describe('syntheticEmail', () => {
  it('builds the synthetic email from the normalized phone', () => {
    expect(syntheticEmail('9876543210')).toBe(`919876543210@${SYNTHETIC_EMAIL_DOMAIN}`);
  });

  it('returns null for an invalid phone', () => {
    expect(syntheticEmail('nope')).toBeNull();
    expect(syntheticEmail('123')).toBeNull();
  });
});
