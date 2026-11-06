import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ApplyPage from './pages/ApplyPage.jsx';
import ListPage from './pages/ListPage.jsx';
import DetailPage from './pages/DetailPage.jsx';

function Shell({ children }) {
  const { user, logout } = useAuth();
  const isApprover = user.role !== 'EMPLOYEE';
  return (
    <>
      <header className="topbar">
        <strong className="brand">Leave Desk</strong>
        <nav aria-label="Main">
          <NavLink to="/apply">Apply</NavLink>
          <NavLink to="/mine">My requests</NavLink>
          {isApprover && <NavLink to="/queue">Approval queue</NavLink>}
          {isApprover && <NavLink to="/team">{user.role === 'HOD' ? 'All requests' : 'Team requests'}</NavLink>}
        </nav>
        <span className="who">
          {user.name} <span className="role">{user.role}</span>
          <button className="link" onClick={logout}>Sign out</button>
        </span>
      </header>
      <main>{children}</main>
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
        <Route path="/leaves/:id" element={<DetailPage />} />
        <Route path="*" element={<Navigate to={isApprover ? '/queue' : '/mine'} replace />} />
      </Routes>
    </Shell>
  );
}
