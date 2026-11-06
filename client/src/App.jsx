import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { LogOut, UserCog, WifiOff } from 'lucide-react';
import { useAuth } from './auth.jsx';
import { Avatar, Brand } from './components.jsx';
import { NotificationBell } from './notifications.jsx';
import { TextSizeMenu, ThemeToggle } from './theme.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu.jsx';
import { cn } from './lib/utils.js';
import LoginPage from './pages/LoginPage.jsx';
import ApplyPage from './pages/ApplyPage.jsx';
import ListPage from './pages/ListPage.jsx';
import DetailPage from './pages/DetailPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import HolidaysPage from './pages/HolidaysPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import HomePage from './pages/HomePage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';

// The landing page carries the animation and 3D libraries; signed-in users never download them.
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-status-amber-fg/40 bg-status-amber-bg px-4 py-2 text-sm font-medium text-status-amber-fg"
    >
      <WifiOff className="size-4" aria-hidden="true" /> You are offline. Nothing you change will be saved until you reconnect.
    </div>
  );
}

const navClass = ({ isActive }) =>
  cn(
    'relative inline-flex h-11 shrink-0 items-center px-3 text-sm font-semibold transition-colors',
    'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors',
    isActive ? 'text-foreground after:bg-flame' : 'text-muted-foreground after:bg-transparent hover:text-foreground',
  );

const ROLE_LABEL = { HOD: 'Head of Department', MANAGER: 'Manager', EMPLOYEE: 'Employee' };

function Shell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isApprover = user.role !== 'EMPLOYEE';
  const links = (
    <>
      <NavLink to="/" end className={navClass}>
        Home
      </NavLink>
      <NavLink to="/apply" className={navClass}>
        Apply
      </NavLink>
      <NavLink to="/mine" className={navClass}>
        My requests
      </NavLink>
      {isApprover && (
        <NavLink to="/queue" className={navClass}>
          Approval queue
        </NavLink>
      )}
      {isApprover && (
        <NavLink to="/team" className={navClass}>
          {user.role === 'HOD' ? 'All requests' : 'Team'}
        </NavLink>
      )}
      <NavLink to="/calendar" className={navClass}>
        Calendar
      </NavLink>
      <NavLink to="/holidays" className={navClass}>
        {user.role === 'HOD' ? 'Settings' : 'Holidays'}
      </NavLink>
      {user.role === 'HOD' && (
        <NavLink to="/audit" className={navClass}>
          Audit log
        </NavLink>
      )}
    </>
  );
  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container flex h-16 items-center gap-4">
          <NavLink to="/" aria-label="Layover home" className="rounded-md">
            <Brand compact className="sm:hidden" />
            <Brand className="hidden sm:inline-flex" />
          </NavLink>
          <div className="ml-auto flex items-center gap-1">
            <TextSizeMenu />
            <NotificationBell />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Account menu, ${user.name}`}
                  className="ml-1 flex h-11 items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-accent sm:pr-4"
                >
                  <Avatar name={user.name} className="size-9" />
                  <span className="hidden text-sm font-semibold sm:block">{user.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 max-w-[calc(100vw-2rem)]">
                <div className="flex items-center gap-3 px-2.5 py-2">
                  <Avatar name={user.name} className="size-12 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="kicker">{ROLE_LABEL[user.role]}</p>
                    {user.employeeCode && <p className="font-mono text-xs text-muted-foreground">{user.employeeCode}</p>}
                  </div>
                </div>
                {user.email && <p className="truncate px-2.5 text-sm text-muted-foreground">{user.email}</p>}
                {user.balance && (
                  <p className="px-2.5 pb-1 pt-2 text-sm">
                    Leave left in {user.balance.year}:{' '}
                    <span className="num font-semibold">
                      {user.balance.remaining} of {user.balance.allowance} days
                    </span>
                  </p>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/account')}>
                  <UserCog className="size-4" aria-hidden="true" />
                  Account
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={logout}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <nav
          aria-label="Main"
          className="container -mt-1 flex gap-0.5 overflow-x-auto pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {links}
        </nav>
      </header>
      <OfflineBanner />
      <main id="content" tabIndex={-1} className="container py-8 pb-24 outline-none sm:py-12">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <p role="status" className="grid min-h-screen place-items-center font-mono text-sm text-muted-foreground">
        Loading
      </p>
    );
  if (!user) {
    return (
      <Suspense
        fallback={
          <p role="status" className="grid min-h-screen place-items-center font-mono text-sm text-muted-foreground">
            Loading
          </p>
        }
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }
  const isApprover = user.role !== 'EMPLOYEE';
  return (
    <Shell>
      <Routes>
        <Route path="/account" element={<AccountPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/leaves/:id/edit" element={<ApplyPage />} />
        <Route
          path="/mine"
          element={
            <ListPage
              key="mine"
              scope="mine"
              title="My requests"
              kicker="Your leave"
              description="Every request you have made, and where each one stands."
            />
          }
        />
        {isApprover && (
          <Route
            path="/queue"
            element={
              <ListPage
                key="queue"
                scope="queue"
                title="Approval queue"
                kicker="Waiting for you"
                description="Requests waiting for your decision, oldest first."
              />
            }
          />
        )}
        {isApprover && (
          <Route
            path="/team"
            element={
              <ListPage
                key="all"
                scope="all"
                title="All requests"
                kicker="Your people"
                description="Every request you can see, with its current status."
              />
            }
          />
        )}
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/holidays" element={<HolidaysPage />} />
        <Route path="/settings" element={<Navigate to="/holidays" replace />} />
        {user.role === 'HOD' && <Route path="/audit" element={<AuditPage />} />}
        <Route path="/leaves/:id" element={<DetailPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
