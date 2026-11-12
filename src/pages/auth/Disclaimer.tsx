import { useEffect, useRef } from 'react';
import { acceptDisclaimer } from '../../actions/session';
import { DISCLAIMER_PARAGRAPHS } from '../../engine/constants';

/** Must be accepted after every sign-in before the workspace opens. */
export function Disclaimer() {
  const accept = useRef<HTMLButtonElement>(null);
  useEffect(() => { accept.current?.focus(); }, []);
  return (
    <div className="overlay" data-overlay="disclaimer">
      <section className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="disclaimerTitle">
        <header className="dialog-header">
          <div>
            <h2 id="disclaimerTitle">Disclaimer</h2>
            <p>Please read before continuing.</p>
          </div>
        </header>
        <div className="dialog-body disclaimer-body">
          {DISCLAIMER_PARAGRAPHS.map(p => <p key={p.slice(0, 24)}>{p}</p>)}
        </div>
        <footer className="dialog-footer">
          <button ref={accept} className="button primary" id="acceptDisclaimer" type="button" onClick={acceptDisclaimer}>I accept</button>
        </footer>
      </section>
    </div>
  );
}
