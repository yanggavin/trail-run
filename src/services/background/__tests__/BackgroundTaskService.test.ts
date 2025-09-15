import { BackgroundTaskService } from '../BackgroundTaskService';

// Mock dependencies
jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
  getStatusAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  BackgroundFetchStatus: {
    Available: 1,
    Denied: 2,
    Restricted: 3,
  },
  BackgroundFetchResult: {
    NewData: 1,
    NoData: 2,
    Failed: 3,
  },
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegistered: jest.fn(),
}));

jest.mock('../../location/LocationService', () => ({
  locationService: {
    getCurrentLocation: jest.fn(),
  },
}));

jest.mock('../../../store', () => ({
  useAppStore: {
    getState: jest.fn(),
  },
}));

describe('BackgroundTaskService', () => {
  let backgroundTaskService: BackgroundTaskService;

  beforeEach(() => {
    backgroundTaskService = BackgroundTaskService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await backgroundTaskService.cleanup();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const mockRequestPermissions = require('expo-background-fetch').requestPermissionsAsync;
      mockRequestPermissions.mockResolvedValue({ status: 'granted' });

      await expect(backgroundTaskService.initialize()).resolves.not.toThrow();
    });

    it('should emit initialized event', async () => {
      const mockRequestPermissions = require('expo-background-fetch').requestPermissionsAsync;
      mockRequestPermissions.mockResolvedValue({ status: 'granted' });

      const initSpy = jest.fn();
      backgroundTaskService.on('initialized', initSpy);

      await backgroundTaskService.initialize();

      expect(initSpy).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const mockRequestPermissions = require('expo-background-fetch').requestPermissionsAsync;
      mockRequestPermissions.mockRejectedValue(new Error('Permission denied'));

      await expect(backgroundTaskService.initialize()).rejects.toThrow('Failed to initialize BackgroundTaskService');
    });
  });

  describe('background task registration', () => {
    beforeEach(async () => {
      const mockRequestPermissions = require('expo-background-fetch').requestPermissionsAsync;
      mockRequestPermissions.mockResolvedValue({ status: 'granted' });
      await backgroundTaskService.initialize();
    });

    it('should register background task successfully', async () => {
      const mockRegisterTask = require('expo-background-fetch').registerTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockIsTaskRegistered.mockReturnValue(false);
      mockRegisterTask.mockResolvedValue(undefined);

      const config = {
        taskName: 'test-task',
        interval: 5000,
        minimumInterval: 15000,
      };

      await expect(backgroundTaskService.registerBackgroundTask(config)).resolves.not.toThrow();
      expect(mockRegisterTask).toHaveBeenCalledWith('test-task', {
        minimumInterval: 15000,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    });

    it('should emit taskRegistered event', async () => {
      const mockRegisterTask = require('expo-background-fetch').registerTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockIsTaskRegistered.mockReturnValue(false);
      mockRegisterTask.mockResolvedValue(undefined);

      const taskRegisteredSpy = jest.fn();
      backgroundTaskService.on('taskRegistered', taskRegisteredSpy);

      const config = {
        taskName: 'test-task',
        interval: 5000,
      };

      await backgroundTaskService.registerBackgroundTask(config);

      expect(taskRegisteredSpy).toHaveBeenCalledWith('test-task');
    });

    it('should handle registration errors', async () => {
      const mockRegisterTask = require('expo-background-fetch').registerTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockIsTaskRegistered.mockReturnValue(false);
      mockRegisterTask.mockRejectedValue(new Error('Registration failed'));

      const config = {
        taskName: 'test-task',
        interval: 5000,
      };

      await expect(backgroundTaskService.registerBackgroundTask(config)).rejects.toThrow('Failed to register background task test-task');
    });
  });

  describe('background task unregistration', () => {
    beforeEach(async () => {
      const mockRequestPermissions = require('expo-background-fetch').requestPermissionsAsync;
      mockRequestPermissions.mockResolvedValue({ status: 'granted' });
      await backgroundTaskService.initialize();
    });

    it('should unregister background task successfully', async () => {
      const mockUnregisterTask = require('expo-background-fetch').unregisterTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockIsTaskRegistered.mockReturnValue(true);
      mockUnregisterTask.mockResolvedValue(undefined);

      await expect(backgroundTaskService.unregisterBackgroundTask('test-task')).resolves.not.toThrow();
      expect(mockUnregisterTask).toHaveBeenCalledWith('test-task');
    });

    it('should emit taskUnregistered event', async () => {
      const mockUnregisterTask = require('expo-background-fetch').unregisterTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockIsTaskRegistered.mockReturnValue(true);
      mockUnregisterTask.mockResolvedValue(undefined);

      const taskUnregisteredSpy = jest.fn();
      backgroundTaskService.on('taskUnregistered', taskUnregisteredSpy);

      await backgroundTaskService.unregisterBackgroundTask('test-task');

      expect(taskUnregisteredSpy).toHaveBeenCalledWith('test-task');
    });
  });

  describe('background location tracking', () => {
    beforeEach(async () => {
      const mockRequestPermissions = require('expo-background-fetch').requestPermissionsAsync;
      mockRequestPermissions.mockResolvedValue({ status: 'granted' });
      await backgroundTaskService.initialize();
    });

    it('should start background location tracking', async () => {
      const mockRegisterTask = require('expo-background-fetch').registerTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockIsTaskRegistered.mockReturnValue(false);
      mockRegisterTask.mockResolvedValue(undefined);

      const backgroundTrackingStartedSpy = jest.fn();
      backgroundTaskService.on('backgroundTrackingStarted', backgroundTrackingStartedSpy);

      await backgroundTaskService.startBackgroundLocationTracking();

      expect(mockRegisterTask).toHaveBeenCalledWith(
        BackgroundTaskService.LOCATION_TRACKING_TASK,
        expect.objectContaining({
          minimumInterval: 15000,
          stopOnTerminate: false,
          startOnBoot: true,
        })
      );
      expect(backgroundTrackingStartedSpy).toHaveBeenCalled();
    });

    it('should stop background location tracking', async () => {
      const mockUnregisterTask = require('expo-background-fetch').unregisterTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockIsTaskRegistered.mockReturnValue(true);
      mockUnregisterTask.mockResolvedValue(undefined);

      const backgroundTrackingStoppedSpy = jest.fn();
      backgroundTaskService.on('backgroundTrackingStopped', backgroundTrackingStoppedSpy);

      await backgroundTaskService.stopBackgroundLocationTracking();

      expect(mockUnregisterTask).toHaveBeenCalledWith(BackgroundTaskService.LOCATION_TRACKING_TASK);
      expect(backgroundTrackingStoppedSpy).toHaveBeenCalled();
    });
  });

  describe('background sync', () => {
    beforeEach(async () => {
      const mockRequestPermissions = require('expo-background-fetch').requestPermissionsAsync;
      mockRequestPermissions.mockResolvedValue({ status: 'granted' });
      await backgroundTaskService.initialize();
    });

    it('should start background sync', async () => {
      const mockRegisterTask = require('expo-background-fetch').registerTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockIsTaskRegistered.mockReturnValue(false);
      mockRegisterTask.mockResolvedValue(undefined);

      const backgroundSyncStartedSpy = jest.fn();
      backgroundTaskService.on('backgroundSyncStarted', backgroundSyncStartedSpy);

      await backgroundTaskService.startBackgroundSync();

      expect(mockRegisterTask).toHaveBeenCalledWith(
        BackgroundTaskService.SYNC_TASK,
        expect.objectContaining({
          minimumInterval: 300000,
          stopOnTerminate: false,
          startOnBoot: true,
        })
      );
      expect(backgroundSyncStartedSpy).toHaveBeenCalled();
    });

    it('should stop background sync', async () => {
      const mockUnregisterTask = require('expo-background-fetch').unregisterTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockIsTaskRegistered.mockReturnValue(true);
      mockUnregisterTask.mockResolvedValue(undefined);

      const backgroundSyncStoppedSpy = jest.fn();
      backgroundTaskService.on('backgroundSyncStopped', backgroundSyncStoppedSpy);

      await backgroundTaskService.stopBackgroundSync();

      expect(mockUnregisterTask).toHaveBeenCalledWith(BackgroundTaskService.SYNC_TASK);
      expect(backgroundSyncStoppedSpy).toHaveBeenCalled();
    });
  });

  describe('app lifecycle handling', () => {
    beforeEach(async () => {
      const mockRequestPermissions = require('expo-background-fetch').requestPermissionsAsync;
      mockRequestPermissions.mockResolvedValue({ status: 'granted' });
      await backgroundTaskService.initialize();
    });

    it('should handle app going to background', async () => {
      const mockUseAppStore = require('../../../store').useAppStore;
      mockUseAppStore.getState.mockReturnValue({
        tracking: { status: 'active' },
      });

      const mockRegisterTask = require('expo-background-fetch').registerTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockIsTaskRegistered.mockReturnValue(false);
      mockRegisterTask.mockResolvedValue(undefined);

      const appStateChangedSpy = jest.fn();
      backgroundTaskService.on('appStateChanged', appStateChangedSpy);

      await backgroundTaskService.handleAppBackground();

      expect(appStateChangedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          current: 'background',
          isTrackingActive: expect.any(Boolean),
        })
      );
    });

    it('should handle app coming to foreground', async () => {
      const mockUnregisterTask = require('expo-background-fetch').unregisterTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockIsTaskRegistered.mockReturnValue(true);
      mockUnregisterTask.mockResolvedValue(undefined);

      const appStateChangedSpy = jest.fn();
      backgroundTaskService.on('appStateChanged', appStateChangedSpy);

      await backgroundTaskService.handleAppForeground();

      expect(appStateChangedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          current: 'active',
          backgroundDuration: expect.any(Number),
        })
      );
    });
  });

  describe('task status', () => {
    beforeEach(async () => {
      const mockRequestPermissions = require('expo-background-fetch').requestPermissionsAsync;
      mockRequestPermissions.mockResolvedValue({ status: 'granted' });
      await backgroundTaskService.initialize();
    });

    it('should get background task status', async () => {
      const mockGetStatus = require('expo-background-fetch').getStatusAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockGetStatus.mockResolvedValue(1); // Available
      mockIsTaskRegistered.mockReturnValue(true);

      const status = await backgroundTaskService.getBackgroundTaskStatus('test-task');

      expect(status).toEqual({
        isRegistered: true,
        isRunning: true,
        status: 'available',
      });
    });

    it('should handle denied status', async () => {
      const mockGetStatus = require('expo-background-fetch').getStatusAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockGetStatus.mockResolvedValue(2); // Denied
      mockIsTaskRegistered.mockReturnValue(false);

      const status = await backgroundTaskService.getBackgroundTaskStatus('test-task');

      expect(status).toEqual({
        isRegistered: false,
        isRunning: false,
        status: 'denied',
      });
    });
  });

  describe('app lifecycle state', () => {
    it('should return current app lifecycle state', () => {
      const state = backgroundTaskService.getAppLifecycleState();

      expect(state).toEqual({
        appState: 'active',
        isTrackingActive: false,
        lastActiveTime: expect.any(Date),
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources', async () => {
      const mockRequestPermissions = require('expo-background-fetch').requestPermissionsAsync;
      const mockUnregisterTask = require('expo-background-fetch').unregisterTaskAsync;
      const mockIsTaskRegistered = require('expo-task-manager').isTaskRegistered;
      
      mockRequestPermissions.mockResolvedValue({ status: 'granted' });
      mockIsTaskRegistered.mockReturnValue(true);
      mockUnregisterTask.mockResolvedValue(undefined);

      await backgroundTaskService.initialize();

      // Register a task
      await backgroundTaskService.registerBackgroundTask({
        taskName: 'test-task',
        interval: 5000,
      });

      await backgroundTaskService.cleanup();

      expect(mockUnregisterTask).toHaveBeenCalledWith('test-task');
    });
  });
});