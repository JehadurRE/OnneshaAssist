import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';
import { LanguageToggle } from '@/components/common/LanguageToggle';
import { useBranding } from '@/hooks/use-branding';
import {
  Award,
  BookOpen,
  Building2,
  ChevronDown,
  Clock,
  Code2,
  GraduationCap,
  Home,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Shield,
  ShieldCheck,
  User,
  Users,
  X,
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
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-xl transition-colors">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          {/* 1. Left Brand Lockup & Optional Joint Partner Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs transition-transform group-hover:scale-105">
              <svg
                viewBox="0 0 36 36"
                fill="none"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle
                  cx="18"
                  cy="18"
                  r="11"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="48 16"
                />
                <circle cx="18" cy="18" r="4" fill="currentColor" />
              </svg>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-display text-base sm:text-lg font-black tracking-tight text-foreground">
                    Onnesha
                  </span>
                  <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                    Arena
                  </span>
                </div>
                {branding.showPartnerLogo && branding.partnerName ? (
                  <span className="mt-0.5 text-[10px] font-medium text-muted-foreground hidden sm:inline truncate max-w-[160px]">
                    × {branding.partnerName}
                  </span>
                ) : (
                  <span className="mt-0.5 text-[10px] font-medium text-muted-foreground hidden xl:inline">
                    Regional Assessment System
                  </span>
                )}
              </div>

              {branding.showPartnerLogo && branding.partnerLogoUrl && (
                <>
                  <span className="text-muted-foreground/50 font-mono text-xs font-bold pl-1">
                    ×
                  </span>
                  <img
                    src={branding.partnerLogoUrl}
                    alt={branding.partnerName || 'Joint Partner'}
                    className="h-8 max-w-[100px] rounded object-contain"
                  />
                </>
              )}
            </div>
          </Link>

          {/* 2. Center Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
            <Link
              to="/"
              className={`whitespace-nowrap rounded-xl px-3 py-2 transition-colors ${
                isActive('/') && pathname === '/'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {lang === 'bn' ? 'হোম' : 'Home'}
            </Link>

            <Link
              to="/play"
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 transition-colors ${
                isActive('/play')
                  ? 'bg-primary/15 text-primary font-bold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span>{t('join_pin')}</span>
            </Link>

            <Link
              to="/vault"
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 transition-colors ${
                isActive('/vault')
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>{t('vault')}</span>
            </Link>

            {/* Solutions Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setSolutionsOpen(true)}
              onMouseLeave={() => setSolutionsOpen(false)}
            >
              <button
                type="button"
                onClick={() => setSolutionsOpen(!solutionsOpen)}
                className={`flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 transition-colors ${
                  isActive('/for')
                    ? 'bg-primary/10 text-primary font-bold'
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
                <div className="absolute left-0 top-full pt-1.5 w-80 z-50">
                  <div className="rounded-2xl border border-border bg-card p-2 shadow-xl">
                    <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 mb-1">
                      Institutional Deployment
                    </div>

                    <Link
                      to="/for/$segment"
                      params={{ segment: 'education' }}
                      onClick={() => setSolutionsOpen(false)}
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-accent transition-colors"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-accent transition-colors"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-accent transition-colors"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-accent transition-colors"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-foreground">{t('for_events')}</div>
                        <div className="text-[11px] text-muted-foreground leading-snug">{t('for_events_desc')}</div>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link
              to="/pricing"
              className={`whitespace-nowrap rounded-xl px-3 py-2 transition-colors ${
                isActive('/pricing')
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {t('pricing')}
            </Link>

            <Link
              to="/timer"
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 transition-colors ${
                isActive('/timer')
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>{t('exam_timer')}</span>
            </Link>
          </nav>

          {/* 3. Right Actions Cluster */}
          <div className="flex items-center gap-2 shrink-0">
            <LanguageToggle />

            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 pr-2.5 hover:bg-accent transition"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                    {user.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="font-display text-xs font-bold text-foreground leading-tight max-w-[110px] truncate">
                      {user.name}
                    </div>
                    <div className="text-[9px] text-primary uppercase font-mono font-bold">
                      {user.role}
                    </div>
                  </div>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-xl z-50">
                    <div className="p-2.5 border-b border-border/80">
                      <div className="font-bold text-xs text-foreground truncate">{user.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                    </div>

                    {user?.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="mt-1 flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        <span>Super Admin Panel (/admin)</span>
                      </Link>
                    )}

                    {user?.role !== 'candidate' && (
                      <Link
                        to="/dashboard"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-foreground hover:bg-accent transition"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
                        <span>Instructor Studio (/dashboard)</span>
                      </Link>
                    )}

                    <Link
                      to="/play"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-foreground hover:bg-accent transition"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Student Exam Hub (/play)</span>
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
                  to="/admin"
                  className="hidden md:inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition"
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>{lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}</span>
                </Link>

                <Link
                  to="/auth/login"
                  className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-accent transition"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>{lang === 'bn' ? 'লগইন' : 'Sign In'}</span>
                </Link>

                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {lang === 'bn' ? 'ইন্সট্রাক্টর স্টুডিও' : 'Instructor Studio'}
                  </span>
                  <span className="sm:hidden">{lang === 'bn' ? 'স্টুডিও' : 'Studio'}</span>
                </Link>
              </div>
            )}

            {/* Mobile & Tablet Menu Button */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-accent transition"
              aria-label="Toggle navigation menu"
            >
              {mobileDrawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Expandable Drawer */}
        {mobileDrawerOpen && (
          <div className="lg:hidden border-t border-border/80 bg-card p-4 space-y-4 shadow-xl">
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                  pathname === '/'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border text-foreground'
                }`}
              >
                <Home className="h-4 w-4" />
                <span>{lang === 'bn' ? 'হোম' : 'Home'}</span>
              </Link>

              <Link
                to="/play"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                  isActive('/play')
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border text-foreground'
                }`}
              >
                <Shield className="h-4 w-4" />
                <span>{t('join_pin')}</span>
              </Link>

              <Link
                to="/vault"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                  isActive('/vault')
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border text-foreground'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>{t('vault')}</span>
              </Link>

              <Link
                to="/timer"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                  isActive('/timer')
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border text-foreground'
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>{t('exam_timer')}</span>
              </Link>

              <Link
                to="/pricing"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                  isActive('/pricing')
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border text-foreground'
                }`}
              >
                <Award className="h-4 w-4" />
                <span>{t('pricing')}</span>
              </Link>

              <Link
                to="/security"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                  isActive('/security')
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border text-foreground'
                }`}
              >
                <Lock className="h-4 w-4" />
                <span>Security</span>
              </Link>

              <Link
                to="/developers"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                  isActive('/developers')
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border text-foreground'
                }`}
              >
                <Code2 className="h-4 w-4" />
                <span>Developer API</span>
              </Link>

              <Link
                to="/contact-sales"
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                  isActive('/contact-sales')
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border text-foreground'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Contact Sales</span>
              </Link>
            </div>

            <div className="border-t border-border/80 pt-3 flex gap-2">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Open Instructor Studio</span>
                </Link>
              ) : (
                <>
                  <Link
                    to="/auth/login"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="flex-1 text-center rounded-xl border border-border bg-background py-2.5 text-xs font-bold text-foreground"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="flex-1 text-center rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground"
                  >
                    Instructor Studio
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Bottom Dock */}
      <nav
        aria-label="Mobile Bottom Dock"
        className="md:hidden fixed bottom-3 inset-x-0 z-50 px-4 pointer-events-none"
      >
        <div className="mx-auto max-w-sm rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-xl p-1.5 px-3 flex items-center justify-between pointer-events-auto">
          <Link
            to="/"
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl ${
              isActive('/') && pathname === '/'
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Home className="h-4 w-4 mb-0.5" />
            <span className="text-[10px] font-medium leading-none">Home</span>
          </Link>

          <Link
            to="/vault"
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl ${
              isActive('/vault')
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-4 w-4 mb-0.5" />
            <span className="text-[10px] font-medium leading-none">
              {lang === 'bn' ? 'ভল্ট' : 'Vault'}
            </span>
          </Link>

          <Link
            to="/play"
            className="flex flex-col items-center justify-center -top-3 relative px-1 group"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md border-2 border-background">
              <Shield className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-primary mt-0.5">
              {lang === 'bn' ? 'পিন পাস' : 'Join Hall'}
            </span>
          </Link>

          <Link
            to="/timer"
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl ${
              isActive('/timer')
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="h-4 w-4 mb-0.5" />
            <span className="text-[10px] font-medium leading-none">
              {lang === 'bn' ? 'টাইমার' : 'Timer'}
            </span>
          </Link>

          <Link
            to={isAuthenticated ? '/dashboard' : '/auth/login'}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl ${
              isActive('/dashboard') || isActive('/auth/login')
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isAuthenticated ? (
              <LayoutDashboard className="h-4 w-4 mb-0.5" />
            ) : (
              <User className="h-4 w-4 mb-0.5" />
            )}
            <span className="text-[10px] font-medium leading-none">
              {isAuthenticated
                ? lang === 'bn'
                  ? 'স্টুডিও'
                  : 'Studio'
                : lang === 'bn'
                  ? 'লগইন'
                  : 'Login'}
            </span>
          </Link>
        </div>
      </nav>
    </>
  );
};
