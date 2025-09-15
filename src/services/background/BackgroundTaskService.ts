import { Platform } from 'react-native';
import { EventEmitter } from 'events';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { locationService } from '../location/LocationService';
import { useAppStore } from '../../store';

export interface BackgroundTaskConfig {
  taskName: string;
  interval: number; // milliseconds
  minimumInterval?: number; // minimum interval for iOS background app refresh
}

export interface BackgroundTaskStatus {
  isRegistered: boolean;
  isRunning: boolean;
  lastExecution?: Date;
  nextExecution?: Date;
  status: 'available' | 'denied' | 'restricted';
}

export interface AppLifecycleState {
  appState: 'active' | 'background' | 'inactive';
  isTrackingActive: boolean;
  lastActiveTime: Date;
  backgroundStartTime?: Date;
}

/**
 * BackgroundTaskService manages background processing for GPS tracking,
 * app lifecycle events, and background sync operations.
 */
export class BackgroundTaskService extends EventEmitter {
  private static instance: BackgroundTaskService;
  private isInitialized = false;
  private registeredTasks = new Map<string, BackgroundTaskConfig>();
  private appLifecycleState: AppLifecycleState = {
    appState: 'active',
    isTrackingActive: false,
    lastActiveTime: new Date(),
  };

  // Task names
  public static readonly LOCATION_TRACKING_TASK = 'location-tracking-background';
  public static readonly SYNC_TASK = 'background-sync';
  public static readonly CLEANUP_TASK = 'background-cleanup';

  private constructor() {
    super();
  }

  public static getInstance(): BackgroundTaskService {
    if (!BackgroundTaskService.instance) {
      BackgroundTaskService.instance = new BackgroundTaskService();
    }
    return BackgroundTaskService.instance;
  }

  /**
   * Initialize the background task service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Register task handlers
      this.registerTaskHandlers();

      // Set up app state change listeners
      this.setupAppStateListeners();

      // Request background permissions
      await this.requestBackgroundPermissions();

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize BackgroundTaskService: ${error}`);
    }
  }

  /**
   * Register a background task
   */
  public async registerBackgroundTask(config: BackgroundTaskConfig): Promise<void> {
    await this.initialize();

    try {
      // Register with TaskManager
      if (!TaskManager.isTaskRegistered(config.taskName)) {
        await BackgroundFetch.registerTaskAsync(config.taskName, {
          minimumInterval: config.minimumInterval || 15000, // 15 seconds minimum
          stopOnTerminate: false,
          startOnBoot: true,
        });
      }

      this.registeredTasks.set(config.taskName, config);
      this.emit('taskRegistered', config.taskName);
    } catch (error) {
      throw new Error(`Failed to register background task ${config.taskName}: ${error}`);
    }
  }

  /**
   * Unregister a background task
   */
  public async unregisterBackgroundTask(taskName: string): Promise<void> {
    try {
      if (TaskManager.isTaskRegistered(taskName)) {
        await BackgroundFetch.unregisterTaskAsync(taskName);
      }

      this.registeredTasks.delete(taskName);
      this.emit('taskUnregistered', taskName);
    } catch (error) {
      throw new Error(`Failed to unregister background task ${taskName}: ${error}`);
    }
  }

  /**
   * Start location tracking in background
   */
  public async startBackgroundLocationTracking(): Promise<void> {
    await this.initialize();

    const config: BackgroundTaskConfig = {
      taskName: BackgroundTaskService.LOCATION_TRACKING_TASK,
      interval: 5000, // 5 seconds
      minimumInterval: 15000, // iOS minimum
    };

    await this.registerBackgroundTask(config);
    
    this.appLifecycleState.isTrackingActive = true;
    this.emit('backgroundTrackingStarted');
  }

  /**
   * Stop location tracking in background
   */
  public async stopBackgroundLocationTracking(): Promise<void> {
    await this.unregisterBackgroundTask(BackgroundTaskService.LOCATION_TRACKING_TASK);
    
    this.appLifecycleState.isTrackingActive = false;
    this.emit('backgroundTrackingStopped');
  }

  /**
   * Start background sync
   */
  public async startBackgroundSync(): Promise<void> {
    await this.initialize();

    const config: BackgroundTaskConfig = {
      taskName: BackgroundTaskService.SYNC_TASK,
      interval: 300000, // 5 minutes
      minimumInterval: 300000,
    };

    await this.registerBackgroundTask(config);
    this.emit('backgroundSyncStarted');
  }

  /**
   * Stop background sync
   */
  public async stopBackgroundSync(): Promise<void> {
    await this.unregisterBackgroundTask(BackgroundTaskService.SYNC_TASK);
    this.emit('backgroundSyncStopped');
  }

  /**
   * Get background task status
   */
  public async getBackgroundTaskStatus(taskName: string): Promise<BackgroundTaskStatus> {
    const status = await BackgroundFetch.getStatusAsync();
    const isRegistered = TaskManager.isTaskRegistered(taskName);

    return {
      isRegistered,
      isRunning: isRegistered && status === BackgroundFetch.BackgroundFetchStatus.Available,
      status: this.mapBackgroundFetchStatus(status),
    };
  }

  /**
   * Get app lifecycle state
   */
  public getAppLifecycleState(): AppLifecycleState {
    return { ...this.appLifecycleState };
  }

