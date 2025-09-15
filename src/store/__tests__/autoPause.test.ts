import { useAppStore } from '../index';
import { autoPauseService } from '../../services/tracking/AutoPauseService';
import { createTrackPoint } from '../../types/models';

// Mock localStorage for persistence tests
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock window and localStorage for Node.js environment
Object.defineProperty(global, 'window', {
  value: {
    localStorage: mockLocalStorage,
  },
  writable: true,
});

describe('Auto-Pause Integration Tests', () => {
  beforeEach(() => {
    // Reset store and auto-pause service
    useAppStore.getState().resetTracking();
    autoPauseService.cleanup();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('auto-pause configuration', () => {
    it('should enable auto-pause with default config', () => {
      useAppStore.getState().enableAutoPause();
      
      const config = autoPauseService.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.speedThreshold).toBe(0.5);
      expect(config.timeThreshold).toBe(20);
    });

    it('should enable auto-pause with custom config', () => {
      const customConfig = {
        speedThreshold: 1.0,
        timeThreshold: 30,
      };

      useAppStore.getState().enableAutoPause(customConfig);
      
      const config = autoPauseService.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.speedThreshold).toBe(1.0);
      expect(config.timeThreshold).toBe(30);
    });

    it('should disable auto-pause', () => {
      useAppStore.getState().enableAutoPause();
      expect(autoPauseService.getConfig().enabled).toBe(true);

      useAppStore.getState().disableAutoPause();
      expect(autoPauseService.getConfig().enabled).toBe(false);
    });

    it('should update auto-pause config', () => {
      const newConfig = {
        speedThreshold: 0.8,
        timeThreshold: 15,
      };

      useAppStore.getState().updateAutoPauseConfig(newConfig);
      
      const config = autoPauseService.getConfig();
      expect(config.speedThreshold).toBe(0.8);
      expect(config.timeThreshold).toBe(15);
    });
  });

  describe('auto-pause during tracking', () => {
    beforeEach(async () => {
      await useAppStore.getState().startTracking('test-user');
    });

    it('should start auto-pause monitoring when tracking starts', () => {
      const state = autoPauseService.getState();
      expect(state.isMonitoring).toBe(true);
    });

    it('should automatically pause when speed drops below threshold', async () => {
      const store = useAppStore.getState();
      
      // Add track points with low speed
      const lowSpeedPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 0.3, // Below 0.5 m/s threshold
      });

      store.addTrackPoint(lowSpeedPoint);

      // Fast-forward time to trigger auto-pause
      jest.advanceTimersByTime(21000);

      // Check that tracking was automatically paused
      const trackingState = useAppStore.getState().tracking;
      expect(trackingState.status).toBe('paused');
      expect(trackingState.isAutoPaused).toBe(true);
    });

    it('should not auto-pause if speed is above threshold', async () => {
      const store = useAppStore.getState();
      
      const highSpeedPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 2.5, // Above 0.5 m/s threshold
      });

      store.addTrackPoint(highSpeedPoint);

      // Fast-forward time
      jest.advanceTimersByTime(25000);

      // Should still be active
      const trackingState = useAppStore.getState().tracking;
      expect(trackingState.status).toBe('active');
      expect(trackingState.isAutoPaused).toBe(false);
    });

    it('should reset auto-pause detection when speed increases', async () => {
      const store = useAppStore.getState();
      
      // First, add low speed point
      const lowSpeedPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 0.3,
      });
      store.addTrackPoint(lowSpeedPoint);

      // Wait some time but not enough to trigger auto-pause
      jest.advanceTimersByTime(15000);

      // Then add high speed point
      const highSpeedPoint = createTrackPoint({
        latitude: 37.7750,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 2.5,
        timestamp: new Date(Date.now() + 15000),
      });
      store.addTrackPoint(highSpeedPoint);

      // Wait more time
      jest.advanceTimersByTime(25000);

      // Should not have auto-paused
      const trackingState = useAppStore.getState().tracking;
      expect(trackingState.status).toBe('active');
    });

    it('should stop auto-pause monitoring when tracking stops', async () => {
      expect(autoPauseService.getState().isMonitoring).toBe(true);

      await useAppStore.getState().stopTracking();

      expect(autoPauseService.getState().isMonitoring).toBe(false);
    });
  });

  describe('manual pause and resume', () => {
    beforeEach(async () => {
      await useAppStore.getState().startTracking('test-user');
    });

    it('should distinguish between manual and auto pause', () => {
      const store = useAppStore.getState();
      
      // Manual pause
      store.pauseTracking(false);
      
      let trackingState = useAppStore.getState().tracking;
      expect(trackingState.status).toBe('paused');
      expect(trackingState.isAutoPaused).toBe(false);

      // Resume and then auto pause
      store.resumeTracking();
      store.pauseTracking(true);

      trackingState = useAppStore.getState().tracking;
      expect(trackingState.status).toBe('paused');
      expect(trackingState.isAutoPaused).toBe(true);
    });

    it('should resume from both manual and auto pause', () => {
      const store = useAppStore.getState();
      
      // Test manual pause/resume
      store.pauseTracking(false);
      expect(useAppStore.getState().tracking.status).toBe('paused');
      
      store.resumeTracking();
      expect(useAppStore.getState().tracking.status).toBe('active');
      expect(useAppStore.getState().tracking.isAutoPaused).toBe(false);

      // Test auto pause/resume
      store.pauseTracking(true);
      expect(useAppStore.getState().tracking.status).toBe('paused');
      
      store.resumeTracking();
      expect(useAppStore.getState().tracking.status).toBe('active');
      expect(useAppStore.getState().tracking.isAutoPaused).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should save tracking state to localStorage', async () => {
      await useAppStore.getState().startTracking('test-user');
      
      // Add some track points
      const trackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 2.5,
      });
      useAppStore.getState().addTrackPoint(trackPoint);

      await useAppStore.getState().saveTrackingState();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'trailrun_tracking_state',
        expect.any(String)
      );

      // Verify the saved data structure
      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData.status).toBe('active');
      expect(savedData.activity).toBeTruthy();
      expect(savedData.trackPoints).toHaveLength(1);
    });

    it('should restore tracking state from localStorage', async () => {
      const mockSavedState = {
        status: 'active',
        activity: {
          activityId: 'test-activity',
          userId: 'test-user',
          startedAt: new Date().toISOString(),
          status: 'active',
          durationSec: 0,
          distanceM: 0,
          avgPaceSecPerKm: 0,
          elevGainM: 0,
          elevLossM: 0,
          splitKm: [],
          deviceMeta: { platform: 'ios', version: '1.0.0', model: 'test' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: 'local',
        },
        trackPoints: [{
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          speed: 2.5,
          timestamp: new Date().toISOString(),
        }],
        startTime: Date.now(),
        pausedTime: 0,
        lastPauseTime: null,
        isAutoPaused: false,
        lastLocation: null,
        statistics: {
          elapsedTime: 0,
          distance: 0,
          currentPace: 0,
          avgPace: 0,
          currentSpeed: 0,
          elevationGain: 0,
          elevationLoss: 0,
        },
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockSavedState));

      await useAppStore.getState().restoreTrackingState();

      const restoredState = useAppStore.getState().tracking;
      expect(restoredState.status).toBe('active');
      expect(restoredState.activity?.activityId).toBe('test-activity');
      expect(restoredState.trackPoints).toHaveLength(1);
      expect(restoredState.trackPoints[0].latitude).toBe(37.7749);

      // Should resume auto-pause monitoring for active tracking
      expect(autoPauseService.getState().isMonitoring).toBe(true);
    });

    it('should handle missing localStorage data gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      await useAppStore.getState().restoreTrackingState();

      // Should not change the current state
      const state = useAppStore.getState().tracking;
      expect(state.status).toBe('inactive');
      expect(state.activity).toBeNull();
    });

    it('should handle corrupted localStorage data gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      await useAppStore.getState().restoreTrackingState();

      // Should not change the current state
      const state = useAppStore.getState().tracking;
      expect(state.status).toBe('inactive');
      expect(state.activity).toBeNull();
    });

    it('should clear persisted state when tracking stops', async () => {
      await useAppStore.getState().startTracking('test-user');
      await useAppStore.getState().stopTracking();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'trailrun_tracking_state',
        expect.stringContaining('"status":"inactive"')
      );
    });
  });

  describe('app lifecycle management', () => {
    it('should enable auto-pause monitoring when starting active tracking', async () => {
      const customConfig = { speedThreshold: 0.8 };
      
      await useAppStore.getState().startTracking('test-user', customConfig);

      expect(autoPauseService.getState().isMonitoring).toBe(true);
      expect(autoPauseService.getConfig().speedThreshold).toBe(0.8);
    });

    it('should resume auto-pause monitoring after restoring active state', async () => {
      const mockActiveState = {
        status: 'active',
        activity: {
          activityId: 'test-activity',
          userId: 'test-user',
          startedAt: new Date().toISOString(),
          status: 'active',
          durationSec: 0,
          distanceM: 0,
          avgPaceSecPerKm: 0,
          elevGainM: 0,
          elevLossM: 0,
          splitKm: [],
          deviceMeta: { platform: 'ios', version: '1.0.0', model: 'test' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: 'local',
        },
        trackPoints: [],
        startTime: Date.now(),
        pausedTime: 0,
        lastPauseTime: null,
        isAutoPaused: false,
        lastLocation: null,
        statistics: {
          elapsedTime: 0,
          distance: 0,
          currentPace: 0,
          avgPace: 0,
          currentSpeed: 0,
          elevationGain: 0,
          elevationLoss: 0,
        },
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockActiveState));

      await useAppStore.getState().restoreTrackingState();

      expect(autoPauseService.getState().isMonitoring).toBe(true);
    });

    it('should not resume auto-pause monitoring for paused or inactive state', async () => {
      const mockPausedState = {
        status: 'paused',
        activity: null,
        trackPoints: [],
        startTime: null,
        pausedTime: 0,
        lastPauseTime: null,
        isAutoPaused: false,
        lastLocation: null,
        statistics: {
          elapsedTime: 0,
          distance: 0,
          currentPace: 0,
          avgPace: 0,
          currentSpeed: 0,
          elevationGain: 0,
          elevationLoss: 0,
        },
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockPausedState));

      await useAppStore.getState().restoreTrackingState();

      expect(autoPauseService.getState().isMonitoring).toBe(false);
    });
  });
});