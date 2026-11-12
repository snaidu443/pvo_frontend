import { useEffect } from 'react';
import { OverlayHost } from './components/common/OverlayHost';
import { AppShell } from './components/layout/AppShell';
import { PolicyPilot } from './components/pilot/PolicyPilot';
import { Disclaimer } from './pages/auth/Disclaimer';
import { LoginPage } from './pages/auth/LoginPage';
import { useAppState } from './store/store';

export function App() {
  const { status } = useAppState();
  const authed = status === 'ready';

  // v03 CSS keys some rules off body classes.
  useEffect(() => {
    document.body.classList.toggle('authed', authed);
    document.body.classList.toggle('disclaiming', status === 'disclaimer');
    if (!authed) document.body.classList.remove('nav-open');
  }, [authed, status]);

  return (
    <>
      {authed ? <AppShell /> : <LoginPage />}
      {status === 'disclaimer' && <Disclaimer />}
      {authed && <PolicyPilot />}
      <OverlayHost />
    </>
  );
}
