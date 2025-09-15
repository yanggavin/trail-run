// Background services exports
export { BackgroundTaskService, backgroundTaskService } from './BackgroundTaskService';
export { AppLifecycleService, appLifecycleService } from './AppLifecycleService';

// Export types
export type {
  BackgroundTaskConfig,
  BackgroundTaskStatus,
  AppLifecycleState,
} from './BackgroundTaskService';

export type {
  AppLifecycleConfig,
  TrackingRecoveryData,
  AppCrashInfo,
} from './AppLifecycleService';