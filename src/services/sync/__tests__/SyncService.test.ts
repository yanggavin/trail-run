import SyncService, { SyncQueueItem } from '../SyncService';
import AuthService from '../../auth/AuthService';
import { ActivityRepository } from '../../repositories/ActivityRepository';
import { PhotoRepository } from '../../repositories/PhotoRepository';
import { Activity, Photo } from '../../../types/models';

// Mock dependencies
jest.mock('../../auth/AuthService');
jest.mock('../../repositories/ActivityRepository');
jest.mock('../../repositories/PhotoRepository');

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('SyncService', () => {
  let syncService: SyncService;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockActivityRepository: jest.Mocked<ActivityRepository>;
  let mockPhotoRepository: jest.Mocked<PhotoRepository>;

  const mockActivity: Activity = {
    activityId: 'activity-1',
    userId: 'user-1',
    name: 'Test Run',
    type: 'running',
    startTime: new Date(),
    endTime: new Date(),
    duration: 3600,
    distance: 5000,
    averageSpeed: 1.39,
    maxSpeed: 2.5,
    elevationGain: 100,
    elevationLoss: 80,
    calories: 300,
    trackPoints: [],
    photos: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPhoto: Photo = {
    photoId: 'photo-1',
    activityId: 'activity-1',
    uri: 'file://photo.jpg',
    thumbnailUri: 'file://thumb.jpg',
    latitude: 37.7749,
    longitude: -122.4194,
    timestamp: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    // Create mock instances
    mockAuthService = new AuthService({} as any) as jest.Mocked<AuthService>;
    mockActivityRepository = new ActivityRepository({} as any) as jest.Mocked<ActivityRepository>;
    mockPhotoRepository = new PhotoRepository({} as any) as jest.Mocked<PhotoRepository>;

    // Setup default mock implementations
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.getValidAccessToken.mockResolvedValue('mock-token');
    mockAuthService['config'] = { apiEndpoint: 'https://api.example.com' } as any;

    syncService = new SyncService(mockAuthService, mockActivityRepository, mockPhotoRepository);

    // Clear all mocks
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    syncService.dispose();
  });

  describe('queueActivity', () => {
    it('should queue activity for sync', async () => {
      const statusListener = jest.fn();
      syncService.addListener(statusListener);

      await syncService.queueActivity(mockActivity, 'create');

      const status = syncService.getSyncStatus();
      expect(status.pendingItems).toBe(1);
      expect(statusListener).toHaveBeenCalled();
    });

    it('should attempt immediate sync when online', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await syncService.queueActivity(mockActivity, 'create');

      // Wait for async sync to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/activities',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });
  });

  describe('queuePhoto', () => {
    it('should queue photo for sync', async () => {
      await syncService.queuePhoto(mockPhoto, 'create');

      const status = syncService.getSyncStatus();
      expect(status.pendingItems).toBe(1);
    });
  });

  describe('syncNow', () => {
    it('should sync queued activities successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await syncService.queueActivity(mockActivity, 'create');
      const result = await syncService.syncNow();

      expect(result.success).toBe(true);
      expect(result.syncedItems).toBe(1);
      expect(result.failedItems).toBe(0);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/activities',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle sync failures with retry logic', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await syncService.queueActivity(mockActivity, 'create');
      const result = await syncService.syncNow();

      expect(result.success).toBe(false);
      expect(result.syncedItems).toBe(0);
      expect(result.errors).toHaveLength(1);
      
      const status = syncService.getSyncStatus();
      expect(status.pendingItems).toBe(1); // Still pending for retry
    });

    it('should remove items after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await syncService.queueActivity(mockActivity, 'create');

      // Attempt sync multiple times to exceed max retries
      await syncService.syncNow();
      await syncService.syncNow();
      await syncService.syncNow();
      const result = await syncService.syncNow();

      expect(result.failedItems).toBe(1);
      
      const status = syncService.getSyncStatus();
      expect(status.pendingItems).toBe(0);
      expect(status.failedItems).toBe(1);
    });

    it('should throw error if not authenticated', async () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);

      await expect(syncService.syncNow()).rejects.toThrow('User not authenticated');
    });

    it('should throw error if sync already in progress', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const syncPromise = syncService.syncNow();
      
      await expect(syncService.syncNow()).rejects.toThrow('Sync already in progress');
      
      // Clean up
      syncService.dispose();
    });
  });

  describe('activity sync operations', () => {
    it('should sync activity creation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await syncService.queueActivity(mockActivity, 'create');
      await syncService.syncNow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/activities',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockActivity),
        })
      );
    });

    it('should sync activity update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await syncService.queueActivity(mockActivity, 'update');
      await syncService.syncNow();

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/activities/${mockActivity.activityId}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(mockActivity),
        })
      );
    });

    it('should sync activity deletion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await syncService.queueActivity(mockActivity, 'delete');
      await syncService.syncNow();

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/activities/${mockActivity.activityId}`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('photo sync operations', () => {
    it('should sync photo creation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await syncService.queuePhoto(mockPhoto, 'create');
      await syncService.syncNow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/photos',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockPhoto),
        })
      );
    });

    it('should sync photo deletion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await syncService.queuePhoto(mockPhoto, 'delete');
      await syncService.syncNow();

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/photos/${mockPhoto.photoId}`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('online status management', () => {
    it('should update online status and trigger sync when coming online', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      // Start offline
      syncService.setOnlineStatus(false);
      await syncService.queueActivity(mockActivity, 'create');

      expect(mockFetch).not.toHaveBeenCalled();

      // Come back online
      syncService.setOnlineStatus(true);

      // Wait for async sync
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should reflect online status in sync status', () => {
      syncService.setOnlineStatus(false);
      
      const status = syncService.getSyncStatus();
      expect(status.isOnline).toBe(false);
    });
  });

  describe('failed items management', () => {
    it('should clear failed items', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await syncService.queueActivity(mockActivity, 'create');

      // Exceed max retries
      for (let i = 0; i < 4; i++) {
        await syncService.syncNow();
      }

      let status = syncService.getSyncStatus();
      expect(status.failedItems).toBe(1);

      await syncService.clearFailedItems();

      status = syncService.getSyncStatus();
      expect(status.failedItems).toBe(0);
    });

    it('should retry failed items', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        } as Response);

      await syncService.queueActivity(mockActivity, 'create');

      // Exceed max retries
      for (let i = 0; i < 4; i++) {
        await syncService.syncNow();
      }

      let status = syncService.getSyncStatus();
      expect(status.failedItems).toBe(1);

      // Retry failed items
      await syncService.retryFailedItems();

      status = syncService.getSyncStatus();
      expect(status.failedItems).toBe(0);
      expect(status.pendingItems).toBe(0);
    });
  });

  describe('listeners', () => {
    it('should notify listeners of status changes', async () => {
      const listener = jest.fn();
      const removeListener = syncService.addListener(listener);

      await syncService.queueActivity(mockActivity, 'create');

      expect(listener).toHaveBeenCalled();

      removeListener();
      
      await syncService.queueActivity(mockActivity, 'update');
      
      // Should not be called again after removal
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});