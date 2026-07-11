export type TeamRole = 'admin' | 'member';

export type TeamMemberStatus = 'active' | 'removed';

export type TeamInvitationStatus = 'pending' | 'accepted' | 'cancelled' | 'expired';

export type TeamSubscriptionStatus =
  | 'active' | 'trialing' | 'past_due' | 'canceled'
  | 'incomplete' | 'incomplete_expired' | 'unpaid' | 'inactive';

export interface Team {
  id: string;
  name: string;
  plan: 'team';
  subscriptionStatus: TeamSubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  seatsUsed: number;
  seatsTotal: number;
  seatsAvailable: number;
  hasStripeCustomer: boolean;
  currentUserRole: TeamRole;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: TeamRole;
  status: TeamMemberStatus;
  joinedAt: string | null;
  isCurrentUser: boolean;
}

export interface TeamInvitation {
  id: string;
  email: string;
  status: TeamInvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface MyPendingInvitation extends TeamInvitation {
  teamName: string | null;
}

export interface InvitationLookup {
  teamName: string;
  inviterName: string | null;
  email: string;
  status: TeamInvitationStatus;
  expiresAt: string;
}

// Every code the backend can return for a Team-plan business-rule violation
// (backend/services/team.js TEAM_ERROR_MESSAGES) — kept in sync by hand.
export type TeamErrorCode =
  | 'TEAM_NOT_FOUND' | 'TEAM_ADMIN_REQUIRED' | 'INVALID_EMAIL' | 'CANNOT_INVITE_SELF'
  | 'USER_ALREADY_TEAM_MEMBER' | 'INVITATION_ALREADY_PENDING' | 'TEAM_MEMBER_LIMIT_REACHED'
  | 'SUBSCRIPTION_INACTIVE' | 'INVITATION_INVALID' | 'INVITATION_EXPIRED' | 'INVITATION_CANCELLED'
  | 'INVITATION_ALREADY_ACCEPTED' | 'EMAIL_MISMATCH' | 'ALREADY_IN_TEAM' | 'TEAM_NAME_TOO_SHORT'
  | 'TEAM_NAME_TOO_LONG' | 'MEMBER_NOT_FOUND' | 'CANNOT_REMOVE_ADMIN' | 'ADMIN_CANNOT_LEAVE'
  | 'NOT_TEAM_MEMBER' | 'UNKNOWN_ERROR';

export class TeamApiError extends Error {
  code: TeamErrorCode;
  status: number;
  constructor(code: TeamErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const TEAM_ERROR_LABELS: Record<TeamErrorCode, string> = {
  TEAM_NOT_FOUND: 'Equipa não encontrada.',
  TEAM_ADMIN_REQUIRED: 'Apenas o administrador da equipa pode fazer isto.',
  INVALID_EMAIL: 'Introduz um email válido.',
  CANNOT_INVITE_SELF: 'Não podes convidar-te a ti próprio.',
  USER_ALREADY_TEAM_MEMBER: 'Este email já pertence à equipa.',
  INVITATION_ALREADY_PENDING: 'Já existe um convite pendente para este email.',
  TEAM_MEMBER_LIMIT_REACHED: 'A equipa já tem o número máximo de lugares ocupados.',
  SUBSCRIPTION_INACTIVE: 'A subscrição da equipa não está ativa.',
  INVITATION_INVALID: 'Este convite não é válido.',
  INVITATION_EXPIRED: 'Este convite expirou.',
  INVITATION_CANCELLED: 'Este convite foi cancelado.',
  INVITATION_ALREADY_ACCEPTED: 'Este convite já foi aceite.',
  EMAIL_MISMATCH: 'Este convite foi enviado para outro email.',
  ALREADY_IN_TEAM: 'Já pertences a uma equipa.',
  TEAM_NAME_TOO_SHORT: 'O nome da equipa deve ter pelo menos 2 caracteres.',
  TEAM_NAME_TOO_LONG: 'O nome da equipa não pode ter mais de 60 caracteres.',
  MEMBER_NOT_FOUND: 'Membro não encontrado.',
  CANNOT_REMOVE_ADMIN: 'O administrador não pode ser removido como um membro normal.',
  ADMIN_CANNOT_LEAVE: 'Como administrador, não podes simplesmente sair — transfere a propriedade ou contacta o suporte para dissolver a equipa.',
  NOT_TEAM_MEMBER: 'Não pertences a nenhuma equipa.',
  UNKNOWN_ERROR: 'Algo correu mal. Tenta novamente.',
};
