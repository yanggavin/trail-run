// Service interfaces - implementations will be added in later tasks

export interface LocationService {
  startTracking(config: TrackingConfig): Promise<void>;
  stopTracking(): Promise<Activity>;
  pauseTracking(): void;
  resumeTracking(): void;
  getCurrentLocation(): Promise<Location>;
  getTrackingStatus(): TrackingStatus;
}

export interface PhotoService {
  capturePhoto(location: Location): Promise<Photo>;
  getPhotosForActivity(activityId: string): Promise<Photo[]>;
  generateThumbnail(photoUri: string): Promise<string>;
  stripExifData(photoUri: string): Promise<string>;
}

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
