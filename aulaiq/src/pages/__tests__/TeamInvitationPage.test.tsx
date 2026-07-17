import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeamInvitationPage from '../TeamInvitationPage';
import { TeamApiError } from '../../types/team';
import type { UserProfile } from '../../types';

const lookupInvitation = vi.fn();
const acceptInvitation = vi.fn();
const declineInvitation = vi.fn();

vi.mock('../../services/teamApi', () => ({
  lookupInvitation: (...args: unknown[]) => lookupInvitation(...args),
  acceptInvitation: (...args: unknown[]) => acceptInvitation(...args),
  declineInvitation: (...args: unknown[]) => declineInvitation(...args),
}));

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1', name: 'Bea', email: 'bea@example.com', institution: 'X', institutionId: 'x',
    course: 'Y', courseId: 'y', year: 1, yearLabel: '1º ano', plan: 'free',
    preferences: { studyFrequency: '', studyHours: '', mainGoal: '', studyStyle: '' },
    createdAt: '2026-01-01', courseChangedAt: null, demoSessionActive: false,
    ...overrides,
  };
}

beforeEach(() => {
  lookupInvitation.mockReset();
  acceptInvitation.mockReset();
  declineInvitation.mockReset();
});

describe('TeamInvitationPage', () => {
  it('shows a not-found state when the token does not resolve', async () => {
    lookupInvitation.mockRejectedValue(new TeamApiError('INVITATION_INVALID', 'Este convite não é válido.', 404));
    render(<TeamInvitationPage token="bad" user={null} onLoginClick={vi.fn()} onSignUpClick={vi.fn()} onAccepted={vi.fn()} />);
    expect(await screen.findByText(/convite inválido/i)).toBeInTheDocument();
  });

  it('shows an expired state', async () => {
    lookupInvitation.mockResolvedValue({
      teamName: 'Equipa X', inviterName: 'Ana', email: 'bea@example.com',
      status: 'expired', expiresAt: '2020-01-01T00:00:00Z',
    });
    render(<TeamInvitationPage token="t" user={null} onLoginClick={vi.fn()} onSignUpClick={vi.fn()} onAccepted={vi.fn()} />);
    expect(await screen.findByText(/convite expirado/i)).toBeInTheDocument();
  });

  it('shows a cancelled state', async () => {
    lookupInvitation.mockResolvedValue({
      teamName: 'Equipa X', inviterName: 'Ana', email: 'bea@example.com',
      status: 'cancelled', expiresAt: '2026-01-08T00:00:00Z',
    });
    render(<TeamInvitationPage token="t" user={null} onLoginClick={vi.fn()} onSignUpClick={vi.fn()} onAccepted={vi.fn()} />);
    expect(await screen.findByText(/convite cancelado/i)).toBeInTheDocument();
  });

  it('prompts login/signup for a valid invite when the visitor is not authenticated', async () => {
    lookupInvitation.mockResolvedValue({
      teamName: 'Equipa X', inviterName: 'Ana', email: 'bea@example.com',
      status: 'pending', expiresAt: '2026-01-08T00:00:00Z',
    });
    const onLoginClick = vi.fn();
    render(<TeamInvitationPage token="t" user={null} onLoginClick={onLoginClick} onSignUpClick={vi.fn()} onAccepted={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /entrar para aceitar/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /entrar para aceitar/i }));
    expect(onLoginClick).toHaveBeenCalled();
  });

  it('offers accept/decline when the logged-in email matches the invitation', async () => {
    lookupInvitation.mockResolvedValue({
      teamName: 'Equipa X', inviterName: 'Ana', email: 'bea@example.com',
      status: 'pending', expiresAt: '2026-01-08T00:00:00Z',
    });
    acceptInvitation.mockResolvedValue({ teamId: 't1', teamName: 'Equipa X' });
    const onAccepted = vi.fn();
    render(<TeamInvitationPage token="t" user={makeUser({ email: 'bea@example.com' })} onLoginClick={vi.fn()} onSignUpClick={vi.fn()} onAccepted={onAccepted} />);

    const acceptButton = await screen.findByRole('button', { name: /aceitar convite/i });
    fireEvent.click(acceptButton);
    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith('t'));
    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
  });

  it('blocks acceptance and explains the mismatch when logged-in email differs', async () => {
    lookupInvitation.mockResolvedValue({
      teamName: 'Equipa X', inviterName: 'Ana', email: 'invited@example.com',
      status: 'pending', expiresAt: '2026-01-08T00:00:00Z',
    });
    render(<TeamInvitationPage token="t" user={makeUser({ email: 'someone-else@example.com' })} onLoginClick={vi.fn()} onSignUpClick={vi.fn()} onAccepted={vi.fn()} />);

    expect(await screen.findByText(/enviado para/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aceitar convite/i })).not.toBeInTheDocument();
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('surfaces a business-rule error from the server (e.g. team full) instead of crashing', async () => {
    lookupInvitation.mockResolvedValue({
      teamName: 'Equipa X', inviterName: 'Ana', email: 'bea@example.com',
      status: 'pending', expiresAt: '2026-01-08T00:00:00Z',
    });
    acceptInvitation.mockRejectedValue(new TeamApiError('TEAM_MEMBER_LIMIT_REACHED', 'A equipa já tem o número máximo de lugares ocupados.', 409));
    render(<TeamInvitationPage token="t" user={makeUser({ email: 'bea@example.com' })} onLoginClick={vi.fn()} onSignUpClick={vi.fn()} onAccepted={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /aceitar convite/i }));
    expect(await screen.findByText(/número máximo de lugares/i)).toBeInTheDocument();
  });
});
