import React, { createContext, useContext, useState, useEffect } from 'react';
import { serverAuthenticateUser, serverAdminMutateStore } from './server-session';
import { DEFAULT_USERS } from './mock-data';
import { ManagedUser } from './types';

export type UserRole = 'instructor' | 'candidate' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  institutionName?: string;
  designation?: string;
  phone?: string;
  assignedCourseIds?: string[];
  createdAt: string;
}

interface StoredUserAccount extends User {
  passwordHash: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  requestPhoneOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPhoneOtp: (phone: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: {
    email: string;
    name: string;
    password?: string;
    role: UserRole;
    institutionName?: string;
    phone?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordWithEmail: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);

  useEffect(() => {
    async function initAuth() {
      try {
        const storedRegistry = localStorage.getItem('onnesha_user_registry');
        let list: StoredUserAccount[] = storedRegistry ? JSON.parse(storedRegistry) : [];

        // Ensure default Admin & Instructor accounts are always seeded locally as well
        for (const def of DEFAULT_USERS) {
          if (!list.some((u) => u.email.toLowerCase() === def.email.toLowerCase())) {
            const hashed = await hashPassword(def.passwordHash || 'instructor123');
            list.push({
              id: def.id,
              email: def.email,
              name: def.name,
              role: def.role,
              institutionName: def.institution,
              designation: def.designation,
              phone: def.phone,
              assignedCourseIds: def.assignedCourseIds,
              passwordHash: hashed,
              createdAt: def.createdAt,
            });
          }
        }
        localStorage.setItem('onnesha_user_registry', JSON.stringify(list));

        const activeSession = localStorage.getItem('onnesha_auth_user');
        if (activeSession) {
          setUser(JSON.parse(activeSession));
        }
      } catch (e) {
        console.error('Auth initialization error:', e);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const getRegistry = (): StoredUserAccount[] => {
    try {
      const stored = localStorage.getItem('onnesha_user_registry');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveRegistry = (registry: StoredUserAccount[]) => {
    try {
      localStorage.setItem('onnesha_user_registry', JSON.stringify(registry));
    } catch (e) {
      console.warn('Storage error saving registry:', e);
    }
  };

  const login = async (
    email: string,
    password = ''
  ): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    if (Date.now() < lockoutUntil) {
      const remainingSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      return { success: false, error: `Too many failed attempts. Please wait ${remainingSec}s before retrying.` };
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. First attempt Server-Authoritative Authentication (works across all devices!)
    try {
      const srv = await serverAuthenticateUser({ data: { email: cleanEmail, password } });
      if (srv.success && srv.user) {
        setFailedAttempts(0);
        const userProfile: User = {
          id: srv.user.id,
          email: srv.user.email,
          name: srv.user.name,
          role: srv.user.role,
          institutionName: srv.user.institution,
          designation: srv.user.designation,
          phone: srv.user.phone,
          assignedCourseIds: srv.user.assignedCourseIds,
          createdAt: srv.user.createdAt,
        };
        setUser(userProfile);
        localStorage.setItem('onnesha_auth_user', JSON.stringify(userProfile));
        return { success: true, role: userProfile.role };
      }
    } catch {
      // Fallback to local registry if offline
    }

    // 2. Fallback to Local Registry
    const registry = getRegistry();
    const account = registry.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!account) {
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      if (nextFailed >= 5) {
        setLockoutUntil(Date.now() + 60 * 1000);
        setFailedAttempts(0);
        return { success: false, error: 'Too many failed login attempts. Security cooldown active (60s).' };
      }
      return { success: false, error: 'No account found with this email address.' };
    }

    const inputHash = await hashPassword(password);
    if (account.passwordHash !== inputHash && account.passwordHash !== password) {
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      if (nextFailed >= 5) {
        setLockoutUntil(Date.now() + 60 * 1000);
        setFailedAttempts(0);
        return { success: false, error: 'Too many failed login attempts. Security cooldown active (60s).' };
      }
      return { success: false, error: 'Incorrect password. Please verify and try again.' };
    }

    setFailedAttempts(0);

    const userProfile: User = {
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
      institutionName: account.institutionName,
      designation: account.designation,
      phone: account.phone,
      assignedCourseIds: account.assignedCourseIds,
      avatarUrl: account.avatarUrl,
      createdAt: account.createdAt,
    };

    setUser(userProfile);
    localStorage.setItem('onnesha_auth_user', JSON.stringify(userProfile));
    return { success: true, role: userProfile.role };
  };

  const requestPhoneOtp = async (phone: string): Promise<{ success: boolean; error?: string }> => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 11) {
      return { success: false, error: 'Please provide a valid 11-digit Bangladeshi mobile number.' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const payload = {
      phone: cleanPhone,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    sessionStorage.setItem(`onnesha_otp_${cleanPhone}`, JSON.stringify(payload));
    return { success: true };
  };

  const loginWithPhoneOtp = async (phone: string, otp: string): Promise<{ success: boolean; error?: string }> => {
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanOtp = otp.trim();

    const storedOtpRaw = sessionStorage.getItem(`onnesha_otp_${cleanPhone}`);
    if (!storedOtpRaw) {
      return { success: false, error: 'No active OTP requested for this number. Please request a new OTP.' };
    }

    const storedOtp = JSON.parse(storedOtpRaw);
    if (Date.now() > storedOtp.expiresAt) {
      sessionStorage.removeItem(`onnesha_otp_${cleanPhone}`);
      return { success: false, error: 'OTP has expired. Please request a new code.' };
    }

    if (storedOtp.otp !== cleanOtp) {
      return { success: false, error: 'Invalid verification code. Please check SMS and try again.' };
    }

    sessionStorage.removeItem(`onnesha_otp_${cleanPhone}`);

    const registry = getRegistry();
    let account = registry.find((u) => u.phone === cleanPhone);

    if (!account) {
      account = {
        id: `usr-phone-${Date.now()}`,
        email: `${cleanPhone}@onnesha.app`,
        name: `Cadet ${cleanPhone.slice(-4)}`,
        role: 'candidate',
        phone: cleanPhone,
        passwordHash: '',
        createdAt: new Date().toISOString(),
      };
      registry.push(account);
      saveRegistry(registry);
    }

    const userProfile: User = {
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
      phone: account.phone,
      institutionName: account.institutionName,
      createdAt: account.createdAt,
    };

    setUser(userProfile);
    localStorage.setItem('onnesha_auth_user', JSON.stringify(userProfile));
    return { success: true };
  };

  const signup = async (data: {
    email: string;
    name: string;
    password?: string;
    role: UserRole;
    institutionName?: string;
    phone?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = data.email.trim().toLowerCase();
    const registry = getRegistry();

    if (registry.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email address already exists. Please login instead.' };
    }

    if (!data.password || data.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const passwordHash = await hashPassword(data.password);
    const id = `usr-${Date.now()}`;
    const createdAt = new Date().toISOString();

    const newAccount: StoredUserAccount = {
      id,
      email: cleanEmail,
      name: data.name.trim(),
      role: data.role,
      institutionName: data.institutionName?.trim(),
      phone: data.phone?.replace(/\D/g, ''),
      passwordHash,
      createdAt,
    };

    registry.push(newAccount);
    saveRegistry(registry);

    // Sync to server store as well
    const managedUser: ManagedUser = {
      id,
      name: newAccount.name,
      email: cleanEmail,
      passwordHash: data.password,
      role: data.role === 'admin' ? 'admin' : 'instructor',
      institution: newAccount.institutionName || 'Onnesha Faculty',
      designation: data.role === 'admin' ? 'System Administrator' : 'Course Instructor',
      phone: newAccount.phone,
      plan: 'institution_max',
      assignedCourseIds: [],
      status: 'active',
      createdAt,
    };
    serverAdminMutateStore({ data: { action: 'save_user', user: managedUser } }).catch(() => {});

    const userProfile: User = {
      id: newAccount.id,
      email: newAccount.email,
      name: newAccount.name,
      role: newAccount.role,
      institutionName: newAccount.institutionName,
      phone: newAccount.phone,
      createdAt: newAccount.createdAt,
    };

    setUser(userProfile);
    localStorage.setItem('onnesha_auth_user', JSON.stringify(userProfile));
    return { success: true };
  };

  const changePassword = async (
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    const registry = getRegistry();
    const account = registry.find((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (account) {
      account.passwordHash = await hashPassword(newPassword);
      saveRegistry(registry);
    }

    serverAdminMutateStore({
      data: {
        action: 'save_user',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role === 'admin' ? 'admin' : 'instructor',
          institution: user.institutionName || 'Onnesha HQ',
          passwordHash: newPassword,
          plan: 'institution_max',
          status: 'active',
          createdAt: user.createdAt,
        },
      },
    }).catch(() => {});

    return { success: true };
  };

  const resetPasswordWithEmail = async (
    email: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    const registry = getRegistry();
    const account = registry.find((u) => u.email.toLowerCase() === cleanEmail);

    if (account) {
      account.passwordHash = await hashPassword(newPassword);
      saveRegistry(registry);
    }

    serverAdminMutateStore({
      data: {
        action: 'save_user',
        user: {
          id: account?.id || `usr-${Date.now()}`,
          email: cleanEmail,
          name: account?.name || 'Faculty Instructor',
          role: account?.role === 'admin' ? 'admin' : 'instructor',
          institution: account?.institutionName || 'Onnesha Assessment Arena',
          passwordHash: newPassword,
          plan: 'institution_max',
          status: 'active',
          createdAt: account?.createdAt || new Date().toISOString(),
        },
      },
    }).catch(() => {});

    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('onnesha_auth_user');
  };

  const updateProfile = (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem('onnesha_auth_user', JSON.stringify(updated));

    const registry = getRegistry();
    const idx = registry.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      registry[idx] = { ...registry[idx], ...data };
      saveRegistry(registry);
    }
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
