import { ActivityRepository } from '../ActivityRepository';
import { DatabaseService } from '../../database/DatabaseService';
import { createActivity, generateActivityId } from '../../../types';

// Mock DatabaseService
const mockExecuteSql = jest.fn();
const mockExecuteQuery = jest.fn();
const mockExecuteUpdate = jest.fn();
const mockTransaction = jest.fn();

const mockDb = {
  executeSql: mockExecuteSql,
  executeQuery: mockExecuteQuery,
  executeUpdate: mockExecuteUpdate,
  transaction: mockTransaction
} as unknown as DatabaseService;

describe('ActivityRepository', () => {
  let repository: ActivityRepository;
  let testActivity: any;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ActivityRepository(mockDb);
    
    testActivity = createActivity({
      activityId: generateActivityId(),
      userId: 'test-user-1'
    });
  });

  describe('create', () => {
    it('should create a new activity', async () => {
      mockExecuteSql.mockResolvedValue([{ insertId: 1, rowsAffected: 1 }]);

      const result = await repository.create(testActivity);

      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO activities'),
        expect.arrayContaining([
          testActivity.activityId,
          testActivity.userId,
          expect.any(Number), // timestamp
          null, // ended_at
          'active',
          0, // duration_sec
          0, // distance_m
          0, // avg_pace_sec_per_km
          0, // elev_gain_m
          0, // elev_loss_m
          undefined, // polyline
          undefined, // bounds
          '[]', // splits (JSON)
          undefined, // cover_photo_id
          expect.any(String), // device_meta (JSON)
          expect.any(Number), // created_at
          expect.any(Number), // updated_at
          'local' // sync_status
        ])
      );
      expect(result).toBe(testActivity);
    });

    it('should throw validation error for invalid activity', async () => {
      const invalidActivity = { ...testActivity, activityId: '' };

      await expect(repository.create(invalidActivity)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find activity by ID', async () => {
      const mockRow = {
        activity_id: testActivity.activityId,
        user_id: testActivity.userId,
        started_at: testActivity.startedAt.getTime(),
        ended_at: null,
        status: 'active',
        duration_sec: 0,
        distance_m: 0,
        avg_pace_sec_per_km: 0,
        elev_gain_m: 0,
        elev_loss_m: 0,
        polyline: null,
        bounds: null,
        splits: '[]',
        cover_photo_id: null,
        device_meta: JSON.stringify(testActivity.deviceMeta),
        created_at: testActivity.createdAt.getTime(),
        updated_at: testActivity.updatedAt.getTime(),
        sync_status: 'local'
      };

      mockExecuteQuery.mockResolvedValue([mockRow]);

      const result = await repository.findById(testActivity.activityId);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM activities WHERE activity_id = ?'),
        [testActivity.activityId]
      );
      expect(result).toBeTruthy();
      expect(result?.activityId).toBe(testActivity.activityId);
    });

    it('should return null if activity not found', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find activities by user ID', async () => {
      const mockRows = [
        {
          activity_id: 'activity-1',
          user_id: 'test-user-1',
          started_at: Date.now(),
          ended_at: null,
          status: 'active',
          duration_sec: 0,
          distance_m: 0,
          avg_pace_sec_per_km: 0,
          elev_gain_m: 0,
          elev_loss_m: 0,
          polyline: null,
          bounds: null,
          splits: '[]',
          cover_photo_id: null,
          device_meta: '{"platform":"ios","version":"1.0.0","model":"iPhone"}',
          created_at: Date.now(),
          updated_at: Date.now(),
          sync_status: 'local'
        }
      ];

      mockExecuteQuery.mockResolvedValue(mockRows);

      const result = await repository.findByUserId('test-user-1');

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM activities WHERE user_id = ?'),
        ['test-user-1']
      );
      expect(result).toHaveLength(1);
      expect(result[0].activityId).toBe('activity-1');
    });

    it('should apply filters correctly', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findByUserId('test-user-1', {
        status: 'completed',
        limit: 10,
        offset: 5
      });

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND status = ?'),
        expect.arrayContaining(['test-user-1', 'completed', 10, 5])
      );
    });
  });

  describe('update', () => {
    it('should update existing activity', async () => {
      // Mock finding existing activity
      const mockRow = {
        activity_id: testActivity.activityId,
        user_id: testActivity.userId,
        started_at: testActivity.startedAt.getTime(),
        ended_at: null,
        status: 'active',
        duration_sec: 0,
        distance_m: 0,
        avg_pace_sec_per_km: 0,
        elev_gain_m: 0,
        elev_loss_m: 0,
        polyline: null,
        bounds: null,
        splits: '[]',
        cover_photo_id: null,
        device_meta: JSON.stringify(testActivity.deviceMeta),
        created_at: testActivity.createdAt.getTime(),
        updated_at: testActivity.updatedAt.getTime(),
        sync_status: 'local'
      };

      mockExecuteQuery.mockResolvedValue([mockRow]);
      mockExecuteSql.mockResolvedValue([{ rowsAffected: 1 }]);

      const updates = { status: 'completed' as const, distanceM: 5000 };
      const result = await repository.update(testActivity.activityId, updates);

      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE activities SET'),
        expect.arrayContaining([
          testActivity.userId,
          expect.any(Number), // started_at
          null, // ended_at
          'completed', // updated status
          0, // duration_sec
          5000, // updated distance_m
          expect.any(Number), // avg_pace_sec_per_km
          0, // elev_gain_m
          0, // elev_loss_m
          undefined, // polyline
          undefined, // bounds
          '[]', // splits
          undefined, // cover_photo_id
          expect.any(String), // device_meta
          expect.any(Number), // updated_at (should be new)
          'local', // sync_status
          testActivity.activityId
        ])
      );
      expect(result?.status).toBe('completed');
      expect(result?.distanceM).toBe(5000);
    });

    it('should return null if activity not found', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      const result = await repository.update('non-existent', { status: 'completed' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete activity and return true', async () => {
      mockExecuteUpdate.mockResolvedValue(1);

      const result = await repository.delete(testActivity.activityId);

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM activities WHERE activity_id = ?'),
        [testActivity.activityId]
      );
      expect(result).toBe(true);
    });

    it('should return false if activity not found', async () => {
      mockExecuteUpdate.mockResolvedValue(0);

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should count activities with filters', async () => {
      mockExecuteQuery.mockResolvedValue([{ count: 5 }]);

      const result = await repository.count({ userId: 'test-user-1', status: 'completed' });

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM activities'),
        expect.arrayContaining(['test-user-1', 'completed'])
      );
      expect(result).toBe(5);
    });
  });

  describe('getStats', () => {
    it('should calculate user statistics', async () => {
      const mockStats = {
        totalActivities: 10,
        totalDistance: 50000,
        totalDuration: 18000,
        averagePace: 360
      };

      mockExecuteQuery.mockResolvedValue([mockStats]);

      const result = await repository.getStats('test-user-1');

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['test-user-1']
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe('findActiveActivity', () => {
    it('should find active or paused activity', async () => {
      const mockRow = {
        activity_id: 'active-activity',
        user_id: 'test-user-1',
        started_at: Date.now(),
        ended_at: null,
        status: 'active',
        duration_sec: 1800,
        distance_m: 2500,
        avg_pace_sec_per_km: 0,
        elev_gain_m: 0,
        elev_loss_m: 0,
        polyline: null,
        bounds: null,
        splits: '[]',
        cover_photo_id: null,
        device_meta: '{"platform":"ios","version":"1.0.0","model":"iPhone"}',
        created_at: Date.now(),
        updated_at: Date.now(),
        sync_status: 'local'
      };

      mockExecuteQuery.mockResolvedValue([mockRow]);

      const result = await repository.findActiveActivity('test-user-1');

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining("status IN ('active', 'paused')"),
        ['test-user-1']
      );
      expect(result?.activityId).toBe('active-activity');
      expect(result?.status).toBe('active');
    });

    it('should return null if no active activity', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      const result = await repository.findActiveActivity('test-user-1');

      expect(result).toBeNull();
    });
  });

  describe('sync operations', () => {
    it('should find unsynced activities', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findUnsyncedActivities(25);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining("sync_status IN ('local', 'syncing')"),
        [25]
      );
    });

    it('should mark activity as synced', async () => {
      mockExecuteUpdate.mockResolvedValue(1);

      const result = await repository.markAsSynced(testActivity.activityId);

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'synced'"),
        expect.arrayContaining([expect.any(Number), testActivity.activityId])
      );
      expect(result).toBe(true);
    });

    it('should mark activity as syncing', async () => {
      mockExecuteUpdate.mockResolvedValue(1);

      const result = await repository.markAsSyncing(testActivity.activityId);

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'syncing'"),
        expect.arrayContaining([expect.any(Number), testActivity.activityId])
      );
      expect(result).toBe(true);
    });
  });

  describe('bulk operations', () => {
    it('should bulk create activities', async () => {
      const activities = [testActivity];
      
      mockTransaction.mockImplementation(async (callback) => {
        return callback();
      });
      mockExecuteSql.mockResolvedValue([{ insertId: 1, rowsAffected: 1 }]);

      const result = await repository.bulkCreate(activities);

      expect(mockTransaction).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(testActivity);
    });

    it('should bulk update activities', async () => {
      const updates = [
        { activityId: testActivity.activityId, data: { status: 'completed' as const } }
      ];

      mockTransaction.mockImplementation(async (callback) => {
        return callback();
      });
      
      // Mock finding existing activity for update
      const mockRow = {
        activity_id: testActivity.activityId,
        user_id: testActivity.userId,
        started_at: testActivity.startedAt.getTime(),
        ended_at: null,
        status: 'active',
        duration_sec: 0,
        distance_m: 0,
        avg_pace_sec_per_km: 0,
        elev_gain_m: 0,
        elev_loss_m: 0,
        polyline: null,
        bounds: null,
        splits: '[]',
        cover_photo_id: null,
        device_meta: JSON.stringify(testActivity.deviceMeta),
        created_at: testActivity.createdAt.getTime(),
        updated_at: testActivity.updatedAt.getTime(),
        sync_status: 'local'
      };

      mockExecuteQuery.mockResolvedValue([mockRow]);
      mockExecuteSql.mockResolvedValue([{ rowsAffected: 1 }]);

      const result = await repository.bulkUpdate(updates);

      expect(mockTransaction).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });
  });

  describe('deleteByUserId', () => {
    it('should delete all activities for a user', async () => {
      mockExecuteUpdate.mockResolvedValue(3);

      const result = await repository.deleteByUserId('test-user-1');

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM activities WHERE user_id = ?'),
        ['test-user-1']
      );
      expect(result).toBe(3);
    });
  });
});