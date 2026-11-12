import type { ReferenceData } from '../types/domain';

/**
 * Reference data (policies, catalogues, model constants) is loaded once from
 * referenceService and then read synchronously by the engine and the UI.
 */
let current: ReferenceData | null = null;

export const setReference = (data: ReferenceData) => {
  current = data;
};

export const ref = (): ReferenceData => {
  if (!current) throw new Error('Reference data has not been loaded yet.');
  return current;
};

export const hasReference = () => current !== null;
