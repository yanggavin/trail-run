// Service interfaces - implementations will be added in later tasks

// LocationService implementation
export { LocationService, locationService } from './location';
export type {
  Location as LocationData,
  LocationConfig,
  LocationServiceConfig,
  PermissionStatus,
  TrackingStatus as LocationTrackingStatus,
} from './location';

// PhotoService is now implemented - see photo services exports below

export interface ActivityService {
  createActivity(): Promise<Activity>;
  updateActivity(id: string, data: Partial<Activity>): Promise<Activity>;
  finalizeActivity(id: string): Promise<RoutineRecord>;
  getActivities(pagination: PaginationParams): Promise<Activity[]>;
  deleteActivity(id: string): Promise<void>;
}

export interface SyncService {
  syncActivity(activity: Activity): Promise<void>;
  syncPhotos(photos: Photo[]): Promise<void>;
  handleConflictResolution(conflict: SyncConflict): Promise<void>;
  getUploadQueue(): Promise<SyncItem[]>;
}

// Import types
import {
  TrackingConfig,
  Location,
  TrackingStatus,
  Activity,
  Photo,
} from '../types';

// Additional types for services
export interface RoutineRecord extends Activity {
  // Extended activity data for completed runs
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SyncConflict {
  localData: any;
  serverData: any;
  conflictType: string;
}

export interface SyncItem {
  id: string;
  type: 'activity' | 'photo';
  data: any;
  retryCount: number;
}

// Database services
export { DatabaseService, getDatabaseService, initializeDatabase } from './database/DatabaseService';
export type { DatabaseConfig, Migration } from './database/DatabaseService';

// Repository services
export { 
  ActivityRepository, 
  PhotoRepository, 
  TrackPointRepository 
} from './repositories';

export type { 
  ActivityFilters, 
  ActivityStats, 
  PhotoFilters, 
  TrackPointFilters, 
  TrackPointBatch 
} from './repositories';

// Photo services
export { 
  CameraPermissionService, 
  CameraConfigService,
  PhotoService,
  PhotoStorageService 
} from './photo';

export type { 
  PermissionStatus as CameraPermissionStatus, 
  CameraConfig, 
  OptimalCameraSettings,
  PhotoCaptureOptions,
  PhotoCaptureResult,
  PhotoStorageStats,
  BatchOperationResult 
} from './photo';
