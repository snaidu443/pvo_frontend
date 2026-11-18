import type { Lookups } from '../../engine/lookups';
import { endpoints } from '../endpoints';
import { http } from '../httpClient';

export const lookupService = {
  /** Options for the set-up dropdowns and the catalogue's selects, from the server only (structx.sqlite). */
  get(): Promise<Lookups> {
    return http.get<Lookups>(endpoints.lookups);
  }
};
