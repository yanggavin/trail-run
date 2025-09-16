import { SecureStorageService } from '../SecureStorageService';
import * as SecureStore from 'expo-secure-store';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock crypto-js
jest.mock('crypto-js', () => ({
  lib: {
    WordArray: {
      random: jest.fn(() => ({
        toString: jest.fn(() => 'mock-random-string'),
      })),
    },
  },
  PBKDF2: jest.fn(() => 'mock-derived-key'),
  AES: {
    encrypt: jest.fn(() => ({
      toString: jest.fn(() => 'mock-encrypted-data'),
    })),
    decrypt: jest.fn(() => ({
      toString: jest.fn(() => 'decrypted-data'),
    })),
  },
  pad: {
    Pkcs7: 'mock-padding',
  },
  mode: {
    CBC: 'mock-mode',
  },
  enc: {
    Hex: {
      parse: jest.fn(() => 'mock-parsed-hex'),
    },
    Utf8: 'mock-utf8',
  },
}));

describe('SecureStorageService', () => {
  let service: SecureStorageService;
  const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

  beforeEach(() => {
    service = SecureStorageService.getInstance();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      mockSecureStore.setItemAsync.mockResolvedValue();

      await service.initialize();

      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('master_key');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'master_key',
        'mock-random-string',
        { requireAuthentication: false }
      );
    });

    it('should use existing master key if available', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('existing-master-key');

      await service.initialize();

      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('master_key');
      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });

  describe('setItem', () => {
    beforeEach(async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('master-key');
      await service.initialize();
    });

    it('should store encrypted item successfully', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();

      await service.setItem('test-key', 'test-value');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'test-key',
        expect.stringContaining(':'),
        { requireAuthentication: false }
      );
    });

    it('should validate key format', async () => {
      await expect(service.setItem('', 'value')).rejects.toThrow('Invalid key');
      await expect(service.setItem('key with spaces', 'value')).rejects.toThrow('Invalid key');
      await expect(service.setItem('a'.repeat(256), 'value')).rejects.toThrow('Invalid key');
    });

    it('should validate value format', async () => {
      await expect(service.setItem('key', null as any)).rejects.toThrow('Invalid value');
      await expect(service.setItem('key', 'a'.repeat(1024 * 1024 + 1))).rejects.toThrow('Invalid value');
    });

    it('should use authentication options', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();

      await service.setItem('test-key', 'test-value', { requireAuthentication: true });

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'test-key',
        expect.any(String),
        { requireAuthentication: true }
      );
    });
  });

  describe('getItem', () => {
    beforeEach(async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('master-key');
      await service.initialize();
    });

    it('should retrieve and decrypt item successfully', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('salt:iv:encrypted-data');

      const result = await service.getItem('test-key');

      expect(result).toBe('decrypted-data');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('test-key', { requireAuthentication: false });
    });

    it('should return null for non-existent item', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await service.getItem('non-existent-key');

      expect(result).toBeNull();
    });

    it('should validate key format', async () => {
      await expect(service.getItem('')).rejects.toThrow('Invalid key');
    });
  });

  describe('removeItem', () => {
    it('should remove item successfully', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      await service.removeItem('test-key');

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('test-key', { requireAuthentication: false });
    });

    it('should validate key format', async () => {
      await expect(service.removeItem('')).rejects.toThrow('Invalid key');
    });
  });

  describe('hasItem', () => {
    beforeEach(async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('master-key');
      await service.initialize();
    });

    it('should return true for existing item', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('salt:iv:encrypted-data');

      const result = await service.hasItem('test-key');

      expect(result).toBe(true);
    });

    it('should return false for non-existent item', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await service.hasItem('non-existent-key');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await service.hasItem('test-key');

      expect(result).toBe(false);
    });
  });

  describe('auth token management', () => {
    beforeEach(async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('master-key');
      await service.initialize();
    });

    it('should store auth tokens securely', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();

      const tokens = {
        accessToken: 'access-token',
        idToken: 'id-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenTimestamp: Date.now(),
      };

      await service.storeAuthTokens(tokens);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_tokens',
        expect.any(String),
        { requireAuthentication: true }
      );
    });

    it('should retrieve auth tokens', async () => {
      const tokens = {
        accessToken: 'access-token',
        idToken: 'id-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenTimestamp: Date.now(),
      };

      mockSecureStore.getItemAsync.mockResolvedValue('salt:iv:encrypted-data');
      // Mock the decryption to return the JSON string
      const CryptoJS = require('crypto-js');
      CryptoJS.AES.decrypt.mockReturnValue({
        toString: jest.fn(() => JSON.stringify(tokens)),
      });

      const result = await service.getAuthTokens();

      expect(result).toEqual(tokens);
    });

    it('should clear auth tokens', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      await service.clearAuthTokens();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_tokens', { requireAuthentication: true });
    });
  });

  describe('database key management', () => {
    beforeEach(async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('master-key');
      await service.initialize();
    });

    it('should store database key', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();

      await service.storeDatabaseKey('database-key');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'database_key',
        expect.any(String),
        { requireAuthentication: true }
      );
    });

    it('should retrieve database key', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('salt:iv:encrypted-data');

      const result = await service.getDatabaseKey();

      expect(result).toBe('decrypted-data');
    });

    it('should generate database key', () => {
      const key = service.generateDatabaseKey();

      expect(key).toBe('mock-random-string');
    });
  });

  describe('clearAllData', () => {
    it('should clear all stored data', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      await service.clearAllData();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(5);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_tokens', undefined);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('database_key', undefined);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('master_key', undefined);
    });

    it('should continue clearing even if some items fail', async () => {
      mockSecureStore.deleteItemAsync
        .mockResolvedValueOnce() // auth_tokens succeeds
        .mockRejectedValueOnce(new Error('Failed')) // database_key fails
        .mockResolvedValueOnce(); // master_key succeeds

      await service.clearAllData();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(5);
    });
  });
});