/** Settings · User management (v03 renderMultiAssetUsers + multiAssetUserForm). */
import { useEffect, useState, type FormEvent } from 'react';
import { goPage } from '../../actions/navigation';
import { resendInvite, saveUserForm, setUserFilter, toggleUserActive } from '../../actions/portfolio';
import { KpiCard, PageHeading, RoleBanner } from '../../components/common/Common';
import { Icon } from '../../components/common/Icon';
import { canManage, canSeeUsers, visibleAssets } from '../../engine/permissions';
import { getState, useAppState } from '../../store/store';
import type { Asset, Role, User } from '../../types/domain';
import { closeModal, openModal, toast } from '../../ui/overlay';

const ROLES: Role[] = ['Admin', 'Editor', 'Viewer'];
const roleClass = (r: Role) => (r === 'Admin' ? 'super' : r === 'Editor' ? 'admin' : 'user');

function UserForm({ user }: { user: User | null }) {
  const assets = getState().assets;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: (user?.role || 'Viewer') as Role,
    status: (user ? user.status : 'active') as User['status'],
    assetIds: new Set(user?.assetIds || [])
  });
  const toggleAsset = (id: string, on: boolean) => {
    const next = new Set(form.assetIds);
    if (on) next.add(id); else next.delete(id);
    setForm({ ...form, assetIds: next });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Keep asset order as listed, as FormData.getAll did in v03.
    saveUserForm({ userId: user?.id ?? null, name: form.name, email: form.email, role: form.role, status: form.status, assetIds: assets.filter(a => form.assetIds.has(a.id)).map(a => a.id) });
  };
  return (
    <form id="userForm" onSubmit={submit}>
      <input type="hidden" name="userId" value={user?.id ?? ''} />
      <div className="asset-input-grid">
        <label className="form-field"><span className="field-label">Full name</span>
          <input className="input" name="name" required maxLength={60} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="form-field"><span className="field-label">Email</span>
          <input className="input" name="email" type="email" required maxLength={80} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="form-field"><span className="field-label">Role</span>
          <select className="select" name="role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
        </label>
        <label className="form-field"><span className="field-label">Account status</span>
          <select className="select" name="status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as User['status'] })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending invite</option>
          </select>
        </label>
      </div>
      <div className="detail-section">
        <h3>Assigned assets</h3>
        <div className="asset-policy-choices">
          {assets.map(a => (
            <label key={a.id} className="asset-policy-choice">
              <input type="checkbox" name="assetIds" value={a.id} checked={form.assetIds.has(a.id)} onChange={e => toggleAsset(a.id, e.target.checked)} />{a.assetCode}
            </label>
          ))}
        </div>
      </div>
      <p className="small muted">Assignments and role changes are stored in this browser session only.</p>
    </form>
  );
}

function openUserForm(user: User | null = null) {
  if (!canManage(getState().role)) { toast('User management is restricted to Admin.'); return; }
  const editing = Boolean(user);
  openModal({
    title: editing ? 'Edit user and asset access' : 'Add user',
    body: <UserForm user={user} />,
    footer: <><button className="button" onClick={closeModal}>Cancel</button><button className="button primary" type="submit" form="userForm">{editing ? 'Save changes' : 'Add user'}</button></>
  });
}

