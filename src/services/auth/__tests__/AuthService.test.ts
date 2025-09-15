import AuthService from '../AuthService';
import * as SecureStore from 'expo-secure-store';
import { AuthConfig } from '../../../types/auth';

// Mock SecureStore
jest.mock('expo-secure-store');
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockConfig: AuthConfig;

  beforeEach(() => {
    mockConfig = {
      apiEndpoint: 'https://api.example.com',
      userPoolId: 'us-east-1_test',
      userPoolClientId: 'test-client-id',
      identityPoolId: 'us-east-1:test-identity-pool',
      region: 'us-east-1',
    };

    authService = new AuthService(mockConfig);
    
    // Clear all mocks
    jest.clearAllMocks();
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockSecureStore.setItemAsync.mockResolvedValue();
    mockSecureStore.deleteItemAsync.mockResolvedValue();
  });

  describe('initialize', () => {
    it('should initialize without stored tokens', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      await authService.initialize();

      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('auth_tokens');
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should initialize with valid stored tokens', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.test',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenTimestamp: Date.now() - 1000, // 1 second ago
      };

      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mockTokens));

      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.getCurrentUser()).toEqual({
        userId: 'user-id',
        email: 'test@example.com',
      });
    });

    it('should refresh expired tokens on initialize', async () => {
      const expiredTokens = {
        accessToken: 'expired-access-token',
        idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.test',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenTimestamp: Date.now() - 4000000, // Expired
      };

      const newTokens = {
        accessToken: 'new-access-token',
        idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.test',
        expiresIn: 3600,
      };

      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(expiredTokens));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => newTokens,
      } as Response);

      await authService.initialize();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.apiEndpoint}/auth`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            action: 'refreshToken',
            refreshToken: 'refresh-token',
          }),
        })
      );
    });
  });

  describe('signUp', () => {
    it('should sign up successfully', async () => {
      const mockResponse = { userSub: 'new-user-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        givenName: 'John',
        familyName: 'Doe',
      });

      expect(result).toEqual({ userSub: 'new-user-id' });
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.apiEndpoint}/auth`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            action: 'signUp',
            email: 'test@example.com',
            password: 'password123',
            givenName: 'John',
            familyName: 'Doe',
          }),
        })
      );
    });

    it('should throw error on sign up failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Email already exists' }),
      } as Response);

      await expect(
        authService.signUp({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('signIn', () => {
    it('should sign in successfully', async () => {
      const mockResponse = {
        accessToken: 'access-token',
        idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZ2l2ZW5fbmFtZSI6IkpvaG4ifQ.test',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const user = await authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(user).toEqual({
        userId: 'user-id',
        email: 'test@example.com',
        givenName: 'John',
      });

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_tokens',
        expect.stringContaining('access-token')
      );

      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should throw error on sign in failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' }),
      } as Response);

      await expect(
        authService.signIn({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle authentication challenges', async () => {
      const mockResponse = {
        challengeName: 'NEW_PASSWORD_REQUIRED',
        session: 'challenge-session',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(
        authService.signIn({
          email: 'test@example.com',
          password: 'temppassword',
        })
      ).rejects.toThrow('Authentication challenge required: NEW_PASSWORD_REQUIRED');
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      // First sign in
      const mockTokens = {
        accessToken: 'access-token',
        idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.test',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenTimestamp: Date.now(),
      };

      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mockTokens));
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(true);

      // Then sign out
      await authService.signOut();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_tokens');
      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getCurrentUser()).toBeNull();
    });
  });

  describe('getValidAccessToken', () => {
    it('should return valid access token', async () => {
      const mockTokens = {
        accessToken: 'valid-access-token',
        idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.test',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenTimestamp: Date.now() - 1000, // 1 second ago
      };

      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mockTokens));
      await authService.initialize();

      const token = await authService.getValidAccessToken();

      expect(token).toBe('valid-access-token');
    });

    it('should refresh token if expired', async () => {
      const expiredTokens = {
        accessToken: 'expired-access-token',
        idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.test',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenTimestamp: Date.now() - 4000000, // Expired
      };

      const newTokens = {
        accessToken: 'new-access-token',
        idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.test',
        expiresIn: 3600,
      };

      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(expiredTokens));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => newTokens,
      } as Response);

      await authService.initialize();
      const token = await authService.getValidAccessToken();

      expect(token).toBe('new-access-token');
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.apiEndpoint}/auth`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            action: 'refreshToken',
            refreshToken: 'refresh-token',
          }),
        })
      );
    });

    it('should throw error if not authenticated', async () => {
      await expect(authService.getValidAccessToken()).rejects.toThrow('User not authenticated');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.test',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenTimestamp: Date.now(),
      };

      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mockTokens));
      await authService.initialize();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password changed successfully' }),
      } as Response);

      await authService.changePassword({
        previousPassword: 'oldpassword',
        proposedPassword: 'newpassword',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.apiEndpoint}/auth`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            action: 'changePassword',
            previousPassword: 'oldpassword',
            proposedPassword: 'newpassword',
            accessToken: 'access-token',
          }),
        })
      );
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.test',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenTimestamp: Date.now(),
      };

      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mockTokens));
      await authService.initialize();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'User deleted successfully' }),
      } as Response);

      await authService.deleteAccount();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.apiEndpoint}/auth`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            action: 'deleteUser',
            accessToken: 'access-token',
          }),
        })
      );

      expect(authService.isAuthenticated()).toBe(false);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_tokens');
    });
  });
});