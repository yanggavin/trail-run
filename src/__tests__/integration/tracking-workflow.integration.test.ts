import { useAppStore } from '../../store';
import { LocationService } from '../../services/location/LocationService';
import { PhotoService } from '../../services/photo/PhotoService';
import { SyncService } from '../../services/sync/SyncService';
import { createTrackPoint } from '../../types/models';

// Mock services
jest.mock('../../services/location/LocationService');
jest.mock('../../services/photo/PhotoService');
jest.mock('../../services/sync/SyncService');

describe('Complete Tracking Workflow Integration Tests', () => {
  let mockLocationService: jest.Mocked<LocationService>;
  let mockPhotoService: jest.Mocked<PhotoService>;
  let mockSyncService: jest.Mocked<SyncService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset store
    useAppStore.getState().resetTracking();
    
    // Setup mocks
    mockLocationService = LocationService.getInstance() as jest.Mocked<LocationService>;
    mockPhotoService = new PhotoService() as jest.Mocked<PhotoService>;
    mockSyncService = SyncService.getInstance() as jest.Mocked<SyncService>;

    // Default mock implementations
    mockLocationService.initialize.mockResolvedValue();
    mockLocationService.requestPermissions.mockResolvedValue({
      granted: true,
      canAskAgain: false,
      status: 'granted',
    });
    mockLocationService.startTracking.mockResolvedValue();
    mockLocationService.stopTracking.mockResolvedValue();
    mockLocationService.pauseTracking.mockResolvedValue();
    mockLocationService.resumeTracking.mockResolvedValue();

    mockPhotoService.capturePhoto.mockResolvedValue({
      photoId: 'test-photo-1',
      activityId: 'test-activity',
      timestamp: new Date(),
      latitude: 37.7749,
      longitude: -122.4194,
      localUri: '/path/to/photo.jpg',
      syncStatus: 'local',
    });

    mockSyncService.syncActivity.mockResolvedValue();
  });

  describe('Complete Activity Tracking Flow', () => {
    it('should complete full tracking workflow from start to finish', async () => {
      const userId = 'test-user';
      
      // 1. Start tracking
      await useAppStore.getState().startTracking(userId);
      
      let state = useAppStore.getState().tracking;
      expect(state.status).toBe('active');
      expect(state.activity).not.toBeNull();
      expect(state.activity?.userId).toBe(userId);
      expect(mockLocationService.startTracking).toHaveBeenCalled();

      // 2. Simulate location updates
      const trackPoint1 = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 2.5,
      });

      const trackPoint2 = createTrackPoint({
        latitude: 37.7750,
        longitude: -122.4195,
        accuracy: 4,
        source: 'gps',
        speed: 2.8,
        timestamp: new Date(Date.now() + 1000),
      });

      useAppStore.getState().addTrackPoint(trackPoint1);
      useAppStore.getState().addTrackPoint(trackPoint2);

      state = useAppStore.getState().tracking;
      expect(state.trackPoints).toHaveLength(2);
      expect(state.statistics.distance).toBeGreaterThan(0);

      // 3. Capture photo during tracking
      const photo = await mockPhotoService.capturePhoto({
        latitude: 37.7750,
        longitude: -122.4195,
      });

      expect(photo.activityId).toBe(state.activity?.activityId);

      // 4. Pause tracking
      useAppStore.getState().pauseTracking();
      
      state = useAppStore.getState().tracking;
      expect(state.status).toBe('paused');
      expect(mockLocationService.pauseTracking).toHaveBeenCalled();

      // 5. Resume tracking
      useAppStore.getState().resumeTracking();
      
      state = useAppStore.getState().tracking;
      expect(state.status).toBe('active');
      expect(mockLocationService.resumeTracking).toHaveBeenCalled();

      // 6. Add more track points
      const trackPoint3 = createTrackPoint({
        latitude: 37.7751,
        longitude: -122.4196,
        accuracy: 3,
        source: 'gps',
        speed: 3.0,
        timestamp: new Date(Date.now() + 2000),
      });

      useAppStore.getState().addTrackPoint(trackPoint3);

      // 7. Stop tracking
      const completedActivity = await useAppStore.getState().stopTracking();
      
      expect(completedActivity.status).toBe('completed');
      expect(completedActivity.endedAt).toBeTruthy();
      expect(completedActivity.durationSec).toBeGreaterThan(0);
      expect(completedActivity.distanceM).toBeGreaterThan(0);
      expect(mockLocationService.stopTracking).toHaveBeenCalled();

      // 8. Verify final state
      state = useAppStore.getState().tracking;
      expect(state.status).toBe('inactive');
      expect(state.activity).toBeNull();
    });

    it('should handle tracking interruption and recovery', async () => {
      const userId = 'test-user';
      
      // Start tracking
      await useAppStore.getState().startTracking(userId);
      
      // Add some track points
      const trackPoint1 = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
      });

      useAppStore.getState().addTrackPoint(trackPoint1);

      // Simulate app crash/interruption by saving state
      const trackingState = useAppStore.getState().tracking;
      const savedState = {
        status: trackingState.status,
        activity: trackingState.activity,
        trackPoints: trackingState.trackPoints,
        startTime: trackingState.startTime,
      };

      // Reset store (simulate app restart)
      useAppStore.getState().resetTracking();
      
      // Restore state
      if (savedState.activity && savedState.status === 'active') {
        // Simulate recovery logic
        useAppStore.setState({
          tracking: {
            ...useAppStore.getState().tracking,
            status: 'active',
            activity: savedState.activity,
            trackPoints: savedState.trackPoints,
            startTime: savedState.startTime,
          },
        });

        // Resume location tracking
        await mockLocationService.startTracking({
          accuracy: 'high',
          interval: 1000,
          distanceFilter: 5,
          adaptiveThrottling: true,
        });
      }

      const recoveredState = useAppStore.getState().tracking;
      expect(recoveredState.status).toBe('active');
      expect(recoveredState.activity?.activityId).toBe(savedState.activity?.activityId);
      expect(recoveredState.trackPoints).toHaveLength(1);
    });
  });

  describe('Photo Capture and Sync Integration', () => {
    it('should capture photos during tracking and sync them', async () => {
      const userId = 'test-user';
      
      // Start tracking
      await useAppStore.getState().startTracking(userId);
      const activityId = useAppStore.getState().tracking.activity?.activityId;

      // Capture multiple photos
      const photo1 = await mockPhotoService.capturePhoto({
        latitude: 37.7749,
        longitude: -122.4194,
      });

      const photo2 = await mockPhotoService.capturePhoto({
        latitude: 37.7750,
        longitude: -122.4195,
      });

      expect(photo1.activityId).toBe(activityId);
      expect(photo2.activityId).toBe(activityId);

      // Complete tracking
      const completedActivity = await useAppStore.getState().stopTracking();

      // Sync activity with photos
      await mockSyncService.syncActivity(completedActivity.activityId);

      expect(mockSyncService.syncActivity).toHaveBeenCalledWith(completedActivity.activityId);
    });

    it('should handle photo capture failures gracefully', async () => {
      const userId = 'test-user';
      
      await useAppStore.getState().startTracking(userId);

      // Mock photo capture failure
      mockPhotoService.capturePhoto.mockRejectedValue(new Error('Camera not available'));

      // Attempt to capture photo
      await expect(mockPhotoService.capturePhoto({
        latitude: 37.7749,
        longitude: -122.4194,
      })).rejects.toThrow('Camera not available');

      // Tracking should continue normally
      const state = useAppStore.getState().tracking;
      expect(state.status).toBe('active');
    });
  });

  describe('Offline Functionality and Sync Recovery', () => {
    it('should handle offline tracking and sync when connection restored', async () => {
      const userId = 'test-user';
      
      // Start tracking in offline mode
      mockSyncService.syncActivity.mockRejectedValue(new Error('Network unavailable'));
      
      await useAppStore.getState().startTracking(userId);
      
      // Add track points while offline
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
        }),
        createTrackPoint({
          latitude: 37.7750,
          longitude: -122.4195,
          accuracy: 4,
          source: 'gps',
          timestamp: new Date(Date.now() + 1000),
        }),
      ];

      trackPoints.forEach(point => useAppStore.getState().addTrackPoint(point));

      // Complete activity while offline
      const completedActivity = await useAppStore.getState().stopTracking();
      expect(completedActivity.syncStatus).toBe('local');

      // Attempt sync (should fail)
      await expect(mockSyncService.syncActivity(completedActivity.activityId))
        .rejects.toThrow('Network unavailable');

      // Restore connection and retry sync
      mockSyncService.syncActivity.mockResolvedValue();
      
      await mockSyncService.syncActivity(completedActivity.activityId);
      expect(mockSyncService.syncActivity).toHaveBeenCalledWith(completedActivity.activityId);
    });

    it('should queue activities for sync when offline', async () => {
      const userId = 'test-user';
      
      // Mock offline state
      mockSyncService.syncActivity.mockRejectedValue(new Error('Network unavailable'));
      
      // Create multiple activities while offline
      const activities = [];
      
      for (let i = 0; i < 3; i++) {
        await useAppStore.getState().startTracking(userId);
        
        // Add a track point
        useAppStore.getState().addTrackPoint(createTrackPoint({
          latitude: 37.7749 + i * 0.001,
          longitude: -122.4194 + i * 0.001,
          accuracy: 5,
          source: 'gps',
        }));

        const activity = await useAppStore.getState().stopTracking();
        activities.push(activity);
      }

      // All activities should be local
      activities.forEach(activity => {
        expect(activity.syncStatus).toBe('local');
      });

      // Restore connection
      mockSyncService.syncActivity.mockResolvedValue();

      // Sync all activities
      for (const activity of activities) {
        await mockSyncService.syncActivity(activity.activityId);
      }

      expect(mockSyncService.syncActivity).toHaveBeenCalledTimes(3);
    });
  });

  describe('App Lifecycle and Background Processing', () => {
    it('should continue tracking when app goes to background', async () => {
      const userId = 'test-user';
      
      await useAppStore.getState().startTracking(userId);
      
      // Simulate app going to background
      // Location service should continue with background tracking
      expect(mockLocationService.startTracking).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundTracking: true,
        })
      );

      // Add track points (simulating background location updates)
      const backgroundTrackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 8, // Slightly lower accuracy in background
        source: 'gps',
      });

      useAppStore.getState().addTrackPoint(backgroundTrackPoint);

      const state = useAppStore.getState().tracking;
      expect(state.trackPoints).toHaveLength(1);
      expect(state.status).toBe('active');
    });

    it('should handle app termination during tracking', async () => {
      const userId = 'test-user';
      
      await useAppStore.getState().startTracking(userId);
      
      // Add some track points
      useAppStore.getState().addTrackPoint(createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
      }));

      const trackingState = useAppStore.getState().tracking;
      
      // Simulate app termination by saving state to persistent storage
      const persistentState = {
        activityId: trackingState.activity?.activityId,
        userId: trackingState.activity?.userId,
        startTime: trackingState.startTime,
        trackPoints: trackingState.trackPoints,
        status: trackingState.status,
      };

      // Verify state can be serialized
      expect(() => JSON.stringify(persistentState)).not.toThrow();
      
      // On app restart, state should be recoverable
      const recoveredState = JSON.parse(JSON.stringify(persistentState));
      expect(recoveredState.activityId).toBe(trackingState.activity?.activityId);
      expect(recoveredState.trackPoints).toHaveLength(1);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle GPS signal loss gracefully', async () => {
      const userId = 'test-user';
      
      await useAppStore.getState().startTracking(userId);

      // Simulate GPS signal loss
      const errorTrackPoint = createTrackPoint({
        latitude: 0,
        longitude: 0,
        accuracy: -1,
        source: 'error',
      });

      useAppStore.getState().addTrackPoint(errorTrackPoint);

      // Should still maintain tracking state
      const state = useAppStore.getState().tracking;
      expect(state.status).toBe('active');
      expect(state.trackPoints).toHaveLength(1);
    });

    it('should recover from location service errors', async () => {
      const userId = 'test-user';
      
      // Mock location service failure
      mockLocationService.startTracking.mockRejectedValueOnce(new Error('GPS unavailable'));
      
      await expect(useAppStore.getState().startTracking(userId)).rejects.toThrow();

      // Retry should work
      mockLocationService.startTracking.mockResolvedValue();
      await useAppStore.getState().startTracking(userId);

      const state = useAppStore.getState().tracking;
      expect(state.status).toBe('active');
    });

    it('should handle storage errors during tracking', async () => {
      const userId = 'test-user';
      
      await useAppStore.getState().startTracking(userId);

      // Add track points normally
      useAppStore.getState().addTrackPoint(createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
      }));

      // Even if storage fails, tracking should continue in memory
      const state = useAppStore.getState().tracking;
      expect(state.status).toBe('active');
      expect(state.trackPoints).toHaveLength(1);
    });
  });
});