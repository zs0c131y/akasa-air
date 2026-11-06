import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ClipboardList, FilePlus2, Inbox, LogOut, ScrollText, Users, WifiOff } from 'lucide-react';
import { useAuth } from './auth.jsx';
import { Avatar, Wordmark } from './components.jsx';
import { TextSizeMenu, ThemeToggle } from './theme.jsx';
import { Button } from './ui/button.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu.jsx';
import { cn } from './lib/utils.js';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ApplyPage from './pages/ApplyPage.jsx';
import ListPage from './pages/ListPage.jsx';
import DetailPage from './pages/DetailPage.jsx';
import AuditPage from './pages/AuditPage.jsx';

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-status-amber-fg/40 bg-status-amber-bg px-4 py-2 text-sm font-medium text-status-amber-fg">
      <WifiOff className="size-4" aria-hidden="true" /> You are offline. Changes will not be saved until you reconnect.
    </div>
  );
}

const navClass = ({ isActive }) =>
  cn(
    'inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors [&_svg]:size-4',
    isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  );

function Shell({ children }) {
  const { user, logout } = useAuth();
  const isApprover = user.role !== 'EMPLOYEE';
  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container flex h-16 items-center gap-3">
          <NavLink to="/" aria-label="Leave Desk home" className="rounded-md"><Wordmark /></NavLink>
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
            <NavLink to="/apply" className={navClass}><FilePlus2 aria-hidden="true" />Apply</NavLink>
            <NavLink to="/mine" className={navClass}><ClipboardList aria-hidden="true" />My requests</NavLink>
            {isApprover && <NavLink to="/queue" className={navClass}><Inbox aria-hidden="true" />Approval queue</NavLink>}
            {isApprover && <NavLink to="/team" className={navClass}><Users aria-hidden="true" />{user.role === 'HOD' ? 'All requests' : 'Team requests'}</NavLink>}
            {user.role === 'HOD' && <NavLink to="/audit" className={navClass}><ScrollText aria-hidden="true" />Audit log</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <TextSizeMenu />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Account menu" className="ml-1 flex h-11 items-center gap-2 rounded-full pl-1 pr-2 hover:bg-accent">
                  <Avatar name={user.name} className="size-9 bg-brand text-brand-foreground" />
                  <span className="hidden text-sm font-medium sm:block">{user.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel className="normal-case tracking-normal">
                  <span className="block text-sm font-semibold text-foreground">{user.name}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{user.role === 'HOD' ? 'Head of Department' : user.role === 'MANAGER' ? 'Manager' : 'Employee'}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logout}><LogOut className="size-4" aria-hidden="true" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <nav aria-label="Main (mobile)" className="container flex gap-1 overflow-x-auto pb-2 md:hidden">
          <NavLink to="/apply" className={navClass}><FilePlus2 aria-hidden="true" />Apply</NavLink>
          <NavLink to="/mine" className={navClass}><ClipboardList aria-hidden="true" />My requests</NavLink>
          {isApprover && <NavLink to="/queue" className={navClass}><Inbox aria-hidden="true" />Queue</NavLink>}
          {isApprover && <NavLink to="/team" className={navClass}><Users aria-hidden="true" />{user.role === 'HOD' ? 'All' : 'Team'}</NavLink>}
          {user.role === 'HOD' && <NavLink to="/audit" className={navClass}><ScrollText aria-hidden="true" />Audit</NavLink>}
        </nav>
      </header>
      <OfflineBanner />
      <main id="content" tabIndex={-1} className="container py-8 pb-20 outline-none sm:py-12">{children}</main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <p role="status" className="grid min-h-screen place-items-center text-muted-foreground">Loading…</p>;
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  const isApprover = user.role !== 'EMPLOYEE';
  const home = isApprover ? '/queue' : '/mine';
  return (
    <Shell>
      <Routes>
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/leaves/:id/edit" element={<ApplyPage />} />
        <Route path="/mine" element={<ListPage key="mine" scope="mine" title="My requests" description="Everything you have asked for, and where each request stands." />} />
        {isApprover && <Route path="/queue" element={<ListPage key="queue" scope="queue" title="Approval queue" description="Requests waiting for your decision." />} />}
        {isApprover && <Route path="/team" element={<ListPage key="all" scope="all" title="All requests" description="Every request you are allowed to see, with its current status." />} />}
        {user.role === 'HOD' && <Route path="/audit" element={<AuditPage />} />}
        <Route path="/leaves/:id" element={<DetailPage />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Shell>
  );
}
