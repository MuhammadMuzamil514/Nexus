import React, { createContext, useState, useContext, useEffect } from 'react';
import { User, UserRole, AuthContextType } from '../types';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import axios from 'axios';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'business_nexus_user';
const TOKEN_STORAGE_KEY = 'nexus_token';

// Pulls a readable message out of an axios error, or falls back to a default
const extractError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }
  return fallback;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On load, if we have a token, ask the backend who we are rather than
  // trusting whatever's cached in localStorage (handles expired tokens,
  // profile edits made elsewhere, etc.)
  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (email: string, password: string, role: UserRole): Promise<void> => {
    setIsLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password, role });
      setUser(data.user);
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      toast.success('Successfully logged in!');
    } catch (error) {
      const message = extractError(error, 'Invalid credentials or user not found');
      toast.error(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password, role });
      setUser(data.user);
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      toast.success('Account created successfully!');
    } catch (error) {
      const message = extractError(error, 'Could not create account');
      toast.error(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Sends a 6-digit code to the given email. Backend responds identically
  // whether or not the email exists, to avoid leaking which addresses are
  // registered - so this always "succeeds" from the UI's point of view.
  const forgotPassword = async (email: string): Promise<void> => {
    try {
      await api.post('/auth/otp/send', { email });
    } catch (error) {
      const message = extractError(error, 'Could not send verification code');
      toast.error(message);
      throw new Error(message);
    }
  };

  // email + the 6-digit code the user received + their new password
  const resetPassword = async (email: string, otp: string, newPassword: string): Promise<void> => {
    try {
      await api.post('/auth/otp/reset-password', { email, otp, newPassword });
      toast.success('Password reset successfully - you can now log in');
    } catch (error) {
      const message = extractError(error, 'Could not reset password');
      toast.error(message);
      throw new Error(message);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      // even if the network call fails, still clear local session
    }
    setUser(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    toast.success('Logged out successfully');
  };

  const updateProfile = async (_userId: string, updates: Partial<User>): Promise<void> => {
    try {
      const { data } = await api.put('/profile', updates);
      setUser(data.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      toast.success('Profile updated successfully');
    } catch (error) {
      const message = extractError(error, 'Could not update profile');
      toast.error(message);
      throw new Error(message);
    }
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    isAuthenticated: !!user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
