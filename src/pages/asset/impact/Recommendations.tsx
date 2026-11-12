/** "Recommendations" view (v05 renderAiaRecs): reinforcing recommendations on the left, tradeoffs on the right. */
import { InfoButton, PolicyPills } from '../../../components/common/Common';
import { Icon } from '../../../components/common/Icon';
import { exposures } from '../../../engine/eligibility';
import { recsFor } from '../../../engine/impact';
import { ref } from '../../../engine/reference';
import { getState, useAppState } from '../../../store/store';
import type { Asset, Recommendation, Synergy } from '../../../types/domain';
import { downloadCsv } from './csv';
import { openTradeoff } from './Tradeoff';

/** v03 "Export to PDF" button: downloads the recommendation catalogue as CSV. */
function exportRecommendations() {
  downloadCsv('pvo-recommendations.csv', [
    ['Rank', 'Recommendation', 'Policies', 'Owner', 'Timing', 'Value at stake'],
    ...ref().recommendations.map(r => [r.rank, r.title, r.policies.join('; '), r.owner, r.timing, `+$${r.value}M`])
  ]);
}

function RecCard({ asset, r, syn }: { asset: Asset; r: Recommendation; syn: Synergy[] }) {
  // Card wording as drawn in the feedback mock (slide 16); empty owner/timing = not shown on that card.
  const card = ref().recommendationCards[r.rank];
  const m = {
    rank: card?.rank || r.rank, title: card?.title || r.title, copy: card?.copy || r.rationale, policies: card?.policies || r.policies,
    owner: card ? card.owner : r.owner, timing: card ? card.timing : r.timing, synergy: card?.synergy
  };
  const kind = syn.find(x => x.rank === r.rank)?.kind, trade = kind === 'Tradeoff', s = syn.find(x => x.rank === r.rank && x.kind === 'Synergy');
  return (
    <article className={`x-rec ${trade ? 'trade' : ''}`}>
      <span className="x-rec-rank">{m.rank}</span>
      <div style={{ minWidth: 0 }}>
        <div className="x-rec-title">{m.title}{trade && <span className="x-pill-trade">Tradeoff</span>}</div>
        <p className="x-rec-copy">{m.copy}</p>
        <div className="x-rec-meta">
          <PolicyPills items={m.policies} />
          {m.owner && <span className="pill"><Icon name="users" size={11} /> Owner: {m.owner}</span>}
          {m.timing && <span className="pill"><Icon name="clock" size={11} /> {m.timing}</span>}
        </div>
        {s && <div className="x-rec-syn"><span className="x-pill-syn">Synergy</span><span>{m.synergy || s.text}</span></div>}
        {trade && (
          <div style={{ marginTop: 7 }}>
            <button type="button" className="link-button" data-tradeoff={r.rank} onClick={() => openTradeoff(getState(), asset, r.rank)}>View decision options <Icon name="chevronRight" size={12} /></button>
          </div>
        )}
      </div>
      {!trade && (
        <div className="x-rec-val">
          <small>Potential revenue impact <InfoButton label="Potential revenue impact" text="Illustrative lifetime revenue impact of the action." /></small>
          <strong>+${r.value}M</strong>
          <span>↳ {r.driver}</span>
        </div>
      )}
    </article>
  );
}

export function Recommendations({ asset }: { asset: Asset }) {
  const s = useAppState();
  const list = recsFor(s, asset), total = list.reduce((t, r) => t + r.value, 0), exp = exposures(s, asset);
  const syn = ref().synergies.filter(x => x.policies.every(c => exp.includes(c)));
  const kind = (r: Recommendation) => syn.find(x => x.rank === r.rank)?.kind, byVal = (x: Recommendation, y: Recommendation) => y.value - x.value;
  const left = [...list.filter(r => kind(r) === 'Synergy').sort(byVal), ...list.filter(r => !kind(r)).sort(byVal)];
  const right = list.filter(r => kind(r) === 'Tradeoff');
  return (
    <>
      <div className="x-headrow">
        <div>
          <h2 className="x-h1">Key recommendations for considerations</h2>
          <p className="x-desc">Ranked by potential revenue impact. Total <strong style={{ color: 'var(--green)' }}>+${total}M</strong> (illustrative).</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button" data-export="recommendations" onClick={exportRecommendations}>Export to PDF</button>
        </div>
      </div>
      <div className="x-recs2">
        <div>
          <div className="x-recs-head">Recommendations for considerations that reinforce or do not conflict with other policies</div>
          {left.length ? left.map(r => <RecCard key={r.rank} asset={asset} r={r} syn={syn} />) : <div className="empty-state">—</div>}
        </div>
        <div>
          <div className="x-recs-head"><span className="x-pill-trade">Tradeoff</span>{right.length} recommendation{right.length === 1 ? ' that creates' : 's that create'} tradeoffs between policies</div>
          {right.length ? right.map(r => <RecCard key={r.rank} asset={asset} r={r} syn={syn} />) : <div className="small muted">—</div>}
        </div>
      </div>
    </>
  );
}
