import { AppState, AppStateStatus } from 'react-native';
import { EventEmitter } from 'events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backgroundTaskService } from './BackgroundTaskService';
import { useAppStore } from '../../store';
import { locationService } from '../location/LocationService';

export interface AppLifecycleConfig {
  enableAutoRecovery: boolean;
  recoveryTimeoutMs: number;
  maxRecoveryAttempts: number;
  persistenceKey: string;
}

export interface TrackingRecoveryData {
  activityId: string;
  userId: string;
  startTime: number;
  pausedTime: number;
  lastPauseTime: number | null;
  trackPointCount: number;
  lastKnownLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
  appCrashTime?: number;
  recoveryAttempts: number;
}

export interface AppCrashInfo {
  timestamp: number;
  appState: AppStateStatus;
  wasTrackingActive: boolean;
  lastActiveTime: number;
  crashReason?: string;
}

/**
 * AppLifecycleService handles app lifecycle events, crash recovery,
 * and automatic tracking resume functionality.
 */
export class AppLifecycleService extends EventEmitter {
  private static instance: AppLifecycleService;
  private isInitialized = false;
  private config: AppLifecycleConfig;
  private appStateSubscription?: any;
  private currentAppState: AppStateStatus = 'active';
  private lastActiveTime = Date.now();
  private crashDetectionTimer?: NodeJS.Timeout;

  // Storage keys
  private static readonly RECOVERY_DATA_KEY = 'trailrun_recovery_data';
  private static readonly CRASH_INFO_KEY = 'trailrun_crash_info';
  private static readonly APP_STATE_KEY = 'trailrun_app_state';

  private constructor() {
    super();
    
    this.config = {
      enableAutoRecovery: true,
      recoveryTimeoutMs: 30000, // 30 seconds
      maxRecoveryAttempts: 3,
      persistenceKey: 'trailrun_lifecycle',
    };
  }

  public static getInstance(): AppLifecycleService {
    if (!AppLifecycleService.instance) {
      AppLifecycleService.instance = new AppLifecycleService();
    }
    return AppLifecycleService.instance;
  }

  /**
   * Initialize the app lifecycle service
   */
  public async initialize(config?: Partial<AppLifecycleConfig>): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      // Set up app state listeners
      this.setupAppStateListeners();

      // Check for crash recovery on startup
      await this.checkForCrashRecovery();

