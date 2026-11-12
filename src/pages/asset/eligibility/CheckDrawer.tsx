/** Eligibility check drawer (v03 openCheckDrawer). Built from the current store snapshot when opened. */
import type { ReactNode } from 'react';
import { editInGovernance } from '../../../actions/assessment';
import { subjectOf } from '../../../actions/core';
import { MetaList } from '../../../components/common/Common';
import { checkDetail, evaluate, parseCheckKey, profile, type PolicyResult } from '../../../engine/eligibility';
import { getState } from '../../../store/store';
import { closeDrawer, openDrawer } from '../../../ui/overlay';

export function openCheckDrawer(key: string) {
  const s = getState(), a = subjectOf(s);
  if (!a?.aia) return;
  const r = evaluate(s, a), [code, i] = parseCheckKey(key), det = checkDetail(s, a, r, key);
  if (!det) return;
  let title: string, verdict: [string, string], value = det.value;
  if (code === 'JCA') {
    const t = (r.JCA.triggers[a.aia.jcaInd] || [])[i];
    if (!t) return;
    title = t[0];
    verdict = t[1] ? ['Triggers', 'red'] : ['Not triggered', 'green'];
    value = t[1] ? 'Yes' : 'No';
  } else {
    const st = (r as unknown as Record<string, PolicyResult>)[code]?.steps[i];
    if (!st) return;
    title = st.label;
    verdict = st.state === 'pass' ? ['Met', 'red'] : st.state === 'fail' ? ['Not met', 'green'] : [code === 'EU-GPL' ? 'Not triggered' : 'Not evaluated', ''];
  }
  const f = det.fieldId != null ? s.fields.find(x => x.id === det.fieldId) ?? null : null;
  const p = profile(s, a);
  const rows: [ReactNode, ReactNode][] = [
    ['Policy', <span className="policy-tag">{code}</span>],
    ['Check', title],
    ['Result', <strong style={{ fontSize: 15 }}>{f && code !== 'JCA' ? f.value || '—' : value}</strong>],
    ['Verdict', <span className={`status ${verdict[1]}`}>{verdict[0]}</span>]
  ];
  if (f && code !== 'JCA') {
    rows.push(['Used for', f.field === 'Assumed annual Medicare spend' && p.spend > 200 ? `Assumed annual Medicare spend; crosses $200M in ${(p.launchUS || 2027) + 4}` : f.field]);
    rows.push(['Source', <><span className="x-src">{det.source}</span>{f.status === 'Edited' && <> <span className="x-stat edited">✎ Edited</span></>}</>]);
    if (f.prev) rows.push(['Extracted value', `${f.prev} (you changed it to ${f.value})`]);
  } else rows.push(['Source', 'Inputs confirmed on Inputs and Assumptions']);
  const fieldId = det.fieldId;
  openDrawer({
    title,
    body: (
      <>
        <p className="small muted" style={{ margin: '0 0 12px' }}>{code} eligibility check</p>
        <MetaList rows={rows} />
      </>
    ),
    footer: (
      <>
        <button className="button" onClick={closeDrawer}>Close</button>
        <button className="button primary" onClick={() => editInGovernance(fieldId)}>Edit in Inputs and Assumptions</button>
      </>
    )
  });
}
