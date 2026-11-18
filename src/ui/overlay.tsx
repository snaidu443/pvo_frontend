/**
 * Overlay state: modal, drawer, toast and the analysis loader.
 * Kept apart from the app store because it holds React nodes (not cloneable).
 * Callable from anywhere: actions, event handlers and components.
 */
import { useSyncExternalStore, type ReactNode } from 'react';

export interface ModalSpec {
  title: ReactNode;
  body: ReactNode;
  footer?: ReactNode;
  small?: boolean;
}
export interface DrawerSpec {
  title: ReactNode;
  body: ReactNode;
  footer?: ReactNode;
  /** 880px side-by-side layout (rule citations, policy findings). */
  wide?: boolean;
}
export interface LoaderSpec {
  title: string;
  steps: string[];
  /** Index of the running step; steps before it are done. Equals steps.length when finished. */
  active: number;
}

interface OverlayState {
  modal: ModalSpec | null;
  drawer: DrawerSpec | null;
  toast: { id: number; message: string } | null;
  loader: LoaderSpec | null;
}

let state: OverlayState = { modal: null, drawer: null, toast: null, loader: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<OverlayState>) => {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useOverlay = () => useSyncExternalStore(subscribe, () => state, () => state);

export const openModal = (spec: ModalSpec) => set({ modal: spec });
export const closeModal = () => set({ modal: null });
export const openDrawer = (spec: DrawerSpec) => set({ drawer: spec });
export const closeDrawer = () => set({ drawer: null });

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastSeq = 0;
export function toast(message: string, ms = 2800) {
  clearTimeout(toastTimer);
  set({ toast: { id: ++toastSeq, message } });
  toastTimer = setTimeout(() => set({ toast: null }), ms);
}

export const isLoaderRunning = () => state.loader !== null;

/** Step-by-step analysis overlay (650 ms per step, as in v03). Resolves when it closes. */
export function runLoader(title: string, steps: string[]): Promise<void> {
  if (state.loader) return Promise.reject(new Error('A run is already in progress.'));
  return new Promise(resolve => {
    const advance = (i: number) => {
      set({ loader: { title, steps, active: i } });
      if (i >= steps.length) {
        setTimeout(() => {
          set({ loader: null });
          resolve();
        }, 350);
        return;
      }
      setTimeout(() => advance(i + 1), 650);
    };
    advance(0);
  });
}

/** Confirmation dialog with Cancel and a danger-styled confirm button. */
export function confirmAction(title: string, message: ReactNode, confirmLabel: string, onConfirm: () => void) {
  openModal({
    title,
    small: true,
    body: <p className="small" style={{ lineHeight: 1.6 }}>{message}</p>,
    footer: (
      <>
        <button className="button" onClick={closeModal}>Cancel</button>
        <button className="button danger" onClick={() => { closeModal(); onConfirm(); }}>{confirmLabel}</button>
      </>
    )
  });
}

/** "About this view" info dialog used by the ⓘ buttons. */
export function showInfo(text: string) {
  openModal({
    title: 'About this view',
    small: true,
    body: <p className="small" style={{ lineHeight: 1.65 }}>{text}</p>,
    footer: <button className="button primary" onClick={closeModal}>Close</button>
  });
}
