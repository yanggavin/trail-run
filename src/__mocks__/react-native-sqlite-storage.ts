// Mock implementation for react-native-sqlite-storage

export interface MockSQLResultSet {
  insertId?: number;
  rowsAffected: number;
  rows: {
    length: number;
    item: (index: number) => any;
    raw: () => any[];
  };
}

export interface MockSQLTransaction {
  executeSql: (
    sql: string,
    params?: any[],
    successCallback?: (tx: MockSQLTransaction, result: MockSQLResultSet) => void,
    errorCallback?: (tx: MockSQLTransaction, error: any) => void
  ) => void;
}

export interface MockSQLDatabase {
  transaction: (
    callback: (tx: MockSQLTransaction) => void,
    errorCallback?: (error: any) => void,
    successCallback?: () => void
  ) => void;
  readTransaction: (
    callback: (tx: MockSQLTransaction) => void,
    errorCallback?: (error: any) => void,
    successCallback?: () => void
  ) => void;
  executeSql: (
    sql: string,
    params?: any[],
    successCallback?: (result: MockSQLResultSet) => void,
    errorCallback?: (error: any) => void
  ) => void;
  close: (
    successCallback?: () => void,
    errorCallback?: (error: any) => void
  ) => void;
}

class MockSQLiteStorage {
  private databases: Map<string, MockDatabase> = new Map();
  private shouldFailOperations = false;
  private operationDelay = 0;

  // Mock database implementation
  openDatabase(
    name: string,
    version: string,
    displayName: string,
    size: number,
    successCallback?: (db: MockSQLDatabase) => void,
    errorCallback?: (error: any) => void
  ): MockSQLDatabase {
    if (this.shouldFailOperations) {
      setTimeout(() => {
        errorCallback?.(new Error('Mock database open failure'));
      }, this.operationDelay);
      return this.createMockDatabase();
    }

    const mockDb = new MockDatabase(name);
    this.databases.set(name, mockDb);

    setTimeout(() => {
      successCallback?.(mockDb);
    }, this.operationDelay);

    return mockDb;
  }

  // Test utilities
  setFailOperations(shouldFail: boolean): void {
    this.shouldFailOperations = shouldFail;
  }

  setOperationDelay(delay: number): void {
    this.operationDelay = delay;
  }

  getDatabase(name: string): MockDatabase | undefined {
    return this.databases.get(name);
  }

  clearAllDatabases(): void {
    this.databases.clear();
  }

  private createMockDatabase(): MockSQLDatabase {
    return new MockDatabase('failed-db');
  }
}

class MockDatabase implements MockSQLDatabase {
  private tables: Map<string, any[]> = new Map();
  private isOpen = true;
  private shouldFailOperations = false;

  constructor(private name: string) {}

  transaction(
    callback: (tx: MockSQLTransaction) => void,
    errorCallback?: (error: any) => void,
    successCallback?: () => void
  ): void {
    if (!this.isOpen) {
      errorCallback?.(new Error('Database is closed'));
      return;
    }

    if (this.shouldFailOperations) {
      errorCallback?.(new Error('Mock transaction failure'));
      return;
    }

    try {
      const tx = new MockTransaction(this);
      callback(tx);
      successCallback?.();
    } catch (error) {
      errorCallback?.(error);
    }
  }

  readTransaction(
    callback: (tx: MockSQLTransaction) => void,
    errorCallback?: (error: any) => void,
    successCallback?: () => void
  ): void {
    // For mock purposes, read transaction behaves the same as regular transaction
    this.transaction(callback, errorCallback, successCallback);
  }

  executeSql(
    sql: string,
    params: any[] = [],
    successCallback?: (result: MockSQLResultSet) => void,
    errorCallback?: (error: any) => void
  ): void {
    if (!this.isOpen) {
      errorCallback?.(new Error('Database is closed'));
      return;
    }

    if (this.shouldFailOperations) {
      errorCallback?.(new Error('Mock SQL execution failure'));
      return;
    }

    try {
      const result = this.executeSQL(sql, params);
      successCallback?.(result);
    } catch (error) {
      errorCallback?.(error);
    }
  }

  close(
    successCallback?: () => void,
    errorCallback?: (error: any) => void
  ): void {
    if (!this.isOpen) {
      errorCallback?.(new Error('Database is already closed'));
      return;
    }

    this.isOpen = false;
    successCallback?.();
  }

  // Test utilities
  setFailOperations(shouldFail: boolean): void {
    this.shouldFailOperations = shouldFail;
  }

  getTableData(tableName: string): any[] {
    return this.tables.get(tableName) || [];
  }

  setTableData(tableName: string, data: any[]): void {
    this.tables.set(tableName, data);
  }

  clearAllTables(): void {
    this.tables.clear();
  }

  private executeSQL(sql: string, params: any[] = []): MockSQLResultSet {
    const normalizedSQL = sql.trim().toLowerCase();

    if (normalizedSQL.startsWith('create table')) {
      return this.handleCreateTable(sql);
    } else if (normalizedSQL.startsWith('insert')) {
      return this.handleInsert(sql, params);
    } else if (normalizedSQL.startsWith('select')) {
      return this.handleSelect(sql, params);
    } else if (normalizedSQL.startsWith('update')) {
      return this.handleUpdate(sql, params);
    } else if (normalizedSQL.startsWith('delete')) {
      return this.handleDelete(sql, params);
    } else if (normalizedSQL.startsWith('drop table')) {
      return this.handleDropTable(sql);
    } else {
      // For other SQL commands (PRAGMA, etc.), return empty result
      return {
        rowsAffected: 0,
        rows: {
          length: 0,
          item: () => ({}),
          raw: () => [],
        },
      };
    }
  }

