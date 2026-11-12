/** Small presentational pieces reused across pages (same markup/classes as v03). */
import type { ReactNode } from 'react';
import { showInfo } from '../../ui/overlay';
import { Icon } from './Icon';

/** ⓘ button that opens the "About this view" dialog. */
export function InfoButton({ label, text }: { label: string; text: string }) {
  return (
    <button
      type="button"
      className="icon-action"
      aria-label={label}
      title={label}
      onClick={e => { e.stopPropagation(); showInfo(text); }}
    >
      <Icon name="info" size={15} />
    </button>
  );
}

export function PolicyPills({ items }: { items: readonly string[] }) {
  return <>{items.map(p => <span key={p} className="policy-tag">{p}</span>)}</>;
}

export function KpiCard({ label, value, icon, valueStyle }: { label: string; value: ReactNode; icon: string; valueStyle?: React.CSSProperties }) {
  return (
    <div className="compact-kpi">
      <span className="kpi-icon"><Icon name={icon} /></span>
      <div>
        <div className="kpi-number" style={valueStyle}>{value}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

interface PageHeadingProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: string;
}

export function PageHeading({ eyebrow, title, description, actions, icon }: PageHeadingProps) {
  return (
    <div className="page-heading">
      <div className="page-heading-main">
        {icon && <span className="heading-icon"><Icon name={icon} size={17} /></span>}
        <div>
          <p className="eyebrow">Global Policy Value Optimizer · {eyebrow}</p>
          <h1>{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

export function RoleBanner({ role }: { role: string }) {
  const [title, note] = role === 'Admin'
    ? ['Admin publish mode', 'Can approve and publish reviewed changes.']
    : role === 'Editor'
      ? ['Editor review mode', 'Can review and submit changes; publishing is restricted.']
      : ['Viewer access', 'Read-only access to governance controls.'];
  return (
    <div className="role-banner">
      <Icon name="users" size={14} />
      <strong>{title}</strong>
      <span className="muted">{note}</span>
    </div>
  );
}

/** Two-column key/value list used in drawers (`.evidence-meta`). */
export function MetaList({ rows, style }: { rows: [ReactNode, ReactNode][]; style?: React.CSSProperties }) {
  return (
    <div className="evidence-meta" style={style}>
      {rows.map(([k, v], i) => (
        <KeyVal key={i} k={k} v={v} />
      ))}
    </div>
  );
}
function KeyVal({ k, v }: { k: ReactNode; v: ReactNode }) {
  return <><b>{k}</b><span>{v}</span></>;
}
