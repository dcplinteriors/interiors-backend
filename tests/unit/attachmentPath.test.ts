import { isAttachmentPath, isOwnAttachmentPath } from '../../src/utils/attachmentPath';

describe('isAttachmentPath', () => {
  it('accepts well-formed attachment keys', () => {
    expect(isAttachmentPath('material-requests/sup1/abc.jpg')).toBe(true);
  });

  it('rejects paths outside the attachments prefix', () => {
    expect(isAttachmentPath('config/secrets.json')).toBe(false);
    expect(isAttachmentPath('/material-requests/sup1/abc.jpg')).toBe(false);
  });

  it('rejects traversal sequences', () => {
    expect(isAttachmentPath('material-requests/sup1/../../config/secrets.json')).toBe(false);
  });
});

describe('isOwnAttachmentPath', () => {
  it('accepts the supervisor’s own path', () => {
    expect(isOwnAttachmentPath('material-requests/sup1/abc.jpg', 'sup1')).toBe(true);
  });

  it('rejects another supervisor’s path', () => {
    expect(isOwnAttachmentPath('material-requests/sup2/abc.jpg', 'sup1')).toBe(false);
  });

  it('is not fooled by uid prefix collisions (trailing slash)', () => {
    // 'sup1' must not match a 'sup12' path.
    expect(isOwnAttachmentPath('material-requests/sup12/abc.jpg', 'sup1')).toBe(false);
  });

  it('rejects traversal even under the own prefix', () => {
    expect(isOwnAttachmentPath('material-requests/sup1/../sup2/abc.jpg', 'sup1')).toBe(false);
  });
});
