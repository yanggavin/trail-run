import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AuthService from '../services/auth/AuthService';
import { AuthState, AuthContextType, AuthUser } from '../types/auth';

// Auth reducer
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: AuthUser | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SIGN_OUT' };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: action.payload !== null,
        error: null,
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SIGN_OUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        error: null,
        isLoading: false,
      };
    default:
      return state;
  }
};

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  authService: AuthService;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, authService }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await authService.initialize();
      
      const user = authService.getCurrentUser();
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error) {
      console.error('Auth initialization failed:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize authentication' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const signUp = async (
    email: string,
    password: string,
    givenName?: string,
    familyName?: string
  ): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      await authService.signUp({ email, password, givenName, familyName });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const confirmSignUp = async (email: string, confirmationCode: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      await authService.confirmSignUp({ email, confirmationCode });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Confirmation failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const user = await authService.signIn({ email, password });
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      await authService.signOut();
      dispatch({ type: 'SIGN_OUT' });
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if sign out fails, clear local state
      dispatch({ type: 'SIGN_OUT' });
    }
  };

  const forgotPassword = async (email: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      await authService.forgotPassword({ email });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Forgot password failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const confirmForgotPassword = async (
    email: string,
    confirmationCode: string,
    newPassword: string
  ): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      await authService.confirmForgotPassword({ email, confirmationCode, newPassword });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password reset failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const changePassword = async (
    previousPassword: string,
    proposedPassword: string
  ): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      await authService.changePassword({ previousPassword, proposedPassword });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password change failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const deleteAccount = async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      await authService.deleteAccount();
      dispatch({ type: 'SIGN_OUT' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Account deletion failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const getAccessToken = async (): Promise<string> => {
    try {
      return await authService.getValidAccessToken();
    } catch (error) {
      // If token refresh fails, sign out the user
      dispatch({ type: 'SIGN_OUT' });
      throw error;
    }
  };

  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const contextValue: AuthContextType = {
    state,
    signUp,
    confirmSignUp,
    signIn,
    signOut,
    forgotPassword,
    confirmForgotPassword,
    changePassword,
    deleteAccount,
    getAccessToken,
    clearError,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};