/** Shared frame for the Asset Impact Analysis tabs: heading, tab bar and the TEST-100 banner. */
import type { ReactNode } from 'react';
import { setGovFilter } from '../../actions/assessment';
import { goTab, setGovView, startNewAsset } from '../../actions/navigation';
import { Icon } from '../../components/common/Icon';
import { ASSET_SUB_PAGES } from '../../engine/constants';
import { canEdit } from '../../engine/permissions';
import { inputsGated, isTabOpen, missingInputs, openConflicts, tabOfInput, type InputTab } from '../../engine/inputs';
import { displayName } from '../../engine/workspace';
import { useAppState } from '../../store/store';
import type { Asset } from '../../types/domain';
import { ExtractionMini } from './submission/ExtractionMini';

function AddProductButton() {
  const { role } = useAppState();
  if (!canEdit(role)) return null;
  // The small progress bar for the CI / Protocol extraction sits right under the button.
  return (
    <div className="x-addcol">
      <button className="button primary" onClick={startNewAsset}><Icon name="plus" /> Add New Product</button>
      <ExtractionMini />
    </div>
  );
}

/** v03 aiaHeading: eyebrow with the asset, title and optional description. */
export function AiaHeading({ asset, title, description }: { asset: Asset; title: ReactNode; description?: ReactNode }) {
  const { aiaMode, role } = useAppState();
  const eyebrow = aiaMode === 'new' ? displayName(asset) || 'Asset Impact Analysis' : `${asset.assetCode} · ${asset.assetName}`;
  return (
    <div className="page-heading">
      <div className="page-heading-main">
        <div>
          <p className="eyebrow">Global Policy Value Optimizer · {eyebrow}</p>
          <h1>{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
      </div>
      {canEdit(role) && <div className="heading-actions"><AddProductButton /></div>}
    </div>
  );
}

/** v03 pageHeading as used on asset pages (with icon and extra actions). */
export function AssetPageHeading({ asset, title, description, actions, icon }: { asset: Asset; title: ReactNode; description?: ReactNode; actions?: ReactNode; icon?: string }) {
  return (
    <div className="page-heading">
      <div className="page-heading-main">
        {icon && <span className="heading-icon"><Icon name={icon} size={17} /></span>}
        <div>
          <p className="eyebrow">Global Policy Value Optimizer · {asset.assetCode} · {asset.assetName}</p>
          <h1>{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
      </div>
      <div className="heading-actions"><AddProductButton />{actions}</div>
    </div>
  );
}

/** Tab bar; tabs unlock in order as the workflow progresses. */
export function AssetSubNav({ asset }: { asset: Asset }) {
  const s = useAppState(), { assetSubPage } = s;
  return (
    <>
      <div className="asset-local-nav" role="tablist" aria-label="Asset analysis sections">
        {ASSET_SUB_PAGES.map(([id, label, ic]) => {
          const open = isTabOpen(s, asset, id);
          return (
            <button
              key={id}
              className={`governance-tab ${assetSubPage === id ? 'active' : ''}`}
              role="tab"
              aria-selected={assetSubPage === id}
              disabled={!open}
              aria-disabled={!open || undefined}
              onClick={() => goTab(id)}
            >
              <Icon name={ic} />{label}{!open && <Icon name="lock" size={11} className="tab-lock" />}
            </button>
          );
        })}
      </div>
      {asset.id === 'TEST-100' && (
        <div className="banner info" style={{ marginBottom: 12 }}>
          <Icon name="info" />
          <div>
            <strong>TEST-100 (Test Asset): illustrative values.</strong> All input values are synthetic sample data, not taken from any Takeda document.
            All required inputs (<span className="x-req">*</span>) are filled; some optional inputs are left empty, as when a document does not contain them.
            If a required input is cleared, the assessment cannot be run until it is entered again.
          </div>
        </div>
      )}
      <MissingInputsBanner asset={asset} />
      {assetSubPage === 'governance' && <ConflictsBanner asset={asset} />}
    </>
  );
}

const TAB_LABEL: Record<InputTab, string> = { submission: 'Data Submission', indications: 'Indications', fields: 'Inputs', judgment: 'Key Assumptions' };

/** Open the page where a missing input is entered. */
function goToInput(tab: InputTab) {
  if (tab === 'submission') { goTab('submission'); return; }
  goTab('governance');
  setGovView(tab);
  if (tab === 'fields') setGovFilter('Required missing');
}

/**
 * Lists missing required inputs; Eligibility, Impact and Scenario Analysis stay locked until they are entered (v07 v6MissingBanner).
 * On the Data Submission page only the inputs entered on that page are listed: the Indications, Inputs and Key Assumptions
 * items are filled on their own tabs (after extraction), so listing them here is noise.
 */
function MissingInputsBanner({ asset }: { asset: Asset }) {
  const s = useAppState();
  if (!inputsGated(asset) || asset.id === '__draft') return null;
  const all = missingInputs(s, asset);
  const m = s.assetSubPage === 'submission' ? all.filter(r => r.tab === 'submission') : all;
  if (!m.length) return null;
  return (
    <div className="banner warning x-reqbanner" style={{ marginBottom: 12 }}>
      <Icon name="alert" />
      <div>
        <strong>{m.length} required input{m.length === 1 ? '' : 's'} missing.</strong> Eligibility, Impact and Scenario Analysis stay locked until they are entered.{' '}
        <button className="link-button small" onClick={() => goToInput(m[0].tab)}>
          Go to first missing input <span className="muted">({TAB_LABEL[m[0].tab]})</span>
        </button>
      </div>
    </div>
  );
}

/** Conflicting document values wait for review on Inputs and Assumptions; they never block the assessment. */
function ConflictsBanner({ asset }: { asset: Asset }) {
  const s = useAppState();
  if (asset.id === '__draft') return null;
  const list = openConflicts(s, asset);
  if (!list.length) return null;
  const WHERE: Record<InputTab, string> = { submission: 'Data Submission', indications: 'Indications', fields: 'Inputs', judgment: 'Assumptions' };
  return (
    <div className="banner x-cfbanner" style={{ marginBottom: 12 }}>
      <Icon name="alert" />
      <div>
        <strong>{list.length} conflicting value{list.length === 1 ? '' : 's'} found in the documents.</strong> The first value is used until you review it.{' '}
        <button className="link-button small" onClick={() => goToInput(tabOfInput(list[0].it))}>
          Review first conflict <span className="muted">({WHERE[tabOfInput(list[0].it)]})</span>
        </button>
      </div>
    </div>
  );
}
