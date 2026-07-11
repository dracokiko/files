import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamSeatsCard from '../TeamSeatsCard';
import type { Team } from '../../../types/team';

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 't1', name: 'Equipa X', plan: 'team', subscriptionStatus: 'active',
    currentPeriodEnd: null, cancelAtPeriodEnd: false,
    seatsUsed: 3, seatsTotal: 5, seatsAvailable: 2,
    hasStripeCustomer: true, currentUserRole: 'admin',
    ...overrides,
  };
}

describe('TeamSeatsCard', () => {
  it('shows the "X of Y seats occupied" summary with real numbers', () => {
    render(<TeamSeatsCard team={makeTeam({ seatsUsed: 3, seatsTotal: 5 })} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/lugares ocupados/i)).toBeInTheDocument();
  });

  it('reflects seatsUsed/seatsTotal in the progress bar', () => {
    render(<TeamSeatsCard team={makeTeam({ seatsUsed: 3, seatsTotal: 5 })} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
  });

  it('flags "no free seats" once seatsAvailable is 0', () => {
    render(<TeamSeatsCard team={makeTeam({ seatsUsed: 5, seatsTotal: 5, seatsAvailable: 0 })} />);
    expect(screen.getByText(/sem lugares livres/i)).toBeInTheDocument();
  });

  it('shows the free-seat count when seats remain', () => {
    render(<TeamSeatsCard team={makeTeam({ seatsUsed: 3, seatsTotal: 5, seatsAvailable: 2 })} />);
    expect(screen.getByText(/2 livres/i)).toBeInTheDocument();
  });
});
