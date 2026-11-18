/** Inputs and Assumptions tab (v03 renderAiaGovernance): Indications, Inputs and Assumptions views. */
import { setGovView } from '../../../actions/navigation';
import { Icon } from '../../../components/common/Icon';
import { viewBlockedByIndications } from '../../../engine/inputs';
import { aia } from '../../../engine/workspace';
import { useAppState } from '../../../store/store';
import type { Asset, GovView } from '../../../types/domain';
import { AiaHeading, AssetSubNav } from '../AssetFrame';
import { Assumptions } from './Assumptions';
import { Fields } from './Fields';
import { Indications } from './Indications';

const VIEWS: [GovView, string, string][] = [['indications', 'Indications', 'layers'], ['fields', 'Inputs', 'table'], ['judgment', 'Assumptions', 'governance']];

export function InputsAndAssumptions({ asset }: { asset: Asset }) {
  const s = useAppState();
  // Inputs and Assumptions open only when every required input of the Indications page is filled; whatever route led here,
  // a blocked view falls back to Indications.
  const blocked = (v: GovView) => viewBlockedByIndications(s, asset, v);
  const want = aia(asset).govView;
  const view = !blocked(want) ? want : want === 'judgment' && !blocked('fields') ? 'fields' : 'indications';
  return (
    <>
      <AiaHeading asset={asset} title="Inputs and Assumptions" />
      <AssetSubNav asset={asset} />
      <div className="governance-tabs">
        {VIEWS.map(([id, label, ic]) => (
          <button key={id} className={`governance-tab ${view === id ? 'active' : ''}`} aria-disabled={blocked(id) || undefined} onClick={() => setGovView(id)}>
            <Icon name={ic} />{label}{blocked(id) && <Icon name="lock" size={11} className="tab-lock" />}
          </button>
        ))}
      </div>
      {view === 'judgment' ? <Assumptions asset={asset} /> : view === 'indications' ? <Indications asset={asset} /> : <Fields asset={asset} />}
    </>
  );
}
