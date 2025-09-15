import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useAppLifecycle } from '../useAppLifecycle';

// Mock dependencies
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
  },
}));

jest.mock('../../services/background/BackgroundTaskService', () => ({
  backgroundTaskService: {
    initialize: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('../../services/background/AppLifecycleService', () => ({
  appLifecycleService: {
    initialize: jest.fn(),
    saveTrackingStateForRecovery: jest.fn(),
    attemptTrackingRecovery: jest.fn(),
    cleanupAbandonedSessions: jest.fn(),
    getAppState: jest.fn(),
    handleAppCrash: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('../../store', () => ({
  useAppStore: jest.fn(),
}));

describe('useAppLifecycle', () => {
  const mockBackgroundTaskService = require('../../services/background/BackgroundTaskService').backgroundTaskService;
  const mockAppLifecycleService = require('../../services/background/AppLifecycleService').appLifecycleService;
  const mockUseAppStore = require('../../store').useAppStore;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful initialization
    mockBackgroundTaskService.initialize.mockResolvedValue(undefined);
    mockAppLifecycleService.initialize.mockResolvedValue(undefined);
    
    // Mock store state
    mockUseAppStore.mockReturnValue({
      status: 'inactive',
      activity: null,
    });

    // Mock AppState
    const mockAppState = AppState as jest.Mocked<typeof AppState>;
    mockAppState.addEventListener.mockReturnValue({
      remove: jest.fn(),
    });
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAppLifecycle());

      expect(result.current.appState).toBe('active');
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.hasRecoveredFromCrash).toBe(false);
    });

    it('should initialize services successfully', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      expect(mockBackgroundTaskService.initialize).toHaveBeenCalled();
      expect(mockAppLifecycleService.initialize).toHaveBeenCalled();
      expect(result.current.isInitialized).toBe(true);
    });

    it('should initialize with custom config', async () => {
      const config = {
        enableAutoRecovery: false,
        recoveryTimeoutMs: 60000,
        maxRecoveryAttempts: 5,
      };

      const { waitForNextUpdate } = renderHook(() => useAppLifecycle(config));

      await waitForNextUpdate();

      expect(mockAppLifecycleService.initialize).toHaveBeenCalledWith(config);
    });

    it('should handle initialization errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockBackgroundTaskService.initialize.mockRejectedValue(new Error('Init failed'));

      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      expect(result.current.isInitialized).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize app lifecycle services:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('event listeners', () => {
    it('should set up event listeners after initialization', async () => {
      const { waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      expect(mockBackgroundTaskService.on).toHaveBeenCalledWith('appStateChanged', expect.any(Function));
      expect(mockAppLifecycleService.on).toHaveBeenCalledWith('crashRecoverySuccessful', expect.any(Function));
      expect(mockAppLifecycleService.on).toHaveBeenCalledWith('crashRecoveryFailed', expect.any(Function));
    });

    it('should handle app state changes', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      // Simulate app state change event
      const appStateChangeHandler = mockBackgroundTaskService.on.mock.calls
        .find(call => call[0] === 'appStateChanged')?.[1];

      act(() => {
        appStateChangeHandler?.({
          current: 'background',
          backgroundDuration: 5000,
        });
      });

      expect(result.current.appState).toBe('background');
      expect(result.current.backgroundDuration).toBe(5000);
    });

    it('should handle crash recovery events', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      // Simulate crash recovery successful
      const recoverySuccessHandler = mockAppLifecycleService.on.mock.calls
        .find(call => call[0] === 'crashRecoverySuccessful')?.[1];

      act(() => {
        recoverySuccessHandler?.();
      });

      expect(result.current.hasRecoveredFromCrash).toBe(true);

      // Simulate crash recovery failed
      const recoveryFailedHandler = mockAppLifecycleService.on.mock.calls
        .find(call => call[0] === 'crashRecoveryFailed')?.[1];

      act(() => {
        recoveryFailedHandler?.();
      });

      expect(result.current.hasRecoveredFromCrash).toBe(false);
    });
  });

  describe('tracking state auto-save', () => {
    it('should save tracking state when it changes', async () => {
      mockUseAppStore.mockReturnValue({
        status: 'active',
        activity: { activityId: 'test' },
      });

      const { waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      // Wait for debounced save
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });

      expect(mockAppLifecycleService.saveTrackingStateForRecovery).toHaveBeenCalled();
    });
  });

  describe('manual actions', () => {
    it('should attempt recovery', async () => {
      mockAppLifecycleService.attemptTrackingRecovery.mockResolvedValue(true);

      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      let recoveryResult: boolean;
      await act(async () => {
        recoveryResult = await result.current.attemptRecovery();
      });

      expect(recoveryResult!).toBe(true);
      expect(result.current.hasRecoveredFromCrash).toBe(true);
      expect(mockAppLifecycleService.attemptTrackingRecovery).toHaveBeenCalled();
    });

    it('should handle recovery failure', async () => {
      mockAppLifecycleService.attemptTrackingRecovery.mockResolvedValue(false);

      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      let recoveryResult: boolean;
      await act(async () => {
        recoveryResult = await result.current.attemptRecovery();
      });

      expect(recoveryResult!).toBe(false);
      expect(result.current.hasRecoveredFromCrash).toBe(false);
    });

    it('should cleanup abandoned sessions', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      await act(async () => {
        await result.current.cleanupAbandonedSessions();
      });

      expect(mockAppLifecycleService.cleanupAbandonedSessions).toHaveBeenCalled();
    });

    it('should get app state info', async () => {
      const mockAppState = {
        currentState: 'active',
        lastActiveTime: Date.now(),
        isTrackingActive: false,
      };
      mockAppLifecycleService.getAppState.mockReturnValue(mockAppState);

      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      const appState = result.current.getAppStateInfo();

      expect(appState).toEqual(mockAppState);
      expect(mockAppLifecycleService.getAppState).toHaveBeenCalled();
    });

    it('should report crashes', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      await act(async () => {
        await result.current.reportCrash('Out of memory');
      });

      expect(mockAppLifecycleService.handleAppCrash).toHaveBeenCalledWith('Out of memory');
    });
  });

  describe('error handling', () => {
    it('should handle recovery errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAppLifecycleService.attemptTrackingRecovery.mockRejectedValue(new Error('Recovery failed'));

      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      let recoveryResult: boolean;
      await act(async () => {
        recoveryResult = await result.current.attemptRecovery();
      });

      expect(recoveryResult!).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to attempt recovery:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle cleanup errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAppLifecycleService.cleanupAbandonedSessions.mockRejectedValue(new Error('Cleanup failed'));

      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      await act(async () => {
        await result.current.cleanupAbandonedSessions();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to cleanup abandoned sessions:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle crash reporting errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAppLifecycleService.handleAppCrash.mockRejectedValue(new Error('Crash report failed'));

      const { result, waitForNextUpdate } = renderHook(() => useAppLifecycle());

      await waitForNextUpdate();

      await act(async () => {
        await result.current.reportCrash('Test crash');
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to report crash:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('uninitialized state handling', () => {
    it('should return false for actions when not initialized', async () => {
      mockBackgroundTaskService.initialize.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useAppLifecycle());

      const recoveryResult = await result.current.attemptRecovery();
      expect(recoveryResult).toBe(false);

      await result.current.cleanupAbandonedSessions(); // Should not throw

      const appState = result.current.getAppStateInfo();
      expect(appState.currentState).toBe('active');
      expect(appState.isTrackingActive).toBe(false);

      await result.current.reportCrash('test'); // Should not throw
    });
  });
});