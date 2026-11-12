/**
 * Settings · Policy refresh monitoring (v07 EWS): read-only, Admin-only list of NEW policy
 * documents found by the source pipelines, per policy, with a link and a short AI summary.
 * No comparison with earlier policy text, no findings. ILLUSTRATIVE sample data.
 */
import { exportDocuments } from '../../actions/governance';
import { PageHeading } from '../../components/common/Common';
import { Icon } from '../../components/common/Icon';
import { documentsForPolicy, safeDocUrl } from '../../engine/monitoring';
import { canManage } from '../../engine/permissions';
import { ref } from '../../engine/reference';
import { useAppState } from '../../store/store';
import type { MonitoredDocument, MonitoringPipeline } from '../../types/domain';

/** Links come from pipeline data, so only https: URLs become clickable (new tab, no opener / referrer). */
function DocLink({ d }: { d: MonitoredDocument }) {
  const href = safeDocUrl(d.url);
  if (!href) return <span className="muted small">Link unavailable</span>;
  return (
    <a className="link-button" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${d.title} (new tab)`}>
      Open document <Icon name="chevronRight" size={12} />
    </a>
  );
}

function PipelineSection({ p, docs, baselineDate }: { p: MonitoringPipeline; docs: MonitoredDocument[]; baselineDate: string }) {
  const pol = ref().policies.find(x => x.code === p.policy);
  return (
    <section className="panel ews-policy">
      <div className="panel-head" style={{ padding: '12px 13px 0', marginBottom: 3 }}>
        <div><h2>{p.policy} · {pol?.name || ''}</h2><p>{docs.length} new document{docs.length === 1 ? '' : 's'} · {p.name}</p></div>
        <div className="action-wrap">
          {p.status === 'failed'
            ? <><span className="status red">Pipeline failed</span><span className="small muted">{p.failReason}</span></>
            : <><span className="status green">Pipeline OK</span><span className="small muted">Last run {p.lastRun}</span></>}
        </div>
      </div>
      <div className="table-wrap">
        <table className="table-compact ews-table">
          <thead><tr><th>Publish date</th><th>Document title</th><th>Summary</th><th>Link</th></tr></thead>
          <tbody>
            {docs.length ? docs.map(d => (
              <tr key={`${d.published}|${d.title}`}>
                <td className="ews-date">{d.published}</td>
                <td><div className="table-primary">{d.title}</div></td>
                <td className="ews-sum"><span className="ews-ai">AI summary</span>{d.summary}</td>
                <td className="ews-link"><DocLink d={d} /></td>
              </tr>
            )) : <tr><td colSpan={4}><div className="empty-state">No new documents since {baselineDate}.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MonitoringPage() {
  const s = useAppState(), m = s.monitoring;
  if (!canManage(s.role) || !m) {
    return (
      <>
        <PageHeading eyebrow="Assets workspace" title="Policy refresh monitoring" description="Policy refresh monitoring is available to Admin users only." icon="clock" />
        <div className="empty-state">Switch to the Admin role to view new policy documents.</div>
      </>
    );
  }
  const failed = m.pipelines.filter(p => p.status === 'failed').length;

  return (
    <>
      <PageHeading
        eyebrow="Assets workspace"
        title="Policy refresh monitoring"
        description="New policy documents found on the official policy websites, by policy, with a link and a short summary."
        actions={<button className="button" onClick={exportDocuments}><Icon name="download" /> Export documents (CSV)</button>}
        icon="clock"
      />
      <div className="compact-kpis">
        <div className="compact-kpi"><span className="kpi-icon"><Icon name="file" /></span><div><div className="kpi-number">{m.pipelines.length}</div><div className="kpi-label">Source pipelines{failed ? <> · <span style={{ color: '#a32431' }}>{failed} failed</span></> : null}</div></div></div>
        <div className="compact-kpi"><span className="kpi-icon"><Icon name="upload" /></span><div><div className="kpi-number">{m.documents.length}</div><div className="kpi-label">New documents</div></div></div>
        <div className="compact-kpi"><span className="kpi-icon"><Icon name="governance" /></span><div><div className="kpi-number" style={{ fontSize: 14 }}>{m.lastRefresh}</div><div className="kpi-label">Last refresh</div></div></div>
      </div>
      {m.pipelines.map(p => <PipelineSection key={p.policy} p={p} docs={documentsForPolicy(m, p.policy)} baselineDate={m.baselineDate} />)}
    </>
  );
}
