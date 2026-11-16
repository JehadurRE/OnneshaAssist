import React from "react";

export interface OnneshaLogoProps {
  /** "default" follows UI theme, "print" uses crisp black ink for white paper, "compact" omits subtitle/badge extras, "markOnly" shows only the emblem */
  variant?: "default" | "print" | "compact" | "markOnly";
  size?: "xs" | "sm" | "md" | "lg";
  subtitle?: string | undefined;
  showArenaBadge?: boolean | undefined;
  showBengali?: boolean | undefined;
  className?: string | undefined;
}

const SIZE_CLASSES: Record<NonNullable<OnneshaLogoProps["size"]>, {
  img: string;
  title: string;
  bn: string;
  badge: string;
  sub: string;
  gap: string;
}> = {
  xs: {
    img: "h-5 w-5",
    title: "text-xs font-black tracking-tight",
    bn: "text-[11px] font-bold",
    badge: "text-[8px] px-1 py-0",
    sub: "text-[9px]",
    gap: "gap-1.5",
  },
  sm: {
    img: "h-7 w-7",
    title: "text-sm font-black tracking-tight",
    bn: "text-xs font-bold",
    badge: "text-[9px] px-1.5 py-0.5",
    sub: "text-[10px]",
    gap: "gap-2",
  },
  md: {
    img: "h-9 w-9",
    title: "text-base sm:text-lg font-black tracking-tight",
    bn: "text-xs sm:text-sm font-extrabold",
    badge: "text-[10px] px-1.5 py-0.5",
    sub: "text-[10px]",
    gap: "gap-2.5",
  },
  lg: {
    img: "h-12 w-12",
    title: "text-xl sm:text-2xl font-black tracking-tight",
    bn: "text-sm sm:text-base font-extrabold",
    badge: "text-[10px] px-2 py-0.5",
    sub: "text-[11px]",
    gap: "gap-3",
  },
};

export const ONNESHA_MARK_SRC = "/assets/onnesha-mark.png";

/**
 * Official Onnesha ("অন্বেষা") transparent brand emblem & bilingual typographic lockup.
 * Pairs the transparent calligraphic Bangla 'অ' + open book + flame illustration cleanly
 * on light, dark, and print surfaces.
 */
export const OnneshaLogo: React.FC<OnneshaLogoProps> = ({
  variant = "default",
  size = "md",
  subtitle,
  showArenaBadge = true,
  showBengali = true,
  className = "",
}) => {
  const s = SIZE_CLASSES[size];
  const isPrint = variant === "print";
  const isCompact = variant === "compact";

  if (variant === "markOnly") {
    return (
      <img
        src={ONNESHA_MARK_SRC}
        alt="Onnesha (অন্বেষা)"
        className={`${s.img} shrink-0 object-contain select-none ${className}`}
      />
    );
  }

  return (
    <span className={`inline-flex items-center ${s.gap} shrink-0 select-none ${className}`}>
      <img
        src={ONNESHA_MARK_SRC}
        alt="অন্বেষা · Onnesha"
        className={`${s.img} shrink-0 object-contain drop-shadow-[0_1px_2px_rgba(14,165,233,0.18)]`}
      />
      <span className="flex flex-col text-left leading-none">
        <span className="flex items-center gap-1.5 leading-none">
          <span
            className={`font-display ${s.title} ${
              isPrint ? "text-black" : "text-foreground"
            }`}
          >
            Onnesha
          </span>
          {showBengali && (
            <span
              className={`${s.bn} ${
                isPrint
                  ? "text-sky-800"
                  : "text-sky-600 dark:text-sky-400"
              }`}
            >
              অন্বেষা
            </span>
          )}
          {!isCompact && showArenaBadge && (
            <span
              className={`rounded border font-mono font-bold uppercase tracking-wider ${s.badge} ${
                isPrint
                  ? "border-sky-800/30 bg-sky-50 text-sky-900"
                  : "border-primary/30 bg-primary/10 text-primary"
              }`}
            >
              Arena
            </span>
          )}
        </span>
        {subtitle && (
          <span
            className={`mt-0.5 font-medium truncate max-w-[180px] ${s.sub} ${
              isPrint ? "text-gray-600" : "text-muted-foreground"
            }`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
};
