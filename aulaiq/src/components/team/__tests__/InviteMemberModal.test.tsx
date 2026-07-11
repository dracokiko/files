import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InviteMemberModal from '../InviteMemberModal';
import type { TeamMember, TeamInvitation } from '../../../types/team';

const existingMember: TeamMember = {
  id: 'm1', userId: 'u1', name: 'Ana', email: 'ana@example.com',
  role: 'member', status: 'active', joinedAt: '2026-01-01', isCurrentUser: false,
};

const pendingInvite: TeamInvitation = {
  id: 'i1', email: 'pending@example.com', status: 'pending',
  expiresAt: '2026-01-08', createdAt: '2026-01-01',
};

function setup(overrides: { seatsAvailable?: number } = {}) {
  const onInvite = vi.fn().mockResolvedValue({
    invitation: { id: 'i2', email: 'new@example.com', status: 'pending', expiresAt: '2026-01-08', createdAt: '2026-01-01' },
    emailSent: true,
  });
  const onClose = vi.fn();
  render(
    <InviteMemberModal
      seatsAvailable={overrides.seatsAvailable ?? 2}
      members={[existingMember]}
      invitations={[pendingInvite]}
      onClose={onClose}
      onInvite={onInvite}
    />,
  );
  return { onInvite, onClose };
}

describe('InviteMemberModal', () => {
  it('rejects submitting with an empty email', async () => {
    const { onInvite } = setup();
    fireEvent.click(screen.getByRole('button', { name: /enviar convite/i }));
    expect(await screen.findByText(/introduz um email/i)).toBeInTheDocument();
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format', async () => {
    const { onInvite } = setup();
    // "foo@bar" (no TLD) passes the <input type="email"> native constraint
    // jsdom enforces before dispatching submit, but fails the component's
    // own stricter EMAIL_RE — exercises the custom validation, not the browser's.
    fireEvent.change(screen.getByPlaceholderText(/colega@email.com/i), { target: { value: 'foo@bar' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar convite/i }));
    expect(await screen.findByText(/email válido/i)).toBeInTheDocument();
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('rejects inviting an email that already belongs to a member', async () => {
    const { onInvite } = setup();
    fireEvent.change(screen.getByPlaceholderText(/colega@email.com/i), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar convite/i }));
    expect(await screen.findByText(/já pertence à equipa/i)).toBeInTheDocument();
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('rejects an email with an already-pending invitation', async () => {
    const { onInvite } = setup();
    fireEvent.change(screen.getByPlaceholderText(/colega@email.com/i), { target: { value: 'pending@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar convite/i }));
    expect(await screen.findByText(/já existe um convite pendente/i)).toBeInTheDocument();
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('disables the form entirely when there are no free seats', async () => {
    const { onInvite } = setup({ seatsAvailable: 0 });
    expect(screen.getByPlaceholderText(/colega@email.com/i)).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /enviar convite/i }));
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('submits a valid, unused email and shows the success state', async () => {
    const { onInvite } = setup();
    fireEvent.change(screen.getByPlaceholderText(/colega@email.com/i), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar convite/i }));
    await waitFor(() => expect(onInvite).toHaveBeenCalledWith('new@example.com'));
    expect(await screen.findByText(/convite enviado para/i)).toBeInTheDocument();
  });

  it('ignores a rapid second click while the first submit is in flight', async () => {
    // never resolves within the test — simulates a submit still in flight
    const onInvite = vi.fn(
      () => new Promise<{ invitation: TeamInvitation; emailSent: boolean }>(() => {}),
    );
    render(
      <InviteMemberModal
        seatsAvailable={2}
        members={[existingMember]}
        invitations={[pendingInvite]}
        onClose={vi.fn()}
        onInvite={onInvite}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/colega@email.com/i), { target: { value: 'new@example.com' } });
    const submit = screen.getByRole('button', { name: /enviar convite/i });
    fireEvent.click(submit);
    await waitFor(() => expect(onInvite).toHaveBeenCalledTimes(1));
    fireEvent.click(submit);
    expect(onInvite).toHaveBeenCalledTimes(1);
  });
});
