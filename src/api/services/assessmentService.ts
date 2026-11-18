import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import type { SavedScenario } from '../../types/domain';

/** Assessment runs. The engines run in the browser; these calls record that a run happened (in structx.sqlite's audit log). */
export const assessmentService = {
  runEligibility(assetId: string): Promise<void> {
    return http.post(endpoints.assessment.runEligibility(assetId));
  },

  runImpact(assetId: string): Promise<void> {
    return http.post(endpoints.assessment.runImpact(assetId));
  },

  saveScenario(assetId: string, scenario: SavedScenario): Promise<SavedScenario> {
    return http.post<SavedScenario>(endpoints.assessment.scenarios(assetId), scenario);
  }
};
