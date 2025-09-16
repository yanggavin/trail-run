import SQLite from 'react-native-sqlite-2';
import { secureStorageService } from './SecureStorageService';
import { ActivityApiFormat, PhotoApiFormat, TrackPointApiFormat } from '../../types';

export interface EncryptedDatabaseConfig {
  name: string;
  version: string;
  displayName: string;
  size: number;
  encryption: boolean;
}

export interface Migration {
  version: number;
  up: (db: any) => Promise<void>;
  down?: (db: any) => Promise<void>;
}

export class EncryptedDatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'EncryptedDatabaseError';
  }
}

export class EncryptedDatabaseService {
  private db: any = null;
  private config: EncryptedDatabaseConfig;
  private migrations: Migration[];
  private encryptionKey: string | null = null;

  constructor(config?: Partial<EncryptedDatabaseConfig>) {
    this.config = {
      name: 'TrailRunEncrypted.db',
      version: '1.0',
      displayName: 'TrailRun Encrypted Database',
      size: 200000,
      encryption: true,
      ...config
    };

    this.migrations = this.getMigrations();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize secure storage first
      await secureStorageService.initialize();

      // Get or create database encryption key
      this.encryptionKey = await this.getOrCreateEncryptionKey();

      // Open encrypted database
      await this.openDatabase();
      
      // Run migrations
      await this.runMigrations();
      
      console.log('Encrypted database initialized successfully');
    } catch (error) {
      throw new EncryptedDatabaseError('Failed to initialize encrypted database', error as Error);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
        console.log('Encrypted database connection closed');
      } catch (error) {
        console.error('Error closing database:', error);
      }
    }
  }

  getDatabase(): any {
    if (!this.db) {
      throw new EncryptedDatabaseError('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const options = {
        name: this.config.name,
        version: this.config.version,
        displayName: this.config.displayName,
        size: this.config.size,
        encryption: this.config.encryption,
        key: this.encryptionKey, // SQLCipher encryption key
      };

      this.db = SQLite.openDatabase(
        options,
        () => {
          console.log('Encrypted database opened successfully');
          resolve();
        },
        (error: any) => {
          reject(new EncryptedDatabaseError('Failed to open encrypted database', error));
        }
      );
    });
  }

  private async getOrCreateEncryptionKey(): Promise<string> {
    let key = await secureStorageService.getDatabaseKey();
    
    if (!key) {
      // Generate new encryption key
      key = secureStorageService.generateDatabaseKey();
      await secureStorageService.storeDatabaseKey(key);
      console.log('Generated new database encryption key');
    }

    return key;
  }

  private getMigrations(): Migration[] {
    return [
      {
        version: 1,
        up: async (db: any) => {
          // Enable foreign key constraints
          await this.executeSql('PRAGMA foreign_keys = ON;');

          // Create activities table with encryption
          await this.executeSql(`
            CREATE TABLE IF NOT EXISTS activities (
              activity_id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              started_at INTEGER NOT NULL,
              ended_at INTEGER,
              status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
              duration_sec INTEGER DEFAULT 0,
              distance_m REAL DEFAULT 0,
              avg_pace_sec_per_km REAL,
              elev_gain_m REAL DEFAULT 0,
              elev_loss_m REAL DEFAULT 0,
              polyline TEXT,
              bounds TEXT,
              splits TEXT,
              cover_photo_id TEXT,
              device_meta TEXT,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              sync_status TEXT DEFAULT 'local' CHECK (sync_status IN ('local', 'syncing', 'synced')),
              privacy_level TEXT DEFAULT 'private' CHECK (privacy_level IN ('private', 'shareable', 'public'))
            );
          `);

          // Create track_points table
          await this.executeSql(`
            CREATE TABLE IF NOT EXISTS track_points (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              activity_id TEXT NOT NULL,
              timestamp INTEGER NOT NULL,
              latitude REAL NOT NULL,
              longitude REAL NOT NULL,
              elevation REAL,
              accuracy REAL NOT NULL,
              speed REAL,
              heading REAL,
              source TEXT NOT NULL CHECK (source IN ('gps', 'network', 'passive')),
              FOREIGN KEY (activity_id) REFERENCES activities (activity_id) ON DELETE CASCADE
            );
          `);

          // Create photos table
          await this.executeSql(`
            CREATE TABLE IF NOT EXISTS photos (
              photo_id TEXT PRIMARY KEY,
              activity_id TEXT NOT NULL,
              timestamp INTEGER NOT NULL,
              latitude REAL NOT NULL,
              longitude REAL NOT NULL,
              local_uri TEXT NOT NULL,
              cloud_uri TEXT,
              thumbnail_uri TEXT,
              exif_data TEXT,
              caption TEXT,
              sync_status TEXT DEFAULT 'local' CHECK (sync_status IN ('local', 'uploading', 'synced')),
              has_location_data BOOLEAN DEFAULT 1,
              FOREIGN KEY (activity_id) REFERENCES activities (activity_id) ON DELETE CASCADE
            );
          `);

          // Create user_preferences table for privacy settings
          await this.executeSql(`
            CREATE TABLE IF NOT EXISTS user_preferences (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              encrypted BOOLEAN DEFAULT 0,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );
          `);

          // Create data_deletion_log for GDPR compliance
          await this.executeSql(`
            CREATE TABLE IF NOT EXISTS data_deletion_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              data_type TEXT NOT NULL,
              deletion_timestamp INTEGER NOT NULL,
              deletion_reason TEXT,
              verification_hash TEXT
            );
          `);

          // Create performance indexes
          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities (user_id);
          `);
          
          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_activities_status ON activities (status);
          `);
          
          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities (created_at DESC);
          `);
          
          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_activities_sync_status ON activities (sync_status);
          `);

          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_activities_privacy ON activities (privacy_level);
          `);

          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_track_points_activity_id ON track_points (activity_id);
          `);
          
          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_track_points_timestamp ON track_points (timestamp);
          `);
          
          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_track_points_activity_timestamp ON track_points (activity_id, timestamp);
          `);

          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_photos_activity_id ON photos (activity_id);
          `);
          
          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_photos_timestamp ON photos (timestamp);
          `);
          
          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_photos_sync_status ON photos (sync_status);
          `);

          await this.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences (key);
          `);

          // Create database metadata table for version tracking
          await this.executeSql(`
            CREATE TABLE IF NOT EXISTS db_metadata (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
          `);

          await this.executeSql(`
            INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('schema_version', '1');
          `);

          // Insert default privacy preferences
          const now = Date.now();
          await this.executeSql(`
            INSERT OR IGNORE INTO user_preferences (key, value, encrypted, created_at, updated_at) 
            VALUES 
              ('default_activity_privacy', 'private', 0, ?, ?),
              ('strip_exif_on_share', 'true', 0, ?, ?),
              ('require_auth_for_sensitive_data', 'true', 0, ?, ?);
          `, [now, now, now, now, now, now]);

          console.log('Encrypted database schema v1 created successfully');
        }
      }
    ];
  }

  private async runMigrations(): Promise<void> {
    try {
      // Get current schema version
      const currentVersion = await this.getCurrentSchemaVersion();
      console.log(`Current encrypted database schema version: ${currentVersion}`);

      // Run migrations in order
      for (const migration of this.migrations) {
        if (migration.version > currentVersion) {
          console.log(`Running encrypted database migration to version ${migration.version}`);
          await migration.up(this.db);
          await this.updateSchemaVersion(migration.version);
          console.log(`Migration to version ${migration.version} completed`);
        }
      }
    } catch (error) {
      throw new EncryptedDatabaseError('Failed to run database migrations', error as Error);
    }
  }

  private async getCurrentSchemaVersion(): Promise<number> {
    try {
      const result = await this.executeQuery(`
        SELECT value FROM db_metadata WHERE key = 'schema_version';
      `);
      
      if (result.length > 0) {
        return parseInt(result[0].value, 10);
      }
      
      return 0; // No version found, assume fresh database
    } catch (error) {
      // Table might not exist yet
      return 0;
    }
  }

  private async updateSchemaVersion(version: number): Promise<void> {
    await this.executeSql(`
      INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('schema_version', ?);
    `, [version.toString()]);
  }

  // Transaction support
  async transaction<T>(callback: (db: any) => Promise<T>): Promise<T> {
    const db = this.getDatabase();
    
    return new Promise((resolve, reject) => {
      db.transaction(
        async (tx: any) => {
          try {
            const result = await callback(tx);
            resolve(result);
          } catch (error) {
            reject(new EncryptedDatabaseError('Transaction failed', error as Error));
          }
        },
        (error: any) => {
          reject(new EncryptedDatabaseError('Transaction error', error));
        }
      );
    });
  }

  // Utility methods for common operations
  async executeSql(sql: string, params: any[] = []): Promise<any> {
    const db = this.getDatabase();
    
    return new Promise((resolve, reject) => {
      db.executeSql(
        sql,
        params,
        (tx: any, result: any) => {
          resolve(result);
        },
        (tx: any, error: any) => {
          reject(new EncryptedDatabaseError(`SQL execution failed: ${sql}`, error));
        }
      );
    });
  }

  async executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const result = await this.executeSql(sql, params);
    const rows: T[] = [];
    
    if (result && result.rows) {
      for (let i = 0; i < result.rows.length; i++) {
        rows.push(result.rows.item(i));
      }
    }
    
    return rows;
  }

  async executeInsert(sql: string, params: any[] = []): Promise<number> {
    const result = await this.executeSql(sql, params);
    return result.insertId || 0;
  }

  async executeUpdate(sql: string, params: any[] = []): Promise<number> {
    const result = await this.executeSql(sql, params);
    return result.rowsAffected || 0;
  }

  // Privacy and security methods
  async setUserPreference(key: string, value: string, encrypted: boolean = false): Promise<void> {
    const now = Date.now();
    await this.executeSql(`
      INSERT OR REPLACE INTO user_preferences (key, value, encrypted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?);
    `, [key, value, encrypted ? 1 : 0, now, now]);
  }

  async getUserPreference(key: string): Promise<string | null> {
    const result = await this.executeQuery(`
      SELECT value FROM user_preferences WHERE key = ?;
    `, [key]);
    
    return result.length > 0 ? result[0].value : null;
  }

  async logDataDeletion(userId: string, dataType: string, reason?: string): Promise<void> {
    const now = Date.now();
    const verificationHash = this.generateVerificationHash(userId, dataType, now);
    
    await this.executeSql(`
      INSERT INTO data_deletion_log (user_id, data_type, deletion_timestamp, deletion_reason, verification_hash)
      VALUES (?, ?, ?, ?, ?);
    `, [userId, dataType, now, reason || 'User requested', verificationHash]);
  }

  private generateVerificationHash(userId: string, dataType: string, timestamp: number): string {
    const CryptoJS = require('crypto-js');
    const data = `${userId}:${dataType}:${timestamp}`;
    return CryptoJS.SHA256(data).toString();
  }

  // Health check methods
  async isHealthy(): Promise<boolean> {
    try {
      await this.executeSql('SELECT 1');
      return true;
    } catch (error) {
      console.error('Encrypted database health check failed:', error);
      return false;
    }
  }

  // Cleanup and maintenance
  async vacuum(): Promise<void> {
    await this.executeSql('VACUUM');
    console.log('Encrypted database vacuum completed');
  }

  async analyze(): Promise<void> {
    await this.executeSql('ANALYZE');
    console.log('Encrypted database analyze completed');
  }

  // Complete data deletion for GDPR compliance
  async deleteAllUserData(userId: string): Promise<void> {
    await this.transaction(async (tx) => {
      // Log the deletion
      await this.logDataDeletion(userId, 'complete_account', 'GDPR deletion request');

      // Delete user activities and related data (cascading deletes will handle track_points and photos)
      await this.executeSql('DELETE FROM activities WHERE user_id = ?', [userId]);
      
      // Delete user preferences
      await this.executeSql('DELETE FROM user_preferences WHERE key LIKE ?', [`user_${userId}_%`]);
      
      console.log(`All data for user ${userId} has been deleted`);
    });
  }

  // Secure database reset (for development/testing)
  async resetDatabase(): Promise<void> {
    await this.close();
    
    // Delete the database file (platform-specific implementation needed)
    // This is a placeholder - actual implementation would depend on the platform
    console.warn('Database reset requested - manual file deletion may be required');
    
    // Reinitialize
    await this.initialize();
  }
}

// Singleton instance
let encryptedDatabaseService: EncryptedDatabaseService | null = null;

export const getEncryptedDatabaseService = (config?: Partial<EncryptedDatabaseConfig>): EncryptedDatabaseService => {
  if (!encryptedDatabaseService) {
    encryptedDatabaseService = new EncryptedDatabaseService(config);
  }
  return encryptedDatabaseService;
};

export const initializeEncryptedDatabase = async (config?: Partial<EncryptedDatabaseConfig>): Promise<EncryptedDatabaseService> => {
  const service = getEncryptedDatabaseService(config);
  await service.initialize();
  return service;
};