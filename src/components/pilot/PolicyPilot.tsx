/**
 * PolicyPilot: floating, draggable assistant available on every page.
 * Mock mode answers with the rule-based engine (engine/copilot.ts);
 * API mode sends the question to the Co-Pilot endpoint via copilotService.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent as RPointerEvent } from 'react';
import { copilotService } from '../../api';
import { subjectOf } from '../../actions/core';
import { pilotChips, pilotReply } from '../../engine/copilot';
import { clampN } from '../../engine/format';
import { getState } from '../../store/store';
import { Icon } from '../common/Icon';

const POS_KEY = 'pvoPilotPos';
interface Msg { role: 'user' | 'bot'; text: string }

function readPos(): { x: number; y: number } {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) return { x: p.x, y: p.y };
  } catch { /* ignore malformed storage */ }
  return { x: (window.innerWidth || 1200) - 84, y: (window.innerHeight || 800) - 96 };
}

const Bubble = ({ msg }: { msg: Msg }) => (
  <div className={`chat-msg ${msg.role}`}>
    {msg.text.split('\n').map((line, i, arr) => <span key={i}>{line}{i < arr.length - 1 && <br />}</span>)}
  </div>
);

export function PolicyPilot() {
  const [pos, setPos] = useState(readPos);
  const [open, setOpen] = useState(false);
  const [big, setBig] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [panelPos, setPanelPos] = useState({ left: 8, top: 8 });
  const fab = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean; fromFab: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Keep the button inside the viewport and the panel next to it (v03 placePilot). */
  const place = useCallback((p = pos) => {
    const vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
    const x = clampN(p.x, 8, vw - 62), y = clampN(p.y, 8, vh - 62);
    if (x !== p.x || y !== p.y) setPos({ x, y });
    if (open && panel.current) {
      const pw = panel.current.offsetWidth || 380, ph = panel.current.offsetHeight || 560;
      const left = clampN(x + 54 - pw, 8, Math.max(8, vw - pw - 8));
      let top = y - ph - 10;
      if (top < 8) top = Math.min(y + 54 + 10, vh - ph - 8);
      setPanelPos({ left, top: Math.max(8, top) });
    }
  }, [pos, open]);

  useLayoutEffect(() => { place(); }, [place, big]);
  useEffect(() => {
    const onResize = () => place();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [place]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [msgs, open]);

  const down = (e: RPointerEvent<HTMLElement>, fromFab: boolean) => {
    if (e.button !== 0) return;
    if (!fromFab && (e.target as HTMLElement).closest('button')) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false, fromFab };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: RPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    setDragging(true);
    setPos({ x: d.ox + dx, y: d.oy + dy });
  };
  const up = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    if (d.moved) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* storage blocked */ }
    } else if (d.fromFab) setOpen(o => !o);
  };

  const close = (reset: boolean) => {
    setOpen(false);
    if (reset) { setMsgs([]); setBig(false); }
    fab.current?.focus();
  };

  async function ask(raw: string) {
    const text = raw.trim().slice(0, 300);
    if (!text || busy) return;
    setQuestion('');
    setMsgs(m => [...m, { role: 'user', text }]);
    setBusy(true);
    const s = getState();
    const ctx = s.page === 'assetAnalysis' && s.aiaMode === 'asset' ? subjectOf(s) : null;
    try {
      const res = await copilotService.ask(text, ctx?.id ?? null, () => pilotReply(s, ctx, text));
      const cites = res.citations?.length ? '\nSources: ' + res.citations.map(c => c.title).join('; ') : '';
      setMsgs(m => [...m, { role: 'bot', text: res.text + cites }]);
    } catch (e) {
      setMsgs(m => [...m, { role: 'bot', text: e instanceof Error ? e.message : 'The assistant is unavailable right now.' }]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void ask(question); };
  const intro: Msg = { role: 'bot', text: 'Hi, I\'m PolicyPilot. I help with questions about the policies in scope in this tool, and any existing asset assessments. This is a demo assistant, so answers come from the illustrative content in the tool.' };

  return (
    <div id="pilotRoot">
      <button
        ref={fab}
        type="button"
        id="pilotFab"
        className={`pilot-fab ${dragging ? 'dragging' : ''}`}
        aria-label="Open PolicyPilot, AI assistant"
        aria-expanded={open}
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={e => down(e, true)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={e => { if (e.detail === 0) setOpen(o => !o); }}
      >
        <Icon name="spark" size={22} />
        <i className="pilot-dot" />
        <span className="pilot-tip">PolicyPilot</span>
      </button>
      <section
        ref={panel}
        id="pilotPanel"
        className={`pilot-panel ${big ? 'big' : ''}`}
        role="region"
        aria-label="PolicyPilot assistant"
        hidden={!open}
        style={{ left: panelPos.left, top: panelPos.top }}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } }}
      >
        <header className="pilot-head" id="pilotHead" onPointerDown={e => down(e, false)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="pilot-avatar"><Icon name="spark" size={18} /></span>
          <div className="pilot-title"><b>PolicyPilot</b><span><i className="pilot-online" />Online · AI assistant</span></div>
          <button type="button" className="pilot-hbtn" aria-label="Expand or restore size" title="Expand" onClick={() => setBig(b => !b)}>+</button>
          <button type="button" className="pilot-hbtn" aria-label="Minimize" title="Minimize" onClick={() => close(false)}>&minus;</button>
          <button type="button" className="pilot-hbtn" aria-label="Close and clear chat" title="Close" onClick={() => close(true)}>&times;</button>
        </header>
        <div ref={log} id="pilotLog" className="pilot-log" aria-live="polite">
          <Bubble msg={intro} />
          {msgs.map((m, i) => <Bubble key={i} msg={m} />)}
          {busy && <div className="chat-msg bot">…</div>}
        </div>
        <div className="pilot-chips pilot-chips-dock" aria-label="Suggested questions">
          {pilotChips().map(c => <button key={c} type="button" className="pilot-chip" title={c} onClick={() => void ask(c)}>{c}</button>)}
        </div>
        <form id="chatForm" className="pilot-form" onSubmit={onSubmit}>
          <input ref={input} className="input" name="q" maxLength={300} autoComplete="off" placeholder="Ask about a policy or existing assessment" aria-label="Ask about a policy or existing assessment" value={question} onChange={e => setQuestion(e.target.value)} />
          <button className="button primary" type="submit" disabled={busy}>Send</button>
        </form>
        <p className="pilot-note">Demo assistant: answers come from illustrative content in this tool, not from approved policy documents. Verify before acting. Do not enter confidential information.</p>
      </section>
    </div>
  );
}
