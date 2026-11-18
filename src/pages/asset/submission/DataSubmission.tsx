/** Data Submission tab (v07 renderAiaSubmission): the asset's set-up and its source documents, both read from structx.sqlite. */
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { createAsset, setDocumentLabel, updateSetup } from '../../../actions/assessment';
import { addFiles, hasDraftFiles, removeDocument, removeDraftDocument } from '../../../actions/documents';
import { extractAsset, useExtracting } from '../../../actions/extraction';
import { ExtractionProgress } from './ExtractionProgress';
import { CommitInput } from '../../../components/common/CommitInput';
import { Icon } from '../../../components/common/Icon';
import { DOC_LABELS, DOC_SLOTS, DOC_TYPES, FILE_ACCEPT, UPLOAD_GUIDANCE } from '../../../engine/constants';
import { INPUT_ITEM } from '../../../engine/inputCatalogue';
import { readInput } from '../../../engine/inputs';
import { canEditAiaInputs } from '../../../engine/permissions';
import { aia, assetDocs, docTypes, hasType } from '../../../engine/workspace';
import { useAppState } from '../../../store/store';
import type { Asset, SourceDocument } from '../../../types/domain';
import { DRAFT_ID } from '../../../store/slices/assessmentSlice';
import { closeDrawer, closeModal, openDrawer, openModal } from '../../../ui/overlay';
import { AiaHeading, AssetSubNav } from '../AssetFrame';
import { InputEditor } from '../inputs/InputEditor';

function inspectDocument(d: SourceDocument) {
  openDrawer({
    title: 'Document details',
    body: (
      <>
        <div className="file-type" style={{ width: 40, height: 48 }}>{d.type.toUpperCase()}</div>
        <h3 style={{ fontSize: 14 }}>{d.name}</h3>
        <div className="evidence-meta">
          <b>Type</b><span>{docTypes(d).join(', ')}</span>
          <b>File size</b><span>{d.size}</span>
          <b>Added</b><span>{d.added}</span>
          <b>AI tag</b><span>{d.tag || 'Confirmed'}</span>
        </div>
        <div className="divider" />
        <div className="banner info"><Icon name="info" /><div>This is the document record from the database. File contents are read by the AI extraction, not by this screen.</div></div>
      </>
    ),
    footer: <button className="button" onClick={closeDrawer}>Close</button>
  });
}

function showUploadGuidance() {
  openModal({
    title: 'What to upload',
    small: true,
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.65, margin: '0 0 10px' }}>Please upload the following documents to inform the asset inputs and assumptions:</p>
        <ul className="x-guide">{UPLOAD_GUIDANCE.map(([doc, text]) => <li key={doc}><b>{doc}:</b> {text}</li>)}</ul>
        <p className="small" style={{ lineHeight: 1.65, margin: '10px 0 0' }}><b>Note:</b> For PowerPoint submissions, ensure all information intended for inclusion appears on visible slides, not hidden slides.</p>
      </>
    ),
    footer: <button className="button primary" onClick={closeModal}>Close</button>
  });
}

/** One asset-level catalogue input on the set-up form (modality, JCA insights, …). */
function SetupInput({ asset, k, ed }: { asset: Asset; k: string; ed: boolean }) {
  const s = useAppState(), it = INPUT_ITEM[k];
  return <InputEditor row={{ it, value: readInput(s, asset, it) }} disabled={!ed} />;
}

