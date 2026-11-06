import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import DetailPage from './pages/DetailPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';

let user;
vi.mock('./auth.jsx', () => ({ useAuth: () => ({ user }) }));
vi.mock('./api.js', () => ({ api: { get: vi.fn(), monthly: vi.fn(), exportCsv: vi.fn() } }));

const leave = {
  id: 'L1',
  employeeId: 'e1',
  employeeName: 'Meera Nair',
  fromDate: '2026-12-01',
  toDate: '2026-12-03',
  days: 3,
  isLong: false,
  reason: 'Family trip',
  status: 'PENDING_HOD',
  allowedActions: ['APPROVE', 'REJECT', 'REQUEST_INFO'],
  documents: [],
  timeline: [{ action: 'REROUTED', actorName: 'System', actorRole: null, at: '2026-11-01T10:00:00Z', comment: 'Passed on.' }],
  version: 0,
};

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/leaves/L1']}>
      <Routes>
        <Route path="/leaves/:id" element={<DetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  user = { id: 'hod', name: 'Priya Rao', role: 'HOD' };
});

describe('DetailPage', () => {
  it('tells the approver who else is away', async () => {
    api.get.mockResolvedValue({
      ...leave,
      overlaps: {
        away: 2,
        teamSize: 3,
        items: [
          { id: 'a', name: 'Karan Shah', fromDate: '2026-12-01', toDate: '2026-12-02', approved: true },
          { id: 'b', name: 'Isha Rao', fromDate: '2026-12-03', toDate: '2026-12-03', approved: false },
        ],
      },
    });
    renderDetail();
    expect(await screen.findByText('2 of 3 teammates are away on those days')).toBeInTheDocument();
    expect(screen.getByText(/approved$/)).toBeInTheDocument();
    expect(screen.getByText(/waiting for an answer$/)).toBeInTheDocument();
  });

  it('says so when nobody else is away', async () => {
    api.get.mockResolvedValue({ ...leave, overlaps: { away: 0, teamSize: 3, items: [] } });
    renderDetail();
    expect(await screen.findByText('Nobody else on the team is away on those days.')).toBeInTheDocument();
  });

  it('explains to the HOD that they answer on behalf of the manager', async () => {
    api.get.mockResolvedValue({ ...leave, onBehalfOf: 'Ananya Iyer' });
    renderDetail();
    expect(
      await screen.findByText('Ananya Iyer is on leave, so this request came to you. You are answering on their behalf.'),
    ).toBeInTheDocument();
    expect(screen.getByText('On behalf of Ananya Iyer')).toBeInTheDocument();
    expect(screen.getByText('Passed to the HOD')).toBeInTheDocument();
    expect(screen.getByText('by System')).toBeInTheDocument();
  });
});

const months = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  name: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
  approvedDays: i === 9 ? 6 : 0,
  waitingDays: i === 9 ? 2 : 0,
  requests: i === 9 ? 3 : 0,
  rejected: 0,
  people: i === 9 ? 2 : 0,
}));

describe('ReportsPage', () => {
  beforeEach(() => {
    api.monthly.mockResolvedValue({
      year: new Date().getFullYear(),
      months,
      totals: { approvedDays: 6, waitingDays: 2, requests: 3 },
      busiest: 'Oct',
    });
  });

  it('gives the bars a table with the same numbers', async () => {
    render(<ReportsPage />);
    const table = await screen.findByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Oct 6 2 3 0/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Oct: 6 days approved, 2 days waiting/ })).toBeInTheDocument();
    expect(screen.getByText('Oct', { selector: 'p' })).toBeInTheDocument();
  });

  it('downloads with the chosen scope and filters', async () => {
    api.exportCsv.mockResolvedValue('leave-requests.csv');
    render(<ReportsPage />);
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Which requests'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'APPROVED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    await waitFor(() => expect(api.exportCsv).toHaveBeenCalledWith({ scope: 'all', status: 'APPROVED' }));
    expect(await screen.findByText('Saved as leave-requests.csv')).toBeInTheDocument();
  });

  it('only offers "mine" to employees and shows a friendly error', async () => {
    user = { id: 'e1', name: 'Meera Nair', role: 'EMPLOYEE' };
    api.exportCsv.mockRejectedValue(Object.assign(new Error('Could not make the file.'), { hint: 'Try again.' }));
    render(<ReportsPage />);
    await screen.findByRole('table');
    expect(screen.queryByRole('option', { name: 'Everyone I can see' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not make the file.');
    expect(api.exportCsv).toHaveBeenCalledWith({ scope: 'mine' });
  });
});
