import { subjectOf } from '../../actions/core';
import { AIA_ORDER } from '../../engine/constants';
import { isUnlocked } from '../../engine/workspace';
import { useAppState } from '../../store/store';
import { Eligibility } from './eligibility/EligibilityPage';
import { ImpactAndRecommendations } from './impact/ImpactPage';
import { InputsAndAssumptions } from './inputs/InputsPage';
import { ScenarioAnalysis } from './scenario/ScenarioPage';
import { DataSubmission } from './submission/DataSubmission';

/** Asset Impact Analysis: renders the active tab for the selected asset (or the new-product draft). */
export function AssetAnalysisPage() {
  const s = useAppState();
  const asset = subjectOf(s);
  if (!asset?.aia) return <div className="asset-empty">Select an assigned asset to continue.</div>;
  // Never show a locked tab (navigation actions also guard this).
  const tab = isUnlocked(asset, s.assetSubPage) ? s.assetSubPage : [...AIA_ORDER].reverse().find(t => isUnlocked(asset, t)) || 'submission';
  switch (tab) {
    case 'governance': return <InputsAndAssumptions asset={asset} />;
    case 'eligibility': return <Eligibility asset={asset} />;
    case 'impact': return <ImpactAndRecommendations asset={asset} />;
    case 'scenario': return <ScenarioAnalysis asset={asset} />;
    default: return <DataSubmission asset={asset} />;
  }
}
