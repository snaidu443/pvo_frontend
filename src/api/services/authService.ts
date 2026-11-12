import { isMock } from '../../config/env';
import { endpoints } from '../endpoints';
import { http, setAccessToken } from '../httpClient';
import { respond } from '../mock/mockDb';
import type { Role, SessionUser } from '../../types/domain';

const ROLES: Role[] = ['Admin', 'Editor', 'Viewer'];

export const authService = {
  /**
   * Mock: the demo sign-in. Nothing is verified and the password is never stored or sent.
   * API (until Okta is connected): the backend's local-only development sign-in with a user name and the
   * shared local test password (PVO_DEV_PASSWORD on the backend). Okta replaces this with the SSO
   * redirect. The backend decides the role; the role picker is only honoured in mock mode.
   */
  async login(name: string, password: string, role: Role): Promise<SessionUser> {
    if (!name.trim() || !password) throw new Error('Invalid credentials. Enter a user name and password.');
    if (isMock()) {
      if (!ROLES.includes(role)) throw new Error('Unknown role.');
      return respond({ name: name.trim().slice(0, 60), role });
    }
    const res = await http.post<{ access_token?: string; user: SessionUser }>(endpoints.auth.devLogin, { username: name.trim(), password });
    setAccessToken(res.access_token ?? null);
    if (!ROLES.includes(res.user?.role)) throw new Error('Your account has no role assigned.'); // fail closed
    return res.user;
  },

  async logout(): Promise<void> {
    if (!isMock()) {
      try { await http.post(endpoints.auth.logout); } catch { /* sign out locally anyway */ }
    }
    setAccessToken(null);
  }
};
