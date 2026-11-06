import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from './api.js';
import { NotificationBell } from './notifications.jsx';
import AccountPage from './pages/AccountPage.jsx';
import { AllowanceImport } from './pages/AllowanceTab.jsx';

const user = {
  id: 'u1',
  name: 'Asha Verma',
  email: 'asha@example.com',
  role: 'EMPLOYEE',
  location: 'Bengaluru',
  employeeCode: 'AKA-0007',
  department: 'Operations',
  joinedAt: '2025-03-01T00:00:00.000Z',
  emailVerified: true,
  emailNotifications: true,
  managerName: 'Rohan Mehta',
  balance: { year: 2026, allowance: 30, custom: false, used: 4, pending: 2, remaining: 24 },
};

vi.mock('./auth.jsx', () => ({ useAuth: () => ({ user, refresh: vi.fn() }) }));
vi.mock('./api.js', () => ({
  api: { notifications: vi.fn(), markRead: vi.fn(), importAllowances: vi.fn(), setPreferences: vi.fn(), changePassword: vi.fn() },
}));

const notice = {
  id: 'n1',
  kind: 'APPROVED',
  title: 'Your leave was approved',
  body: 'Rohan approved 12 to 14 Nov.',
  leaveId: 'L1',
  read: false,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  api.notifications.mockResolvedValue({ unread: 3, items: [notice] });
  api.markRead.mockResolvedValue({ ok: true });
});

describe('NotificationBell', () => {
  it('puts the unread count in its accessible name', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
  });

  it('marks a notice as read when it is clicked', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );
    const bell = await screen.findByRole('button', { name: 'Notifications, 3 unread' });
    fireEvent.keyDown(bell, { key: 'Enter' });
    const item = await screen.findByText('Your leave was approved');
    fireEvent.click(item);
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith({ ids: ['n1'] }));
  });
});

describe('AllowanceImport', () => {
  it('disables Apply while any line has an error', async () => {
    api.importAllowances.mockResolvedValue({
      applied: false,
      summary: { new: 1, changed: 0, same: 0, errors: 1 },
      rows: [
        { line: 1, who: 'Asha Verma', email: 'asha@example.com', days: 24, year: 2026, status: 'new', message: '' },
        {
          line: 2,
          who: '',
          email: 'nobody@example.com',
          days: 20,
          year: 2026,
          status: 'error',
          message: 'No one has signed up with that email.',
        },
      ],
    });
    render(<AllowanceImport />);
    fireEvent.change(screen.getByLabelText('Allowances, one per line'), {
      target: { value: 'asha@example.com,24\nnobody@example.com,20' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check the list' }));
    expect(await screen.findByText('No one has signed up with that email.')).toBeInTheDocument();
    expect(screen.getByText('Needs fixing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Apply/ })).toBeDisabled();
  });
});

describe('AccountPage', () => {
  it('shows the employee ID and the allowance sentence', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('AKA-0007')).toBeInTheDocument();
    expect(screen.getByText('Your allowance this year is 30 days.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Email me when something changes on my requests' })).toBeChecked();
  });
});
