import type * as NodeCrypto from "node:crypto";
import type * as NodeFs from "node:fs";
import { ManagedUser } from "./types";

function getNodeCrypto(): typeof NodeCrypto | null {
  try {
    const proc = globalThis.process as unknown as {
      getBuiltinModule?: (id: string) => typeof NodeCrypto;
    };
    return proc?.getBuiltinModule ? proc.getBuiltinModule("node:crypto") : null;
  } catch {
    return null;
  }
}

function getNodeFsSafe(): typeof NodeFs | null {
  try {
    const proc = globalThis.process as unknown as {
      getBuiltinModule?: (id: string) => typeof NodeFs;
    };
    return proc?.getBuiltinModule ? proc.getBuiltinModule("node:fs") : null;
  } catch {
    return null;
  }
}

export function hashPasswordScrypt(password: string): string {
  const crypto = getNodeCrypto();
  if (!crypto) {
    throw new Error("Node crypto module is required for password hashing");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPasswordScrypt(
  password: string,
  storedHash?: string,
): { valid: boolean; needsRehash: boolean } {
  if (!password || !storedHash) {
    return { valid: false, needsRehash: false };
  }
  const crypto = getNodeCrypto();
  if (!crypto) {
    return { valid: false, needsRehash: false };
  }

  if (storedHash.startsWith("scrypt:")) {
    const parts = storedHash.split(":");
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const salt = parts[1];
    const hexHash = parts[2];
    if (!salt || !hexHash) return { valid: false, needsRehash: false };

    try {
      const expected = Buffer.from(hexHash, "hex");
      const actual = crypto.scryptSync(password, salt, 32);
      if (expected.length !== actual.length) return { valid: false, needsRehash: false };
      return { valid: crypto.timingSafeEqual(expected, actual), needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // Legacy SHA-256 hex (64 hex chars) or plaintext default seed migration
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const shaHex = crypto.createHash("sha256").update(password).digest("hex");
    const expected = Buffer.from(storedHash.toLowerCase(), "utf8");
    const actual = Buffer.from(shaHex.toLowerCase(), "utf8");
    if (expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) {
      return { valid: true, needsRehash: true };
    }
  }

  const expectedBuf = Buffer.from(storedHash, "utf8");
  const actualBuf = Buffer.from(password, "utf8");
  if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: true, needsRehash: true };
  }

  return { valid: false, needsRehash: false };
}

export function sanitizeUserForClient(user: ManagedUser): ManagedUser {
  const { passwordHash: _omitted, ...safeFields } = user;
  return {
    ...safeFields,
    institutionName: user.institutionName || user.institution,
  };
}

let cachedRuntimeSecret: string | null = null;

export function getServerSessionSecret(dataDir?: string): string {
  const envSecret =
    typeof process !== "undefined" ? process.env["SESSION_SECRET"]?.trim() : undefined;
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  if (cachedRuntimeSecret) return cachedRuntimeSecret;

  const crypto = getNodeCrypto();
  const fs = getNodeFsSafe();

  if (fs && dataDir) {
    try {
      const secretPath = `${dataDir}/.onnesha-session-secret`;
      if (fs.existsSync(secretPath)) {
        const existing = fs.readFileSync(secretPath, "utf-8").trim();
        if (existing.length >= 32) {
          cachedRuntimeSecret = existing;
          return existing;
        }
      }
      if (crypto) {
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        const generated = crypto.randomBytes(32).toString("hex");
        fs.writeFileSync(secretPath, generated, { mode: 0o600 });
        cachedRuntimeSecret = generated;
        return generated;
      }
    } catch {
      // Fall back to in-memory runtime secret
    }
  }

  if (crypto) {
    cachedRuntimeSecret = crypto.randomBytes(32).toString("hex");
    return cachedRuntimeSecret;
  }

  cachedRuntimeSecret = `ephemeral-${Date.now()}-${Math.random().toString(36)}`;
  return cachedRuntimeSecret;
}

export interface SignedSessionPayload {
  uid: string;
  role: ManagedUser["role"];
  exp: number;
}

export function signSessionToken(payload: SignedSessionPayload, secret: string): string {
  const crypto = getNodeCrypto();
  if (!crypto) {
    throw new Error("Node crypto module unavailable");
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  nowMs = Date.now(),
): SignedSessionPayload | null {
  if (!token) return null;
  const crypto = getNodeCrypto();
  if (!crypto) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const encodedPayload = parts[0];
  const sig = parts[1];
  if (!encodedPayload || !sig) return null;

  try {
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(encodedPayload)
      .digest("base64url");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const decoded = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SignedSessionPayload>;

    if (!decoded.uid || !decoded.role || typeof decoded.exp !== "number" || decoded.exp <= nowMs) {
      return null;
    }
    return {
      uid: decoded.uid,
      role: decoded.role,
      exp: decoded.exp,
    };
  } catch {
    return null;
  }
}

export function generateHostToken(): string {
  const crypto = getNodeCrypto();
  if (crypto) {
    return crypto.randomBytes(24).toString("hex");
  }
  return `ht-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const ADMIN_ONLY_MUTATIONS = new Set<string>([
  "save_user",
  "delete_user",
  "add_region",
  "delete_region",
  "save_course",
  "delete_course",
  "update_branding",
  "import_store_backup",
  "purge_dummy_data",
  "update_sales_lead",
  "update_transaction",
]);

const STAFF_MUTATIONS = new Set<string>([
  "save_quiz",
  "delete_quiz",
  "add_student",
  "bulk_add_students",
  "delete_student",
  "clear_roster",
  "issue_certificate",
]);

export function canActorMutateStoreAction(
  actor: { id: string; role: ManagedUser["role"] } | null,
  action: string,
  existingQuizAuthorId?: string,
  existingQuizIsTemplate?: boolean,
): { allowed: boolean; reason?: string } {
  if (!actor) {
    return { allowed: false, reason: "Authentication required. Please sign in." };
  }

  if (ADMIN_ONLY_MUTATIONS.has(action)) {
    if (actor.role !== "admin") {
      return { allowed: false, reason: "Super Admin privileges required for this action." };
    }
    return { allowed: true };
  }

  if (STAFF_MUTATIONS.has(action)) {
    if (actor.role !== "admin" && actor.role !== "instructor") {
      return { allowed: false, reason: "Instructor or Admin account required." };
    }
    if ((action === "delete_quiz" || action === "save_quiz") && actor.role !== "admin") {
      if (existingQuizIsTemplate) {
        return {
          allowed: false,
          reason: "Built-in template packs cannot be overwritten. Clone the quiz to customize it.",
        };
      }
      if (existingQuizAuthorId && existingQuizAuthorId !== actor.id) {
        return {
          allowed: false,
          reason: `Instructors can only ${action === "delete_quiz" ? "delete" : "modify"} their own quizzes.`,
        };
      }
    }
    return { allowed: true };
  }

  return { allowed: false, reason: `Unknown mutation action: ${action}` };
}
