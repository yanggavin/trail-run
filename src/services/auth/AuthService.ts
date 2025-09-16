import * as SecureStore from 'expo-secure-store';
import { AuthConfig } from '../../types/auth';
import { secureStorageService } from '../security/SecureStorageService';
import { dataValidationService } from '../security/DataValidationService';
import { secureCommunicationService } from '../security/SecureCommunicationService';

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenTimestamp: number;
}

export interface AuthUser {
  userId: string;
  email: string;
  givenName?: string;
  familyName?: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  givenName?: string;
  familyName?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface ConfirmSignUpRequest {
  email: string;
  confirmationCode: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ConfirmForgotPasswordRequest {
  email: string;
  confirmationCode: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  previousPassword: string;
  proposedPassword: string;
}

class AuthService {
  private config: AuthConfig;
  private tokens: AuthTokens | null = null;
  private user: AuthUser | null = null;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize secure storage and communication services
      await secureStorageService.initialize();
      secureCommunicationService.initialize(this.config.apiEndpoint);
      
      await this.loadStoredTokens();
      if (this.tokens && this.isTokenExpired()) {
        await this.refreshTokens();
      }
    } catch (error) {
      console.log('Failed to initialize auth service:', error);
      await this.clearStoredTokens();
    }
  }

  async signUp(request: SignUpRequest): Promise<{ userSub: string }> {
    // Validate and sanitize input
    const validatedRequest = dataValidationService.validateAuthInput(request);
    
    const response = await secureCommunicationService.request({
      url: '/auth',
      method: 'POST',
      body: {
        action: 'signUp',
        ...validatedRequest,
      },
      validateResponse: true,
    });

    return { userSub: response.data.userSub };
  }

  async confirmSignUp(request: ConfirmSignUpRequest): Promise<void> {
    // Validate and sanitize input
    const validatedRequest = dataValidationService.validateAuthInput(request);
    
    await secureCommunicationService.request({
      url: '/auth',
      method: 'POST',
      body: {
        action: 'confirmSignUp',
        ...validatedRequest,
      },
      validateResponse: true,
    });
  }

  async signIn(request: SignInRequest): Promise<AuthUser> {
    // Validate and sanitize input
    const validatedRequest = dataValidationService.validateAuthInput(request);
    
    const response = await secureCommunicationService.request({
      url: '/auth',
      method: 'POST',
      body: {
        action: 'signIn',
        ...validatedRequest,
      },
      validateResponse: true,
    });

    const result = response.data;
    
    if (result.challengeName) {
      throw new Error(`Authentication challenge required: ${result.challengeName}`);
    }

    const tokens: AuthTokens = {
      accessToken: result.accessToken,
      idToken: result.idToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      tokenTimestamp: Date.now(),
    };

    await this.storeTokens(tokens);
    this.tokens = tokens;
    
    // Decode user info from ID token
    this.user = this.decodeIdToken(result.idToken);
    
    return this.user;
  }

  async signOut(): Promise<void> {
    await secureStorageService.clearAuthTokens();
    this.tokens = null;
    this.user = null;
  }

  async refreshTokens(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.makeAuthRequest('refreshToken', {
      refreshToken: this.tokens.refreshToken,
    });

    if (!response.ok) {
      const error = await response.json();
      await this.clearStoredTokens();
      this.tokens = null;
      this.user = null;
      throw new Error(error.error || 'Token refresh failed');
    }

    const result = await response.json();
    
    const updatedTokens: AuthTokens = {
      ...this.tokens,
      accessToken: result.accessToken,
      idToken: result.idToken,
      expiresIn: result.expiresIn,
      tokenTimestamp: Date.now(),
    };

    await this.storeTokens(updatedTokens);
    this.tokens = updatedTokens;
    
    // Update user info from new ID token
    this.user = this.decodeIdToken(result.idToken);
  }

  async forgotPassword(request: ForgotPasswordRequest): Promise<void> {
    const response = await this.makeAuthRequest('forgotPassword', request);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Forgot password failed');
    }
  }

  async confirmForgotPassword(request: ConfirmForgotPasswordRequest): Promise<void> {
    const response = await this.makeAuthRequest('confirmForgotPassword', request);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Password reset failed');
    }
  }

  async changePassword(request: ChangePasswordRequest): Promise<void> {
    if (!this.tokens?.accessToken) {
      throw new Error('User not authenticated');
    }

    const response = await this.makeAuthRequest('changePassword', {
      ...request,
      accessToken: this.tokens.accessToken,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Password change failed');
    }
  }

  async deleteAccount(): Promise<void> {
    if (!this.tokens?.accessToken) {
      throw new Error('User not authenticated');
    }

    const response = await this.makeAuthRequest('deleteUser', {
      accessToken: this.tokens.accessToken,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Account deletion failed');
    }

    await this.signOut();
  }

  async getValidAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('User not authenticated');
    }

    if (this.isTokenExpired()) {
      await this.refreshTokens();
    }

    return this.tokens!.accessToken;
  }

  getCurrentUser(): AuthUser | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.tokens !== null && this.user !== null && !this.isTokenExpired();
  }

  private async makeAuthRequest(action: string, data: any): Promise<Response> {
    return fetch(`${this.config.apiEndpoint}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        ...data,
      }),
    });
  }

  private isTokenExpired(): boolean {
    if (!this.tokens) return true;
    
    const expirationTime = this.tokens.tokenTimestamp + (this.tokens.expiresIn * 1000);
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    
    return Date.now() >= (expirationTime - bufferTime);
  }

  private decodeIdToken(idToken: string): AuthUser {
    try {
      const payload = idToken.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      
      return {
        userId: decoded.sub,
        email: decoded.email,
        givenName: decoded.given_name,
        familyName: decoded.family_name,
      };
    } catch (error) {
      throw new Error('Failed to decode ID token');
    }
  }

  private async storeTokens(tokens: AuthTokens): Promise<void> {
    try {
      await secureStorageService.storeAuthTokens(tokens);
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  private async loadStoredTokens(): Promise<void> {
    try {
      const storedTokens = await secureStorageService.getAuthTokens();
      if (storedTokens) {
        this.tokens = storedTokens;
        if (this.tokens?.idToken) {
          this.user = this.decodeIdToken(this.tokens.idToken);
        }
      }
    } catch (error) {
      console.error('Failed to load stored tokens:', error);
      await this.clearStoredTokens();
    }
  }

  private async clearStoredTokens(): Promise<void> {
    try {
      await secureStorageService.clearAuthTokens();
    } catch (error) {
      console.error('Failed to clear stored tokens:', error);
    }
  }
}

export default AuthService;