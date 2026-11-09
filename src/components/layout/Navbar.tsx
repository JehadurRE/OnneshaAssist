import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';
import { LanguageToggle } from '@/components/common/LanguageToggle';
import { useBranding } from '@/hooks/use-branding';
import onnesha from '@/assets/onnesha.jpg.asset.json';
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  ChevronDown,
  Clock,
  Code2,
  GraduationCap,
  Home,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Play,
  Rocket,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const branding = useBranding();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const pathname = location.pathname;

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {/* ============================================================ */}
      {/* 1. TOP HEADER NAVIGATION (Desktop, Tablet & Mobile Header) */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-xl transition-all shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 py-3">
          {/* Brand Logo & Optional Joint Partner Emblem */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="flex items-center gap-2">
              <div className="relative">
                <img
                  src={onnesha.url}
                  alt="Onnesha Arena"
                  className="h-8 sm:h-9 w-auto rounded-lg object-contain transition-transform group-hover:scale-105"
                />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>

              {branding.showPartnerLogo && branding.partnerLogoUrl && (
                <>
                  <span className="text-muted-foreground/60 font-mono text-xs font-bold">×</span>
                  <img
                    src={branding.partnerLogoUrl}
                    alt={branding.partnerName || 'Joint Partner'}
                    className="h-8 sm:h-9 max-w-[110px] object-contain rounded-md"
                  />
                </>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-display text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-1.5">
                <span>Onnesha</span>
                <span className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] sm:text-xs font-black text-primary uppercase tracking-wider">
                  Arena
                </span>
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline leading-none font-medium">
                {branding.showPartnerLogo && branding.partnerName
                  ? `In partnership with ${branding.partnerName}`
                  : 'Live Examination & Assessment System'}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 text-xs lg:text-sm font-semibold">
            {/* Home Link */}
            <Link
              to="/"
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 transition-all ${
                isActive('/') && pathname === '/'
                  ? 'bg-primary/10 text-primary font-bold shadow-xs'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </Link>

            {/* Candidate Arena Pass */}
            <Link
              to="/play"
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 transition-all ${
                isActive('/play')
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>{t('join_pin')}</span>
            </Link>

            {/* Knowledge Vault */}
            <Link
              to="/vault"
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 transition-all ${
                isActive('/vault')
                  ? 'bg-primary/10 text-primary font-bold shadow-xs'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <BookOpen className="h-4 w-4 text-primary" />
              <span>{t('vault')}</span>
            </Link>

            {/* Institutional Solutions Mega Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setSolutionsOpen(true)}
              onMouseLeave={() => setSolutionsOpen(false)}
            >
              <button
                type="button"
                onClick={() => setSolutionsOpen(!solutionsOpen)}
                className={`flex items-center gap-1 rounded-2xl px-3 py-2 transition-all ${
                  isActive('/for')
                    ? 'bg-primary/10 text-primary font-bold shadow-xs'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <span>{t('solutions')}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    solutionsOpen ? 'rotate-180 text-primary' : 'opacity-60'
                  }`}
                />
              </button>

              {solutionsOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-84 rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl p-2.5 shadow-2xl animate-in fade-in-50 zoom-in-95 z-50">
                  <div className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 mb-1">
                    Institutional Assessment Frameworks
                  </div>

                  <Link
                    to="/for/$segment"
                    params={{ segment: 'education' }}
                    onClick={() => setSolutionsOpen(false)}
                    className="flex items-start gap-3 rounded-2xl p-2.5 hover:bg-accent transition-colors"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground">{t('for_education')}</div>
                      <div className="text-[11px] text-muted-foreground leading-snug">{t('for_education_desc')}</div>
                    </div>
                  </Link>

                  <Link
                    to="/for/$segment"
                    params={{ segment: 'training' }}
                    onClick={() => setSolutionsOpen(false)}
                    className="flex items-start gap-3 rounded-2xl p-2.5 hover:bg-accent transition-colors"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground">{t('for_training')}</div>
                      <div className="text-[11px] text-muted-foreground leading-snug">{t('for_training_desc')}</div>
                    </div>
                  </Link>

                  <Link
                    to="/for/$segment"
                    params={{ segment: 'corporate' }}
                    onClick={() => setSolutionsOpen(false)}
                    className="flex items-start gap-3 rounded-2xl p-2.5 hover:bg-accent transition-colors"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground">{t('for_corporate')}</div>
                      <div className="text-[11px] text-muted-foreground leading-snug">{t('for_corporate_desc')}</div>
                    </div>
                  </Link>

                  <Link
                    to="/for/$segment"
                    params={{ segment: 'events' }}
                    onClick={() => setSolutionsOpen(false)}
                    className="flex items-start gap-3 rounded-2xl p-2.5 hover:bg-accent transition-colors"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-pink-500">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground">{t('for_events')}</div>
                      <div className="text-[11px] text-muted-foreground leading-snug">{t('for_events_desc')}</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Plans & Pricing */}
            <Link
              to="/pricing"
              className={`rounded-2xl px-3 py-2 transition-all ${
                isActive('/pricing')
                  ? 'bg-primary/10 text-primary font-bold shadow-xs'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {t('pricing')}
            </Link>

            {/* Exam Timer */}
            <Link
              to="/timer"
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 transition-all ${
                isActive('/timer')
                  ? 'bg-primary/10 text-primary font-bold shadow-xs'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>{t('exam_timer')}</span>
            </Link>
          </nav>

          {/* Right Header Cluster: Language & Account */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />

            {/* Instructor Studio CTA or Profile Dropdown */}
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5 pr-2.5 sm:pr-3 hover:bg-accent transition shadow-xs"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/20 text-xs font-bold text-primary">
                    {user.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="font-display text-xs font-bold text-foreground leading-tight max-w-[120px] truncate">
                      {user.name}
                    </div>
                    <div className="text-[9px] text-primary uppercase font-mono font-bold">
                      {user.role}
                    </div>
                  </div>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-3xl border border-border bg-card/95 backdrop-blur-2xl p-2 shadow-2xl animate-in fade-in-50 zoom-in-95 z-50">
                    <div className="p-2.5 border-b border-border/80">
                      <div className="font-bold text-xs text-foreground truncate">{user.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                      {user.institutionName && (
                        <div className="mt-1 text-[10px] font-semibold text-primary truncate">
                          {user.institutionName}
                        </div>
                      )}
                    </div>

                    <Link
                      to="/dashboard"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-foreground hover:bg-accent transition"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
                      <span>{t('dashboard')}</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setUserDropdownOpen(false);
                        navigate({ to: '/' });
                      }}
                      className="flex w-full items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-destructive hover:bg-destructive/10 transition"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/auth/login"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-xs hover:bg-accent transition"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </Link>

                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-3.5 sm:px-4 py-2 text-xs font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition-all hover:scale-102"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Studio Launch</span>
                  <span className="sm:hidden">Studio</span>
                </Link>
              </div>
            )}

            {/* Mobile Full Drawer Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-foreground hover:bg-accent transition"
              aria-label="Toggle navigation menu"
            >
              {mobileDrawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. MOBILE EXPANDABLE DRAWER OVERLAY (More Options / Settings) */}
        {/* ============================================================ */}
        {mobileDrawerOpen && (
          <div className="md:hidden border-t border-border/80 bg-card/95 backdrop-blur-2xl p-4 space-y-4 animate-in slide-in-from-top-3 shadow-2xl">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Institutional Navigation
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-bold ${
                  pathname === '/' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-foreground'
                }`}
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Link>

              <Link
                to="/play"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-bold ${
                  isActive('/play') ? 'bg-emerald-500 text-white' : 'bg-background border border-border text-foreground'
                }`}
              >
                <Shield className="h-4 w-4 text-emerald-400" />
                <span>{t('join_pin')}</span>
              </Link>

              <Link
                to="/vault"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-bold ${
                  isActive('/vault') ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-foreground'
                }`}
              >
                <BookOpen className="h-4 w-4 text-primary" />
                <span>{t('vault')}</span>
              </Link>

              <Link
                to="/timer"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-bold ${
                  isActive('/timer') ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-foreground'
                }`}
              >
                <Clock className="h-4 w-4 text-primary" />
                <span>{t('exam_timer')}</span>
              </Link>

              <Link
                to="/pricing"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-bold ${
                  isActive('/pricing') ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-foreground'
                }`}
              >
                <Award className="h-4 w-4 text-amber-500" />
                <span>{t('pricing')}</span>
              </Link>

              <Link
                to="/security"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-bold ${
                  isActive('/security') ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-foreground'
                }`}
              >
                <Lock className="h-4 w-4 text-blue-500" />
                <span>Security</span>
              </Link>

              <Link
                to="/developers"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-bold ${
                  isActive('/developers') ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-foreground'
                }`}
              >
                <Code2 className="h-4 w-4 text-indigo-500" />
                <span>Developer API</span>
              </Link>

              <Link
                to="/contact-sales"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-bold ${
                  isActive('/contact-sales') ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-foreground'
                }`}
              >
                <MessageSquare className="h-4 w-4 text-pink-500" />
                <span>Contact Sales</span>
              </Link>
            </div>

            <div className="border-t border-border/80 pt-3 flex gap-2">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-glow"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Open Instructor Studio</span>
                </Link>
              ) : (
                <>
                  <Link
                    to="/auth/login"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="flex-1 text-center rounded-2xl border border-border bg-card py-2.5 text-xs font-bold text-foreground"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="flex-1 text-center rounded-2xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground shadow-glow"
                  >
                    Launch Studio
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ============================================================ */}
      {/* 3. ULTRA-MODERN FLOATING MOBILE BOTTOM NAVIGATION DOCK       */}
      {/* ============================================================ */}
      <nav
        aria-label="Mobile Bottom Dock"
        className="md:hidden fixed bottom-3 inset-x-0 z-50 px-4 pointer-events-none"
      >
        <div className="mx-auto max-w-sm rounded-3xl border border-border/90 bg-card/90 backdrop-blur-2xl shadow-2xl p-2 px-3 flex items-center justify-between pointer-events-auto transition-all">
          {/* 1. Home Tab */}
          <Link
            to="/"
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-2xl ${
              isActive('/') && pathname === '/'
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Home className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] font-medium leading-none">Home</span>
            {isActive('/') && pathname === '/' && (
              <span className="h-1 w-1 rounded-full bg-primary mt-1" />
            )}
          </Link>

          {/* 2. Vault Tab */}
          <Link
            to="/vault"
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-2xl ${
              isActive('/vault')
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] font-medium leading-none">{lang === 'bn' ? 'ভল্ট' : 'Vault'}</span>
            {isActive('/vault') && (
              <span className="h-1 w-1 rounded-full bg-primary mt-1" />
            )}
          </Link>

          {/* 3. Center Elevated Hero Action: ARENA PIN PASS */}
          <Link
            to="/play"
            className="flex flex-col items-center justify-center -top-4 relative px-1 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 group-hover:scale-105 border-2 border-background">
              <Shield className="h-6 w-6 fill-current" />
            </div>
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 mt-1 uppercase tracking-tight">
              {lang === 'bn' ? 'পিন পাস' : 'PIN Pass'}
            </span>
          </Link>

          {/* 4. Timer Tab */}
          <Link
            to="/timer"
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-2xl ${
              isActive('/timer')
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] font-medium leading-none">{lang === 'bn' ? 'টাইমার' : 'Timer'}</span>
            {isActive('/timer') && (
              <span className="h-1 w-1 rounded-full bg-primary mt-1" />
            )}
          </Link>

          {/* 5. Studio / Account Tab */}
          <Link
            to={isAuthenticated ? '/dashboard' : '/auth/login'}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-2xl ${
              isActive('/dashboard') || isActive('/auth/login')
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isAuthenticated ? (
              <LayoutDashboard className="h-5 w-5 mb-0.5" />
            ) : (
              <User className="h-5 w-5 mb-0.5" />
            )}
            <span className="text-[10px] font-medium leading-none">
              {isAuthenticated ? (lang === 'bn' ? 'স্টুডিও' : 'Studio') : (lang === 'bn' ? 'লগইন' : 'Login')}
            </span>
            {(isActive('/dashboard') || isActive('/auth/login')) && (
              <span className="h-1 w-1 rounded-full bg-primary mt-1" />
            )}
          </Link>
        </div>
      </nav>
    </>
  );
};

