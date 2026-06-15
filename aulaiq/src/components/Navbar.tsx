import { useState, useEffect } from 'react';
import type { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  onJoin: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Navbar({ user, onJoin, onLogin, onLogout }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  const navLinks = [
    { label: 'Como funciona', id: 'como-funciona' },
    { label: 'Faculdades', id: 'faculdades' },
    { label: 'Planos', id: 'planos' },
    { label: 'FAQ', id: 'faq' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-md group-hover:shadow-blue-300 transition-shadow">
              <span className="text-white font-black text-sm tracking-tight">A</span>
            </div>
            <span className="font-black text-xl text-gray-900 tracking-tight">AulaIQ</span>
          </button>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors duration-150"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-blue-700">
                    Olá, {user.name.split(' ')[0]}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Sair
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={onLogin}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2"
                >
                  Entrar
                </button>
                <button onClick={onJoin} className="btn-primary !py-2 !px-5 text-sm">
                  Juntar-me
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-100 shadow-lg animate-fade-in">
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl px-3 py-2.5 text-left transition-colors"
                >
                  {link.label}
                </button>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-3 flex flex-col gap-2">
                {user ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{user.name.charAt(0)}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">Olá, {user.name.split(' ')[0]}</span>
                    </div>
                    <button onClick={onLogout} className="text-sm text-gray-400">Sair</button>
                  </div>
                ) : (
                  <>
                    <button onClick={onLogin} className="text-sm font-medium text-gray-600 text-left px-3 py-2">
                      Entrar
                    </button>
                    <button onClick={onJoin} className="btn-primary justify-center">
                      Juntar-me
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
