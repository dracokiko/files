import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeamMembersList from '../TeamMembersList';
import type { TeamMember } from '../../../types/team';

const admin: TeamMember = {
  id: 'm1', userId: 'u1', name: 'Admin User', email: 'admin@example.com',
  role: 'admin', status: 'active', joinedAt: '2026-01-01', isCurrentUser: true,
};
const member: TeamMember = {
  id: 'm2', userId: 'u2', name: 'Bea', email: 'bea@example.com',
  role: 'member', status: 'active', joinedAt: '2026-01-02', isCurrentUser: false,
};

describe('TeamMembersList', () => {
  it('shows a loading skeleton while loading', () => {
    const { container } = render(
      <TeamMembersList members={[]} loading canRemove={false} onRemoved={vi.fn()} />,
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows an empty state with no members', () => {
    render(<TeamMembersList members={[]} loading={false} canRemove={false} onRemoved={vi.fn()} />);
    expect(screen.getByText(/ainda não há membros/i)).toBeInTheDocument();
  });

  it('lists members with name, email and role', () => {
    render(<TeamMembersList members={[admin, member]} loading={false} canRemove={false} onRemoved={vi.fn()} />);
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('bea@example.com')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Membro')).toBeInTheDocument();
  });

  it('hides the remove action entirely for a non-admin viewer', () => {
    render(<TeamMembersList members={[admin, member]} loading={false} canRemove={false} onRemoved={vi.fn()} />);
    expect(screen.queryByLabelText(/remover bea/i)).not.toBeInTheDocument();
  });

  it('never offers to remove the admin row, even when the viewer can remove', () => {
    render(<TeamMembersList members={[admin, member]} loading={false} canRemove onRemoved={vi.fn()} />);
    expect(screen.queryByLabelText(/remover admin user/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/remover bea/i)).toBeInTheDocument();
  });

  it('confirms before removing, then calls onRemoved with the member id', async () => {
    const onRemoved = vi.fn().mockResolvedValue(undefined);
    render(<TeamMembersList members={[admin, member]} loading={false} canRemove onRemoved={onRemoved} />);

    fireEvent.click(screen.getByLabelText(/remover bea/i));
    expect(screen.getByText(/tens a certeza/i)).toBeInTheDocument();
    expect(onRemoved).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^remover$/i }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith('m2'));
  });

  it('surfaces a server error inside the confirmation dialog instead of failing silently', async () => {
    const onRemoved = vi.fn().mockRejectedValue(new Error('boom'));
    render(<TeamMembersList members={[admin, member]} loading={false} canRemove onRemoved={onRemoved} />);

    fireEvent.click(screen.getByLabelText(/remover bea/i));
    fireEvent.click(screen.getByRole('button', { name: /^remover$/i }));

    expect(await screen.findByText(/não foi possível remover/i)).toBeInTheDocument();
  });
});
