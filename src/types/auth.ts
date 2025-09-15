export interface AuthConfig {
  apiEndpoint: string;
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
  region: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  error: string | null;
}

export interface AuthUser {
  userId: string;
  email: string;
  givenName?: string;
  familyName?: string;
}

export interface AuthContextType {
  state: AuthState;
  signUp: (email: string, password: string, givenName?: string, familyName?: string) => Promise<void>;
  confirmSignUp: (email: string, confirmationCode: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, confirmationCode: string, newPassword: string) => Promise<void>;
  changePassword: (previousPassword: string, proposedPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  getAccessToken: () => Promise<string>;
  clearError: () => void;
}