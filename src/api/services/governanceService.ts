import { isMock } from '../../config/env';
import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import { db, respond } from '../mock/mockDb';
import type { ActivityEntry } from '../../types/domain';

/*
 * Policy refresh monitoring and the rules catalogue are read-only (v07): they load with
 * the workspace (GET /policy-monitoring) and the reference data (GET /reference), so there
 * are no governance write calls. Only the activity log is written.
 */
export const activityService = {
  record(entry: ActivityEntry): Promise<void> {
    if (!isMock()) return http.post(endpoints.activity, entry);
    db.activity = [entry, ...db.activity].slice(0, 10);
    return respond(undefined);
  }
};
