import { useState } from 'react';
import type { Subject } from '../../types';
import type { UserProgress, Buddy } from '../../types/progress';
import { saveProgress } from '../../utils/progress';

interface BuddiesTabProps {
  subject: Subject;
  userXP: number;
  userName: string;
  progress: UserProgress;
  onProgressUpdate: (updated: UserProgress) => void;
}

function CompetitiveMessage({ rank, nearestBuddy, subjectName, competitive }: {
  rank: number;
  nearestBuddy: Buddy | null;
  subjectName: string;
  competitive: boolean;
}) {
  if (!nearestBuddy) return null;
  const diff = Math.abs(nearestBuddy.subjectXP[subjectName] ?? nearestBuddy.totalXP / 3);

  if (competitive) {
    const msgs = [
      `A ${nearestBuddy.name} passou-te. Toca a recuperar a linha.`,
      `Estás a perder a linha para ${nearestBuddy.name} em ${subjectName}.`,
      `Estás a ${Math.round(diff)} XP de passar ${nearestBuddy.name} em ${subjectName}.`,
      `${nearestBuddy.name} passou-te em ${subjectName}. Vais deixar?`,
    ];
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 font-medium">
        🔥 {msgs[rank % msgs.length]}
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 font-medium">
      💪 {rank === 1
        ? 'Estás no topo! Mantém o ritmo.'
        : `Estás perto de alcançar ${nearestBuddy.name}. Faltam ${Math.round(diff)} XP.`}
    </div>
  );
}

export default function BuddiesTab({ subject, userXP, userName, progress, onProgressUpdate }: BuddiesTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBuddyName, setNewBuddyName] = useState('');
  const [challengeMsg, setChallengeMsg] = useState<string | null>(null);

  const competitive = progress.competitiveMode;

  // Build leaderboard for this subject
  const entries = [
    { id: 'user', name: userName, xp: userXP, isUser: true },
    ...progress.buddies.map((b) => ({
      id: b.id,
      name: b.name,
      xp: b.subjectXP[subject.id] ?? Math.round(b.totalXP / 4),
      isUser: false,
    })),
  ].sort((a, b) => b.xp - a.xp);

  const userRank = entries.findIndex((e) => e.isUser);
  const aboveBuddy = userRank > 0 ? progress.buddies.find((b) => b.name === entries[userRank - 1]?.name) ?? null : null;

  function handleAddBuddy() {
    if (!newBuddyName.trim()) return;
    const newBuddy: Buddy = {
      id: `buddy-${Date.now()}`,
      name: newBuddyName.trim(),
      totalXP: Math.floor(Math.random() * 300) + 100,
      subjectXP: { [subject.id]: Math.floor(Math.random() * 150) + 50 },
      strongestSubject: subject.name,
      weakChapter: 'Conceitos Fundamentais',
    };
    const updated: UserProgress = { ...progress, buddies: [...progress.buddies, newBuddy] };
    saveProgress(updated);
    onProgressUpdate(updated);
    setNewBuddyName('');
    setShowAddForm(false);
  }

  function handleToggleCompetitive() {
    const updated: UserProgress = { ...progress, competitiveMode: !progress.competitiveMode };
    saveProgress(updated);
    onProgressUpdate(updated);
  }

  return (
    <div className="space-y-5">
      {/* Competitive toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
        <div>
          <p className="text-sm font-semibold text-gray-900">Modo competitivo</p>
          <p className="text-xs text-gray-400">Ativa para mensagens mais intensas</p>
        </div>
        <button
          type="button"
          onClick={handleToggleCompetitive}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${competitive ? 'bg-blue-500' : 'bg-gray-200'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${competitive ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* Competitive message */}
      <CompetitiveMessage
        rank={userRank}
        nearestBuddy={aboveBuddy}
        subjectName={subject.name}
        competitive={competitive}
      />

      {/* Leaderboard */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Ranking · {subject.name}
        </h3>
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                entry.isUser
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-gray-300 text-gray-700' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {idx + 1}
              </span>
              <span className={`flex-1 text-sm font-semibold ${entry.isUser ? 'text-blue-700' : 'text-gray-800'}`}>
                {entry.isUser ? 'Tu' : entry.name}
              </span>
              <div className="text-right">
                <p className={`text-sm font-bold ${entry.isUser ? 'text-blue-600' : 'text-gray-700'}`}>
                  {entry.xp} XP
                </p>
              </div>
              {!entry.isUser && (
                <button
                  onClick={() => {
                    setChallengeMsg('Desafio criado em demo. Em produção, isto enviará convite ao teu buddy.');
                    setTimeout(() => setChallengeMsg(null), 4000);
                  }}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-700 px-2 py-1 bg-violet-50 rounded-lg transition-colors flex-shrink-0"
                >
                  Desafiar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Challenge message */}
      {challengeMsg && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700 font-medium animate-fade-in">
          ✓ {challengeMsg}
        </div>
      )}

      {/* Add buddy */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-2.5 text-sm font-semibold text-blue-600 border-2 border-dashed border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          + Adicionar buddy
        </button>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={newBuddyName}
            onChange={(e) => setNewBuddyName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddBuddy(); }}
            placeholder="Nome ou email do buddy"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 focus:bg-white transition-all"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddBuddy}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:scale-[1.01] transition-all"
            >
              Adicionar
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewBuddyName(''); }}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
