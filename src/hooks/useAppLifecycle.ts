import { useEffect, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { appLifecycleService } from '../services/background/AppLifecycleService';
import { backgroundTaskService } from '../services/background/BackgroundTaskService';
import { useAppStore } from '../store';

export interface AppLifecycleState {
  appState: AppStateStatus;
  isInitialized: boolean;
  hasRecoveredFromCrash: boolean;
  backgroundDuration?: number;
}

export interface AppLifecycleConfig {
  enableAutoRecovery?: boolean;
  recoveryTimeoutMs?: number;
  maxRecoveryAttempts?: number;
}

/**
 * Hook for managing app lifecycle, crash recovery, and background processing
 */
export function useAppLifecycle(config?: AppLifecycleConfig) {
  const [lifecycleState, setLifecycleState] = useState<AppLifecycleState>({
    appState: AppState.currentState,
    isInitialized: false,
    hasRecoveredFromCrash: false,
  });

  const tracking = useAppStore((state) => state.tracking);

  // Initialize services
  useEffect(() => {
    let mounted = true;

    const initializeServices = async () => {
      try {
        // Initialize background task service
        await backgroundTaskService.initialize();

        // Initialize app lifecycle service with config
        await appLifecycleService.initialize(config);

        if (mounted) {
          setLifecycleState(prev => ({
            ...prev,
            isInitialized: true,
          }));
        }
      } catch (error) {
        console.error('Failed to initialize app lifecycle services:', error);
      }
    };

    initializeServices();

    return () => {
      mounted = false;
    };
  }, [config]);

  // Set up event listeners
  useEffect(() => {
    if (!lifecycleState.isInitialized) return;

    // App state change listener
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setLifecycleState(prev => ({
        ...prev,
        appState: nextAppState,
      }));
    };

    // Background service event listeners
    const handleAppStateChanged = (event: any) => {
      setLifecycleState(prev => ({
        ...prev,
        appState: event.current,
        backgroundDuration: event.backgroundDuration,
      }));
    };

    const handleCrashRecoverySuccessful = () => {
      setLifecycleState(prev => ({
        ...prev,
        hasRecoveredFromCrash: true,
      }));
    };

    const handleCrashRecoveryFailed = () => {
      setLifecycleState(prev => ({
        ...prev,
        hasRecoveredFromCrash: false,
      }));
    };

    // Set up listeners
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    backgroundTaskService.on('appStateChanged', handleAppStateChanged);
    appLifecycleService.on('crashRecoverySuccessful', handleCrashRecoverySuccessful);
    appLifecycleService.on('crashRecoveryFailed', handleCrashRecoveryFailed);

    return () => {
      appStateSubscription?.remove();
      backgroundTaskService.off('appStateChanged', handleAppStateChanged);
      appLifecycleService.off('crashRecoverySuccessful', handleCrashRecoverySuccessful);
      appLifecycleService.off('crashRecoveryFailed', handleCrashRecoveryFailed);
    };
  }, [lifecycleState.isInitialized]);

  // Auto-save tracking state when it changes
  useEffect(() => {
    if (!lifecycleState.isInitialized) return;

    const saveTrackingState = async () => {
      try {
        await appLifecycleService.saveTrackingStateForRecovery();
      } catch (error) {
        console.error('Failed to save tracking state for recovery:', error);
      }
    };

    // Debounce saves to avoid excessive writes
    const timeoutId = setTimeout(saveTrackingState, 1000);

    return () => clearTimeout(timeoutId);
  }, [tracking, lifecycleState.isInitialized]);

  // Manual recovery attempt
  const attemptRecovery = useCallback(async (): Promise<boolean> => {
    if (!lifecycleState.isInitialized) return false;

    try {
      const recovered = await appLifecycleService.attemptTrackingRecovery();
      
      if (recovered) {
        setLifecycleState(prev => ({
          ...prev,
          hasRecoveredFromCrash: true,
        }));
      }

      return recovered;
    } catch (error) {
      console.error('Failed to attempt recovery:', error);
      return false;
    }
  }, [lifecycleState.isInitialized]);

  // Manual cleanup
  const cleanupAbandonedSessions = useCallback(async (): Promise<void> => {
    if (!lifecycleState.isInitialized) return;

    try {
      await appLifecycleService.cleanupAbandonedSessions();
    } catch (error) {
      console.error('Failed to cleanup abandoned sessions:', error);
    }
  }, [lifecycleState.isInitialized]);

  // Get current app state info
  const getAppStateInfo = useCallback(() => {
    if (!lifecycleState.isInitialized) {
      return {
        currentState: AppState.currentState,
        lastActiveTime: Date.now(),
        isTrackingActive: false,
      };
    }

    return appLifecycleService.getAppState();
  }, [lifecycleState.isInitialized]);

  // Handle app crash (for manual crash reporting)
  const reportCrash = useCallback(async (crashReason?: string): Promise<void> => {
    if (!lifecycleState.isInitialized) return;

    try {
      await appLifecycleService.handleAppCrash(crashReason);
    } catch (error) {
      console.error('Failed to report crash:', error);
    }
  }, [lifecycleState.isInitialized]);

  return {
    // State
    ...lifecycleState,
    
    // Actions
    attemptRecovery,
    cleanupAbandonedSessions,
    getAppStateInfo,
    reportCrash,
  };
}