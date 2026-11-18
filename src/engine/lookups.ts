/**
 * Options for the dropdowns: Therapeutic Modality and every select of the input catalogue.
 * API mode: the lists come from the server (structx.sqlite) at sign-in and replace the built-in demo lists, so the app
 * offers exactly the values the database accepts. Mock mode: the built-in lists stay.
 */
import { INPUT_ITEMS } from './inputCatalogue';

export interface Lookups {
  modalities: string[];
  /** Option lists by catalogue key (phase, trialDesign, launchMarkets, cPhase, …). Keys the server does not list keep the built-in list. */
  options?: Record<string, string[]>;
}

const BUILT_IN = new Map(INPUT_ITEMS.map(it => [it, it.opts]));

/** Replace the options with the server's lists. The editors and their validation read the catalogue items, so they are updated in place. */
export function setLookups(l: Lookups): void {
  for (const it of INPUT_ITEMS) {
    const list = it.k === 'modality' ? l.options?.modality ?? l.modalities : l.options?.[it.k];
    it.opts = list ? [...list] : BUILT_IN.get(it);
  }
}
