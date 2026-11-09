import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'instructor' | 'candidate' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  institutionName?: string;
  phone?: string;
  createdAt: string;
}

interface StoredUserAccount extends User {
  passwordHash: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  requestPhoneOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPhoneOtp: (phone: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: { email: string; name: string; password?: string; role: UserRole; institutionName?: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
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

  // Initialize DB registry and restore active session if present
  useEffect(() => {
    async function initAuth() {
      try {
        const storedRegistry = localStorage.getItem('onnesha_user_registry');
        if (!storedRegistry) {
          // Pre-seed official instructor demo account in registry
          const defaultHash = await hashPassword('instructor123');
          const seedAccount: StoredUserAccount = {
            id: 'usr-default-instructor',
            email: 'instructor@onnesha.app',
            name: 'Farhan Chowdhury',
            role: 'instructor',
            institutionName: 'Onnesha Assessment Academy',
            phone: '01711000000',
            passwordHash: defaultHash,
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            createdAt: new Date().toISOString(),
          };
          localStorage.setItem('onnesha_user_registry', JSON.stringify([seedAccount]));
        }

        // Restore active user session if exists
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

  const login = async (email: string, password = ''): Promise<{ success: boolean; error?: string }> => {
    if (Date.now() < lockoutUntil) {
      const remainingSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      return { success: false, error: `Too many failed attempts. Please wait ${remainingSec}s before retrying.` };
    }

    const cleanEmail = email.trim().toLowerCase();
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
    if (account.passwordHash !== inputHash) {
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      if (nextFailed >= 5) {
        setLockoutUntil(Date.now() + 60 * 1000);
        setFailedAttempts(0);
        return { success: false, error: 'Too many failed login attempts. Security cooldown active (60s).' };
      }
      return { success: false, error: 'Incorrect password. Please verify and try again.' };
    }

    // Reset failed counter
    setFailedAttempts(0);

    const userProfile: User = {
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
      institutionName: account.institutionName,
      phone: account.phone,
      avatarUrl: account.avatarUrl,
      createdAt: account.createdAt,
    };

    setUser(userProfile);
    localStorage.setItem('onnesha_auth_user', JSON.stringify(userProfile));
    return { success: true };
  };

  const requestPhoneOtp = async (phone: string): Promise<{ success: boolean; error?: string }> => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 11) {
      return { success: false, error: 'Please provide a valid 11-digit Bangladeshi mobile number.' };
    }

    // Generate 6-digit OTP and store in sessionStorage with 5-minute expiry
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const payload = {
      phone: cleanPhone,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    sessionStorage.setItem(`onnesha_otp_${cleanPhone}`, JSON.stringify(payload));

    console.log(`[SMS OTP GATEWAY] Dispatched OTP for ${cleanPhone}: ${otp}`);
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

    // Clear OTP after successful consumption
    sessionStorage.removeItem(`onnesha_otp_${cleanPhone}`);

    // Check if user exists or create candidate profile
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
    const newAccount: StoredUserAccount = {
      id: `usr-${Date.now()}`,
      email: cleanEmail,
      name: data.name.trim(),
      role: data.role,
      institutionName: data.institutionName?.trim(),
      phone: data.phone?.replace(/\D/g, ''),
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    registry.push(newAccount);
    saveRegistry(registry);

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

  const changePassword = async (oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    const registry = getRegistry();
    const account = registry.find((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (!account) return { success: false, error: 'User account not found.' };

    const oldHash = await hashPassword(oldPassword);
    if (account.passwordHash && account.passwordHash !== oldHash) {
      return { success: false, error: 'Current password does not match.' };
    }

    account.passwordHash = await hashPassword(newPassword);
    saveRegistry(registry);
    return { success: true };
  };

  const resetPasswordWithEmail = async (email: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const registry = getRegistry();
    const account = registry.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!account) {
      return { success: false, error: 'No account found matching this email address.' };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    account.passwordHash = await hashPassword(newPassword);
    saveRegistry(registry);
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

    // Update in registry as well
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

