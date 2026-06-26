/** Pure validators for storage object keys — keep the storage layout enforced in one place.
 * Two namespaces: material-request attachments and supervisor profile images, both uid-scoped.
 *
 * Freshly-signed uploads land under the staging prefix ([TMP_PREFIX]); they're moved to their
 * permanent key only once a saved request/profile references them (StorageService.finalizeUpload).
 * Anything left in staging is swept by the bucket lifecycle rule. So clients submit STAGED paths;
 * the permanent keys are what get stored and later signed for download. */

/** Prefix where uploads sit between signing and being committed to a request/profile. */
export const TMP_PREFIX = 'tmp/';

/** A well-formed attachment object key (inside the attachments prefix, no traversal). */
export function isAttachmentPath(path: string): boolean {
  return path.startsWith('material-requests/') && !path.includes('..');
}

/** A well-formed attachment owned by `supervisorUid` (`material-requests/<uid>/...`). */
export function isOwnAttachmentPath(path: string, supervisorUid: string): boolean {
  return isAttachmentPath(path) && path.startsWith(`material-requests/${supervisorUid}/`);
}

/** A freshly-uploaded, not-yet-committed attachment owned by `supervisorUid`
 *  (`tmp/material-requests/<uid>/...`) — what a client submits on a request. */
export function isOwnStagedAttachmentPath(path: string, supervisorUid: string): boolean {
  return (
    path.startsWith(`${TMP_PREFIX}material-requests/${supervisorUid}/`) && !path.includes('..')
  );
}

/** A well-formed profile-image object key (inside the profiles prefix, no traversal). */
export function isProfilePath(path: string): boolean {
  return path.startsWith('profiles/') && !path.includes('..');
}

/** A well-formed profile image owned by `uid` (`profiles/<uid>/...`). */
export function isOwnProfilePath(path: string, uid: string): boolean {
  return isProfilePath(path) && path.startsWith(`profiles/${uid}/`);
}

/** A freshly-uploaded, not-yet-committed profile image owned by `uid`
 *  (`tmp/profiles/<uid>/...`) — what a client submits when setting its photo. */
export function isOwnStagedProfilePath(path: string, uid: string): boolean {
  return path.startsWith(`${TMP_PREFIX}profiles/${uid}/`) && !path.includes('..');
}
