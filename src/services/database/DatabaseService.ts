import SQLite, { SQLiteDatabase, SQLTransaction, SQLError, SQLResultSet } from 'react-native-sqlite-storage';
import { ActivityApiFormat, PhotoApiFormat, TrackPointApiFormat } from '../../types';

// Enable debugging in development
SQLite.DEBUG(true);
SQLite.enablePromise(true);

export interface DatabaseConfig {
  name: string;
  version: string;
  displayName: string;
  size: number;
}

export interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
  down?: (db: SQLiteDatabase) => Promise<void>;
}

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class DatabaseService {
  private db: SQLiteDatabase | null = null;
  private config: DatabaseConfig;
  private migrations: Migration[];

  constructor(config?: Partial<DatabaseConfig>) {
    this.config = {
      name: 'TrailRunDB.db',
      version: '1.0',
      displayName: 'TrailRun Database',
      size: 200000,
      ...config
    };

    this.migrations = this.getMigrations();
  }

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase(this.config);
      await this.runMigrations();
      console.log('Database initialized successfully');
    } catch (error) {
      throw new DatabaseError('Failed to initialize database', error as Error);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }

  getDatabase(): SQLiteDatabase {
    if (!this.db) {
      throw new DatabaseError('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  private getMigrations(): Migration[] {
    return [
      {
        version: 1,
        up: async (db: SQLiteDatabase) => {
          // Create activities table
          await db.executeSql(`
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
              sync_status TEXT DEFAULT 'local' CHECK (sync_status IN ('local', 'syncing', 'synced'))
            );
          `);

          // Create track_points table
          await db.executeSql(`
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
          await db.executeSql(`
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
              FOREIGN KEY (activity_id) REFERENCES activities (activity_id) ON DELETE CASCADE
            );
          `);

          // Create indexes for performance
          await db.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities (user_id);
          `);
          
          await db.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_activities_status ON activities (status);
          `);
          
          await db.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities (created_at DESC);
          `);
          
          await db.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_activities_sync_status ON activities (sync_status);
          `);

          await db.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_track_points_activity_id ON track_points (activity_id);
          `);
          
          await db.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_track_points_timestamp ON track_points (timestamp);
          `);
          
          await db.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_track_points_activity_timestamp ON track_points (activity_id, timestamp);
          `);

          await db.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_photos_activity_id ON photos (activity_id);
          `);
          
          await db.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_photos_timestamp ON photos (timestamp);
          `);
          
          await db.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_photos_sync_status ON photos (sync_status);
          `);

          // Create database metadata table for version tracking
          await db.executeSql(`
            CREATE TABLE IF NOT EXISTS db_metadata (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
          `);

          await db.executeSql(`
            INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('schema_version', '1');
          `);

          console.log('Database schema v1 created successfully');
        }
      }
    ];
  }

  private async runMigrations(): Promise<void> {
    const db = this.getDatabase();
    
    try {
      // Get current schema version
      const currentVersion = await this.getCurrentSchemaVersion();
      console.log(`Current database schema version: ${currentVersion}`);

      // Run migrations in order
      for (const migration of this.migrations) {
        if (migration.version > currentVersion) {
          console.log(`Running migration to version ${migration.version}`);
          await migration.up(db);
          await this.updateSchemaVersion(migration.version);
          console.log(`Migration to version ${migration.version} completed`);
        }
      }
    } catch (error) {
      throw new DatabaseError('Failed to run database migrations', error as Error);
    }
  }

  private async getCurrentSchemaVersion(): Promise<number> {
    const db = this.getDatabase();
    
    try {
      const result = await db.executeSql(`
        SELECT value FROM db_metadata WHERE key = 'schema_version';
      `);
      
      if (result[0].rows.length > 0) {
        return parseInt(result[0].rows.item(0).value, 10);
      }
      
      return 0; // No version found, assume fresh database
    } catch (error) {
      // Table might not exist yet
      return 0;
    }
  }

  private async updateSchemaVersion(version: number): Promise<void> {
    const db = this.getDatabase();
    
    await db.executeSql(`
      INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('schema_version', ?);
    `, [version.toString()]);
  }

  // Transaction support
  async transaction<T>(callback: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
    const db = this.getDatabase();
    
    return new Promise((resolve, reject) => {
      db.transaction(
        async (tx: SQLTransaction) => {
          try {
            const result = await callback(tx as any); // Cast to SQLiteDatabase for compatibility
            resolve(result);
          } catch (error) {
            reject(new DatabaseError('Transaction failed', error as Error));
          }
        },
        (error: SQLError) => {
          const err = new Error(error.message);
          reject(new DatabaseError('Transaction error', err));
        }
      );
    });
  }

  // Utility methods for common operations
  async executeSql(sql: string, params: any[] = []): Promise<SQLResultSet[]> {
    const db = this.getDatabase();
    
    try {
      return await db.executeSql(sql, params);
    } catch (error) {
      throw new DatabaseError(`SQL execution failed: ${sql}`, error as Error);
    }
  }

  async executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const results = await this.executeSql(sql, params);
    const rows: T[] = [];
    
    if (results[0] && results[0].rows) {
      for (let i = 0; i < results[0].rows.length; i++) {
        rows.push(results[0].rows.item(i));
      }
    }
    
    return rows;
  }

  async executeInsert(sql: string, params: any[] = []): Promise<number> {
    const results = await this.executeSql(sql, params);
    return results[0].insertId || 0;
  }

  async executeUpdate(sql: string, params: any[] = []): Promise<number> {
    const results = await this.executeSql(sql, params);
    return results[0].rowsAffected || 0;
  }

  // Health check methods
  async isHealthy(): Promise<boolean> {
    try {
      await this.executeSql('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  async getTableInfo(tableName: string): Promise<any[]> {
    return this.executeQuery(`PRAGMA table_info(${tableName})`);
  }

  async getIndexes(tableName: string): Promise<any[]> {
    return this.executeQuery(`PRAGMA index_list(${tableName})`);
  }

  // Cleanup and maintenance
  async vacuum(): Promise<void> {
    await this.executeSql('VACUUM');
    console.log('Database vacuum completed');
  }

  async analyze(): Promise<void> {
    await this.executeSql('ANALYZE');
    console.log('Database analyze completed');
  }

  async getDatabaseSize(): Promise<number> {
    const result = await this.executeQuery('PRAGMA page_count');
    const pageCount = result[0]?.page_count || 0;
    
    const pageSizeResult = await this.executeQuery('PRAGMA page_size');
    const pageSize = pageSizeResult[0]?.page_size || 0;
    
    return pageCount * pageSize;
  }

  // Development and testing utilities
  async dropAllTables(): Promise<void> {
    const tables = await this.executeQuery(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';
    `);
    
    for (const table of tables) {
      await this.executeSql(`DROP TABLE IF EXISTS ${table.name}`);
    }
    
    console.log('All tables dropped');
  }

  async resetDatabase(): Promise<void> {
    await this.dropAllTables();
    await this.runMigrations();
    console.log('Database reset completed');
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null;

export const getDatabaseService = (config?: Partial<DatabaseConfig>): DatabaseService => {
  if (!databaseService) {
    databaseService = new DatabaseService(config);
  }
  return databaseService;
};

export const initializeDatabase = async (config?: Partial<DatabaseConfig>): Promise<DatabaseService> => {
  const service = getDatabaseService(config);
  await service.initialize();
  return service;
};