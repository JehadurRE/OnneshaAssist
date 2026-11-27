import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_INSTRUCTOR_PASSWORD,
  resetAllStaffPasswordsInStore,
  upsertManagedUserInStore,
} from "../server-session";
import { hashPasswordScrypt, verifyPasswordScrypt } from "../server-security";
import type { ManagedUser } from "../types";

describe("resetAllStaffPasswordsInStore & staff password persistence", () => {
  it("resets admin and instructor passwords to role defaults and skips candidates", () => {
    const store = {
      users: [
        {
          id: "a1",
          email: "admin@test.app",
          name: "Admin",
          role: "admin",
          passwordHash: hashPasswordScrypt("old-admin"),
          status: "active",
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "i1",
          email: "inst@test.app",
          name: "Instructor",
          role: "instructor",
          passwordHash: hashPasswordScrypt("old-inst"),
          status: "active",
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "c1",
          email: "cand@test.app",
          name: "Candidate",
          role: "candidate",
          passwordHash: hashPasswordScrypt("keep-me"),
          status: "active",
          createdAt: "2026-01-01T00:00:00Z",
        },
      ] as ManagedUser[],
    };

    const summary = resetAllStaffPasswordsInStore(store as never);
    expect(summary.adminCount).toBe(1);
    expect(summary.instructorCount).toBe(1);
    expect(summary.resetEmails).toEqual(["admin@test.app", "inst@test.app"]);

    expect(
      verifyPasswordScrypt(DEFAULT_ADMIN_PASSWORD, store.users[0]!.passwordHash!).valid,
    ).toBe(true);
    expect(
      verifyPasswordScrypt(DEFAULT_INSTRUCTOR_PASSWORD, store.users[1]!.passwordHash!).valid,
    ).toBe(true);
    expect(verifyPasswordScrypt("keep-me", store.users[2]!.passwordHash!).valid).toBe(true);
  });

  it("hashes new admin password on edit and preserves custom password when blank", () => {
    const initial: ManagedUser[] = [
      {
        id: "usr-super-admin",
        email: "admin@onnesha.app",
        name: "Super Admin",
        role: "admin",
        passwordHash: hashPasswordScrypt("admin123"),
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    const updated = upsertManagedUserInStore(initial, {
      ...initial[0]!,
      name: "Md. Jehad",
      passwordHash: "MyStrongPass#2026",
    });
    expect(updated.success).toBe(true);
    const savedHash = updated.savedUser?.passwordHash;
    expect(savedHash?.startsWith("scrypt:")).toBe(true);
    expect(verifyPasswordScrypt("MyStrongPass#2026", savedHash!).valid).toBe(true);
    expect(verifyPasswordScrypt("admin123", savedHash!).valid).toBe(false);

    // Subsequent profile edit without password keeps the custom hash intact
    const profileOnly = upsertManagedUserInStore(updated.users, {
      ...updated.savedUser!,
      designation: "Director",
      passwordHash: "",
    });
    expect(profileOnly.success).toBe(true);
    expect(profileOnly.savedUser?.passwordHash).toBe(savedHash);
    expect(verifyPasswordScrypt("MyStrongPass#2026", profileOnly.savedUser?.passwordHash!).valid).toBe(
      true,
    );
  });
});
