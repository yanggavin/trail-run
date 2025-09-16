import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

export interface SecureStorageOptions {
  requireAuthentication?: boolean;
  accessGroup?: string;
}

export interface EncryptionConfig {
  algorithm: string;
  keySize: number;
  iterations: number;
}

export class SecureStorageError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'SecureStorageError';
  }
}

export class SecureStorageService {
  private static instance: SecureStorageService | null = null;
  private encryptionConfig: EncryptionConfig;
  private masterKey: string | null = null;

  private constructor() {
    this.encryptionConfig = {
      algorithm: 'AES',
      keySize: 256 / 32, // 256 bits / 32 bits per word
      iterations: 10000,
    };
  }

  static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Generate or retrieve master key for additional encryption layer
      this.masterKey = await this.getOrCreateMasterKey();
    } catch (error) {
      throw new SecureStorageError('Failed to initialize secure storage', error as Error);
    }
  }

  /**
   * Store sensitive data with encryption and secure storage
   */
  async setItem(key: string, value: string, options?: SecureStorageOptions): Promise<void> {
    try {
      // Validate input
      this.validateKey(key);
      this.validateValue(value);

      // Encrypt the value with master key
      const encryptedValue = this.encrypt(value);

      // Store in secure store with platform-specific security
      const secureStoreOptions: SecureStore.SecureStoreOptions = {
        requireAuthentication: options?.requireAuthentication || false,
        ...(options?.accessGroup && { accessGroup: options.accessGroup }),
      };

      await SecureStore.setItemAsync(key, encryptedValue, secureStoreOptions);
    } catch (error) {
      throw new SecureStorageError(`Failed to store item with key: ${key}`, error as Error);
    }
  }

  /**
   * Retrieve and decrypt sensitive data
   */
  async getItem(key: string, options?: SecureStorageOptions): Promise<string | null> {
    try {
      this.validateKey(key);

      const secureStoreOptions: SecureStore.SecureStoreOptions = {
        requireAuthentication: options?.requireAuthentication || false,
        ...(options?.accessGroup && { accessGroup: options.accessGroup }),
      };

      const encryptedValue = await SecureStore.getItemAsync(key, secureStoreOptions);
      
      if (!encryptedValue) {
        return null;
      }

      // Decrypt the value
      return this.decrypt(encryptedValue);
    } catch (error) {
      throw new SecureStorageError(`Failed to retrieve item with key: ${key}`, error as Error);
    }
  }

  /**
   * Remove item from secure storage
   */
  async removeItem(key: string, options?: SecureStorageOptions): Promise<void> {
    try {
      this.validateKey(key);

      const secureStoreOptions: SecureStore.SecureStoreOptions = {
        requireAuthentication: options?.requireAuthentication || false,
        ...(options?.accessGroup && { accessGroup: options.accessGroup }),
      };

      await SecureStore.deleteItemAsync(key, secureStoreOptions);
    } catch (error) {
      throw new SecureStorageError(`Failed to remove item with key: ${key}`, error as Error);
    }
  }

  /**
   * Check if item exists in secure storage
   */
  async hasItem(key: string, options?: SecureStorageOptions): Promise<boolean> {
    try {
      const value = await this.getItem(key, options);
      return value !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Store authentication tokens securely
   */
  async storeAuthTokens(tokens: any): Promise<void> {
    const sanitizedTokens = this.sanitizeAuthTokens(tokens);
    await this.setItem('auth_tokens', JSON.stringify(sanitizedTokens), {
      requireAuthentication: true,
    });
  }

  /**
   * Retrieve authentication tokens
   */
  async getAuthTokens(): Promise<any | null> {
    const tokensJson = await this.getItem('auth_tokens', {
      requireAuthentication: true,
    });
    
    if (!tokensJson) {
      return null;
    }

    try {
      return JSON.parse(tokensJson);
    } catch (error) {
      throw new SecureStorageError('Failed to parse stored auth tokens', error as Error);
    }
  }

  /**
   * Clear all authentication tokens
   */
  async clearAuthTokens(): Promise<void> {
    await this.removeItem('auth_tokens', {
      requireAuthentication: true,
    });
  }

  /**
   * Store database encryption key
   */
  async storeDatabaseKey(key: string): Promise<void> {
    await this.setItem('database_key', key, {
      requireAuthentication: true,
    });
  }

  /**
   * Retrieve database encryption key
   */
  async getDatabaseKey(): Promise<string | null> {
    return this.getItem('database_key', {
      requireAuthentication: true,
    });
  }

  /**
   * Generate a new database encryption key
   */
  generateDatabaseKey(): string {
    return CryptoJS.lib.WordArray.random(256 / 8).toString();
  }

  /**
   * Clear all stored data (for account deletion)
   */
  async clearAllData(): Promise<void> {
    const keysToRemove = [
      'auth_tokens',
      'database_key',
      'master_key',
      'user_preferences',
      'biometric_settings',
    ];

    for (const key of keysToRemove) {
      try {
        await this.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove key ${key}:`, error);
      }
    }
  }

  private async getOrCreateMasterKey(): Promise<string> {
    let masterKey = await SecureStore.getItemAsync('master_key');
    
    if (!masterKey) {
      // Generate new master key
      masterKey = CryptoJS.lib.WordArray.random(256 / 8).toString();
      await SecureStore.setItemAsync('master_key', masterKey, {
        requireAuthentication: false, // Master key should be accessible for app functionality
      });
    }

    return masterKey;
  }

  private encrypt(text: string): string {
    if (!this.masterKey) {
      throw new SecureStorageError('Master key not initialized');
    }

    try {
      // Generate random salt
      const salt = CryptoJS.lib.WordArray.random(128 / 8);
      
      // Derive key from master key and salt
      const key = CryptoJS.PBKDF2(this.masterKey, salt, {
        keySize: this.encryptionConfig.keySize,
        iterations: this.encryptionConfig.iterations,
      });

      // Generate random IV
      const iv = CryptoJS.lib.WordArray.random(128 / 8);

      // Encrypt the text
      const encrypted = CryptoJS.AES.encrypt(text, key, {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC,
      });

      // Combine salt, iv, and encrypted data
      const combined = salt.toString() + ':' + iv.toString() + ':' + encrypted.toString();
      return combined;
    } catch (error) {
      throw new SecureStorageError('Failed to encrypt data', error as Error);
    }
  }

  private decrypt(encryptedText: string): string {
    if (!this.masterKey) {
      throw new SecureStorageError('Master key not initialized');
    }

    try {
      // Split the combined string
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const salt = CryptoJS.enc.Hex.parse(parts[0]);
      const iv = CryptoJS.enc.Hex.parse(parts[1]);
      const encrypted = parts[2];

      // Derive key from master key and salt
      const key = CryptoJS.PBKDF2(this.masterKey, salt, {
        keySize: this.encryptionConfig.keySize,
        iterations: this.encryptionConfig.iterations,
      });

      // Decrypt the data
      const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC,
      });

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      throw new SecureStorageError('Failed to decrypt data', error as Error);
    }
  }

  private validateKey(key: string): void {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new SecureStorageError('Invalid key: must be a non-empty string');
    }

    if (key.length > 255) {
      throw new SecureStorageError('Invalid key: must be 255 characters or less');
    }

    // Check for potentially dangerous characters
    if (!/^[a-zA-Z0-9_.-]+$/.test(key)) {
      throw new SecureStorageError('Invalid key: contains invalid characters');
    }
  }

  private validateValue(value: string): void {
    if (typeof value !== 'string') {
      throw new SecureStorageError('Invalid value: must be a string');
    }

    // Check for reasonable size limits (1MB)
    if (value.length > 1024 * 1024) {
      throw new SecureStorageError('Invalid value: exceeds maximum size limit');
    }
  }

  private sanitizeAuthTokens(tokens: any): any {
    // Remove any potentially sensitive metadata and validate token structure
    const sanitized: any = {};

    if (tokens.accessToken && typeof tokens.accessToken === 'string') {
      sanitized.accessToken = tokens.accessToken;
    }

    if (tokens.idToken && typeof tokens.idToken === 'string') {
      sanitized.idToken = tokens.idToken;
    }

    if (tokens.refreshToken && typeof tokens.refreshToken === 'string') {
      sanitized.refreshToken = tokens.refreshToken;
    }

    if (tokens.expiresIn && typeof tokens.expiresIn === 'number') {
      sanitized.expiresIn = tokens.expiresIn;
    }

    if (tokens.tokenTimestamp && typeof tokens.tokenTimestamp === 'number') {
      sanitized.tokenTimestamp = tokens.tokenTimestamp;
    }

    return sanitized;
  }
}

// Singleton instance
export const secureStorageService = SecureStorageService.getInstance();