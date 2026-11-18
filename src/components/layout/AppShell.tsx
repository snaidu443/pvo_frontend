import { useEffect, useRef } from 'react';
import { goPage, selectAssetFromHeader } from '../../actions/navigation';
import { signOut, switchRole } from '../../actions/session';
import { isMock } from '../../config/env';
import { ASSET_SUB_PAGES, NAV_ITEMS, type NavItem } from '../../engine/constants';
import { lastRefreshDate, newDocumentCount } from '../../engine/monitoring';
import { canManage, canSeeUsers, visibleAssets } from '../../engine/permissions';
import { AssetAnalysisPage } from '../../pages/asset/AssetAnalysisPage';
import { OverviewPage } from '../../pages/overview/OverviewPage';
import { MonitoringPage } from '../../pages/settings/MonitoringPage';
import { RulesPage } from '../../pages/settings/RulesPage';
import { UsersPage } from '../../pages/settings/UsersPage';
import type { AppState } from '../../store/appState';
import { useAppState } from '../../store/store';
import type { Role } from '../../types/domain';
import { Icon } from '../common/Icon';
import { openTour } from '../tour/Tour';

function badgeValue(s: AppState, key: NavItem['badge']): string {
  if (key === 'ewsFindings') return newDocumentCount(s.monitoring) + ' new docs';
  if (key === 'invites') return s.users.filter(u => u.status === 'pending').length + ' invites';
  return '';
}

function Sidebar() {
  const s = useAppState();
  const nav = NAV_ITEMS.filter(i => i.id !== 'governance' && (!i.admin || canSeeUsers(s.role)) && (!i.adminOnly || canManage(s.role)));
  const group = (label: string, items: NavItem[]) => items.length ? (
    <>
      <div className="nav-label">{label}</div>
      {items.map(item => (
        <button key={item.id} className={`nav-link ${s.page === item.id ? 'active' : ''}`} onClick={() => goPage(item.id)}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
          {item.badge && <span className="nav-badge">{badgeValue(s, item.badge)}</span>}
        </button>
      ))}
    </>
  ) : null;
  return (
    <aside className="sidebar" id="sidebar" aria-label="Primary navigation">
      <div className="brand">
        <img src="/takeda-logo.png" alt="Takeda" />
        <div><div className="brand-name">Global Policy<br />Value Optimizer</div><div className="brand-sub">Oncology portfolio</div></div>
      </div>
      <nav className="nav-list" id="primaryNav">
        {group('Workspace', nav.filter(i => i.group !== 'settings'))}
        {group('Settings', nav.filter(i => i.group === 'settings'))}
      </nav>
      <div className="sidebar-bottom">
        <strong>Takeda Oncology portfolio</strong><br />
        <span>{visibleAssets(s).length} assets · Illustrative data</span><br />
        <span>Trinity Life Sciences · 2026</span>
      </div>
    </aside>
  );
}

/** Up to two initials from the display name, e.g. "Demo Admin" → "DA". */
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

/** Signed-in user (name + role) at the right end of the top bar. */
function UserChip({ name, role }: { name: string; role: Role }) {
  return (
    <div className="user-chip" id="userChip" title={`Signed in as ${name} (${role})`}>
      <span className="user-avatar" aria-hidden="true">{initials(name)}</span>
      <span className="user-chip-text">
        <strong>{name}</strong>
        <small>{role}</small>
      </span>
    </div>
  );
}

function Topbar() {
  const s = useAppState(), assets = visibleAssets(s);
  const asset = s.assets.find(a => a.id === s.selectedAssetId);
  const subLabel = (ASSET_SUB_PAGES.find(x => x[0] === s.assetSubPage) || ASSET_SUB_PAGES[0])[1];
  const crumb = s.page === 'assetAnalysis'
    ? (s.aiaMode === 'new' || !asset ? `Asset Impact Analysis · ${subLabel}` : `${asset.assetCode} · ${subLabel}`)
    : (NAV_ITEMS.find(x => x.id === s.page) || NAV_ITEMS[0]).label;
  const newDocs = newDocumentCount(s.monitoring), refreshed = lastRefreshDate(s.monitoring);
  const selected = s.page === 'assetAnalysis' && s.aiaMode !== 'new' ? s.selectedAssetId : 'portfolio';
  return (
    <header className="topbar">
      <button className="mobile-menu" aria-label="Open navigation" title="Open navigation" onClick={() => document.body.classList.toggle('nav-open')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <div className="crumb"><span>Takeda Oncology</span><span aria-hidden="true">/</span><strong id="crumbPage">{crumb}</strong></div>
      <div className="top-actions">
        <select className="asset-select" id="assetSelect" aria-label="Selected asset" value={selected} onChange={e => selectAssetFromHeader(e.target.value)}>
          <option value="portfolio">Assets overview</option>
          {assets.map(a => <option key={a.id} value={a.id}>{a.assetCode}</option>)}
        </select>
        {isMock() && ( /* demo role preview; in API mode the server-assigned role applies */
          <label className="role-control">
            <span>View as</span>
            <select className="role-select" id="roleSelect" aria-label="Switch demo role" value={s.role} onChange={e => switchRole(e.target.value as Role)}>
              <option>Admin</option><option>Editor</option><option>Viewer</option>
            </select>
          </label>
        )}
        <span className="bundle-pill" id="bundlePill"><i />{newDocs ? `${newDocs} new policy documents · ${refreshed}` : `No new policy documents · ${refreshed}`}</span>
        <button className="tour-button" id="tourButton" onClick={() => openTour()}><Icon name="tour" size={15} />Take a Tour</button>
        <button className="tour-button" id="signOutButton" style={{ color: 'var(--ink)', borderColor: 'var(--line)' }} onClick={() => { void signOut(); }}>Sign out</button>
        <UserChip name={s.session?.name || 'Signed-in user'} role={s.role} />
      </div>
    </header>
  );
}

function CurrentPage() {
  const { page } = useAppState();
  switch (page) {
    case 'assetAnalysis': return <AssetAnalysisPage />;
    case 'users': return <UsersPage />;
    case 'monitoring': return <MonitoringPage />;
    case 'rules': return <RulesPage />;
    default: return <OverviewPage />;
  }
}

export function AppShell() {
  const { page, assetSubPage } = useAppState();
  const main = useRef<HTMLElement>(null);
  // Keep keyboard/screen-reader focus at the top of the content after navigating (as v03 did on every render).
  useEffect(() => { main.current?.focus({ preventScroll: true }); }, [page, assetSubPage]);
  return (
    <div className="shell">
      <Sidebar />
      <div className="mobile-nav-backdrop" id="navBackdrop" onClick={() => document.body.classList.remove('nav-open')} />
      <div className="main">
        <Topbar />
        <main id="mainContent" ref={main} tabIndex={-1}><CurrentPage /></main>
        <footer style={{ padding: '0 34px 22px', color: '#858a8d', fontSize: 10 }}>© 2026 Trinity · Prepared for Takeda · Sample data · Illustrative figures · Mockup v0.1</footer>
      </div>
    </div>
  );
}
