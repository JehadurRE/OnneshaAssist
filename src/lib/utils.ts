import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * TanStack Router parses numeric/boolean URL query values with JSON semantics
 * (e.g. `?pin=408756` -> number `408756`, `?minAnswers=3` -> number `3`).
 * Coerce string, finite number, or boolean search params back to a trimmed string.
 */
export function coerceSearchString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

/**
 * Coerce a `?pin=` URL search parameter (string or JSON-parsed number) into
 * at most 6 numeric PIN digits while preserving leading zeros on string values.
 */
export function coercePinSearchParam(value: unknown): string | undefined {
  const raw = coerceSearchString(value);
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  return digits ? digits : undefined;
}
