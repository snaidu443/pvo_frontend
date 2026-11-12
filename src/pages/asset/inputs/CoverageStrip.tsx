/** Data coverage strip above the Inputs tables (v07 coverageStrip): document inputs that have a value. */
import { InfoButton } from '../../../components/common/Common';
import { Icon } from '../../../components/common/Icon';
import { DOC_SOURCES, INPUT_SOURCE_LABEL } from '../../../engine/inputCatalogue';
import { inputCoverage } from '../../../engine/inputs';
import { useAppState } from '../../../store/store';
import type { Asset } from '../../../types/domain';

export function CoverageStrip({ asset }: { asset: Asset }) {
  const s = useAppState(), cov = inputCoverage(s, asset), chips = DOC_SOURCES.filter(k => cov.by[k]);
  return (
    <section className="panel x-covstrip" aria-label="Data coverage">
      <div>
        <h3><Icon name="check" size={14} /> Data coverage <InfoButton label="Data coverage" text="Inputs found in the uploaded documents. Manual and calculated inputs are not counted." /></h3>
        <div className="x-cov-head"><strong>{cov.covered} of {cov.total} document inputs found</strong><span className="x-cov-pct">{cov.pct}%</span></div>
        <div className="x-cov-bar"><span style={{ width: `${cov.pct}%` }} /></div>
      </div>
      <div>
        <div className="x-cov-lbl">Found per document</div>
        <div className="x-cov-chips">
          {chips.length ? chips.map(k => <span key={k} className="x-cov-chip"><b>{INPUT_SOURCE_LABEL[k]}</b> {cov.by[k]}</span>) : <span className="small muted">No inputs found yet</span>}
        </div>
      </div>
    </section>
  );
}
