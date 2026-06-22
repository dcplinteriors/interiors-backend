/** Pure validators for storage object keys — keep the storage layout enforced in one place.
 * Two namespaces: material-request attachments and supervisor profile images, both uid-scoped. */

/** A well-formed attachment object key (inside the attachments prefix, no traversal). */
export function isAttachmentPath(path: string): boolean {
  return path.startsWith('material-requests/') && !path.includes('..');
}

/** A well-formed attachment owned by `supervisorUid` (`material-requests/<uid>/...`). */
export function isOwnAttachmentPath(path: string, supervisorUid: string): boolean {
  return isAttachmentPath(path) && path.startsWith(`material-requests/${supervisorUid}/`);
}

/** A well-formed profile-image object key (inside the profiles prefix, no traversal). */
export function isProfilePath(path: string): boolean {
  return path.startsWith('profiles/') && !path.includes('..');
}

/** A well-formed profile image owned by `uid` (`profiles/<uid>/...`). */
export function isOwnProfilePath(path: string, uid: string): boolean {
  return isProfilePath(path) && path.startsWith(`profiles/${uid}/`);
}