  private handleCreateTable(sql: string): MockSQLResultSet {
    // Extract table name from CREATE TABLE statement
    const match = sql.match(/create table (?:if not exists )?(\w+)/i);
    if (match) {
      const tableName = match[1];
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
    }

    return {
      rowsAffected: 0,
      rows: {
        length: 0,
        item: () => ({}),
        raw: () => [],
      },
    };
  }

  private handleInsert(sql: string, params: any[]): MockSQLResultSet {
    // Simple mock insert - just add to array
    const match = sql.match(/insert into (\w+)/i);
    if (match) {
      const tableName = match[1];
      const tableData = this.tables.get(tableName) || [];
      
      // Create a mock row with parameters
      const newRow: any = {};
      params.forEach((param, index) => {
        newRow[`col_${index}`] = param;
      });
      newRow.id = tableData.length + 1; // Mock auto-increment ID
      
      tableData.push(newRow);
      this.tables.set(tableName, tableData);

      return {
        insertId: newRow.id,
        rowsAffected: 1,
        rows: {
          length: 0,
          item: () => ({}),
          raw: () => [],
        },
      };
    }

    return {
      rowsAffected: 0,
      rows: {
        length: 0,
        item: () => ({}),
        raw: () => [],
      },
    };
  }

  private handleSelect(sql: string, params: any[]): MockSQLResultSet {
    // Simple mock select - return all data from table
    const match = sql.match(/from (\w+)/i);
    if (match) {
      const tableName = match[1];
      const tableData = this.tables.get(tableName) || [];

      return {
        rowsAffected: 0,
        rows: {
          length: tableData.length,
          item: (index: number) => tableData[index] || {},
          raw: () => tableData,
        },
      };
    }

    return {
      rowsAffected: 0,
      rows: {
        length: 0,
        item: () => ({}),
        raw: () => [],
      },
    };
  }

  private handleUpdate(sql: string, params: any[]): MockSQLResultSet {
    // Simple mock update - update all rows in table
    const match = sql.match(/update (\w+)/i);
    if (match) {
      const tableName = match[1];
      const tableData = this.tables.get(tableName) || [];
      
      // Mock update - just return affected rows count
      return {
        rowsAffected: tableData.length,
        rows: {
          length: 0,
          item: () => ({}),
          raw: () => [],
        },
      };
    }

    return {
      rowsAffected: 0,
      rows: {
        length: 0,
        item: () => ({}),
        raw: () => [],
      },
    };
  }

  private handleDelete(sql: string, params: any[]): MockSQLResultSet {
    // Simple mock delete - clear table
    const match = sql.match(/delete from (\w+)/i);
    if (match) {
      const tableName = match[1];
      const tableData = this.tables.get(tableName) || [];
      const rowCount = tableData.length;
      
      this.tables.set(tableName, []);
      
      return {
        rowsAffected: rowCount,
        rows: {
          length: 0,
          item: () => ({}),
          raw: () => [],
        },
      };
    }

    return {
      rowsAffected: 0,
      rows: {
        length: 0,
        item: () => ({}),
        raw: () => [],
      },
    };
  }

  private handleDropTable(sql: string): MockSQLResultSet {
    const match = sql.match(/drop table (?:if exists )?(\w+)/i);
    if (match) {
      const tableName = match[1];
      this.tables.delete(tableName);
    }

    return {
      rowsAffected: 0,
      rows: {
        length: 0,
        item: () => ({}),
        raw: () => [],
      },
    };
  }
}

class MockTransaction implements MockSQLTransaction {
  constructor(private database: MockDatabase) {}

  executeSql(
    sql: string,
    params: any[] = [],
    successCallback?: (tx: MockSQLTransaction, result: MockSQLResultSet) => void,
    errorCallback?: (tx: MockSQLTransaction, error: any) => void
  ): void {
    this.database.executeSql(
      sql,
      params,
      (result) => successCallback?.(this, result),
      (error) => errorCallback?.(this, error)
    );
  }
}

// Export singleton instance
const mockSQLiteStorage = new MockSQLiteStorage();

export default {
  openDatabase: mockSQLiteStorage.openDatabase.bind(mockSQLiteStorage),
  // Test utilities
  __setFailOperations: mockSQLiteStorage.setFailOperations.bind(mockSQLiteStorage),
  __setOperationDelay: mockSQLiteStorage.setOperationDelay.bind(mockSQLiteStorage),
  __getDatabase: mockSQLiteStorage.getDatabase.bind(mockSQLiteStorage),
  __clearAllDatabases: mockSQLiteStorage.clearAllDatabases.bind(mockSQLiteStorage),
};

// Export types
export type {
  MockSQLResultSet as SQLResultSet,
  MockSQLTransaction as SQLTransaction,
  MockSQLDatabase as SQLDatabase,
};