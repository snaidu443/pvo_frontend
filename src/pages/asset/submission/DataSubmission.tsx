/** Data Submission tab (v07 renderAiaSubmission): set-up form, document slots and "Extract data with AI". */
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { addFiles, extractData, removeDocument, setDocumentLabel, updateSetup, type UploadOptions } from '../../../actions/assessment';
import { hasDraftFiles, resumeExtraction, retryExtraction } from '../../../actions/submission';
import { SUBMISSION_LIMITS } from '../../../api';
import { CommitInput } from '../../../components/common/CommitInput';
import { isMock } from '../../../config/env';
import { Icon } from '../../../components/common/Icon';
import { ASSET_AREAS, DOC_LABELS, DOC_SLOTS, DOC_TYPES, FILE_ACCEPT, UPLOAD_GUIDANCE } from '../../../engine/constants';
import { INPUT_ITEM } from '../../../engine/inputCatalogue';
import { readInput } from '../../../engine/inputs';
import { canEditAiaInputs } from '../../../engine/permissions';
import { aia, assetDocs, docTypes, hasType } from '../../../engine/workspace';
import { DRAFT_ID } from '../../../store/slices/assessmentSlice';
import { useAppState } from '../../../store/store';
import type { Asset, SourceDocument } from '../../../types/domain';
import { closeDrawer, closeModal, openDrawer, openModal } from '../../../ui/overlay';
import { AiaHeading, AssetSubNav } from '../AssetFrame';
import { InputEditor } from '../inputs/InputEditor';

const SCAN_LABEL: Record<string, string> = {
  pending_scan: 'Waiting for the scan', clean: 'Clean', infected: 'Threat found · file removed', failed: 'Scan failed', no_file: 'No file stored'
};

const JOB_TEXT: Record<string, string> = {
  queued: 'Extraction is queued on the server.',
  waiting_for_scan: 'Your files are waiting for the malware scan. Extraction starts once every file is marked clean.',
  running: 'Extraction is running on the server.',
  done: 'Server extraction finished.'
};

/** API mode: status of the latest server extraction job for this asset, with Retry after a failure. */
function ExtractionStatus({ asset, ed }: { asset: Asset; ed: boolean }) {
  const s = useAppState(), job = s.extractionJobs[asset.id];
  useEffect(() => {
    if (!isMock() && ['extracting', 'extraction_failed'].includes(asset.workflowStatus || '')) resumeExtraction(asset.id);
  }, [asset.id, asset.workflowStatus]);
  if (isMock() || !job) return null;
  const failed = job.status === 'failed';
  return (
    <div className={failed ? 'banner' : 'banner info'} role="status" style={{ marginBottom: 12 }}>
      <Icon name={failed ? 'alert' : 'info'} />
      <div style={{ flex: 1 }}>
        {failed ? job.error || 'Extraction failed.' : JOB_TEXT[job.status]}
        {job.status === 'done' && job.fieldsFound > 0 && ` ${job.fieldsFound} inputs found.`}
      </div>
      {failed && ed && <button className="button" onClick={() => { void retryExtraction(asset.id); }}>Retry</button>}
    </div>
  );
}

