/**
 * Pop-up shown while the CDP is read by "Extract data with AI". When the CDP is saved the pop-up closes, the page opens the
 * Indications tab, and the CI and Protocol continue in the small bar under "Add New Product" (ExtractionMini). The AI service
 * does not report a percentage inside one document, so the pop-up shows the stage and the time taken.
 */
import { useEffect, useState } from 'react';
import { dismissExtraction, useExtracting, useExtractionBackground, useExtractionFailure, useExtractionSteps } from '../../../actions/extraction';
import { ProgressRing } from '../../../components/common/ProgressRing';
import type { ExtractionStep } from '../../../api';

const LABEL: Record<ExtractionStep['name'], string> = { CDP: 'CDP', CI: 'CI', Protocol: 'Protocol', Save: 'Saving results' };

function seconds(s: ExtractionStep, now: number): number | null {
  if (!s.startedAt) return null;
  const end = s.finishedAt ? Date.parse(s.finishedAt) : now;
  return Math.max(0, Math.round((end - Date.parse(s.startedAt)) / 1000));
}

export function ExtractionProgress() {
  const extracting = useExtracting(), steps = useExtractionSteps(), reason = useExtractionFailure(), background = useExtractionBackground();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!extracting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [extracting]);

  const failed = steps.some(s => s.state === 'failed');
  if (background || (!extracting && !failed)) return null; // once the CDP is saved the small bar takes over

  // The pop-up is about the CDP (plus any step that failed). A run without a CDP file shows every step.
  const hasCdp = steps.some(s => s.name === 'CDP');
  const shown = hasCdp ? steps.filter(s => s.name === 'CDP' || s.state === 'failed') : steps;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="AI extraction progress">
      <div className="x-xmodal" role="status" aria-live="polite">
        <div className="x-xprog-head">
          <b>{failed ? 'Extraction stopped' : hasCdp || !steps.length ? 'Reading the CDP' : 'Extracting data with AI'}</b>
        </div>
        <div className="x-rings x-rings-big">
          {shown.map(s => <ProgressRing key={s.name} label={LABEL[s.name]} state={s.state} seconds={seconds(s, now)} size={hasCdp ? 104 : 80} />)}
        </div>
        <p className="small muted">
          {!steps.length ? 'Starting…' : failed ? (reason || 'Nothing was saved.') : hasCdp
            ? 'When the CDP is done you will be taken to the Indications. The CI and Protocol are then read in the background; you can edit the indications meanwhile.'
            : 'This can take a few minutes; keep this page open.'}
        </p>
        {failed && <div className="x-xmodal-foot"><button type="button" className="button" onClick={dismissExtraction}>Close</button></div>}
      </div>
    </div>
  );
}
