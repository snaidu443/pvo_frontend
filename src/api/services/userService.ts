import { isMock } from '../../config/env';
import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import { db, respond, upsert } from '../mock/mockDb';
import type { User } from '../../types/domain';

/** What the server accepts for a user (it refuses anything else). The id, and the last-active time, are the server's. */
const body = (u: User) => ({ name: u.name, email: u.email, role: u.role, status: u.status, assetIds: u.assetIds || [] });

/** User administration on structx.sqlite. The server enforces who may do what (Admin only for changes); the answer is the saved user. */
export const userService = {
  list(): Promise<User[]> {
    if (!isMock()) return http.get<User[]>(endpoints.users.list);
    return respond(db.users);
  },

  create(user: User): Promise<User> {
    if (!isMock()) return http.post<User>(endpoints.users.create, body(user));
    return respond(upsert(db.users, user, u => u.id));
  },

  update(user: User): Promise<User> {
    if (!isMock()) return http.put<User>(endpoints.users.byId(user.id), body(user));
    return respond(upsert(db.users, user, u => u.id));
  },

  /** Activate or deactivate. */
  setStatus(id: number, status: 'active' | 'inactive'): Promise<User> {
    if (!isMock()) return http.patch<User>(endpoints.users.status(id), { status });
    const u = db.users.find(x => x.id === id)!;
    return respond(upsert(db.users, { ...u, status, active: status === 'active' }, x => x.id));
  },

  resendInvite(id: number): Promise<void> {
    if (!isMock()) return http.post(endpoints.users.resendInvite(id));
    return respond(undefined);
  }
};
