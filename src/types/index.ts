// Core data models
export interface Location {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
  timestamp: Date;
}

export interface TrackPoint extends Location {
  speed?: number;
  heading?: number;
  source: 'gps' | 'network' | 'passive';
}

export interface Activity {
  activityId: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  status: 'active' | 'paused' | 'completed';
  durationSec: number;
  distanceM: number;
  avgPaceSecPerKm: number;
  elevGainM: number;
  elevLossM: number;
  polyline?: string;
  bounds?: BoundingBox;
  splitKm: Split[];
  coverPhotoId?: string;
  deviceMeta: DeviceMeta;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'local' | 'syncing' | 'synced';
}

export interface Photo {
  photoId: string;
  activityId: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  localUri: string;
  cloudUri?: string;
  thumbnailUri?: string;
  exifData?: ExifData;
  caption?: string;
  syncStatus: 'local' | 'uploading' | 'synced';
}

// API/Database format interfaces for data transformation
export interface ActivityApiFormat {
  activity_id: string;
  user_id: string;
  started_at: string; // ISO string
  ended_at?: string;
  status: string;
  duration_sec: number;
  distance_m: number;
  avg_pace_sec_per_km: number;
  elev_gain_m: number;
  elev_loss_m: number;
  polyline?: string;
  bounds?: string; // JSON string
  splits: string; // JSON string
  cover_photo_id?: string;
  device_meta: string; // JSON string
  created_at: string; // ISO string
  updated_at: string; // ISO string
  sync_status: string;
}

export interface PhotoApiFormat {
  photo_id: string;
  activity_id: string;
  timestamp: string; // ISO string
  latitude: number;
  longitude: number;
  local_uri: string;
  cloud_uri?: string;
  thumbnail_uri?: string;
  exif_data?: string; // JSON string
  caption?: string;
  sync_status: string;
}

export interface TrackPointApiFormat {
  id?: number;
  activity_id: string;
  timestamp: string; // ISO string
  latitude: number;
  longitude: number;
  elevation?: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  source: string;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Split {
  kmIndex: number;
  durationSec: number;
  paceSecPerKm: number;
}

export interface DeviceMeta {
  platform: 'ios' | 'android';
  version: string;
  model: string;
}

export interface ExifData {
  [key: string]: any;
}

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Camera: { activityId: string };
  ActivityDetail: { activityId: string };
  History: undefined;
  Settings: undefined;
};

// Service interfaces
export interface TrackingConfig {
  accuracy: 'high' | 'balanced' | 'low';
  interval: number;
  distanceFilter: number;
  adaptiveThrottling: boolean;
}

export type TrackingStatus = 'inactive' | 'active' | 'paused';

export type PermissionStatus =
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'undetermined';

// Re-export model utilities
export * from './models';
