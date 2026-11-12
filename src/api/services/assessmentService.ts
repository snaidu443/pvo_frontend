import { isMock } from '../../config/env';
import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import { db, persist, respond } from '../mock/mockDb';
import type { SavedScenario } from '../../types/domain';

/**
 * Assessment runs. In mock mode the deterministic engine in src/engine computes
 * the results in the browser, so these calls only record that a run happened.
 * In API mode the Python engines on the backend run and persist the results;
 * the screens keep reading the same shapes.
 */
export const assessmentService = {
  runEligibility(assetId: string): Promise<void> {
    if (!isMock()) return http.post(endpoints.assessment.runEligibility(assetId));
    return respond(undefined);
  },

  runImpact(assetId: string): Promise<void> {
    if (!isMock()) return http.post(endpoints.assessment.runImpact(assetId));
    return respond(undefined);
  },

  saveScenario(assetId: string, scenario: SavedScenario): Promise<SavedScenario> {
    if (!isMock()) return http.post<SavedScenario>(endpoints.assessment.scenarios(assetId), scenario);
    const asset = db.assets.find(a => a.id === assetId);
    if (asset?.aia) (asset.aia.savedScenarios ??= []).push(structuredClone(scenario));
    persist();
    return respond(scenario);
  }
};
