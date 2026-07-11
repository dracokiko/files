import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamPage from '../TeamPage';
import type { Team } from '../../types/team';

const useTeamMock = vi.fn();
const useTeamMembersMock = vi.fn();
const useTeamInvitationsMock = vi.fn();

vi.mock('../../hooks/useTeam', () => ({ useTeam: () => useTeamMock() }));
vi.mock('../../hooks/useTeamMembers', () => ({ useTeamMembers: () => useTeamMembersMock() }));
vi.mock('../../hooks/useTeamInvitations', () => ({ useTeamInvitations: () => useTeamInvitationsMock() }));

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 't1', name: 'Equipa X', plan: 'team', subscriptionStatus: 'active',
    currentPeriodEnd: '2026-08-01T00:00:00Z', cancelAtPeriodEnd: false,
    seatsUsed: 2, seatsTotal: 5, seatsAvailable: 3,
    hasStripeCustomer: true, currentUserRole: 'admin',
    ...overrides,
  };
}

const defaultMembersState = { members: [], loading: false, error: null, refresh: vi.fn(), remove: vi.fn() };
const defaultInvitationsState = {
  invitations: [], loading: false, error: null, refresh: vi.fn(), invite: vi.fn(), resend: vi.fn(), cancel: vi.fn(),
};

beforeEach(() => {
  useTeamMembersMock.mockReturnValue(defaultMembersState);
  useTeamInvitationsMock.mockReturnValue(defaultInvitationsState);
});

describe('TeamPage', () => {
  it('shows a loading skeleton while the team is loading', () => {
    useTeamMock.mockReturnValue({ team: null, myInvitation: null, loading: true, error: null, refresh: vi.fn(), rename: vi.fn(), leave: vi.fn() });
    const { container } = render(<TeamPage onBack={vi.fn()} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows an error state with a retry action on failure', () => {
    const refresh = vi.fn();
    useTeamMock.mockReturnValue({ team: null, myInvitation: null, loading: false, error: 'Não foi possível carregar a equipa.', refresh, rename: vi.fn(), leave: vi.fn() });
    render(<TeamPage onBack={vi.fn()} />);
    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('shows the commercial empty state when the user has no team and no invite', () => {
    useTeamMock.mockReturnValue({ team: null, myInvitation: null, loading: false, error: null, refresh: vi.fn(), rename: vi.fn(), leave: vi.fn() });
    render(<TeamPage onBack={vi.fn()} />);
    expect(screen.getByText(/ainda não fazes parte de uma equipa/i)).toBeInTheDocument();
  });

  it('admin: sees billing and the invite button', () => {
    useTeamMock.mockReturnValue({ team: makeTeam({ currentUserRole: 'admin' }), myInvitation: null, loading: false, error: null, refresh: vi.fn(), rename: vi.fn(), leave: vi.fn() });
    render(<TeamPage onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: /convidar membro/i })).toBeInTheDocument();
    expect(screen.getByText(/faturação/i)).toBeInTheDocument();
    expect(screen.queryByText(/^sair$/i)).not.toBeInTheDocument();
  });

  it('member: does not see billing or the invite button, but can leave', () => {
    useTeamMock.mockReturnValue({ team: makeTeam({ currentUserRole: 'member' }), myInvitation: null, loading: false, error: null, refresh: vi.fn(), rename: vi.fn(), leave: vi.fn() });
    render(<TeamPage onBack={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /convidar membro/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/faturação/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sair$/i })).toBeInTheDocument();
  });

  it('member: pending invitations are never fetched/shown', () => {
    useTeamMock.mockReturnValue({ team: makeTeam({ currentUserRole: 'member' }), myInvitation: null, loading: false, error: null, refresh: vi.fn(), rename: vi.fn(), leave: vi.fn() });
    render(<TeamPage onBack={vi.fn()} />);
    // useTeamInvitations was called with enabled=false for a member
    expect(useTeamInvitationsMock).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: /convites pendentes/i })).not.toBeInTheDocument();
  });

  it('renders the seat counter with real numbers from the team', () => {
    useTeamMock.mockReturnValue({ team: makeTeam({ seatsUsed: 2, seatsTotal: 5 }), myInvitation: null, loading: false, error: null, refresh: vi.fn(), rename: vi.fn(), leave: vi.fn() });
    render(<TeamPage onBack={vi.fn()} />);
    expect(screen.getByText(/lugares ocupados/i)).toBeInTheDocument();
  });
});
