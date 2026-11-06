import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatusChip, ErrorScreen, Badges, StatusLegend } from './components.jsx';
import LoginPage from './pages/LoginPage.jsx';

const login = vi.fn().mockResolvedValue();
vi.mock('./auth.jsx', () => ({ useAuth: () => ({ login }) }));

describe('StatusChip', () => {
  it('shows text for every status, never colour alone', () => {
    render(<StatusLegend />);
    for (const label of ['Pending manager', 'Awaiting HOD', 'Info requested', 'Approved', 'Rejected', 'Cancelled']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
  it('applies the status class used for colour coding', () => {
    const { container } = render(<StatusChip status="APPROVED" />);
    expect(container.firstChild).toHaveClass('chip-APPROVED');
  });
});

describe('Badges', () => {
  it('flags long, emergency and documents-due leave', () => {
    render(<Badges leave={{ isLong: true, isEmergency: true, documentsPending: true, documentsDueBy: '2026-12-01' }} />);
    expect(screen.getByText('Long leave')).toBeInTheDocument();
    expect(screen.getByText('Emergency')).toBeInTheDocument();
    expect(screen.getByText(/Documents due 2026-12-01/)).toBeInTheDocument();
  });
});

describe('ErrorScreen', () => {
  it.each([
    [{ status: 403, message: 'No.' }, /do not have access/i],
    [{ status: 404, message: 'Missing.' }, /could not find/i],
    [{ code: 'NETWORK', message: 'x' }, /offline/i],
  ])('shows a friendly title for %o', (error, title) => {
    render(<MemoryRouter><ErrorScreen error={error} /></MemoryRouter>);
    expect(screen.getByRole('heading')).toHaveTextContent(title);
  });
});

describe('LoginPage', () => {
  it('signs in with one click and never displays a password', async () => {
    render(<LoginPage />);
    expect(document.body.textContent).not.toMatch(/Password@/);
    fireEvent.click(screen.getByRole('button', { name: 'Rahul Mehta' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('rahul.mehta@akasa.demo', expect.any(String)));
  });
});
