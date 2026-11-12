/** Tradeoff decision-options dialog (v05 openTradeoff). */
import { PolicyPills } from '../../../components/common/Common';
import type { Ctx } from '../../../engine/eligibility';
import { impactFor } from '../../../engine/impact';
import { ref } from '../../../engine/reference';
import type { Asset } from '../../../types/domain';
import { closeModal, openModal } from '../../../ui/overlay';

export function openTradeoff(s: Ctx, asset: Asset, rank: string) {
  const r = ref().recommendations.find(x => x.rank === rank), st = ref().synergies.find(x => x.rank === rank && x.kind === 'Tradeoff');
  if (!r || !st) return;
  const im = impactFor(s, asset).policyImpact, mfn = Math.abs(Math.min(0, im.MFN || 0)), avoid = Math.round(mfn * 0.3), card = ref().recommendationCards[rank];
  const opts: [string, string, string, string][] = [
    ['Prioritize EU-GPL', 'EU-GPL', 'Submit EU MAA within 90 days of first worldwide MAA', '+1 year of conditional RMP'],
    ['Prioritize MFN', 'MFN', 'Determine whether speed to market in the US and a delayed / evidence-optimized approach in the EU may maximize value across regions', `+$${avoid}M`]
  ];
  openModal({
    title: 'Tradeoff: decision options',
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.6, margin: '0 0 12px' }}><strong>{st.text}</strong></p>
        <div className="table-wrap">
          <table className="x-ctable">
            <thead><tr><th>Decision option</th><th>Favors</th><th>Decision</th><th>Potential Impact</th></tr></thead>
            <tbody>
              {opts.map(o => (
                <tr key={o[0]}>
                  <td className="q">{o[0]}</td>
                  <td><PolicyPills items={[o[1]]} /></td>
                  <td>{o[2]}</td>
                  <td><strong style={{ fontSize: 14, color: 'var(--green)' }}>{o[3]}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          Illustrative figures for discussion, not a forecast. Related recommendation: {card?.rank || r.rank} · {card?.title || r.title}.
        </p>
      </>
    ),
    footer: <button className="button primary" onClick={closeModal}>Close</button>
  });
}