export function DataSubmission({ asset }: { asset: Asset }) {
  const s = useAppState();
  const st = aia(asset).setup, ed = canEditAiaInputs(s.role), docs = assetDocs(s, asset);
  const [openLabel, setOpenLabel] = useState<number | null>(null);
  const draft = asset.id === DRAFT_ID;
  const extracting = useExtracting();
  const fileRef = useRef<HTMLInputElement>(null);
  const pickType = useRef<string | undefined>(undefined);
  const [dragover, setDragover] = useState(false);
  const pick = (type?: string, accept = FILE_ACCEPT) => {
    const input = fileRef.current;
    if (!input) return;
    pickType.current = type;
    input.accept = accept;
    input.click();
  };
  const onFilesPicked = () => {
    const input = fileRef.current;
    if (!input) return;
    if (input.files?.length) addFiles(input.files, pickType.current);
    input.value = '';
    input.accept = FILE_ACCEPT;
    pickType.current = undefined;
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragover(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };
  const onDropKey = (e: KeyboardEvent<HTMLDivElement>) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(); } };

  // A new product's files live in memory until Create asset: warn before the page is left.
  useEffect(() => {
    if (!draft) return;
    const onLeave = (e: BeforeUnloadEvent) => { if (hasDraftFiles()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [draft]);
  const onCreate = async () => {
    if (await createAsset() === 'name-required') {
      const el = document.getElementById('aiaAssetName') as HTMLInputElement | null;
      el?.reportValidity();
      el?.focus();
    }
  };

  // Only one label dropdown open; outside click or Escape closes it (v03 document listeners).
  useEffect(() => {
    const onClick = (e: globalThis.MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('.x-multi')) setOpenLabel(null);
    };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpenLabel(null); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const onLabelSummary = (e: MouseEvent, id: number) => {
    e.preventDefault();
    setOpenLabel(cur => (cur === id ? null : id));
  };

  const typeMulti = (d: SourceDocument) => {
    const t = docTypes(d);
    return (
      <details className="x-multi" open={openLabel === d.id}>
        <summary onClick={e => onLabelSummary(e, d.id)}>Type: <b>{t.map(x => DOC_LABELS[x] || x).join(', ')}</b></summary>
        <div className="x-multi-list">
          {DOC_TYPES.map(o => (
            <label key={o}>
              <input
                type="checkbox"
                data-doc-label={d.id}
                value={o}
                checked={t.includes(o)}
                disabled={!ed}
                onChange={e => { setDocumentLabel(d.id, o, e.target.checked); setOpenLabel(d.id); }}
              /> {DOC_LABELS[o] || o}
            </label>
          ))}
        </div>
      </details>
    );
  };

  const docCard = (d: SourceDocument) => {
    const title = `${d.name}${d.slideRef ? ` · slide ${d.slideRef}` : ''}`;
    return (
      <div className="x-file" key={d.id}>
        <div className="x-file-top">
          <div className="x-file-name"><Icon name="file" size={13} /><span title={title}>{title}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="x-file-meta">{d.size} · {d.addedStamp || '10 Oct, 14:02'}</span>
            <button className="icon-action" aria-label={`Inspect ${d.name}`} onClick={() => inspectDocument(d)}><Icon name="eye" size={14} /></button>
            {ed && <button className="icon-action" aria-label={`Remove ${d.name}`} title="Remove file" onClick={() => (draft ? removeDraftDocument(d.id) : removeDocument(d.id))}><Icon name="trash" size={14} /></button>}
          </div>
        </div>
        <div className="x-file-ctl">{typeMulti(d)}</div>
              </div>
    );
  };

  const slots = DOC_SLOTS.map(([type, label, example, formats, accept]) => {
    const list = docs.filter(d => docTypes(d)[0] === type), cover = docs.find(d => hasType(d, type));
    if (list.length) {
      // Several files per slot: keep "+ Add file" under the slot's files until the limit.
      return (
        <div key={type}>
          {list.map(docCard)}
        </div>
      );
    }
    if (cover) {
      return (
        <div key={type} className="x-slot" style={{ borderStyle: 'solid', background: '#f6faf7' }}>
          <div className="x-slot-main"><Icon name="check" size={14} /><div>
            <div className="x-slot-title"><b>{label}</b></div>
            <div className="x-slot-ex">Covered by {cover.name} (also labelled {DOC_LABELS[type] || type})</div>
          </div></div>
        </div>
      );
    }
    return (
      <div key={type} className="x-slot">
        <div className="x-slot-main"><Icon name="file" size={14} /><div>
          <div className="x-slot-title"><b>{label}</b></div>
          <div className="x-slot-ex">e.g. {example} · {formats}</div>
        </div></div>
        {ed
          ? <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}><button className="button" onClick={() => pick(type, accept || FILE_ACCEPT)}>+ Add file</button></span>
          : <span className="status">Empty</span>}
      </div>
    );
  });

  return (
    <>
      <AiaHeading asset={asset} title="Data Submission" />
      <AssetSubNav asset={asset} />
      <ExtractionProgress />
      <input ref={fileRef} type="file" accept={FILE_ACCEPT} multiple hidden onChange={onFilesPicked} />
      <div className="x-grid2s">
        <section className="x-card">
          <h2><Icon name="sliders" /> 1. Set up assessment <span className="x-opt"><span className="x-req">*</span> required</span></h2>
          <div className="x-form2">
            <label className="form-field" style={{ gridColumn: '1/-1' }}>
              <span className="field-label">Asset name<span className="x-req">*</span></span>
              <CommitInput className="input" id="aiaAssetName" data-setup="name" value={st.name} required disabled={!ed} onCommit={v => { updateSetup('name', v); }} />
            </label>
            <div className="form-field">
              <span className="field-label">Therapeutic Modality<span className="x-req">*</span></span>
              <SetupInput asset={asset} k="modality" ed={ed} />
            </div>
            <div className="form-field">
              <span className="field-label">Launch Markets<span className="x-req">*</span></span>
              <SetupInput asset={asset} k="launchMarkets" ed={ed} />
            </div>
          </div>
          <p className="small muted" style={{ margin: '10px 0 0' }}>
            After extraction, confirm the indications, phase and timelines on the Indications tab, review the Inputs tab and answer the Key Assumptions.
          </p>
        </section>
        <section className="x-card">
          <h2>
            <Icon name="upload" /> 2. Upload documents{' '}
            <button className="icon-action" aria-label="What to upload" title="What to upload" onClick={showUploadGuidance}><Icon name="info" size={15} /></button>
          </h2>
          {ed && (
            <div
              className={`x-drop ${dragover ? 'dragover' : ''}`}
              id="dropzone"
              role="button"
              tabIndex={0}
              aria-label="Add source documents"
              onDragOver={e => { e.preventDefault(); setDragover(true); }}
              onDragLeave={e => { if (e.target === e.currentTarget) setDragover(false); }}
              onDrop={onDrop}
              onKeyDown={onDropKey}
            >
              <div>
                <b>Drag &amp; drop files here, or <button className="link-button" onClick={() => pick()}>browse</button></b>
                <small>Competitive Intelligence, Trial Protocol Concept Sheet, Clinical Development Plan (CDP), Forecast Assumptions · PDF, Word, PowerPoint, Excel</small>
              </div>
            </div>
          )}
          {slots}
          {docs.filter(d => !DOC_TYPES.includes(docTypes(d)[0])).map(docCard)}
        </section>
      </div>
      <div className="x-foot">
        <span className="small">{draft
          ? 'Nothing is saved until you click Extract data with AI. One file per document type, 50 MB each.'
          : 'Uploaded files are stored securely. Click Extract data with AI to read them.'}</span>
        {draft
          ? ed && <button className="button primary x-cta" onClick={onCreate}>Extract data with AI →</button>
          : ed && <button className="button primary x-cta" disabled={extracting} onClick={extractAsset}>{extracting ? 'Extracting…' : 'Extract data with AI →'}</button>}
      </div>
    </>
  );
}
