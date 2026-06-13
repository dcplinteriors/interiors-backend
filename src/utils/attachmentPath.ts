/** Pure validators for attachment object keys — keep the storage layout enforced in one place. */

/** A well-formed attachment object key (inside the attachments prefix, no traversal). */
export function isAttachmentPath(path: string): boolean {
  return path.startsWith('material-requests/') && !path.includes('..');
}

/** A well-formed attachment owned by `supervisorUid` (`material-requests/<uid>/...`). */
export function isOwnAttachmentPath(path: string, supervisorUid: string): boolean {
  return isAttachmentPath(path) && path.startsWith(`material-requests/${supervisorUid}/`);
}
