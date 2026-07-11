import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import InstitutionSelector from './components/InstitutionSelector';
import HowItWorks from './components/HowItWorks';
import Features from './components/Features';
import Pricing from './components/Pricing';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import OnboardingModal from './components/OnboardingModal';
import LoginModal from './components/LoginModal';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import ResetPasswordModal from './components/ResetPasswordModal';
import Dashboard from './components/Dashboard';
import ProductShowcase from './components/landing/ProductShowcase';
import TeamInvitationPage from './pages/TeamInvitationPage';
import { requestPasswordReset, updatePassword } from './utils/auth';

const INVITE_PATH_RE = /^\/team\/invite\/([^/]+)\/?$/;

export default function App() {
  const { user, login, logout, register, loading, recoveryMode, finishRecovery } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'essential' | 'team' | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const scrollToPlanos = () =>
    document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' });

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center p-2">
            <img src="/images/logo-mark.png" alt="" className="w-full h-full object-contain" />
          </div>
          <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  if (recoveryMode) {
    return (
      <ResetPasswordModal
        onSubmit={async (password) => {
          const { error } = await updatePassword(password);
          return error;
        }}
        onDone={finishRecovery}
      />
    );
  }

  // No client-side router in this app (see vite.config.ts / server.js SPA
  // fallback) — a handful of paths are recognized by inspecting
  // window.location directly instead of pulling in react-router.
  const inviteToken = window.location.pathname.match(INVITE_PATH_RE)?.[1] ?? null;
  const initialDashboardView = window.location.pathname === '/dashboard/team' ? 'team' : 'subjects';

  let mainContent: React.ReactNode;
  if (inviteToken) {
    mainContent = (
      <TeamInvitationPage
        token={inviteToken}
        user={user}
        onLoginClick={() => setShowLogin(true)}
        onSignUpClick={() => setShowOnboarding(true)}
        onAccepted={() => { window.location.href = '/dashboard/team'; }}
      />
    );
  } else if (user) {
    mainContent = <Dashboard user={user} onLogout={logout} initialView={initialDashboardView} />;
  } else {
    mainContent = (
      <>
        <Navbar
          user={null}
          onJoin={() => setShowOnboarding(true)}
          onLogin={() => setShowLogin(true)}
          onLogout={logout}
        />

        <main>
          <Hero
            onStart={() => setShowOnboarding(true)}
            onPlans={scrollToPlanos}
          />

          <InstitutionSelector onCreatePlan={() => setShowOnboarding(true)} />

          <HowItWorks />

          <ProductShowcase />

          <Features />

          <Pricing onSelectPlan={(planId) => { setSelectedPlan(planId ?? null); setShowOnboarding(true); }} />

          <FAQ />
        </main>

        <Footer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {mainContent}

      {showOnboarding && (
        <OnboardingModal
          initialPlan={selectedPlan}
          onClose={() => { setShowOnboarding(false); setSelectedPlan(null); }}
          onComplete={(profile) => {
            register(profile);
            setShowOnboarding(false);
            setSelectedPlan(null);
          }}
        />
      )}

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={async (email, password) => {
            const success = await login(email, password);
            if (success) setShowLogin(false);
            return success;
          }}
          onSignUp={() => {
            setShowLogin(false);
            setShowOnboarding(true);
          }}
          onForgotPassword={() => {
            setShowLogin(false);
            setShowForgotPassword(true);
          }}
        />
      )}

      {showForgotPassword && (
        <ForgotPasswordModal
          onClose={() => setShowForgotPassword(false)}
          onSubmit={async (email) => {
            const { error } = await requestPasswordReset(email);
            return error;
          }}
          onBackToLogin={() => {
            setShowForgotPassword(false);
            setShowLogin(true);
          }}
        />
      )}
    </div>
  );
}
