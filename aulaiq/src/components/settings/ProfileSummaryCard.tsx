import type { UserProfile, Plan } from '../../types';

const PLAN_LABEL: Record<Plan, string> = {
  free: 'Plano Grátis',
  essential: 'Versão Essential',
  team: 'Versão Team',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon',
  });
}

export default function ProfileSummaryCard({ user }: { user: UserProfile }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-lg font-bold">{user.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="min-w-0">
          <p className="text-base font-black text-gray-900 truncate">{user.name}</p>
          <p className="text-sm text-gray-400 truncate">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Faculdade</p>
          <p className="font-semibold text-gray-900 mt-0.5">{user.institution}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Curso</p>
          <p className="font-semibold text-gray-900 mt-0.5">{user.course}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Ano</p>
          <p className="font-semibold text-gray-900 mt-0.5">{user.yearLabel}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Plano</p>
          <p className="font-semibold text-gray-900 mt-0.5">{PLAN_LABEL[user.plan]}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-5">Membro desde {formatDate(user.createdAt)}</p>
    </div>
  );
}
