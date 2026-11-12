/** Inputs and Assumptions tab (v03 renderAiaGovernance): Indications, Inputs and Assumptions views. */
import { setGovView } from '../../../actions/navigation';
import { Icon } from '../../../components/common/Icon';
import { aia } from '../../../engine/workspace';
import type { Asset, GovView } from '../../../types/domain';
import { AiaHeading, AssetSubNav } from '../AssetFrame';
import { Assumptions } from './Assumptions';
import { Fields } from './Fields';
import { Indications } from './Indications';

const VIEWS: [GovView, string, string][] = [['indications', 'Indications', 'layers'], ['fields', 'Inputs', 'table'], ['judgment', 'Assumptions', 'governance']];

export function InputsAndAssumptions({ asset }: { asset: Asset }) {
  const view = aia(asset).govView;
  return (
    <>
      <AiaHeading asset={asset} title="Inputs and Assumptions" />
      <AssetSubNav asset={asset} />
      <div className="governance-tabs">
        {VIEWS.map(([id, label, ic]) => (
          <button key={id} className={`governance-tab ${view === id ? 'active' : ''}`} onClick={() => setGovView(id)}><Icon name={ic} />{label}</button>
        ))}
      </div>
      {view === 'judgment' ? <Assumptions asset={asset} /> : view === 'indications' ? <Indications asset={asset} /> : <Fields asset={asset} />}
    </>
  );
}
