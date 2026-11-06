import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { BrandMark } from './components.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ApplyPage from './pages/ApplyPage.jsx';
import ListPage from './pages/ListPage.jsx';
import DetailPage from './pages/DetailPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import { useEffect, useState } from 'react';

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online ? null : <div className="offline" role="status">You are offline. Changes will not be saved until you reconnect.</div>;
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  const isApprover = user.role !== 'EMPLOYEE';
  return (
    <>
      <a className="skip" href="#content">Skip to content</a>
      <header className="topbar">
        <strong className="brand"><BrandMark /> Leave Desk</strong>
        <nav aria-label="Main">
          <NavLink to="/apply">Apply</NavLink>
          <NavLink to="/mine">My requests</NavLink>
          {isApprover && <NavLink to="/queue">Approval queue</NavLink>}
          {user.role === 'HOD' && <NavLink to="/audit">Audit log</NavLink>}
          {isApprover && <NavLink to="/team">{user.role === 'HOD' ? 'All requests' : 'Team requests'}</NavLink>}
        </nav>
        <span className="who">
          <span className="avatar" aria-hidden="true">{user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
          <span>{user.name}</span> <span className="role">{user.role}</span>
          <button className="link" onClick={logout}>Sign out</button>
        </span>
      </header>
      <OfflineBanner />
      <main id="content" tabIndex={-1}>{children}</main>
    </>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <p className="center">Loading…</p>;
  if (!user) return <LoginPage />;
  const isApprover = user.role !== 'EMPLOYEE';
  return (
    <Shell>
      <Routes>
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/leaves/:id/edit" element={<ApplyPage />} />
        <Route path="/mine" element={<ListPage key="mine" scope="mine" title="My requests" />} />
        {isApprover && <Route path="/queue" element={<ListPage key="queue" scope="queue" title="Pending approvals" />} />}
        {isApprover && <Route path="/team" element={<ListPage key="all" scope="all" title="All requests you can see" />} />}
        {user.role === 'HOD' && <Route path="/audit" element={<AuditPage />} />}
        <Route path="/leaves/:id" element={<DetailPage />} />
        <Route path="*" element={<Navigate to={isApprover ? '/queue' : '/mine'} replace />} />
      </Routes>
    </Shell>
  );
}
