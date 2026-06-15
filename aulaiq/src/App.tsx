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
  const { user, login, logout, register } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const scrollToPlanos = () =>
    document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' });

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
          onLogin={(email, password) => {
            const success = login(email, password);
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
