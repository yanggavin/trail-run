import { EncryptedDatabaseService, EncryptedDatabaseError, getEncryptedDatabaseService, initializeEncryptedDatabase } from '../EncryptedDatabaseService';
import { secureStorageService } from '../SecureStorageService';

// Mock dependencies
jest.mock('react-native-sqlite-2', () => ({
  openDatabase: jest.fn(),
}));

jest.mock('../SecureStorageService', () => ({
  secureStorageService: {
    initialize: jest.fn(),
    getDatabaseKey: jest.fn(),
    generateDatabaseKey: jest.fn(),
    storeDatabaseKey: jest.fn(),
  },
}));

jest.mock('crypto-js', () => ({
  SHA256: jest.fn(() => ({
    toString: jest.fn(() => 'mock-hash'),
  })),
}));

const SQLite = require('react-native-sqlite-2');

describe('EncryptedDatabaseService', () => {
  let service: EncryptedDatabaseService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database instance
    mockDb = {
      close: jest.fn((callback) => callback()),
      executeSql: jest.fn(),
      transaction: jest.fn(),
    };

    // Mock SQLite.openDatabase
    SQLite.openDatabase.mockImplementation((options: any, successCallback: any, errorCallback: any) => {
      setTimeout(() => successCallback(), 0);
      return mockDb;
    });

    // Mock secure storage
    (secureStorageService.initialize as jest.Mock).mockResolvedValue(undefined);
    (secureStorageService.getDatabaseKey as jest.Mock).mockResolvedValue('existing-key');
    (secureStorageService.generateDatabaseKey as jest.Mock).mockReturnValue('new-key');
    (secureStorageService.storeDatabaseKey as jest.Mock).mockResolvedValue(undefined);

    service = new EncryptedDatabaseService();
  });

  describe('initialization', () => {
    it('should initialize successfully with existing encryption key', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        if (sql.includes('SELECT value FROM db_metadata')) {
          success(null, { rows: { length: 1, item: () => ({ value: '1' }) } });
        } else {
          success(null, { insertId: 1, rowsAffected: 1 });
        }
      });

      await service.initialize();

      expect(secureStorageService.initialize).toHaveBeenCalled();
      expect(secureStorageService.getDatabaseKey).toHaveBeenCalled();
      expect(SQLite.openDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TrailRunEncrypted.db',
          encryption: true,
          key: 'existing-key',
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should generate new encryption key when none exists', async () => {
      (secureStorageService.getDatabaseKey as jest.Mock).mockResolvedValue(null);
      
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { insertId: 1, rowsAffected: 1 });
      });

      await service.initialize();

      expect(secureStorageService.generateDatabaseKey).toHaveBeenCalled();
      expect(secureStorageService.storeDatabaseKey).toHaveBeenCalledWith('new-key');
      expect(SQLite.openDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'new-key',
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should run migrations on fresh database', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        if (sql.includes('SELECT value FROM db_metadata')) {
          // Simulate no existing version
          success(null, { rows: { length: 0 } });
        } else {
          success(null, { insertId: 1, rowsAffected: 1 });
        }
      });

      await service.initialize();

      // Should have created tables and indexes
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS activities'),
        expect.any(Array),
        expect.any(Function),
        expect.any(Function)
      );
      
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS track_points'),
        expect.any(Array),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should handle database opening errors', async () => {
      SQLite.openDatabase.mockImplementation((options: any, successCallback: any, errorCallback: any) => {
        setTimeout(() => errorCallback(new Error('Database open failed')), 0);
        return mockDb;
      });

      await expect(service.initialize()).rejects.toThrow(EncryptedDatabaseError);
      await expect(service.initialize()).rejects.toThrow('Failed to initialize encrypted database');
    });

    it('should handle secure storage initialization errors', async () => {
      (secureStorageService.initialize as jest.Mock).mockRejectedValue(new Error('Storage init failed'));

      await expect(service.initialize()).rejects.toThrow(EncryptedDatabaseError);
    });
  });

  describe('database operations', () => {
    beforeEach(async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { insertId: 1, rowsAffected: 1, rows: { length: 0 } });
      });
      
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should execute SQL statements', async () => {
      const mockResult = { insertId: 123, rowsAffected: 1 };
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, mockResult);
      });

      const result = await service.executeSql('INSERT INTO test VALUES (?)', ['value']);

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        'INSERT INTO test VALUES (?)',
        ['value'],
        expect.any(Function),
        expect.any(Function)
      );
      expect(result).toBe(mockResult);
    });

    it('should handle SQL execution errors', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        error(null, new Error('SQL error'));
      });

      await expect(service.executeSql('INVALID SQL')).rejects.toThrow(EncryptedDatabaseError);
      await expect(service.executeSql('INVALID SQL')).rejects.toThrow('SQL execution failed');
    });

    it('should execute queries and return rows', async () => {
      const mockRows = [
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' },
      ];

      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, {
          rows: {
            length: mockRows.length,
            item: (index: number) => mockRows[index],
          },
        });
      });

      const result = await service.executeQuery('SELECT * FROM test');

      expect(result).toEqual(mockRows);
    });

    it('should execute insert and return insert ID', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { insertId: 456 });
      });

      const insertId = await service.executeInsert('INSERT INTO test VALUES (?)', ['value']);

      expect(insertId).toBe(456);
    });

    it('should execute update and return affected rows', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { rowsAffected: 3 });
      });

      const affectedRows = await service.executeUpdate('UPDATE test SET name = ?', ['new_name']);

      expect(affectedRows).toBe(3);
    });

    it('should throw error when database not initialized', () => {
      const uninitializedService = new EncryptedDatabaseService();
      
      expect(() => uninitializedService.getDatabase()).toThrow(EncryptedDatabaseError);
      expect(() => uninitializedService.getDatabase()).toThrow('Database not initialized');
    });
  });

  describe('transactions', () => {
    beforeEach(async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { insertId: 1, rowsAffected: 1, rows: { length: 0 } });
      });
      
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should execute transactions successfully', async () => {
      const mockTx = { executeSql: jest.fn() };
      mockDb.transaction.mockImplementation((callback: any, errorCallback: any) => {
        callback(mockTx);
      });

      const result = await service.transaction(async (tx) => {
        return 'transaction result';
      });

      expect(result).toBe('transaction result');
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should handle transaction errors', async () => {
      mockDb.transaction.mockImplementation((callback: any, errorCallback: any) => {
        errorCallback(new Error('Transaction failed'));
      });

      await expect(service.transaction(async (tx) => {
        return 'result';
      })).rejects.toThrow(EncryptedDatabaseError);
    });

    it('should handle callback errors in transactions', async () => {
      const mockTx = { executeSql: jest.fn() };
      mockDb.transaction.mockImplementation((callback: any, errorCallback: any) => {
        callback(mockTx);
      });

      await expect(service.transaction(async (tx) => {
        throw new Error('Callback error');
      })).rejects.toThrow(EncryptedDatabaseError);
    });
  });

  describe('user preferences', () => {
    beforeEach(async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { insertId: 1, rowsAffected: 1, rows: { length: 0 } });
      });
      
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should set user preferences', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { rowsAffected: 1 });
      });

      await service.setUserPreference('theme', 'dark', false);

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO user_preferences'),
        ['theme', 'dark', 0, expect.any(Number), expect.any(Number)],
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should get user preferences', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, {
          rows: {
            length: 1,
            item: () => ({ value: 'dark' }),
          },
        });
      });

      const value = await service.getUserPreference('theme');

      expect(value).toBe('dark');
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('SELECT value FROM user_preferences WHERE key = ?'),
        ['theme'],
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should return null for non-existent preferences', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { rows: { length: 0 } });
      });

      const value = await service.getUserPreference('non_existent');

      expect(value).toBeNull();
    });
  });

  describe('data deletion and GDPR compliance', () => {
    beforeEach(async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { insertId: 1, rowsAffected: 1, rows: { length: 0 } });
      });
      
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should log data deletion', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { insertId: 1 });
      });

      await service.logDataDeletion('user123', 'activities', 'User request');

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_deletion_log'),
        ['user123', 'activities', expect.any(Number), 'User request', 'mock-hash'],
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should delete all user data', async () => {
      const mockTx = { executeSql: jest.fn() };
      mockDb.transaction.mockImplementation((callback: any, errorCallback: any) => {
        callback(mockTx);
      });

      // Mock the service methods used in the transaction
      jest.spyOn(service, 'logDataDeletion').mockResolvedValue();
      jest.spyOn(service, 'executeSql').mockResolvedValue({ rowsAffected: 1 });

      await service.deleteAllUserData('user123');

      expect(service.logDataDeletion).toHaveBeenCalledWith('user123', 'complete_account', 'GDPR deletion request');
    });
  });

  describe('health and maintenance', () => {
    beforeEach(async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { insertId: 1, rowsAffected: 1, rows: { length: 0 } });
      });
      
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should check database health', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, {});
      });

      const isHealthy = await service.isHealthy();

      expect(isHealthy).toBe(true);
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        'SELECT 1',
        [],
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should return false for unhealthy database', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        error(null, new Error('Database error'));
      });

      const isHealthy = await service.isHealthy();

      expect(isHealthy).toBe(false);
    });

    it('should vacuum database', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, {});
      });

      await service.vacuum();

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        'VACUUM',
        [],
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should analyze database', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, {});
      });

      await service.analyze();

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        'ANALYZE',
        [],
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('database lifecycle', () => {
    beforeEach(async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { insertId: 1, rowsAffected: 1, rows: { length: 0 } });
      });
      
      await service.initialize();
    });

    it('should close database connection', async () => {
      await service.close();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      mockDb.close.mockImplementation((callback) => {
        throw new Error('Close error');
      });

      await expect(service.close()).resolves.not.toThrow();
    });

    it('should reset database', async () => {
      jest.spyOn(service, 'close').mockResolvedValue();
      jest.spyOn(service, 'initialize').mockResolvedValue();

      await service.resetDatabase();

      expect(service.close).toHaveBeenCalled();
      expect(service.initialize).toHaveBeenCalled();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance from getEncryptedDatabaseService', () => {
      const instance1 = getEncryptedDatabaseService();
      const instance2 = getEncryptedDatabaseService();

      expect(instance1).toBe(instance2);
    });

    it('should initialize and return service from initializeEncryptedDatabase', async () => {
      mockDb.executeSql.mockImplementation((sql: string, params: any[], success: any, error: any) => {
        success(null, { insertId: 1, rowsAffected: 1, rows: { length: 0 } });
      });

      const service = await initializeEncryptedDatabase();

      expect(service).toBeInstanceOf(EncryptedDatabaseService);
    });
  });

  describe('custom configuration', () => {
    it('should accept custom configuration', () => {
      const customConfig = {
        name: 'CustomDB.db',
        size: 500000,
        encryption: false,
      };

      const customService = new EncryptedDatabaseService(customConfig);

      expect((customService as any).config.name).toBe('CustomDB.db');
      expect((customService as any).config.size).toBe(500000);
      expect((customService as any).config.encryption).toBe(false);
    });

    it('should merge custom config with defaults', () => {
      const customConfig = {
        name: 'CustomDB.db',
      };

      const customService = new EncryptedDatabaseService(customConfig);

      expect((customService as any).config.name).toBe('CustomDB.db');
      expect((customService as any).config.encryption).toBe(true); // Default value
      expect((customService as any).config.size).toBe(200000); // Default value
    });
  });

  describe('error handling', () => {
    it('should create EncryptedDatabaseError with original error', () => {
      const originalError = new Error('Original error');
      const dbError = new EncryptedDatabaseError('Database error', originalError);

      expect(dbError.message).toBe('Database error');
      expect(dbError.originalError).toBe(originalError);
      expect(dbError.name).toBe('EncryptedDatabaseError');
    });

    it('should create EncryptedDatabaseError without original error', () => {
      const dbError = new EncryptedDatabaseError('Database error');

      expect(dbError.message).toBe('Database error');
      expect(dbError.originalError).toBeUndefined();
      expect(dbError.name).toBe('EncryptedDatabaseError');
    });
  });
});