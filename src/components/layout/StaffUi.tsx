import React from "react";
import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function StaffPanel({ className, ...props }: DivProps) {
  return <div className={cn("staff-panel", className)} {...props} />;
}

export function StaffPanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("staff-panel-header", className)}>
      <div className="min-w-0 space-y-1">
        <h2 className="staff-panel-title">{title}</h2>
        {description ? <p className="staff-panel-desc">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0 flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function StaffMetric({
  label,
  value,
  hint,
  icon,
  onClick,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  tone?: "default" | "amber" | "sky" | "emerald" | "rose";
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("staff-metric", onClick && "staff-metric-clickable", `staff-metric-${tone}`)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="staff-metric-label">{label}</span>
        {icon ? <span className="staff-metric-icon">{icon}</span> : null}
      </div>
      <div className="staff-metric-value">{value}</div>
      {hint ? <div className="staff-metric-hint">{hint}</div> : null}
    </Comp>
  );
}

export function StaffField({
  label,
  children,
  hint,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("staff-field", className)}>
      <span className="staff-label">{label}</span>
      {children}
      {hint ? <span className="staff-hint">{hint}</span> : null}
    </label>
  );
}

export function StaffToolbar({ className, ...props }: DivProps) {
  return <div className={cn("staff-toolbar", className)} {...props} />;
}

export function StaffEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="staff-empty">
      <p className="staff-empty-title">{title}</p>
      {description ? <p className="staff-empty-desc">{description}</p> : null}
      {action}
    </div>
  );
}

export function StaffTableWrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("staff-table-wrap", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
