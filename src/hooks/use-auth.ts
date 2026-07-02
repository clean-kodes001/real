import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthAPI, User, ApiError } from '@/services/api';
import toast from 'react-hot-toast';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<{ uuid: string; email: string; role: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  verifyEmail: (uuid: string, otp: string) => Promise<void>;
  resendVerification: (uuid: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, email: string, new_password: string) => Promise<void>;
  checkAuth: () => Promise<boolean>;
  updateUser: (userData: Partial<User>) => void;
  setHydrated: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      isHydrated: false,

      setHydrated: () => {
        set({ isHydrated: true, isLoading: false });
      },

      login: async (email: string, password: string) => {
        try {
          const response = await AuthAPI.login(email, password);
          const { access_token, refresh_token, user } = response.data;          
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          
          set({ user, isAuthenticated: true, isLoading: false });
          toast.success('Welcome back!');
        } catch (error) {
          set({ isLoading: false });
          if (error instanceof ApiError) {
            toast.error(error.getDisplayMessage());
          } else {
            toast.error('Login failed. Please try again.');
          }
          throw error;
        }
      },

      register: async (data: any) => {
        try {
          const response = await AuthAPI.register(data);
          toast.success('Registration successful! Please verify your email.');
          return response.data;
        } catch (error) {
          if (error instanceof ApiError) {
            toast.error(error.getDisplayMessage());
          } else {
            toast.error('Registration failed. Please try again.');
          }
          throw error;
        }
      },

      logout: async () => {
        try {
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
            await AuthAPI.logout(refreshToken);
          }
        } catch (error) {
          // Ignore errors on logout
        } finally {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          set({ user: null, isAuthenticated: false, isLoading: false });
          toast.success('Logged out successfully');
          window.location.href = '/auth/login';
        }
      },

      refreshToken: async () => {
        try {
          const refreshToken = localStorage.getItem('refresh_token');
          if (!refreshToken) throw new Error('No refresh token');

          const response = await AuthAPI.refresh(refreshToken);
          const { access_token, refresh_token } = response.data;
          
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          
          return Promise.resolve();
        } catch (error) {
          get().logout();
          return Promise.reject(error);
        }
      },

      verifyEmail: async (uuid: string, otp: string) => {
        try {
          await AuthAPI.verifyEmail(uuid, otp);
          const user = get().user;
          if (user && user.uuid === uuid) {
            set({ user: { ...user, email_verified: true } });
          }
          toast.success('Email verified successfully!');
        } catch (error) {
          if (error instanceof ApiError) {
            toast.error(error.getDisplayMessage());
          } else {
            toast.error('Verification failed. Please try again.');
          }
          throw error;
        }
      },

      resendVerification: async (uuid: string) => {
        try {
          await AuthAPI.resendVerification(uuid);
          toast.success('Verification code resent to your email');
        } catch (error) {
          if (error instanceof ApiError) {
            toast.error(error.getDisplayMessage());
          } else {
            toast.error('Failed to resend verification code');
          }
          throw error;
        }
      },

      forgotPassword: async (email: string) => {
        try {
          await AuthAPI.forgotPassword(email);
          toast.success('Password reset link sent to your email');
        } catch (error) {
          if (error instanceof ApiError) {
            toast.error(error.getDisplayMessage());
          } else {
            toast.error('Failed to send reset link');
          }
          throw error;
        }
      },

      resetPassword: async (token: string, email: string, new_password: string) => {
        try {
          await AuthAPI.resetPassword(token, email, new_password);
          toast.success('Password reset successfully!');
        } catch (error) {
          if (error instanceof ApiError) {
            toast.error(error.getDisplayMessage());
          } else {
            toast.error('Password reset failed');
          }
          throw error;
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const token = localStorage.getItem('access_token');
          if (!token) {
            set({ isLoading: false, isAuthenticated: false, user: null });
            return false;
          }

          // Try to refresh token to validate
          await get().refreshToken();
          
          // If refresh succeeded, get user profile to ensure user data is current
          try {
            const userResponse = await AuthAPI.login(
              // This is a hack - we need a proper /auth/me endpoint
              // For now, we'll just assume the user from storage is valid
            );
          } catch (e) {
            // If we can't get user, but token refresh worked, keep existing user
          }
          
          set({ isLoading: false, isAuthenticated: true });
          return true;
        } catch (error) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return false;
        }
      },

      updateUser: (userData: Partial<User>) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...userData } });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // This is called when the store is rehydrated
        state?.setHydrated();
        // Check auth after rehydration
        if (state?.user && state?.isAuthenticated) {
          state.checkAuth();
        } else {
          state?.setHydrated();
        }
      },
    }
  )
);