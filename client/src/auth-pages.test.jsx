import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from './api.js';
import SignupPage from './pages/SignupPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';

vi.mock('./auth.jsx', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('./api.js', () => ({
  api: { signup: vi.fn(), forgotPassword: vi.fn(), checkReset: vi.fn(), resetPassword: vi.fn(), resendVerification: vi.fn() },
}));

const renderAt = (ui, path = '/') => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('SignupPage', () => {
  it('shows field errors for a weak password and does not call the server', async () => {
    renderAt(<SignupPage />);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Asha Verma' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'asha@example.com' } });
    fireEvent.change(screen.getByLabelText('Choose a password'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(api.signup).not.toHaveBeenCalled();
  });

  it('uses the right autocomplete attributes', () => {
    renderAt(<SignupPage />);
    expect(screen.getByLabelText('Choose a password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
  });
});

describe('ForgotPasswordPage', () => {
  it('shows the same confirmation the server gives, whatever the address', async () => {
    api.forgotPassword.mockResolvedValue({ ok: true, message: 'If that email has an account, a link is on its way.' });
    renderAt(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nobody@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    expect(await screen.findByText('If that email has an account, a link is on its way.')).toBeInTheDocument();
  });
});

describe('ResetPasswordPage', () => {
  it('shows the expired state when the link is not valid', async () => {
    api.checkReset.mockResolvedValue({ valid: false });
    renderAt(<ResetPasswordPage />, '/reset-password?token=abcdefghijklmnopqrstuvwxyz');
    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('shows the form when the link is valid', async () => {
    api.checkReset.mockResolvedValue({ valid: true });
    renderAt(<ResetPasswordPage />, '/reset-password?token=abcdefghijklmnopqrstuvwxyz');
    await waitFor(() => expect(screen.getByLabelText('New password')).toBeInTheDocument());
  });
});
