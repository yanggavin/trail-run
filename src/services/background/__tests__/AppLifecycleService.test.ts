import { AppLifecycleService } from '../AppLifecycleService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
  },
}));

jest.mock('../BackgroundTaskService', () => ({
  backgroundTaskService: {
    handleAppBackground: jest.fn(),
    handleAppForeground: jest.fn(),
    handleAppInactive: jest.fn(),
  },
}));

jest.mock('../../../store', () => ({
  useAppStore: {
    getState: jest.fn(),
    restoreTrackingState: jest.fn(),
  },
}));

jest.mock('../../location/LocationService', () => ({
  locationService: {
    resumeTracking: jest.fn(),
  },
}));

describe('AppLifecycleService', () => {
  let appLifecycleService: AppLifecycleService;
  const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

  beforeEach(() => {
    appLifecycleService = AppLifecycleService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    appLifecycleService.cleanup();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await expect(appLifecycleService.initialize()).resolves.not.toThrow();
    });

    it('should emit initialized event', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const initSpy = jest.fn();
      appLifecycleService.on('initialized', initSpy);

      await appLifecycleService.initialize();

      expect(initSpy).toHaveBeenCalled();
    });

    it('should initialize with custom config', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const config = {
        enableAutoRecovery: false,
        recoveryTimeoutMs: 60000,
        maxRecoveryAttempts: 5,
      };

      await appLifecycleService.initialize(config);

      const configUpdatedSpy = jest.fn();
      appLifecycleService.on('configUpdated', configUpdatedSpy);

      appLifecycleService.updateConfig({ enableAutoRecovery: true });

      expect(configUpdatedSpy).toHaveBeenCalled();
    });
  });

  describe('tracking state persistence', () => {
    beforeEach(async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      await appLifecycleService.initialize();
    });

    it('should save tracking state for recovery', async () => {
      const mockUseAppStore = require('../../../store').useAppStore;
      mockUseAppStore.getState.mockReturnValue({
        tracking: {
          status: 'active',
          activity: {
            activityId: 'test-activity',
            userId: 'test-user',
          },
          startTime: Date.now(),
          pausedTime: 0,
          lastPauseTime: null,
          trackPoints: [
            {
              latitude: 37.7749,
              longitude: -122.4194,
              timestamp: new Date(),
            },
          ],
          lastLocation: {
            latitude: 37.7749,
            longitude: -122.4194,
            timestamp: new Date(),
          },
        },
      });

      await appLifecycleService.saveTrackingStateForRecovery();

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'trailrun_recovery_data',
        expect.stringContaining('test-activity')
      );
    });

    it('should clear recovery data when no active tracking', async () => {
      const mockUseAppStore = require('../../../store').useAppStore;
      mockUseAppStore.getState.mockReturnValue({
        tracking: {
          status: 'inactive',
          activity: null,
        },
      });

      await appLifecycleService.saveTrackingStateForRecovery();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('trailrun_recovery_data');
    });

    it('should not save when auto recovery is disabled', async () => {
      appLifecycleService.updateConfig({ enableAutoRecovery: false });

      await appLifecycleService.saveTrackingStateForRecovery();

      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('tracking recovery', () => {
    beforeEach(async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      await appLifecycleService.initialize();
    });

    it('should attempt tracking recovery successfully', async () => {
      const recoveryData = {
        activityId: 'test-activity',
        userId: 'test-user',
        startTime: Date.now() - 10000, // 10 seconds ago
        pausedTime: 0,
        lastPauseTime: null,
        trackPointCount: 5,
        recoveryAttempts: 0,
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(recoveryData));

      const mockUseAppStore = require('../../../store').useAppStore;
      mockUseAppStore.getState.mockReturnValue({
        tracking: {
          status: 'inactive',
        },
      });
      mockUseAppStore.restoreTrackingState = jest.fn();

      // Mock successful restoration
      mockUseAppStore.getState
        .mockReturnValueOnce({
          tracking: { status: 'inactive' },
        })
        .mockReturnValueOnce({
          tracking: {
            status: 'active',
            activity: { activityId: 'test-activity' },
          },
        });

      const trackingRecoveredSpy = jest.fn();
      appLifecycleService.on('trackingRecovered', trackingRecoveredSpy);

      const result = await appLifecycleService.attemptTrackingRecovery();

      expect(result).toBe(true);
      expect(trackingRecoveredSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          activityId: 'test-activity',
          recoveryAttempts: 1,
        })
      );
    });

    it('should fail recovery when max attempts exceeded', async () => {
      const recoveryData = {
        activityId: 'test-activity',
        userId: 'test-user',
        startTime: Date.now(),
        pausedTime: 0,
        lastPauseTime: null,
        trackPointCount: 5,
        recoveryAttempts: 5, // Exceeds default max of 3
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(recoveryData));

      const result = await appLifecycleService.attemptTrackingRecovery();

      expect(result).toBe(false);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('trailrun_recovery_data');
    });

    it('should fail recovery when timeout exceeded', async () => {
      const recoveryData = {
        activityId: 'test-activity',
        userId: 'test-user',
        startTime: Date.now() - 60000, // 60 seconds ago (exceeds default 30s timeout)
        pausedTime: 0,
        lastPauseTime: null,
        trackPointCount: 5,
        recoveryAttempts: 0,
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(recoveryData));

      const result = await appLifecycleService.attemptTrackingRecovery();

      expect(result).toBe(false);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('trailrun_recovery_data');
    });

    it('should return false when no recovery data exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await appLifecycleService.attemptTrackingRecovery();

      expect(result).toBe(false);
    });

    it('should return false when auto recovery is disabled', async () => {
      appLifecycleService.updateConfig({ enableAutoRecovery: false });

      const result = await appLifecycleService.attemptTrackingRecovery();

      expect(result).toBe(false);
    });
  });

  describe('crash handling', () => {
    beforeEach(async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      await appLifecycleService.initialize();
    });

    it('should handle app crash', async () => {
      const mockUseAppStore = require('../../../store').useAppStore;
      mockUseAppStore.getState.mockReturnValue({
        tracking: {
          status: 'active',
          activity: { activityId: 'test-activity' },
        },
      });

      const appCrashedSpy = jest.fn();
      appLifecycleService.on('appCrashed', appCrashedSpy);

      await appLifecycleService.handleAppCrash('Out of memory');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'trailrun_crash_info',
        expect.stringContaining('Out of memory')
      );
      expect(appCrashedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          crashReason: 'Out of memory',
          wasTrackingActive: true,
        })
      );
    });
  });

  describe('cleanup operations', () => {
    beforeEach(async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      await appLifecycleService.initialize();
    });

    it('should cleanup abandoned sessions', async () => {
      const mockUseAppStore = require('../../../store').useAppStore;
      mockUseAppStore.getState.mockReturnValue({
        tracking: {
          status: 'inactive',
          activity: { activityId: 'stale-activity' },
        },
      });
      mockUseAppStore.resetTracking = jest.fn();
      mockUseAppStore.saveTrackingState = jest.fn();

      // Mock old recovery data
      const oldRecoveryData = {
        activityId: 'old-activity',
        startTime: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(oldRecoveryData));

      const cleanupCompletedSpy = jest.fn();
      appLifecycleService.on('cleanupCompleted', cleanupCompletedSpy);

      await appLifecycleService.cleanupAbandonedSessions();

      expect(mockUseAppStore.resetTracking).toHaveBeenCalled();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('trailrun_recovery_data');
      expect(cleanupCompletedSpy).toHaveBeenCalled();
    });

    it('should cleanup old crash info', async () => {
      const oldCrashInfo = {
        timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        wasTrackingActive: true,
      };

      mockAsyncStorage.getItem
        .mockResolvedValueOnce(null) // recovery data
        .mockResolvedValueOnce(JSON.stringify(oldCrashInfo)); // crash info

      await appLifecycleService.cleanupAbandonedSessions();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('trailrun_crash_info');
    });
  });

  describe('app state management', () => {
    beforeEach(async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      await appLifecycleService.initialize();
    });

    it('should return current app state', () => {
      const state = appLifecycleService.getAppState();

      expect(state).toEqual({
        currentState: 'active',
        lastActiveTime: expect.any(Number),
        isTrackingActive: expect.any(Boolean),
      });
    });
  });

  describe('crash recovery on startup', () => {
    it('should check for crash recovery on initialization', async () => {
      const crashInfo = {
        timestamp: Date.now() - 5000, // 5 seconds ago
        wasTrackingActive: true,
        appState: 'background',
        lastActiveTime: Date.now() - 10000,
      };

      const recoveryData = {
        activityId: 'test-activity',
        userId: 'test-user',
        startTime: Date.now() - 10000,
        recoveryAttempts: 0,
      };

      mockAsyncStorage.getItem
        .mockResolvedValueOnce(JSON.stringify(crashInfo)) // crash info
        .mockResolvedValueOnce(JSON.stringify(recoveryData)); // recovery data

      const mockUseAppStore = require('../../../store').useAppStore;
      mockUseAppStore.getState
        .mockReturnValueOnce({ tracking: { status: 'inactive' } })
        .mockReturnValueOnce({
          tracking: {
            status: 'active',
            activity: { activityId: 'test-activity' },
          },
        });

      const crashRecoverySuccessfulSpy = jest.fn();
      appLifecycleService.on('crashRecoverySuccessful', crashRecoverySuccessfulSpy);

      await appLifecycleService.initialize();

      expect(crashRecoverySuccessfulSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          wasTrackingActive: true,
        })
      );
    });

    it('should handle failed crash recovery', async () => {
      const crashInfo = {
        timestamp: Date.now() - 5000,
        wasTrackingActive: true,
        appState: 'background',
        lastActiveTime: Date.now() - 10000,
      };

      mockAsyncStorage.getItem
        .mockResolvedValueOnce(JSON.stringify(crashInfo))
        .mockResolvedValueOnce(null); // no recovery data

      const crashRecoveryFailedSpy = jest.fn();
      appLifecycleService.on('crashRecoveryFailed', crashRecoveryFailedSpy);

      await appLifecycleService.initialize();

      expect(crashRecoveryFailedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          wasTrackingActive: true,
        })
      );
    });
  });
});