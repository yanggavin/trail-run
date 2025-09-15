import { DatabaseService, DatabaseError } from '../DatabaseService';

// Mock react-native-sqlite-storage
jest.mock('react-native-sqlite-storage', () => ({
  DEBUG: jest.fn(),
  enablePromise: jest.fn(),
  openDatabase: jest.fn(),
  default: {
    DEBUG: jest.fn(),
    enablePromise: jest.fn(),
    openDatabase: jest.fn()
  }
}));

describe('DatabaseService', () => {
  let databaseService: DatabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    databaseService = new DatabaseService({
      name: 'test.db',
      version: '1.0',
      displayName: 'Test Database',
      size: 100000
    });
  });

  describe('configuration', () => {
    it('should create service with default config', () => {
      const service = new DatabaseService();
      expect(service).toBeInstanceOf(DatabaseService);
    });

    it('should create service with custom config', () => {
      const service = new DatabaseService({
        name: 'custom.db',
        version: '2.0',
        displayName: 'Custom Database',
        size: 500000
      });
      expect(service).toBeInstanceOf(DatabaseService);
    });

    it('should throw error when accessing database before initialization', () => {
      expect(() => databaseService.getDatabase()).toThrow(DatabaseError);
      expect(() => databaseService.getDatabase()).toThrow('Database not initialized');
    });
  });

  describe('error handling', () => {
    it('should create DatabaseError with message and original error', () => {
      const originalError = new Error('Original error');
      const dbError = new DatabaseError('Database failed', originalError);

      expect(dbError.message).toBe('Database failed');
      expect(dbError.originalError).toBe(originalError);
      expect(dbError.name).toBe('DatabaseError');
    });

    it('should create DatabaseError with just message', () => {
      const dbError = new DatabaseError('Database failed');

      expect(dbError.message).toBe('Database failed');
      expect(dbError.originalError).toBeUndefined();
      expect(dbError.name).toBe('DatabaseError');
    });
  });

  describe('migrations structure', () => {
    it('should have migration with proper structure', () => {
      const service = new DatabaseService();
      // Access private migrations through any cast for testing
      const migrations = (service as any).migrations;

      expect(migrations).toHaveLength(1);
      expect(migrations[0]).toHaveProperty('version', 1);
      expect(migrations[0]).toHaveProperty('up');
      expect(typeof migrations[0].up).toBe('function');
    });
  });
});