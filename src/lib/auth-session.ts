// Admin auth session token with adjustable timeout.
// Once the merchant enters the correct admin password, we stamp a signed
// token (hash + timestamp) into localStorage. Any privileged action (send
// XMR, scan-and-send) checks isAdminAuthed() and is allowed without a new
// prompt while the token is fresh; when the timeout elapses, the user must
// re-enter the password.

const KEY = 'moneroflow_admin_auth';

export interface AdminAuthToken {
  hash: string; // the admin password hash this token was issued for
  at: number; // Date.now() when the password was verified
}

// Default session lifetime if no merchant setting is present yet.
export const DEFAULT_AUTH_TIMEOUT_MIN = 30;

export function getAuthToken(): AdminAuthToken | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminAuthToken;
    if (typeof parsed.hash !== 'string' || typeof parsed.at !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

// True if a token exists, belongs to the current admin password hash, and has
// not exceeded the timeout.
export function isAdminAuthed(adminPasswordHash: string, timeoutMin: number): boolean {
  if (!adminPasswordHash) return false;
  const token = getAuthToken();
  if (!token) return false;
  if (token.hash !== adminPasswordHash) return false;
  return Date.now() - token.at <= timeoutMin * 60_000;
}

// Stamp a fresh token after a successful password check.
export function markAdminAuthed(adminPasswordHash: string): void {
  const token: AdminAuthToken = { hash: adminPasswordHash, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(token));
  } catch {
    // storage unavailable — session silently downgrades to per-action prompts
  }
}

// Clear the session (used on logout / explicit "lock now").
export function clearAdminAuth(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
