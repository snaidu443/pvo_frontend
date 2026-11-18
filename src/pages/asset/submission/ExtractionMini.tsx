/**
 * Shown under "Add New Product" while the CI and Protocol are still being read (the CDP is already saved, so the user can
 * edit the indications meanwhile). One round progress per file, side by side, because the two files are read in parallel.
 * When the run ends the rings disappear (on failure they stay with the reason until dismissed).
 */
import { useEffect, useState } from 'react';
import { dismissExtraction, useExtracting, useExtractionBackground, useExtractionFailure, useExtractionSteps } from '../../../actions/extraction';
import { ProgressRing } from '../../../components/common/ProgressRing';
import type { ExtractionStep } from '../../../api';

function seconds(s: ExtractionStep, now: number): number | null {
  if (!s.startedAt) return null;
  const end = s.finishedAt ? Date.parse(s.finishedAt) : now;
  return Math.max(0, Math.round((end - Date.parse(s.startedAt)) / 1000));
}

export function ExtractionMini() {
  const background = useExtractionBackground(), extracting = useExtracting(), steps = useExtractionSteps(), reason = useExtractionFailure();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!extracting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [extracting]);
  if (!background) return null;

  const files = steps.filter(s => s.name === 'CI' || s.name === 'Protocol'), save = steps.find(s => s.name === 'Save');
  const failed = steps.some(s => s.state === 'failed'), stopped = failed || !extracting;
  return (
    <div className="x-xmini-bar" role="status" aria-live="polite">
      <div className="x-xmini-row">
        <b>{stopped ? 'CI / Protocol stopped' : 'Reading the remaining files'}</b>
        {!extracting && <button type="button" className="link-button small" onClick={dismissExtraction}>Dismiss</button>}
      </div>
      <div className="x-rings">
        {files.map(s => <ProgressRing key={s.name} label={s.name} state={s.state} seconds={seconds(s, now)} size={52} />)}
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        {stopped ? (reason || 'The CI / Protocol values were not saved.') : save?.state === 'running' ? 'Saving the results…' : 'You can edit the indications meanwhile.'}
      </p>
    </div>
  );
}
