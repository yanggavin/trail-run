import { HistoryService, HistoryFilters, PaginationParams } from '../HistoryService';
import { ActivityRepository } from '../../repositories/ActivityRepository';
import { PhotoRepository } from '../../repositories/PhotoRepository';
import { Activity, Photo } from '../../../types';
import { createActivity, createPhoto } from '../../../types/models';

// Mock the repositories
jest.mock('../../repositories/ActivityRepository');
jest.mock('../../repositories/PhotoRepository');

const MockedActivityRepository = ActivityRepository as jest.MockedClass<typeof ActivityRepository>;
const MockedPhotoRepository = PhotoRepository as jest.MockedClass<typeof PhotoRepository>;

describe('HistoryService', () => {
  let historyService: HistoryService;
  let mockActivityRepo: jest.Mocked<ActivityRepository>;
  let mockPhotoRepo: jest.Mocked<PhotoRepository>;

  const mockUserId = 'user_123';
  const mockActivity1: Activity = createActivity({
    activityId: 'activity_1',
    userId: mockUserId,
    startedAt: new Date('2024-01-15T10:00:00Z'),
  });
  mockActivity1.status = 'completed';
  mockActivity1.distanceM = 5000;
  mockActivity1.durationSec = 1800;
  mockActivity1.avgPaceSecPerKm = 360;
  mockActivity1.endedAt = new Date('2024-01-15T10:30:00Z');

  const mockActivity2: Activity = createActivity({
    activityId: 'activity_2',
    userId: mockUserId,
    startedAt: new Date('2024-01-14T09:00:00Z'),
  });
  mockActivity2.status = 'completed';
  mockActivity2.distanceM = 10000;
  mockActivity2.durationSec = 3600;
  mockActivity2.avgPaceSecPerKm = 360;
  mockActivity2.endedAt = new Date('2024-01-14T10:00:00Z');
  mockActivity2.coverPhotoId = 'photo_1';

  const mockPhoto1: Photo = createPhoto({
    photoId: 'photo_1',
    activityId: 'activity_2',
    latitude: 40.7128,
    longitude: -74.0060,
    localUri: '/path/to/photo1.jpg',
  });
  mockPhoto1.thumbnailUri = '/path/to/photo1_thumb.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockActivityRepo = new MockedActivityRepository({} as any) as jest.Mocked<ActivityRepository>;
    mockPhotoRepo = new MockedPhotoRepository({} as any) as jest.Mocked<PhotoRepository>;
    
    historyService = new HistoryService(mockActivityRepo, mockPhotoRepo);
  });

  describe('getActivities', () => {
    it('should return activities with cover photos', async () => {
      // Arrange
      mockActivityRepo.findAll.mockResolvedValue([mockActivity1, mockActivity2]);
      mockActivityRepo.findByUserId.mockResolvedValue([mockActivity1, mockActivity2]);
      mockActivityRepo.getStats.mockResolvedValue({
        totalActivities: 2,
        totalDistance: 15000,
        totalDuration: 5400,
        averagePace: 360,
      });
      mockPhotoRepo.findById.mockResolvedValue(mockPhoto1);
      mockPhotoRepo.findByActivityId.mockResolvedValue([]);

      const pagination: PaginationParams = { limit: 10, offset: 0 };

      // Act
      const result = await historyService.getActivities(mockUserId, {}, pagination);

      // Assert
      expect(result.activities).toHaveLength(2);
      expect(result.activities[0].activity.activityId).toBe('activity_1');
      expect(result.activities[1].activity.activityId).toBe('activity_2');
      expect(result.activities[1].coverPhotoUri).toBe('/path/to/photo1_thumb.jpg');
      expect(result.totalCount).toBe(2);
      expect(result.hasMore).toBe(false);

      expect(mockActivityRepo.findAll).toHaveBeenCalledWith({
        userId: mockUserId,
        status: 'completed',
        limit: 10,
        offset: 0,
      });
    });

    it('should filter activities by date range', async () => {
      // Arrange
      const startDate = new Date('2024-01-14T00:00:00Z');
      const endDate = new Date('2024-01-14T23:59:59Z');
      const filters: HistoryFilters = { startDate, endDate };

      mockActivityRepo.findAll.mockResolvedValue([mockActivity2]);
      mockActivityRepo.findByUserId.mockResolvedValue([mockActivity2]);
      mockActivityRepo.getStats.mockResolvedValue({
        totalActivities: 1,
        totalDistance: 10000,
        totalDuration: 3600,
        averagePace: 360,
      });
      mockPhotoRepo.findById.mockResolvedValue(mockPhoto1);

      // Act
      const result = await historyService.getActivities(mockUserId, filters);

      // Assert
      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].activity.activityId).toBe('activity_2');
      expect(mockActivityRepo.findAll).toHaveBeenCalledWith({
        userId: mockUserId,
        status: 'completed',
        startDate,
        endDate,
        limit: 20,
        offset: 0,
      });
    });

    it('should filter activities by distance range', async () => {
      // Arrange
      const filters: HistoryFilters = { minDistance: 8, maxDistance: 12 }; // 8-12 km
      mockActivityRepo.findAll.mockResolvedValue([mockActivity1, mockActivity2]);
      mockActivityRepo.findByUserId.mockResolvedValue([mockActivity1, mockActivity2]);
      mockActivityRepo.getStats.mockResolvedValue({
        totalActivities: 1,
        totalDistance: 10000,
        totalDuration: 3600,
        averagePace: 360,
      });

      // Act
      const result = await historyService.getActivities(mockUserId, filters);

      // Assert
      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].activity.activityId).toBe('activity_2');
      expect(result.activities[0].activity.distanceM).toBe(10000);
    });

    it('should filter activities by duration range', async () => {
      // Arrange
      const filters: HistoryFilters = { minDuration: 50, maxDuration: 70 }; // 50-70 minutes
      mockActivityRepo.findAll.mockResolvedValue([mockActivity1, mockActivity2]);
      mockActivityRepo.findByUserId.mockResolvedValue([mockActivity1, mockActivity2]);
      mockActivityRepo.getStats.mockResolvedValue({
        totalActivities: 1,
        totalDistance: 3600,
        totalDuration: 3600,
        averagePace: 360,
      });

      // Act
      const result = await historyService.getActivities(mockUserId, filters);

      // Assert
      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].activity.activityId).toBe('activity_2');
      expect(result.activities[0].activity.durationSec).toBe(3600);
    });

    it('should sort activities by distance', async () => {
      // Arrange
      const filters: HistoryFilters = { sortBy: 'distance', sortOrder: 'asc' };
      mockActivityRepo.findAll.mockResolvedValue([mockActivity2, mockActivity1]); // Returned in date order
      mockActivityRepo.findByUserId.mockResolvedValue([mockActivity2, mockActivity1]);
      mockActivityRepo.getStats.mockResolvedValue({
        totalActivities: 2,
        totalDistance: 15000,
        totalDuration: 5400,
        averagePace: 360,
      });
      mockPhotoRepo.findByActivityId.mockResolvedValue([]);

      // Act
      const result = await historyService.getActivities(mockUserId, filters);

      // Assert
      expect(result.activities).toHaveLength(2);
      expect(result.activities[0].activity.activityId).toBe('activity_1'); // 5km first
      expect(result.activities[1].activity.activityId).toBe('activity_2'); // 10km second
    });

    it('should handle search text filtering', async () => {
      // Arrange
      const filters: HistoryFilters = { searchText: 'activity_1' };
      mockActivityRepo.findAll.mockResolvedValue([mockActivity1, mockActivity2]);
      mockActivityRepo.findByUserId.mockResolvedValue([mockActivity1, mockActivity2]);
      mockActivityRepo.getStats.mockResolvedValue({
        totalActivities: 1,
        totalDistance: 5000,
        totalDuration: 1800,
        averagePace: 360,
      });
      mockPhotoRepo.findByActivityId.mockResolvedValue([]);

      // Act
      const result = await historyService.getActivities(mockUserId, filters);

      // Assert
      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].activity.activityId).toBe('activity_1');
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      const pagination: PaginationParams = { limit: 1, offset: 0 };
      mockActivityRepo.findAll.mockResolvedValue([mockActivity1]);
      mockActivityRepo.findByUserId.mockResolvedValue([mockActivity1, mockActivity2]);
      mockActivityRepo.getStats.mockResolvedValue({
        totalActivities: 2,
        totalDistance: 15000,
        totalDuration: 5400,
        averagePace: 360,
      });
      mockPhotoRepo.findByActivityId.mockResolvedValue([]);

      // Act
      const result = await historyService.getActivities(mockUserId, {}, pagination);

      // Assert
      expect(result.activities).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.totalCount).toBe(2);
    });

    it('should use fallback photo when no cover photo is set', async () => {
      // Arrange
      const activityWithoutCover = { ...mockActivity1 };
      delete activityWithoutCover.coverPhotoId;
      
      mockActivityRepo.findAll.mockResolvedValue([activityWithoutCover]);
      mockActivityRepo.findByUserId.mockResolvedValue([activityWithoutCover]);
      mockActivityRepo.getStats.mockResolvedValue({
        totalActivities: 1,
        totalDistance: 5000,
        totalDuration: 1800,
        averagePace: 360,
      });
      mockPhotoRepo.findByActivityId.mockResolvedValue([mockPhoto1]);

      // Act
      const result = await historyService.getActivities(mockUserId);

      // Assert
      expect(result.activities[0].coverPhotoUri).toBe('/path/to/photo1_thumb.jpg');
      expect(mockPhotoRepo.findByActivityId).toHaveBeenCalledWith('activity_1');
    });
  });

  describe('searchActivities', () => {
    it('should search activities with text', async () => {
      // Arrange
      const searchText = 'activity_2';
      mockActivityRepo.findAll.mockResolvedValue([mockActivity2]);
      mockActivityRepo.findByUserId.mockResolvedValue([mockActivity2]);
      mockActivityRepo.getStats.mockResolvedValue({
        totalActivities: 1,
        totalDistance: 10000,
        totalDuration: 3600,
        averagePace: 360,
      });
      mockPhotoRepo.findById.mockResolvedValue(mockPhoto1);

      // Act
      const result = await historyService.searchActivities(mockUserId, searchText);

      // Assert
      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].activity.activityId).toBe('activity_2');
    });
  });

  describe('refreshActivities', () => {
    it('should complete without error', async () => {
      // Act & Assert
      await expect(historyService.refreshActivities(mockUserId)).resolves.toBeUndefined();
    });
  });

  describe('getActivityStats', () => {
    it('should return activity statistics', async () => {
      // Arrange
      const expectedStats = {
        totalActivities: 2,
        totalDistance: 15000,
        totalDuration: 5400,
        averagePace: 360,
      };
      mockActivityRepo.getStats.mockResolvedValue(expectedStats);

      // Act
      const result = await historyService.getActivityStats(mockUserId);

      // Assert
      expect(result).toEqual(expectedStats);
      expect(mockActivityRepo.getStats).toHaveBeenCalledWith(mockUserId, {});
    });

    it('should return statistics for date range', async () => {
      // Arrange
      const dateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };
      const expectedStats = {
        totalActivities: 1,
        totalDistance: 10000,
        totalDuration: 3600,
        averagePace: 360,
      };
      mockActivityRepo.getStats.mockResolvedValue(expectedStats);

      // Act
      const result = await historyService.getActivityStats(mockUserId, dateRange);

      // Assert
      expect(result).toEqual(expectedStats);
      expect(mockActivityRepo.getStats).toHaveBeenCalledWith(mockUserId, dateRange);
    });
  });
});