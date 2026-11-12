import { isMock } from '../../config/env';
import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import { db, respond, upsert } from '../mock/mockDb';
import type { User } from '../../types/domain';

/** User administration. The API must enforce Admin-only access server-side. */
export const userService = {
  create(user: User): Promise<User> {
    if (!isMock()) return http.post<User>(endpoints.users.create, user);
    return respond(upsert(db.users, user, u => u.id));
  },

  update(user: User): Promise<User> {
    if (!isMock()) return http.put<User>(endpoints.users.byId(user.id), user);
    return respond(upsert(db.users, user, u => u.id));
  },

  remove(id: number): Promise<void> {
    if (!isMock()) return http.delete(endpoints.users.byId(id));
    db.users = db.users.filter(u => u.id !== id);
    return respond(undefined);
  },

  resendInvite(id: number): Promise<void> {
    if (!isMock()) return http.post(endpoints.users.resendInvite(id));
    return respond(undefined);
  }
};
