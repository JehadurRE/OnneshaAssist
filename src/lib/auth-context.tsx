import React, { createContext, useContext, useState, useEffect } from "react";
import {
  serverAuthenticateUser,
  serverChangeOwnPassword,
  serverGetCurrentUser,
  serverLogout,
  serverRequestPhoneOtp,
  serverSignupUser,
  serverUpdateOwnProfile,
  serverVerifyPhoneOtp,
} from "./server-session";
import { ManagedUser } from "./types";

export type UserRole = "instructor" | "candidate" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | undefined;
  institutionName?: string | undefined;
  designation?: string | undefined;
  phone?: string | undefined;
  assignedCourseIds?: string[] | undefined;
  aiCredits?: number | undefined;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password?: string,
  ) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  requestPhoneOtp: (
    phone: string,
  ) => Promise<{ success: boolean; error?: string; devOtp?: string }>;
  loginWithPhoneOtp: (
    phone: string,
    otp: string,
  ) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  signup: (data: {
    email: string;
    name: string;
    password?: string | undefined;
    role: UserRole;
    institutionName?: string | undefined;
    phone?: string | undefined;
  }) => Promise<{ success: boolean; error?: string }>;
  changePassword: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
  resetPasswordWithEmail: (
    email: string,
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

function toUserProfile(u: ManagedUser): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    institutionName: u.institutionName || u.institution,
    designation: u.designation,
    phone: u.phone,
    assignedCourseIds: u.assignedCourseIds,
    aiCredits: typeof u.aiCredits === "number" ? u.aiCredits : undefined,
    createdAt: u.createdAt,
  };
}

function syncProfileToStorage(profile: User | null) {
  if (typeof window === "undefined") return;
  if (!profile) {
    localStorage.removeItem("onnesha_auth_user");
    return;
  }
  localStorage.setItem("onnesha_auth_user", JSON.stringify(profile));
  if (typeof profile.aiCredits === "number" && Number.isFinite(profile.aiCredits)) {
    localStorage.setItem("onnesha_ai_credits", String(Math.max(0, profile.aiCredits)));
  }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ success: false }),
  requestPhoneOtp: async () => ({ success: false }),
  loginWithPhoneOtp: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  changePassword: async () => ({ success: false }),
  resetPasswordWithEmail: async () => ({ success: false }),
  logout: () => {},
  updateProfile: () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);

  const refreshUser = async (): Promise<void> => {
    try {
      const res = await serverGetCurrentUser();
      if (res.success && res.user) {
        const profile = toUserProfile(res.user);
        setUser(profile);
        syncProfileToStorage(profile);
      } else {
        setUser(null);
        syncProfileToStorage(null);
      }
    } catch (err) {
      console.warn("Auth session refresh notice:", err);
    }
  };

  useEffect(() => {
    let active = true;
    async function initAuth() {
      try {
        // Clear any legacy plaintext/client-side password registry
        localStorage.removeItem("onnesha_user_registry");

        const res = await serverGetCurrentUser();
        if (!active) return;

        if (res.success && res.user) {
          const profile = toUserProfile(res.user);
          setUser(profile);
          syncProfileToStorage(profile);
        } else {
          setUser(null);
          syncProfileToStorage(null);
        }
      } catch (err) {
        console.warn("Auth session verify notice:", err);
        if (active) {
          setUser(null);
          syncProfileToStorage(null);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    initAuth();
    return () => {
      active = false;
    };
  }, []);

  const login = async (
    email: string,
    password = "",
  ): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    if (lockoutUntil > Date.now()) {
      const waitSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      return { success: false, error: `Security cooldown active. Please wait ${waitSec} seconds.` };
    }

    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await serverAuthenticateUser({ data: { email: cleanEmail, password } });
      if (res.success && res.user) {
        setFailedAttempts(0);
        const profile = toUserProfile(res.user);
        setUser(profile);
        syncProfileToStorage(profile);
        await import("./db").then(({ db }) => db.syncFromServerStore()).catch(() => {});
        return { success: true, role: profile.role };
      }

      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      if (nextFailed >= 5) {
        setLockoutUntil(Date.now() + 60 * 1000);
        setFailedAttempts(0);
        return {
          success: false,
          error: "Too many failed login attempts. Security cooldown active (60s).",
        };
      }
      return {
        success: false,
        error: res.error || "Authentication failed. Please check credentials.",
      };
    } catch {
      return { success: false, error: "Unable to reach authentication server. Please retry." };
    }
  };

  const requestPhoneOtp = async (
    phone: string,
  ): Promise<{ success: boolean; error?: string; devOtp?: string }> => {
    try {
      const res = await serverRequestPhoneOtp({ data: { phone } });
      return {
        success: res.success,
        ...(res.error ? { error: res.error } : {}),
        ...(res.devOtp ? { devOtp: res.devOtp } : {}),
      };
    } catch {
      return { success: false, error: "Unable to contact SMS OTP gateway." };
    }
  };

  const loginWithPhoneOtp = async (
    phone: string,
    otp: string,
  ): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    try {
      const res = await serverVerifyPhoneOtp({ data: { phone, otp } });
      if (res.success && res.user) {
        const profile = toUserProfile(res.user);
        setUser(profile);
        syncProfileToStorage(profile);
        await import("./db").then(({ db }) => db.syncFromServerStore()).catch(() => {});
        return { success: true, role: profile.role };
      }
      return { success: false, error: res.error || "OTP verification failed." };
    } catch {
      return { success: false, error: "Unable to verify OTP with server." };
    }
  };

  const signup = async (data: {
    email: string;
    name: string;
    password?: string | undefined;
    role: UserRole;
    institutionName?: string | undefined;
    phone?: string | undefined;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!data.password || data.password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    try {
      const res = await serverSignupUser({
        data: {
          email: data.email,
          name: data.name,
          password: data.password,
          role: data.role,
          institutionName: data.institutionName,
          phone: data.phone,
        },
      });
      if (res.success && res.user) {
        const profile = toUserProfile(res.user);
        setUser(profile);
        syncProfileToStorage(profile);
        await import("./db").then(({ db }) => db.syncFromServerStore()).catch(() => {});
        return { success: true };
      }
      return { success: false, error: res.error || "Registration failed." };
    } catch {
      return { success: false, error: "Unable to complete registration on server." };
    }
  };

  const changePassword = async (
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Not authenticated" };
    try {
      const res = await serverChangeOwnPassword({ data: { oldPassword, newPassword } });
      return {
        success: res.success,
        ...(res.error ? { error: res.error } : {}),
      };
    } catch {
      return { success: false, error: "Failed to update password." };
    }
  };

  const resetPasswordWithEmail = async (
    _email: string,
    _newPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    return {
      success: false,
      error:
        "Unverified self-service email password reset is disabled for security. Please sign in with Phone & OTP or ask your Super Admin to reset your password from /admin.",
    };
  };

  const logout = () => {
    setUser(null);
    syncProfileToStorage(null);
    localStorage.removeItem("onnesha_user_registry");
    serverLogout()
      .then(() => import("./db").then(({ db }) => db.syncFromServerStore()))
      .catch(() => {});
  };

  const updateProfile = (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    syncProfileToStorage(updated);
    serverUpdateOwnProfile({
      data: {
        name: data.name,
        institutionName: data.institutionName,
        designation: data.designation,
        phone: data.phone,
      },
    }).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        requestPhoneOtp,
        loginWithPhoneOtp,
        signup,
        changePassword,
        resetPasswordWithEmail,
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
