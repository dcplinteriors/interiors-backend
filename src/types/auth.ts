export type Role = 'admin' | 'supervisor';

/** The authenticated principal for a request, derived from a verified ID token. */
export interface AuthUser {
  uid: string;
  email?: string;
  role: Role;
}
