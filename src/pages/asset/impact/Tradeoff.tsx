/** Interdependency decision-options dialog (v09 openTradeoff). */
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
  const opts: [string, string[], string, string[]][] = [
    ['Prioritize pre-launch evidence requirements', ['MFN', 'JCA', 'EU-GPL'], 'Prioritize a comparative trial with an optimized, high-valued comparator to maximize global value recognition', [`+$${avoid}M`, '+1 year of conditional RMP']],
    ['Prioritize post-launch evidence generation plans', ['IRA'], 'Prioritize strong post-launch evidence generation plans (e.g., robust ITCs, follow-up studies, etc.) to de-risk potential MFP negotiations, while considering a fast indication expansion timing to capture maximum market value pre-MFP', ['+$25M']]
  ];
  openModal({
    title: 'Interdependency: decision options',
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.6, margin: '0 0 12px' }}><strong>{st.text}</strong></p>
        <div className="table-wrap">
          <table className="x-ctable">
            <thead><tr><th>Decision Option</th><th>Policies</th><th>Decision</th><th>Potential Impact</th></tr></thead>
            <tbody>
              {opts.map(o => (
                <tr key={o[0]}>
                  <td className="q">{o[0]}</td>
                  <td><PolicyPills items={o[1]} /></td>
                  <td>{o[2]}</td>
                  <td>{o[3].map(v => <strong key={v} style={{ display: 'block', fontSize: 14, color: 'var(--green)', whiteSpace: 'nowrap' }}>{v}</strong>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          Illustrative figures for discussion, not a forecast. Related recommendation: {card?.title || r.title}.
        </p>
      </>
    ),
    footer: <button className="button primary" onClick={closeModal}>Close</button>
  });
}