  /**
   * Handle app going to background
   */
  public async handleAppBackground(): Promise<void> {
    const previousState = this.appLifecycleState.appState;
    
    this.appLifecycleState = {
      ...this.appLifecycleState,
      appState: 'background',
      backgroundStartTime: new Date(),
    };

    // Start background location tracking if tracking is active
    const store = useAppStore.getState();
    if (store.tracking.status === 'active') {
      await this.startBackgroundLocationTracking();
    }

    // Start background sync
    await this.startBackgroundSync();

    this.emit('appStateChanged', {
      previous: previousState,
      current: 'background',
      isTrackingActive: this.appLifecycleState.isTrackingActive,
    });
  }

  /**
   * Handle app coming to foreground
   */
  public async handleAppForeground(): Promise<void> {
    const previousState = this.appLifecycleState.appState;
    const backgroundDuration = this.appLifecycleState.backgroundStartTime
      ? Date.now() - this.appLifecycleState.backgroundStartTime.getTime()
      : 0;

    this.appLifecycleState = {
      ...this.appLifecycleState,
      appState: 'active',
      lastActiveTime: new Date(),
      backgroundStartTime: undefined,
    };

    // Stop background tasks when app becomes active
    if (this.registeredTasks.has(BackgroundTaskService.LOCATION_TRACKING_TASK)) {
      await this.stopBackgroundLocationTracking();
    }

    this.emit('appStateChanged', {
      previous: previousState,
      current: 'active',
      backgroundDuration,
      isTrackingActive: this.appLifecycleState.isTrackingActive,
    });
  }

  /**
   * Handle app becoming inactive (iOS only)
   */
  public handleAppInactive(): void {
    const previousState = this.appLifecycleState.appState;
    
    this.appLifecycleState = {
      ...this.appLifecycleState,
      appState: 'inactive',
    };

    this.emit('appStateChanged', {
      previous: previousState,
      current: 'inactive',
      isTrackingActive: this.appLifecycleState.isTrackingActive,
    });
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    // Unregister all tasks
    for (const taskName of this.registeredTasks.keys()) {
      await this.unregisterBackgroundTask(taskName);
    }

    this.registeredTasks.clear();
    this.isInitialized = false;
  }

  // MARK: - Private Methods

  private registerTaskHandlers(): void {
    // Location tracking task handler
    TaskManager.defineTask(BackgroundTaskService.LOCATION_TRACKING_TASK, async () => {
      try {
        const store = useAppStore.getState();
        
        // Only continue if tracking is active
        if (store.tracking.status !== 'active') {
          return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // Get current location
        const location = await locationService.getCurrentLocation();
        
        if (location && location.source !== 'error' && location.source !== 'unavailable') {
          // Add track point to store
          const trackPoint = {
            timestamp: new Date(location.timestamp),
            latitude: location.latitude,
            longitude: location.longitude,
            altitude: location.altitude,
            accuracy: location.accuracy,
            speed: location.speed,
            heading: location.heading,
          };

          store.addTrackPoint(trackPoint);
          
          // Save state for persistence
          await store.saveTrackingState();
        }

        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('Background location tracking error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    // Background sync task handler
    TaskManager.defineTask(BackgroundTaskService.SYNC_TASK, async () => {
      try {
        // Import sync service dynamically to avoid circular dependencies
        const { syncService } = await import('../sync/SyncService');
        
        // Perform background sync
        await syncService.performBackgroundSync();
        
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('Background sync error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    // Cleanup task handler
    TaskManager.defineTask(BackgroundTaskService.CLEANUP_TASK, async () => {
      try {
        // Perform cleanup operations
        await this.performBackgroundCleanup();
        
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('Background cleanup error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }

  private setupAppStateListeners(): void {
    if (Platform.OS === 'ios') {
      // iOS app state handling is done through native modules
      // This would be implemented in the native iOS module
    } else if (Platform.OS === 'android') {
      // Android app state handling is done through native modules
      // This would be implemented in the native Android module
    }
  }

  private async requestBackgroundPermissions(): Promise<void> {
    try {
      const { status } = await BackgroundFetch.requestPermissionsAsync();
      
      if (status !== 'granted') {
        console.warn('Background fetch permission not granted');
      }
    } catch (error) {
      console.error('Failed to request background permissions:', error);
    }
  }

  private mapBackgroundFetchStatus(status: BackgroundFetch.BackgroundFetchStatus): 'available' | 'denied' | 'restricted' {
    switch (status) {
      case BackgroundFetch.BackgroundFetchStatus.Available:
        return 'available';
      case BackgroundFetch.BackgroundFetchStatus.Denied:
        return 'denied';
      case BackgroundFetch.BackgroundFetchStatus.Restricted:
        return 'restricted';
      default:
        return 'denied';
    }
  }

  private async performBackgroundCleanup(): Promise<void> {
    try {
      // Clean up old tracking data
      const store = useAppStore.getState();
      
      // If no active tracking session, clear any stale state
      if (store.tracking.status === 'inactive') {
        // Clear any persisted state that might be stale
        await store.saveTrackingState();
      }

      // Additional cleanup operations can be added here
      this.emit('backgroundCleanupCompleted');
    } catch (error) {
      console.error('Background cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const backgroundTaskService = BackgroundTaskService.getInstance();