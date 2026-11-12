import { useState, type FormEvent } from 'react';
import { signIn } from '../../actions/session';
import { isMock } from '../../config/env';
import { useAppState } from '../../store/store';
import type { Role } from '../../types/domain';

export function LoginPage() {
  const { status } = useAppState();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Admin');
  const [error, setError] = useState('');
  const busy = status === 'loading', mock = isMock();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !password) { setError('Invalid credentials. Enter a user name and password.'); return; }
    setError('');
    try {
      await signIn(name, password, role);
      setPassword(''); // never keep the password in memory longer than needed
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  }

  return (
    <div className="login-screen" id="loginScreen">
      <form className="login-card" id="loginForm" aria-labelledby="loginTitle" onSubmit={onSubmit} noValidate>
        <div className="login-brand">
          <img src="/takeda-logo.png" alt="Takeda" />
          <div>
            <div className="brand-name">Global Policy<br />Value Optimizer</div>
            <div className="brand-sub">Oncology portfolio</div>
          </div>
        </div>
        <h1 id="loginTitle">Sign in</h1>
        <p className="small muted" style={{ margin: '8px 0 18px', lineHeight: 1.55 }}>
          <strong>Admin</strong>: manages users and asset access, approves and publishes policy and rule changes. <strong>Editor</strong>: edits inputs,
          reviews and submits changes; cannot publish. <strong>Viewer</strong>: read-only.
        </p>
        <div className="login-fields">
          <label className="form-field">
            <span className="field-label">User name</span>
            <input className="input" id="loginName" autoComplete="off" maxLength={80} placeholder="User name" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="field-label">Password</span>
            <input className="input" id="loginPassword" type="password" autoComplete="off" maxLength={128} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          {mock && (
            <label className="form-field">
              <span className="field-label">Demo role</span>
              <select className="select" id="loginRole" value={role} onChange={e => setRole(e.target.value as Role)}>
                <option>Admin</option>
                <option>Editor</option>
                <option>Viewer</option>
              </select>
            </label>
          )}
        </div>
        {error && <div className="login-error" id="loginError" role="alert">{error}</div>}
        <button className="button primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
