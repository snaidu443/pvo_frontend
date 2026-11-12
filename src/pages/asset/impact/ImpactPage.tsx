/** Impact & Recommendations tab (v03 renderAiaImpact + impactPager). */
import { setImpactView } from '../../../actions/navigation';
import { Icon } from '../../../components/common/Icon';
import { aia } from '../../../engine/workspace';
import type { Asset, ImpactView } from '../../../types/domain';
import { AiaHeading, AssetSubNav } from '../AssetFrame';
import { PolicyImpact } from './PolicyImpact';
import { Recommendations } from './Recommendations';
import { ValueImpact } from './ValueImpact';

const VIEWS: [ImpactView, string, string][] = [
  ['policy', 'Impact by Policy', 'impact'],
  ['value', 'Asset Value Impact', 'context'],
  ['recs', 'Recommendations', 'recommendations']
];

function ImpactPager({ view }: { view: ImpactView }) {
  const i = Math.max(0, VIEWS.findIndex(x => x[0] === view)), prev = VIEWS[i - 1], next = VIEWS[i + 1];
  return (
    <nav className="x-pager" aria-label="Impact and recommendations pages">
      <button className="button" data-aia-impact={prev ? prev[0] : ''} disabled={!prev} onClick={() => prev && setImpactView(prev[0])}>‹ {prev ? prev[1] : 'Previous'}</button>
      <div className="x-dots">
        {VIEWS.map((x, k) => (
          <button
            key={x[0]}
            className={`x-dot ${k === i ? 'on' : ''}`}
            data-aia-impact={x[0]}
            aria-label={x[1]}
            aria-current={k === i ? 'page' : undefined}
            title={x[1]}
            onClick={() => setImpactView(x[0])}
          />
        ))}
      </div>
      <span className="x-pager-label">Page {i + 1} of {VIEWS.length}</span>
      <button className="button" data-aia-impact={next ? next[0] : ''} disabled={!next} onClick={() => next && setImpactView(next[0])}>{next ? next[1] : 'Next'} ›</button>
    </nav>
  );
}

export function ImpactAndRecommendations({ asset }: { asset: Asset }) {
  const v = aia(asset), view = v.impactView;
  const title = (VIEWS.find(x => x[0] === view) ?? VIEWS[0])[1];
  const body = view === 'value' ? <ValueImpact asset={asset} /> : view === 'recs' ? <Recommendations asset={asset} /> : <PolicyImpact asset={asset} />;
  return (
    <>
      <AiaHeading asset={asset} title={title} />
      <AssetSubNav asset={asset} />
      <div className="governance-tabs">
        {VIEWS.map(([id, l, ic]) => (
          <button key={id} className={`governance-tab ${view === id ? 'active' : ''}`} data-aia-impact={id} onClick={() => setImpactView(id)}><Icon name={ic} />{l}</button>
        ))}
      </div>
      <ImpactPager view={view} />
      {body}
      <ImpactPager view={view} />
    </>
  );
}
