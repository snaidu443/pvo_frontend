import type { KeyboardEvent, MouseEvent } from 'react';
import { openAsset, startNewAsset } from '../../actions/navigation';
import { setOverviewFilter } from '../../actions/portfolio';
import { PageHeading, PolicyPills } from '../../components/common/Common';
import { Icon } from '../../components/common/Icon';
import { canEdit, canSeeUsers, visibleAssets } from '../../engine/permissions';
import { ref } from '../../engine/reference';
import { lastAssessmentDate } from '../../engine/workspace';
import { useAppState } from '../../store/store';
import type { Asset } from '../../types/domain';
import { confirmStartAssessment, openCollaboratorModal, openEditAssetModal, openPastAssessments } from './AssetModals';

const uniq = <T,>(list: T[]) => [...new Set(list)];

export function OverviewPage() {
  const s = useAppState();
  const assets = visibleAssets(s), search = s.overviewSearch.trim().toLowerCase();
  const filtered = assets
    .filter(a =>
      (s.overviewPolicy === 'All policies' || a.policyExposures.includes(s.overviewPolicy as Asset['policyExposures'][number])) &&
      (s.overviewStatus === 'All statuses' || a.submissionStatus === s.overviewStatus) &&
      (s.overviewRisk === 'All risks' || a.estimatedImpactLevel === s.overviewRisk) &&
      (s.overviewGeography === 'All geographies' || a.jurisdictions.includes(s.overviewGeography)) &&
      (s.overviewOwner === 'All owners' || a.owner === s.overviewOwner) &&
      (!search || `${a.assetCode} ${a.assetName} ${a.owner}`.toLowerCase().includes(search)))
    .sort((a, b) => String(a[s.overviewSort] ?? '').localeCompare(String(b[s.overviewSort] ?? '')));
  const edit = canEdit(s.role), seeUsers = canSeeUsers(s.role);

  const onRowClick = (e: MouseEvent, id: string) => { if (!(e.target as HTMLElement).closest('[data-row-menu]')) openAsset(id, 'impact'); };
  const onRowKey = (e: KeyboardEvent, id: string) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openAsset(id, 'impact'); }
  };
  const filter = (key: Parameters<typeof setOverviewFilter>[0], label: string, all: string, options: string[], value: string) => (
    <select className="select" aria-label={label} value={value} onChange={e => setOverviewFilter(key, e.target.value)}>
      <option>{all}</option>
      {options.map(x => <option key={x}>{x}</option>)}
    </select>
  );

  return (
    <>
      <PageHeading
        eyebrow="Assets workspace"
        title="Assets overview"
        icon="overview"
        description="A cross-asset view of the assets uploaded to date: policy exposure, input completeness, and decisions requiring attention."
        actions={
          <>
            {edit && <button className="button primary" onClick={startNewAsset}><Icon name="plus" /> Add New Product</button>}
          </>
        }
      />
      <section className="panel portfolio-directory">
        <div className="panel-head">
          <div>
            <h2>Assets</h2>
            <p>{filtered.length} of {assets.length} assigned assets · Select an asset to open its assessment</p>
          </div>
        </div>
        <div className="filter-grid portfolio-filters">
          <input className="input" id="overviewSearch" placeholder="Search assets, owner" aria-label="Search assets" value={s.overviewSearch} onChange={e => setOverviewFilter('overviewSearch', e.target.value)} />
          {filter('overviewPolicy', 'Filter by policy', 'All policies', ref().policies.map(p => p.code), s.overviewPolicy)}
          {filter('overviewStatus', 'Filter by submission status', 'All statuses', uniq(assets.map(a => a.submissionStatus)), s.overviewStatus)}
          {filter('overviewRisk', 'Filter by risk', 'All risks', ['High', 'Medium', 'Low'], s.overviewRisk)}
          {filter('overviewGeography', 'Filter by geography', 'All geographies', uniq(assets.flatMap(a => a.jurisdictions)), s.overviewGeography)}
          {filter('overviewOwner', 'Filter by owner', 'All owners', uniq(assets.map(a => a.owner)), s.overviewOwner)}
        </div>
        <div className="table-wrap">
          <table className="table-compact portfolio-table">
            <thead>
              <tr><th>Asset</th><th>Launch Region</th><th>Policy exposure</th><th>Last assessment</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map(a => (
                <tr key={a.id} data-asset-row={a.id} tabIndex={0} role="button" aria-label={`Open analysis for ${a.assetName}`} onClick={e => onRowClick(e, a.id)} onKeyDown={e => onRowKey(e, a.id)}>
                  <td>
                    <div className="table-primary">{a.assetName === a.assetCode ? a.assetCode : `${a.assetCode} · ${a.assetName.replace(`${a.assetCode} `, '')}`}</div>
                    <div className="table-secondary">{a.owner}</div>
                  </td>
                  <td>{a.jurisdictions.map(j => <span key={j} className="policy-tag">{j}</span>)}</td>
                  <td><PolicyPills items={a.policyExposures} /></td>
                  <td><span className="table-secondary">{lastAssessmentDate(a)}</span></td>
                  <td>
                    <div className="action-wrap" data-row-menu style={{ minWidth: 250 }}>
                      <button className="table-action" onClick={() => openAsset(a.id, 'impact')}>View Current Assessment <Icon name="chevronRight" size={12} /></button>
                      {edit && <>
                        <button className="table-action" onClick={() => confirmStartAssessment(a.id)}>Start New Assessment</button>
                        <button className="table-action" onClick={() => openPastAssessments(a.id)}>View Past Assessments</button>
                      </>}
                      {seeUsers && <button className="table-action" onClick={() => openCollaboratorModal(a.id)}>Add User</button>}
                      {a.createdByRole && seeUsers && <>
                        <button className="table-action" onClick={() => openEditAssetModal(a.id)}>Edit</button>
                      </>}
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={5}><div className="empty-state">No assets match these filters.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