export function UsersPage() {
  const s = useAppState();
  const allowed = canSeeUsers(s.role);
  // v03 redirected while rendering; here the redirect runs after render.
  useEffect(() => { if (!allowed) goPage('overview'); }, [allowed]);
  if (!allowed) return null;

  const scoped = visibleAssets(s), filterAssets = s.role === 'Admin' ? s.assets : scoped, q = s.userSearch.toLowerCase();
  const assetById = (id: string) => s.assets.find(a => a.id === id);
  const users = s.users.filter(user =>
    (s.role === 'Admin' || user.assetIds?.some(id => scoped.some(asset => asset.id === id))) &&
    (s.userAssetFilter === 'All assets' || user.assetIds?.includes(s.userAssetFilter)) &&
    (s.userRoleFilter === 'All roles' || user.role === s.userRoleFilter) &&
    (!q || `${user.name} ${user.email} ${user.assetIds?.map(id => assetById(id)?.assetCode).join(' ')}`.toLowerCase().includes(q)));
  const management = canManage(s.role), pending = s.users.filter(u => u.status === 'pending').length;

  return (
    <>
      <PageHeading
        eyebrow="Assets workspace"
        title="User management"
        description="Manage user roles and the assets they can review."
        actions={management
          ? <button className="button primary" onClick={() => openUserForm()}><Icon name="plus" /> Add user</button>
          : <span className="status blue">Editor · Read only</span>}
        icon="users"
      />
      <RoleBanner role={s.role} />
      <div className="compact-kpis">
        <KpiCard label="Total users" value={s.users.length} icon="users" />
        <KpiCard label="Active users" value={s.users.filter(u => u.status === 'active').length} icon="governance" />
        <KpiCard label="Pending invites" value={pending} icon="clock" />
        <KpiCard label="Admins" value={s.users.filter(u => u.role === 'Admin').length} icon="impact" />
      </div>
      <div className="toolbar">
        <div className="toolbar-left"><span className="small muted">{users.length} users · {scoped.length} visible assets</span></div>
        <div className="toolbar-right">
          <input className="input search" id="userSearch" type="search" placeholder="Search name, email, asset" aria-label="Search users" value={s.userSearch} onChange={e => setUserFilter('userSearch', e.target.value)} />
          <select className="select" id="userRoleFilter" style={{ width: 140 }} value={s.userRoleFilter} onChange={e => setUserFilter('userRoleFilter', e.target.value)}>
            <option>All roles</option>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
          <select className="select" id="userAssetFilter" style={{ width: 170 }} value={s.userAssetFilter} onChange={e => setUserFilter('userAssetFilter', e.target.value)}>
            <option>All assets</option>
            {filterAssets.map(a => <option key={a.id} value={a.id}>{a.assetCode}</option>)}
          </select>
        </div>
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Assigned assets</th><th>Last active</th><th>Actions</th></tr></thead>
            <tbody>
              {users.length ? users.map(user => {
                const assigned = (user.assetIds || []).map(assetById).filter((a): a is Asset => Boolean(a));
                return (
                  <tr key={user.id}>
                    <td><div className="table-primary">{user.name}</div><div className="table-secondary">{user.email}</div></td>
                    <td><span className={`role-pill ${roleClass(user.role)}`}>{user.role}</span></td>
                    <td>
                      <span className={`status ${user.status === 'active' ? 'green' : user.status === 'pending' ? 'amber' : 'red'}`}>
                        {user.status === 'active' ? 'Active' : user.status === 'pending' ? 'Pending' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <strong>{assigned.length}</strong>
                      <div className="table-secondary">
                        {assigned.slice(0, 2).map(a => a.assetCode).join(' · ') || 'No assets assigned'}{assigned.length > 2 ? ` · +${assigned.length - 2}` : ''}
                      </div>
                    </td>
                    <td>{user.last}</td>
                    <td>
                      {management ? (
                        <div className="action-wrap">
                          <button className="table-action" onClick={() => openUserForm(user)}>Edit</button>
                          <button className="table-action" onClick={() => openUserForm(user)}>Assign assets</button>
                          {user.status === 'pending'
                            ? <button className="table-action" onClick={() => resendInvite(user.id)}>Resend invite</button>
                            : <button className="table-action" onClick={() => toggleUserActive(user.id)}>{user.active ? 'Deactivate' : 'Activate'}</button>}
                        </div>
                      ) : <span className="small muted">View only</span>}
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={6}><div className="empty-state">No users match this asset scope.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <h2 className="section-title">Recent activity</h2>
      <section className="panel pad">
        <div className="cta-list">
          {s.activity.slice(0, 5).map((entry, i) => (
            <div key={i} className="cta-row">
              <div><div className="cta-title">{entry.event}</div><div className="cta-note">{entry.user} · {entry.time}</div></div>
              <span className="status">Activity</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