/** Unique option list with the current value first (v03 `opt`). */
const optList = (list: string[], val: string) => [...new Set([val, ...list].filter(Boolean))];

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
          {!isMock() && <><b>Malware scan</b><span>{SCAN_LABEL[d.scanStatus || ''] || 'Not uploaded yet'}</span></>}
        </div>
        <div className="divider" />
        <div className="banner info"><Icon name="info" /><div>{isMock()
          ? 'This is a demo file record. File bytes are not uploaded to a server or parsed.'
          : 'Files are uploaded when you click Extract data with AI, and are only read after the malware scan marks them clean.'}</div></div>
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
  const fileRef = useRef<HTMLInputElement>(null);
  const pickOpts = useRef<UploadOptions>({});
  const [openLabel, setOpenLabel] = useState<number | null>(null);
  const [dragover, setDragover] = useState(false);
  const draft = asset.id === DRAFT_ID, api = !isMock();

  // API mode: picked files live in memory until Extract; warn before the page is left or reloaded.
  useEffect(() => {
    if (!api || !draft) return;
    const onLeave = (e: BeforeUnloadEvent) => { if (hasDraftFiles()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [api, draft]);

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

  const pick = (opts: UploadOptions, accept = FILE_ACCEPT) => {
    const input = fileRef.current;
    if (!input) return;
    pickOpts.current = opts;
    input.accept = accept;
    input.click();
  };
  const onFilesPicked = () => {
    const input = fileRef.current;
    if (!input) return;
    if (input.files?.length) addFiles(input.files, pickOpts.current);
    input.value = '';
    input.accept = FILE_ACCEPT;
    pickOpts.current = {};
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragover(true); };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) setDragover(false); };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragover(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };
  const onDropKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick({}); }
  };

  const onExtract = async () => {
    if (await extractData() === 'name-required') {
      const el = document.getElementById('aiaAssetName') as HTMLInputElement | null;
      el?.reportValidity();
      el?.focus();
    }
  };

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
            {ed && <button className="icon-action" aria-label={`Remove ${d.name}`} onClick={() => removeDocument(d.id)}><Icon name="trash" size={14} /></button>}
          </div>
        </div>
        <div className="x-file-ctl">{typeMulti(d)}</div>
        {/\.xlsm$/i.test(d.name) && (
          <div className="small muted" style={{ marginTop: 7, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <Icon name="alert" size={12} /><span>Macro-enabled file: macros are never run and the contents are not opened in this demo.</span>
          </div>
        )}
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
          {ed && list.length < SUBMISSION_LIMITS.perType && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-2px 0 10px' }}>
              <button className="button" onClick={() => pick({ forcedType: type }, accept || FILE_ACCEPT)} aria-label={`Add another ${label} file`}>+ Add file</button>
            </div>
          )}
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
          ? <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}><button className="button" onClick={() => pick({ forcedType: type }, accept || FILE_ACCEPT)}>+ Add file</button></span>
          : <span className="status">Empty</span>}
      </div>
    );
  });

  return (
    <>
      <AiaHeading asset={asset} title="Data Submission" />
      <AssetSubNav asset={asset} />
      {!draft && <ExtractionStatus asset={asset} ed={ed} />}
      <input ref={fileRef} type="file" accept={FILE_ACCEPT} multiple hidden onChange={onFilesPicked} />
      <div className="x-grid2s">
        <section className="x-card">
          <h2><Icon name="sliders" /> 1. Set up assessment <span className="x-opt"><span className="x-req">*</span> required</span></h2>
          <div className="x-form2">
            <label className="form-field" style={{ gridColumn: '1/-1' }}>
              <span className="field-label">Asset name<span className="x-req">*</span></span>
              <CommitInput className="input" id="aiaAssetName" data-setup="name" value={st.name} required disabled={!ed} onCommit={v => { updateSetup('name', v); }} />
            </label>
            <label className="form-field">
              <span className="field-label">Therapeutic area</span>
              <select className="select" data-setup="area" value={st.area} disabled={!ed} onChange={e => updateSetup('area', e.target.value)}>
                {!st.area && <option value="">Select area</option>}
                {optList(ASSET_AREAS, st.area).map(o => <option key={o}>{o}</option>)}
              </select>
            </label>
            <div className="form-field">
              <span className="field-label">Therapeutic Modality<span className="x-req">*</span></span>
              <SetupInput asset={asset} k="modality" ed={ed} />
            </div>
            <div className="form-field" style={{ gridColumn: '1/-1' }}>
              <span className="field-label">JCA Insights Availability <span className="x-opt">(optional · competitor input)</span></span>
              <SetupInput asset={asset} k="jcaInsights" ed={ed} />
              <span className="small muted" style={{ marginTop: 4 }}>Are there published JCA assessment scopes and reports for competitor products in the same or adjacent indications?</span>
            </div>
            <div className="form-field">
              <span className="field-label">Regulatory Strategy Alignment <span className="x-opt">(optional)</span></span>
              <SetupInput asset={asset} k="regStrategy" ed={ed} />
              <span className="small muted" style={{ marginTop: 4 }}>Has the regulatory strategy already planned alignment with JCA delivery (MAA timing, indication wording, label scenarios, sequencing)?</span>
            </div>
            <div className="form-field">
              <span className="field-label">EU Markets Access Challenge <span className="x-opt">(optional)</span></span>
              <SetupInput asset={asset} k="euAccess" ed={ed} />
              <span className="small muted" style={{ marginTop: 4 }}>Are there any EU markets with predicted access challenges?</span>
            </div>
          </div>
          <p className="small muted" style={{ margin: '10px 0 0' }}>
            Indication-level inputs you enter yourself (orphan designations, Medicare coverage, payer mix and others) are asked on the Indications tab once the indications are confirmed.
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
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onKeyDown={onDropKey}
            >
              <div>
                <b>Drag &amp; drop files here, or <button className="link-button" onClick={() => pick({})}>browse</button></b>
                <small>Competitive Intelligence, Trial Protocol Concept Sheet, Clinical Development Plan (CDP), Forecast Assumptions · PDF, Word, PowerPoint, Excel</small>
              </div>
            </div>
          )}
          {slots}
          {docs.filter(d => !DOC_TYPES.includes(docTypes(d)[0])).map(docCard)}
        </section>
      </div>
      <div className="x-foot">
        <span className="small">{!api
          ? 'Document records are saved in this browser only; file contents are never stored.'
          : draft
            ? `Nothing is saved until you click Extract data with AI. Up to ${SUBMISSION_LIMITS.perType} files per document type, ${SUBMISSION_LIMITS.fileBytes / 1024 / 1024} MB each.`
            : 'Files are stored securely and read only after the malware scan marks them clean.'}</span>
        {ed && <button className="button primary x-cta" onClick={onExtract}>Extract data with AI →</button>}
      </div>
    </>
  );
}
