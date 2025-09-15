declare module 'react-native-sqlite-storage' {
  export interface SQLResultSetRowList {
    length: number;
    item(index: number): any;
  }

  export interface SQLResultSet {
    insertId?: number;
    rowsAffected: number;
    rows: SQLResultSetRowList;
  }

  export interface SQLError {
    code: number;
    message: string;
  }

  export interface SQLTransaction {
    executeSql(
      statement: string,
      params?: any[],
      success?: (tx: SQLTransaction, result: SQLResultSet) => void,
      error?: (tx: SQLTransaction, error: SQLError) => void
    ): void;
  }

  export interface SQLiteDatabase {
    executeSql(
      statement: string,
      params?: any[]
    ): Promise<SQLResultSet[]>;
    
    transaction(
      callback: (tx: SQLTransaction) => void,
      error?: (error: SQLError) => void,
      success?: () => void
    ): void;
    
    close(): Promise<void>;
  }

  export interface DatabaseConfig {
    name: string;
    version?: string;
    displayName?: string;
    size?: number;
  }

  export function openDatabase(config: DatabaseConfig): Promise<SQLiteDatabase>;
  export function DEBUG(debug: boolean): void;
  export function enablePromise(enable: boolean): void;

  const SQLite: {
    openDatabase: typeof openDatabase;
    DEBUG: typeof DEBUG;
    enablePromise: typeof enablePromise;
  };

  export default SQLite;
}