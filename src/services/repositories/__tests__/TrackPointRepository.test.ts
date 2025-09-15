import { TrackPointRepository } from '../TrackPointRepository';
import { DatabaseService } from '../../database/DatabaseService';
import { createTrackPoint } from '../../../types';

// Mock DatabaseService
const mockExecuteSql = jest.fn();
const mockExecuteQuery = jest.fn();
const mockExecuteUpdate = jest.fn();
const mockExecuteInsert = jest.fn();
const mockTransaction = jest.fn();

const mockDb = {
  executeSql: mockExecuteSql,
  executeQuery: mockExecuteQuery,
  executeUpdate: mockExecuteUpdate,
  executeInsert: mockExecuteInsert,
  transaction: mockTransaction
} as unknown as DatabaseService;

describe('TrackPointRepository', () => {
  let repository: TrackPointRepository;
  let testTrackPoint: any;
  const testActivityId = 'test-activity-1';

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new TrackPointRepository(mockDb);
    
    testTrackPoint = createTrackPoint({
      latitude: 45.5231,
      longitude: -122.6765,
      accuracy: 5,
      source: 'gps',
      speed: 2.5,
      heading: 180,
      altitude: 100
    });
  });

  describe('create', () => {
    it('should create a new track point', async () => {
      mockExecuteInsert.mockResolvedValue(1);

      const result = await repository.create(testTrackPoint, testActivityId);

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO track_points'),
        expect.arrayContaining([
          testActivityId,
          expect.any(Number), // timestamp
          testTrackPoint.latitude,
          testTrackPoint.longitude,
          testTrackPoint.altitude,
          testTrackPoint.accuracy,
          testTrackPoint.speed,
          testTrackPoint.heading,
          testTrackPoint.source
        ])
      );
      expect(result).toBe(testTrackPoint);
    });

    it('should throw validation error for invalid track point', async () => {
      const invalidTrackPoint = { ...testTrackPoint, latitude: 91 }; // Invalid latitude

      await expect(repository.create(invalidTrackPoint, testActivityId)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find track point by ID', async () => {
      const mockRow = {
        id: 1,
        activity_id: testActivityId,
        timestamp: testTrackPoint.timestamp.getTime(),
        latitude: testTrackPoint.latitude,
        longitude: testTrackPoint.longitude,
        elevation: testTrackPoint.altitude,
        accuracy: testTrackPoint.accuracy,
        speed: testTrackPoint.speed,
        heading: testTrackPoint.heading,
        source: testTrackPoint.source
      };

      mockExecuteQuery.mockResolvedValue([mockRow]);

      const result = await repository.findById(1);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM track_points WHERE id = ?'),
        [1]
      );
      expect(result).toBeTruthy();
      expect(result?.latitude).toBe(testTrackPoint.latitude);
    });

    it('should return null if track point not found', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByActivityId', () => {
    it('should find track points by activity ID', async () => {
      const mockRows = [
        {
          id: 1,
          activity_id: testActivityId,
          timestamp: Date.now(),
          latitude: 45.5231,
          longitude: -122.6765,
          elevation: 100,
          accuracy: 5,
          speed: 2.5,
          heading: 180,
          source: 'gps'
        }
      ];

      mockExecuteQuery.mockResolvedValue(mockRows);

      const result = await repository.findByActivityId(testActivityId);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM track_points WHERE activity_id = ?'),
        [testActivityId]
      );
      expect(result).toHaveLength(1);
      expect(result[0].latitude).toBe(45.5231);
    });

    it('should apply filters correctly', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findByActivityId(testActivityId, {
        source: 'gps',
        maxAccuracy: 10,
        limit: 100
      });

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND source = ?'),
        expect.arrayContaining([testActivityId, 'gps', 10, 100])
      );
    });
  });

  describe('update', () => {
    it('should update existing track point', async () => {
      // Mock finding existing track point
      const mockRow = {
        id: 1,
        activity_id: testActivityId,
        timestamp: testTrackPoint.timestamp.getTime(),
        latitude: testTrackPoint.latitude,
        longitude: testTrackPoint.longitude,
        elevation: testTrackPoint.altitude,
        accuracy: testTrackPoint.accuracy,
        speed: testTrackPoint.speed,
        heading: testTrackPoint.heading,
        source: testTrackPoint.source
      };

      mockExecuteQuery
        .mockResolvedValueOnce([mockRow]) // findById call
        .mockResolvedValueOnce([{ activity_id: testActivityId }]); // get activity_id call
      mockExecuteSql.mockResolvedValue([{ rowsAffected: 1 }]);

      const updates = { accuracy: 3, speed: 3.0 };
      const result = await repository.update(1, updates);

      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE track_points SET'),
        expect.arrayContaining([
          expect.any(Number), // timestamp
          testTrackPoint.latitude,
          testTrackPoint.longitude,
          testTrackPoint.altitude,
          3, // updated accuracy
          3.0, // updated speed
          testTrackPoint.heading,
          testTrackPoint.source,
          1 // id
        ])
      );
      expect(result?.accuracy).toBe(3);
      expect(result?.speed).toBe(3.0);
    });

    it('should return null if track point not found', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      const result = await repository.update(999, { accuracy: 3 });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete track point and return true', async () => {
      mockExecuteUpdate.mockResolvedValue(1);

      const result = await repository.delete(1);

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM track_points WHERE id = ?'),
        [1]
      );
      expect(result).toBe(true);
    });

    it('should return false if track point not found', async () => {
      mockExecuteUpdate.mockResolvedValue(0);

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should count track points with filters', async () => {
      mockExecuteQuery.mockResolvedValue([{ count: 150 }]);

      const result = await repository.count({ activityId: testActivityId, source: 'gps' });

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM track_points'),
        expect.arrayContaining([testActivityId, 'gps'])
      );
      expect(result).toBe(150);
    });
  });

  describe('bulk operations', () => {
    it('should bulk create track points', async () => {
      const batch = {
        activityId: testActivityId,
        trackPoints: [testTrackPoint]
      };
      
      mockTransaction.mockImplementation(async (callback) => {
        return callback();
      });
      mockExecuteInsert.mockResolvedValue(1);

      const result = await repository.bulkCreate(batch);

      expect(mockTransaction).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(testTrackPoint);
    });

    it('should bulk create optimized for large batches', async () => {
      const batch = {
        activityId: testActivityId,
        trackPoints: [testTrackPoint, testTrackPoint, testTrackPoint]
      };
      
      mockTransaction.mockImplementation(async (callback) => {
        return callback();
      });
      mockExecuteSql.mockResolvedValue([{ rowsAffected: 3 }]);

      const result = await repository.bulkCreateOptimized(batch);

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO track_points'),
        expect.any(Array)
      );
      expect(result).toBe(3);
    });

    it('should return 0 for empty batch', async () => {
      const batch = {
        activityId: testActivityId,
        trackPoints: []
      };

      const result = await repository.bulkCreateOptimized(batch);

      expect(result).toBe(0);
    });
  });

  describe('deleteByActivityId', () => {
    it('should delete all track points for an activity', async () => {
      mockExecuteUpdate.mockResolvedValue(150);

      const result = await repository.deleteByActivityId(testActivityId);

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM track_points WHERE activity_id = ?'),
        [testActivityId]
      );
      expect(result).toBe(150);
    });
  });

  describe('utility methods', () => {
    it('should find latest track points', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findLatestByActivityId(testActivityId, 5);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY timestamp DESC'),
        [testActivityId, 5]
      );
    });

    it('should find track points by time range', async () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const endTime = new Date('2023-01-01T11:00:00Z');
      
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findByTimeRange(testActivityId, startTime, endTime);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('timestamp BETWEEN ? AND ?'),
        [testActivityId, startTime.getTime(), endTime.getTime()]
      );
    });

    it('should find track points by accuracy threshold', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findByAccuracyThreshold(testActivityId, 10);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('accuracy <= ?'),
        [testActivityId, 10]
      );
    });
  });

  describe('calculateBounds', () => {
    it('should calculate bounding box for track points', async () => {
      const mockStats = {
        minLat: 45.5200,
        maxLat: 45.5300,
        minLng: -122.6800,
        maxLng: -122.6700,
        count: 100
      };

      mockExecuteQuery.mockResolvedValue([mockStats]);

      const result = await repository.calculateBounds(testActivityId);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('MIN(latitude)'),
        [testActivityId]
      );
      expect(result).toEqual({
        north: 45.5300,
        south: 45.5200,
        east: -122.6700,
        west: -122.6800
      });
    });

    it('should return null for activity with no track points', async () => {
      mockExecuteQuery.mockResolvedValue([{ count: 0 }]);

      const result = await repository.calculateBounds(testActivityId);

      expect(result).toBeNull();
    });
  });

  describe('calculateDistance', () => {
    it('should calculate total distance from track points', async () => {
      const mockTrackPoints = [
        createTrackPoint({ latitude: 45.5231, longitude: -122.6765, accuracy: 5, source: 'gps' }),
        createTrackPoint({ latitude: 45.5241, longitude: -122.6775, accuracy: 5, source: 'gps' }),
        createTrackPoint({ latitude: 45.5251, longitude: -122.6785, accuracy: 5, source: 'gps' })
      ];

      // Mock the findByActivityId call
      jest.spyOn(repository, 'findByActivityId').mockResolvedValue(mockTrackPoints);

      const result = await repository.calculateDistance(testActivityId);

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('should return 0 for activity with less than 2 track points', async () => {
      jest.spyOn(repository, 'findByActivityId').mockResolvedValue([testTrackPoint]);

      const result = await repository.calculateDistance(testActivityId);

      expect(result).toBe(0);
    });
  });

  describe('findOutliers', () => {
    it('should find track points with poor accuracy', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findOutliers(testActivityId, 20);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('accuracy > ?'),
        [testActivityId, 20]
      );
    });
  });

  describe('getActivitySummary', () => {
    it('should get comprehensive activity summary', async () => {
      const mockCount = 100;
      const mockStats = {
        minTime: Date.now() - 3600000, // 1 hour ago
        maxTime: Date.now(),
        avgAccuracy: 7.5
      };
      const mockBounds = {
        north: 45.5300,
        south: 45.5200,
        east: -122.6700,
        west: -122.6800
      };

      jest.spyOn(repository, 'count').mockResolvedValue(mockCount);
      mockExecuteQuery.mockResolvedValue([mockStats]);
      jest.spyOn(repository, 'calculateBounds').mockResolvedValue(mockBounds);
      jest.spyOn(repository, 'calculateDistance').mockResolvedValue(5000);

      const result = await repository.getActivitySummary(testActivityId);

      expect(result).toEqual({
        totalPoints: 100,
        timeSpan: 3600000,
        avgAccuracy: 7.5,
        bounds: mockBounds,
        distance: 5000
      });
    });
  });

  describe('cleanup operations', () => {
    it('should cleanup track points by accuracy', async () => {
      mockExecuteUpdate.mockResolvedValue(15);

      const result = await repository.cleanupByAccuracy(testActivityId, 50);

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining('accuracy > ?'),
        [testActivityId, 50]
      );
      expect(result).toBe(15);
    });

    it('should thin track points', async () => {
      const mockTrackPoints = Array.from({ length: 10 }, (_, i) => 
        createTrackPoint({ 
          latitude: 45.5231 + i * 0.001, 
          longitude: -122.6765 + i * 0.001, 
          accuracy: 5, 
          source: 'gps' 
        })
      );

      mockTransaction.mockImplementation(async (callback) => {
        return callback();
      });
      jest.spyOn(repository, 'findByActivityId').mockResolvedValue(mockTrackPoints);
      mockExecuteQuery.mockResolvedValue([{ id: 1 }]); // Mock ID lookup
      mockExecuteUpdate.mockResolvedValue(4); // Mock deletion result

      const result = await repository.thinTrackPoints(testActivityId, 2);

      expect(mockTransaction).toHaveBeenCalled();
      expect(result).toBe(4);
    });

    it('should return 0 when no points to thin', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        return callback();
      });
      jest.spyOn(repository, 'findByActivityId').mockResolvedValue([testTrackPoint]);

      const result = await repository.thinTrackPoints(testActivityId, 2);

      expect(result).toBe(0);
    });
  });
});