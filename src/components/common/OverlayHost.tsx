import { useEffect, useRef } from 'react';
import { closeDrawer, closeModal, useOverlay } from '../../ui/overlay';
import { Icon } from './Icon';

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';

/** Renders the modal, drawer, toast and analysis loader with the v03 markup and keyboard behaviour. */
export function OverlayHost() {
  const { modal, drawer, toast, loader } = useOverlay();
  const modalRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Move focus into a newly opened dialog.
  useEffect(() => { modalRef.current?.querySelector<HTMLElement>('button,input,select')?.focus(); }, [modal]);
  useEffect(() => { drawerRef.current?.querySelector<HTMLElement>('button')?.focus(); }, [drawer]);

  // Escape closes; Tab stays inside the open dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loader) {
        if ((document.activeElement as HTMLElement | null)?.closest?.('#pilotPanel')) return;
        closeModal();
        closeDrawer();
      }
      if (e.key === 'Tab') {
        const dialog = modalRef.current ?? drawerRef.current;
        if (!dialog) return;
        const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [loader]);

  return (
    <>
      {modal && (
        <div className="overlay" data-overlay="modal">
          <section ref={modalRef} className={`dialog ${modal.small ? 'small-dialog' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialogTitle">
            <header className="dialog-header">
              <div><h2 id="dialogTitle">{modal.title}</h2></div>
              <button className="icon-action" onClick={closeModal} aria-label="Close dialog"><Icon name="close" /></button>
            </header>
            <div className="dialog-body">{modal.body}</div>
            {modal.footer && <footer className="dialog-footer">{modal.footer}</footer>}
          </section>
        </div>
      )}
      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={closeDrawer} />
          <aside ref={drawerRef} className={`drawer ${drawer.wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
            <header className="dialog-header">
              <div><h2 id="drawerTitle">{drawer.title}</h2></div>
              <button className="icon-action" onClick={closeDrawer} aria-label="Close panel"><Icon name="close" /></button>
            </header>
            <div className="dialog-body">{drawer.body}</div>
            {drawer.footer && <footer className="dialog-footer">{drawer.footer}</footer>}
          </aside>
        </>
      )}
      <div id="toastRoot" aria-live="polite" aria-atomic="true">
        {toast && <div key={toast.id} className="toast" role="status">{toast.message}</div>}
      </div>
      {loader && (
        <div className="analysis-overlay" role="dialog" aria-modal="true" aria-labelledby="analysisTitle">
          <section className="analysis-card">
            <div className="analysis-head">
              <span className="analysis-spin" aria-hidden="true" />
              <h2 id="analysisTitle">{loader.title}</h2>
            </div>
            <div className="analysis-bar"><i style={{ width: `${Math.round(loader.active / loader.steps.length * 100)}%` }} /></div>
            <div aria-live="polite">
              {loader.steps.map((label, i) => {
                const cls = i < loader.active ? 'done' : i === loader.active ? 'active' : '';
                return (
                  <div key={label} className={`analysis-step ${cls}`}>
                    <span className="mark">{cls === 'done' ? '✓' : cls === 'active' ? <span className="analysis-spin small" /> : null}</span>
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