      // Start crash detection monitoring
      this.startCrashDetection();

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize AppLifecycleService: ${error}`);
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<AppLifecycleConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * Save tracking state for recovery
   */
  public async saveTrackingStateForRecovery(): Promise<void> {
    if (!this.config.enableAutoRecovery) {
      return;
    }

    try {
      const store = useAppStore.getState();
      const tracking = store.tracking;

      if (tracking.status === 'inactive' || !tracking.activity) {
        // Clear recovery data if no active tracking
        await AsyncStorage.removeItem(AppLifecycleService.RECOVERY_DATA_KEY);
        return;
      }

      const recoveryData: TrackingRecoveryData = {
        activityId: tracking.activity.activityId,
        userId: tracking.activity.userId,
        startTime: tracking.startTime || Date.now(),
        pausedTime: tracking.pausedTime,
        lastPauseTime: tracking.lastPauseTime,
        trackPointCount: tracking.trackPoints.length,
        lastKnownLocation: tracking.lastLocation ? {
          latitude: tracking.lastLocation.latitude,
          longitude: tracking.lastLocation.longitude,
          timestamp: tracking.lastLocation.timestamp.getTime(),
        } : undefined,
        recoveryAttempts: 0,
      };

      await AsyncStorage.setItem(
        AppLifecycleService.RECOVERY_DATA_KEY,
        JSON.stringify(recoveryData)
      );

      // Also save current app state
      await this.saveAppState();
    } catch (error) {
      console.error('Failed to save tracking state for recovery:', error);
    }
  }

  /**
   * Attempt to recover interrupted tracking session
   */
  public async attemptTrackingRecovery(): Promise<boolean> {
    if (!this.config.enableAutoRecovery) {
      return false;
    }

    try {
      const recoveryDataStr = await AsyncStorage.getItem(AppLifecycleService.RECOVERY_DATA_KEY);
      
      if (!recoveryDataStr) {
        return false;
      }

      const recoveryData: TrackingRecoveryData = JSON.parse(recoveryDataStr);

      // Check if recovery attempts exceeded
      if (recoveryData.recoveryAttempts >= this.config.maxRecoveryAttempts) {
        await this.clearRecoveryData();
        return false;
      }

      // Check if recovery timeout exceeded
      const timeSinceStart = Date.now() - recoveryData.startTime;
      if (timeSinceStart > this.config.recoveryTimeoutMs) {
        await this.clearRecoveryData();
        return false;
      }

      // Increment recovery attempts
      recoveryData.recoveryAttempts++;
      await AsyncStorage.setItem(
        AppLifecycleService.RECOVERY_DATA_KEY,
        JSON.stringify(recoveryData)
      );

      // Attempt to restore tracking session
      const success = await this.restoreTrackingSession(recoveryData);

      if (success) {
        await this.clearRecoveryData();
        this.emit('trackingRecovered', recoveryData);
      }

      return success;
    } catch (error) {
      console.error('Failed to attempt tracking recovery:', error);
      return false;
    }
  }

  /**
   * Handle app crash detection
   */
  public async handleAppCrash(crashReason?: string): Promise<void> {
    try {
      const crashInfo: AppCrashInfo = {
        timestamp: Date.now(),
        appState: this.currentAppState,
        wasTrackingActive: await this.isTrackingActive(),
        lastActiveTime: this.lastActiveTime,
        crashReason,
      };

      await AsyncStorage.setItem(
        AppLifecycleService.CRASH_INFO_KEY,
        JSON.stringify(crashInfo)
      );

      // Save current tracking state for recovery
      await this.saveTrackingStateForRecovery();

      this.emit('appCrashed', crashInfo);
    } catch (error) {
      console.error('Failed to handle app crash:', error);
    }
  }

  /**
   * Clean up abandoned tracking sessions
   */
  public async cleanupAbandonedSessions(): Promise<void> {
    try {
      const store = useAppStore.getState();
      
      // Check if there's an inactive tracking session that should be cleaned up
      if (store.tracking.status === 'inactive' && store.tracking.activity) {
        // Clear any stale tracking data
        store.resetTracking();
        await store.saveTrackingState();
      }

      // Clear old recovery data
      const recoveryDataStr = await AsyncStorage.getItem(AppLifecycleService.RECOVERY_DATA_KEY);
      
      if (recoveryDataStr) {
        const recoveryData: TrackingRecoveryData = JSON.parse(recoveryDataStr);
        const timeSinceStart = Date.now() - recoveryData.startTime;
        
        // Clean up recovery data older than 24 hours
        if (timeSinceStart > 24 * 60 * 60 * 1000) {
          await this.clearRecoveryData();
        }
      }

      // Clear old crash info
      const crashInfoStr = await AsyncStorage.getItem(AppLifecycleService.CRASH_INFO_KEY);
      
      if (crashInfoStr) {
        const crashInfo: AppCrashInfo = JSON.parse(crashInfoStr);
        const timeSinceCrash = Date.now() - crashInfo.timestamp;
        
        // Clean up crash info older than 7 days
        if (timeSinceCrash > 7 * 24 * 60 * 60 * 1000) {
          await AsyncStorage.removeItem(AppLifecycleService.CRASH_INFO_KEY);
        }
      }

      this.emit('cleanupCompleted');
    } catch (error) {
      console.error('Failed to cleanup abandoned sessions:', error);
    }
  }

  /**
   * Get current app lifecycle state
   */
  public getAppState(): {
    currentState: AppStateStatus;
    lastActiveTime: number;
    isTrackingActive: boolean;
  } {
    return {
      currentState: this.currentAppState,
      lastActiveTime: this.lastActiveTime,
      isTrackingActive: this.isTrackingActiveSync(),
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    if (this.crashDetectionTimer) {
      clearInterval(this.crashDetectionTimer);
    }

    this.isInitialized = false;
  }

  // MARK: - Private Methods

  private setupAppStateListeners(): void {
    this.currentAppState = AppState.currentState;
    
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      this.handleAppStateChange(nextAppState);
    });
  }

  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    const previousState = this.currentAppState;
    this.currentAppState = nextAppState;

    try {
      switch (nextAppState) {
        case 'active':
          this.lastActiveTime = Date.now();
          await backgroundTaskService.handleAppForeground();
          
          // Check for crash recovery when app becomes active
          await this.checkForCrashRecovery();
          break;

        case 'background':
          await backgroundTaskService.handleAppBackground();
          await this.saveAppState();
          await this.saveTrackingStateForRecovery();
          break;

        case 'inactive':
          backgroundTaskService.handleAppInactive();
          break;
      }

      this.emit('appStateChanged', {
        previous: previousState,
        current: nextAppState,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error handling app state change:', error);
    }
  }

  private async checkForCrashRecovery(): Promise<void> {
    try {
      const crashInfoStr = await AsyncStorage.getItem(AppLifecycleService.CRASH_INFO_KEY);
      
      if (crashInfoStr) {
        const crashInfo: AppCrashInfo = JSON.parse(crashInfoStr);
        
        // Check if crash was recent and tracking was active
        const timeSinceCrash = Date.now() - crashInfo.timestamp;
        const shouldAttemptRecovery = crashInfo.wasTrackingActive && 
                                    timeSinceCrash < this.config.recoveryTimeoutMs;

        if (shouldAttemptRecovery) {
          const recovered = await this.attemptTrackingRecovery();
          
          if (recovered) {
            this.emit('crashRecoverySuccessful', crashInfo);
          } else {
            this.emit('crashRecoveryFailed', crashInfo);
          }
        }

        // Clear crash info after processing
        await AsyncStorage.removeItem(AppLifecycleService.CRASH_INFO_KEY);
      }
    } catch (error) {
      console.error('Failed to check for crash recovery:', error);
    }
  }

  private async restoreTrackingSession(recoveryData: TrackingRecoveryData): Promise<boolean> {
    try {
      const store = useAppStore.getState();

      // Check if there's already an active tracking session
      if (store.tracking.status !== 'inactive') {
        return false;
      }

      // Restore tracking state from persisted data
      await store.restoreTrackingState();

      // Verify that the restored state matches recovery data
      const restoredTracking = useAppStore.getState().tracking;
      
      if (!restoredTracking.activity || 
          restoredTracking.activity.activityId !== recoveryData.activityId) {
        return false;
      }

      // Resume location tracking if it was active
      if (restoredTracking.status === 'active') {
        await locationService.resumeTracking();
      }

      return true;
    } catch (error) {
      console.error('Failed to restore tracking session:', error);
      return false;
    }
  }

  private async clearRecoveryData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AppLifecycleService.RECOVERY_DATA_KEY);
    } catch (error) {
      console.error('Failed to clear recovery data:', error);
    }
  }

  private async saveAppState(): Promise<void> {
    try {
      const appState = {
        currentState: this.currentAppState,
        lastActiveTime: this.lastActiveTime,
        timestamp: Date.now(),
      };

      await AsyncStorage.setItem(
        AppLifecycleService.APP_STATE_KEY,
        JSON.stringify(appState)
      );
    } catch (error) {
      console.error('Failed to save app state:', error);
    }
  }

  private async isTrackingActive(): Promise<boolean> {
    try {
      const store = useAppStore.getState();
      return store.tracking.status === 'active' || store.tracking.status === 'paused';
    } catch (error) {
      return false;
    }
  }

  private isTrackingActiveSync(): boolean {
    try {
      const store = useAppStore.getState();
      return store.tracking.status === 'active' || store.tracking.status === 'paused';
    } catch (error) {
      return false;
    }
  }

  private startCrashDetection(): void {
    // Set up periodic crash detection
    this.crashDetectionTimer = setInterval(() => {
      this.updateHeartbeat();
    }, 5000); // Update heartbeat every 5 seconds
  }

  private updateHeartbeat(): void {
    // Update heartbeat timestamp for crash detection
    // This would be used by native modules to detect app crashes
    try {
      AsyncStorage.setItem('trailrun_heartbeat', Date.now().toString());
    } catch (error) {
      // Ignore heartbeat errors
    }
  }
}

// Export singleton instance
export const appLifecycleService = AppLifecycleService.getInstance();