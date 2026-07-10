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
import Dashboard from './components/Dashboard';
import ProductShowcase from './components/landing/ProductShowcase';

export default function App() {
  const { user, login, logout, register, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const scrollToPlanos = () =>
    document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' });

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
            <span className="text-white font-black text-sm">A</span>
          </div>
          <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {user ? (
        /* ── Logged-in: show Dashboard ──────────────────────────────────── */
        <Dashboard
          user={user}
          onLogout={logout}
        />
      ) : (
        /* ── Logged-out: show landing page ──────────────────────────────── */
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

            <Pricing onSelectPlan={() => setShowOnboarding(true)} />

            <FAQ />
          </main>

          <Footer />
        </>
      )}

      {showOnboarding && (
        <OnboardingModal
          onClose={() => setShowOnboarding(false)}
          onComplete={(profile) => {
            register(profile);
            setShowOnboarding(false);
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
        />
      )}
    </div>
  );
}
