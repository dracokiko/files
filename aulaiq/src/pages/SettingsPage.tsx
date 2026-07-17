import { useEffect, useState } from 'react';
import type { UserProfile } from '../types';
import { fetchMyProfile } from '../services/profileApi';
import ProfileSummaryCard from '../components/settings/ProfileSummaryCard';
import ChangeCourseCard from '../components/settings/ChangeCourseCard';
import ChangePasswordCard from '../components/settings/ChangePasswordCard';
import BillingCard from '../components/settings/BillingCard';

interface SettingsPageProps {
  user: UserProfile;
  onBack: () => void;
  onUserUpdated: (profile: UserProfile) => void;
}

export default function SettingsPage({ user, onBack, onUserUpdated }: SettingsPageProps) {
  const [courseChange, setCourseChange] = useState<{ eligible: boolean; availableAt: string | null } | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(true);

  // Refresh from the server on open so course-change eligibility (and any
  // other server-side state) reflects reality, not a stale client copy.
  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then(({ profile, courseChange: eligibility }) => {
        if (cancelled) return;
        onUserUpdated(profile);
        setCourseChange(eligibility ?? { eligible: true, availableAt: null });
      })
      .catch(() => { if (!cancelled) setCourseChange({ eligible: true, availableAt: null }); })
      .finally(() => { if (!cancelled) setLoadingEligibility(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal top bar, consistent with the team page */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <span className="font-black text-gray-900 text-sm">Definições</span>
        <div className="w-16" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <ProfileSummaryCard user={user} />

        <ChangeCourseCard
          user={user}
          eligible={courseChange?.eligible ?? true}
          availableAt={courseChange?.availableAt ?? null}
          loadingEligibility={loadingEligibility}
          onUpdated={onUserUpdated}
        />

        <ChangePasswordCard email={user.email} />

        <BillingCard plan={user.plan} />
      </div>
    </div>
  );
}
