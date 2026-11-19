import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  ChevronLeft,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from "lucide-react";

export type StaffNavItem = {
  id: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  badge?: string | number | undefined;
  group?: string | undefined;
};

type StaffShellProps = {
  variant: "admin" | "instructor";
  title: string;
  subtitle?: string;
  eyebrow?: string;
  userName?: string | undefined;
  userEmail?: string | undefined;
  activeId: string;
  items: StaffNavItem[];
  onNavigate: (id: string) => void;
  headerActions?: React.ReactNode;
  toast?: React.ReactNode;
  children: React.ReactNode;
};

const VARIANT = {
  admin: {
    accent: "amber",
    rail: "from-amber-500/15 via-background to-background",
    active: "bg-amber-500 text-black shadow-sm",
    soft: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500",
  },
  instructor: {
    accent: "emerald",
    rail: "from-emerald-500/12 via-background to-background",
    active: "bg-primary text-primary-foreground shadow-sm",
    soft: "bg-primary/10 text-primary border-primary/30",
    dot: "bg-primary",
  },
} as const;

export function StaffShell({
  variant,
  title,
  subtitle,
  eyebrow,
  userName,
  userEmail,
  activeId,
  items,
  onNavigate,
  headerActions,
  toast,
  children,
}: StaffShellProps) {
  const theme = VARIANT[variant];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [activeId]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const groups = groupItems(items);
  const activeItem = items.find((i) => i.id === activeId);

  const NavList = ({ compact = false }: { compact?: boolean }) => (
    <nav className="flex flex-col gap-5 px-3 pb-6">
      {groups.map((group) => (
        <div key={group.name || "main"} className="space-y-1.5">
          {group.name && !compact && (
            <p className="px-3 pt-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">
              {group.name}
            </p>
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  title={item.label}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-bold transition ${
                    active
                      ? theme.active
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  } ${compact ? "justify-center px-2" : ""}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "" : "opacity-80"}`} />
                  {!compact && (
                    <>
                      <span className="flex-1 truncate leading-snug">
                        {item.shortLabel || item.label}
                      </span>
                      {item.badge !== undefined && item.badge !== "" && (
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-black ${
                            active
                              ? "bg-black/15 text-inherit"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      {toast}

      <div className="relative flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside
          className={`hidden lg:flex sticky top-0 h-[calc(100vh-0px)] max-h-[100dvh] shrink-0 flex-col border-r border-sidebar-border bg-gradient-to-b ${theme.rail} transition-[width] duration-200 ${
            collapsed ? "w-[76px]" : "w-[272px]"
          }`}
        >
          <div className={`border-b border-sidebar-border ${collapsed ? "p-3" : "p-4"}`}>
            <div className={`flex items-start gap-3 ${collapsed ? "justify-center" : ""}`}>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${theme.soft}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    {eyebrow || (variant === "admin" ? "Super Admin" : "Instructor Studio")}
                  </p>
                  <p className="truncate text-sm font-black text-foreground">{title}</p>
                  {(userName || userEmail) && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {userName}
                      {userEmail ? ` · ${userEmail}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pt-4">
            <NavList compact={collapsed} />
          </div>

          <div className="border-t border-sidebar-border p-3 space-y-2">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-bold text-muted-foreground hover:text-foreground"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" />
                  Collapse
                </>
              )}
            </button>
            {!collapsed && (
              <Link
                to={variant === "admin" ? "/dashboard" : "/portal"}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {variant === "admin" ? "Instructor Studio" : "Student Portal"}
              </Link>
            )}
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col border-r border-sidebar-border bg-card shadow-2xl animate-in slide-in-from-left">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    {eyebrow || (variant === "admin" ? "Super Admin" : "Instructor Studio")}
                  </p>
                  <p className="text-sm font-black">{title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl border border-border p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pt-3">
                <NavList />
              </div>
            </aside>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
            <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    className="lg:hidden mt-0.5 inline-flex rounded-xl border border-border bg-card p-2.5 text-foreground shadow-sm"
                    aria-label="Open sidebar"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${theme.soft}`}
                      >
                        {activeItem?.shortLabel || activeItem?.label || "Console"}
                      </span>
                    </div>
                    <h1 className="mt-1 truncate font-display text-xl font-black tracking-tight sm:text-2xl">
                      {activeItem?.label || title}
                    </h1>
                    {subtitle && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
                    )}
                  </div>
                </div>
                {headerActions && (
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {headerActions}
                  </div>
                )}
              </div>

              {/* Mobile section chips */}
              <div className="lg:hidden -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === activeId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition ${
                        active
                          ? theme.active
                          : "border border-border bg-card text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.shortLabel || item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-28 md:pb-10">
            <div className="mx-auto w-full max-w-6xl animate-in fade-in duration-300">
              {children}
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function groupItems(items: StaffNavItem[]) {
  const map = new Map<string, StaffNavItem[]>();
  for (const item of items) {
    const key = item.group || "";
    const list = map.get(key) || [];
    list.push(item);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([name, grouped]) => ({ name, items: grouped }));
}
