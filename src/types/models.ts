import { 
  Activity, 
  Photo, 
  TrackPoint, 
  ActivityApiFormat, 
  PhotoApiFormat, 
  TrackPointApiFormat,
  DeviceMeta,
  BoundingBox,
  Split,
  ExifData
} from './index';

// Validation functions
export class ValidationError extends Error {
  constructor(field: string, value: any, reason: string) {
    super(`Validation failed for field '${field}': ${reason}. Got: ${value}`);
    this.name = 'ValidationError';
  }
}

export const validateLatitude = (lat: number): boolean => {
  return typeof lat === 'number' && lat >= -90 && lat <= 90;
};

export const validateLongitude = (lng: number): boolean => {
  return typeof lng === 'number' && lng >= -180 && lng <= 180;
};

export const validateAccuracy = (accuracy: number): boolean => {
  return typeof accuracy === 'number' && accuracy >= 0;
};

export const validateSpeed = (speed?: number): boolean => {
  return speed === undefined || (typeof speed === 'number' && speed >= 0);
};

export const validateHeading = (heading?: number): boolean => {
  return heading === undefined || (typeof heading === 'number' && heading >= 0 && heading < 360);
};

export const validateActivityStatus = (status: string): status is Activity['status'] => {
  return ['active', 'paused', 'completed'].includes(status);
};

export const validateSyncStatus = (status: string): status is Activity['syncStatus'] => {
  return ['local', 'syncing', 'synced'].includes(status);
};

export const validatePhotoSyncStatus = (status: string): status is Photo['syncStatus'] => {
  return ['local', 'uploading', 'synced'].includes(status);
};

export const validateTrackPointSource = (source: string): source is TrackPoint['source'] => {
  return ['gps', 'network', 'passive'].includes(source);
};

// Validation functions for complete models
export const validateActivity = (activity: Partial<Activity>): void => {
  if (!activity.activityId || typeof activity.activityId !== 'string') {
    throw new ValidationError('activityId', activity.activityId, 'must be a non-empty string');
  }
  
  if (!activity.userId || typeof activity.userId !== 'string') {
    throw new ValidationError('userId', activity.userId, 'must be a non-empty string');
  }
  
  if (!activity.startedAt || !(activity.startedAt instanceof Date)) {
    throw new ValidationError('startedAt', activity.startedAt, 'must be a valid Date');
  }
  
  if (activity.endedAt && !(activity.endedAt instanceof Date)) {
    throw new ValidationError('endedAt', activity.endedAt, 'must be a valid Date or undefined');
  }
  
  if (!validateActivityStatus(activity.status || '')) {
    throw new ValidationError('status', activity.status, 'must be active, paused, or completed');
  }
  
  if (typeof activity.durationSec !== 'number' || activity.durationSec < 0) {
    throw new ValidationError('durationSec', activity.durationSec, 'must be a non-negative number');
  }
  
  if (typeof activity.distanceM !== 'number' || activity.distanceM < 0) {
    throw new ValidationError('distanceM', activity.distanceM, 'must be a non-negative number');
  }
};

export const validatePhoto = (photo: Partial<Photo>): void => {
  if (!photo.photoId || typeof photo.photoId !== 'string') {
    throw new ValidationError('photoId', photo.photoId, 'must be a non-empty string');
  }
  
  if (!photo.activityId || typeof photo.activityId !== 'string') {
    throw new ValidationError('activityId', photo.activityId, 'must be a non-empty string');
  }
  
  if (!photo.timestamp || !(photo.timestamp instanceof Date)) {
    throw new ValidationError('timestamp', photo.timestamp, 'must be a valid Date');
  }
  
  if (!validateLatitude(photo.latitude || NaN)) {
    throw new ValidationError('latitude', photo.latitude, 'must be a valid latitude (-90 to 90)');
  }
  
  if (!validateLongitude(photo.longitude || NaN)) {
    throw new ValidationError('longitude', photo.longitude, 'must be a valid longitude (-180 to 180)');
  }
  
  if (!photo.localUri || typeof photo.localUri !== 'string') {
    throw new ValidationError('localUri', photo.localUri, 'must be a non-empty string');
  }
};

export const validateTrackPoint = (trackPoint: Partial<TrackPoint>): void => {
  if (!validateLatitude(trackPoint.latitude || NaN)) {
    throw new ValidationError('latitude', trackPoint.latitude, 'must be a valid latitude (-90 to 90)');
  }
  
  if (!validateLongitude(trackPoint.longitude || NaN)) {
    throw new ValidationError('longitude', trackPoint.longitude, 'must be a valid longitude (-180 to 180)');
  }
  
  if (!validateAccuracy(trackPoint.accuracy || NaN)) {
    throw new ValidationError('accuracy', trackPoint.accuracy, 'must be a non-negative number');
  }
  
  if (!validateSpeed(trackPoint.speed)) {
    throw new ValidationError('speed', trackPoint.speed, 'must be a non-negative number or undefined');
  }
  
  if (!validateHeading(trackPoint.heading)) {
    throw new ValidationError('heading', trackPoint.heading, 'must be between 0-359 degrees or undefined');
  }
  
  if (!validateTrackPointSource(trackPoint.source || '')) {
    throw new ValidationError('source', trackPoint.source, 'must be gps, network, or passive');
  }
  
  if (!trackPoint.timestamp || !(trackPoint.timestamp instanceof Date)) {
    throw new ValidationError('timestamp', trackPoint.timestamp, 'must be a valid Date');
  }
};

// Factory functions for model instantiation with defaults
export const createActivity = (params: {
  activityId: string;
  userId: string;
  startedAt?: Date;
  deviceMeta?: DeviceMeta;
}): Activity => {
  const now = new Date();
  
  const activity: Activity = {
    activityId: params.activityId,
    userId: params.userId,
    startedAt: params.startedAt || now,
    status: 'active',
    durationSec: 0,
    distanceM: 0,
    avgPaceSecPerKm: 0,
    elevGainM: 0,
    elevLossM: 0,
    splitKm: [],
    deviceMeta: params.deviceMeta || {
      platform: 'ios', // Default, should be set by platform detection
      version: '1.0.0',
      model: 'unknown'
    },
    createdAt: now,
    updatedAt: now,
    syncStatus: 'local'
  };
  
  validateActivity(activity);
  return activity;
};

export const createPhoto = (params: {
  photoId: string;
  activityId: string;
  latitude: number;
  longitude: number;
  localUri: string;
  timestamp?: Date;
  exifData?: ExifData;
}): Photo => {
  const photo: Photo = {
    photoId: params.photoId,
    activityId: params.activityId,
    timestamp: params.timestamp || new Date(),
    latitude: params.latitude,
    longitude: params.longitude,
    localUri: params.localUri,
    exifData: params.exifData,
    syncStatus: 'local'
  };
  
  validatePhoto(photo);
  return photo;
};

export const createTrackPoint = (params: {
  latitude: number;
  longitude: number;
  accuracy: number;
  source: TrackPoint['source'];
  timestamp?: Date;
  altitude?: number;
  speed?: number;
  heading?: number;
}): TrackPoint => {
  const trackPoint: TrackPoint = {
    latitude: params.latitude,
    longitude: params.longitude,
    accuracy: params.accuracy,
    source: params.source,
    timestamp: params.timestamp || new Date(),
    altitude: params.altitude,
    speed: params.speed,
    heading: params.heading
  };
  
  validateTrackPoint(trackPoint);
  return trackPoint;
};

// Data transformation utilities between API and local formats
export const activityToApiFormat = (activity: Activity): ActivityApiFormat => {
  return {
    activity_id: activity.activityId,
    user_id: activity.userId,
    started_at: activity.startedAt.toISOString(),
    ended_at: activity.endedAt?.toISOString(),
    status: activity.status,
    duration_sec: activity.durationSec,
    distance_m: activity.distanceM,
    avg_pace_sec_per_km: activity.avgPaceSecPerKm,
    elev_gain_m: activity.elevGainM,
    elev_loss_m: activity.elevLossM,
    polyline: activity.polyline,
    bounds: activity.bounds ? JSON.stringify(activity.bounds) : undefined,
    splits: JSON.stringify(activity.splitKm),
    cover_photo_id: activity.coverPhotoId,
    device_meta: JSON.stringify(activity.deviceMeta),
    created_at: activity.createdAt.toISOString(),
    updated_at: activity.updatedAt.toISOString(),
    sync_status: activity.syncStatus
  };
};

export const activityFromApiFormat = (apiActivity: ActivityApiFormat): Activity => {
  const activity: Activity = {
    activityId: apiActivity.activity_id,
    userId: apiActivity.user_id,
    startedAt: new Date(apiActivity.started_at),
    endedAt: apiActivity.ended_at ? new Date(apiActivity.ended_at) : undefined,
    status: apiActivity.status as Activity['status'],
    durationSec: apiActivity.duration_sec,
    distanceM: apiActivity.distance_m,
    avgPaceSecPerKm: apiActivity.avg_pace_sec_per_km,
    elevGainM: apiActivity.elev_gain_m,
    elevLossM: apiActivity.elev_loss_m,
    polyline: apiActivity.polyline,
    bounds: apiActivity.bounds ? JSON.parse(apiActivity.bounds) : undefined,
    splitKm: JSON.parse(apiActivity.splits),
    coverPhotoId: apiActivity.cover_photo_id,
    deviceMeta: JSON.parse(apiActivity.device_meta),
    createdAt: new Date(apiActivity.created_at),
    updatedAt: new Date(apiActivity.updated_at),
    syncStatus: apiActivity.sync_status as Activity['syncStatus']
  };
  
  validateActivity(activity);
  return activity;
};

export const photoToApiFormat = (photo: Photo): PhotoApiFormat => {
  return {
    photo_id: photo.photoId,
    activity_id: photo.activityId,
    timestamp: photo.timestamp.toISOString(),
    latitude: photo.latitude,
    longitude: photo.longitude,
    local_uri: photo.localUri,
    cloud_uri: photo.cloudUri,
    thumbnail_uri: photo.thumbnailUri,
    exif_data: photo.exifData ? JSON.stringify(photo.exifData) : undefined,
    caption: photo.caption,
    sync_status: photo.syncStatus
  };
};

export const photoFromApiFormat = (apiPhoto: PhotoApiFormat): Photo => {
  const photo: Photo = {
    photoId: apiPhoto.photo_id,
    activityId: apiPhoto.activity_id,
    timestamp: new Date(apiPhoto.timestamp),
    latitude: apiPhoto.latitude,
    longitude: apiPhoto.longitude,
    localUri: apiPhoto.local_uri,
    cloudUri: apiPhoto.cloud_uri,
    thumbnailUri: apiPhoto.thumbnail_uri,
    exifData: apiPhoto.exif_data ? JSON.parse(apiPhoto.exif_data) : undefined,
    caption: apiPhoto.caption,
    syncStatus: apiPhoto.sync_status as Photo['syncStatus']
  };
  
  validatePhoto(photo);
  return photo;
};

export const trackPointToApiFormat = (trackPoint: TrackPoint, activityId: string): TrackPointApiFormat => {
  return {
    activity_id: activityId,
    timestamp: trackPoint.timestamp.toISOString(),
    latitude: trackPoint.latitude,
    longitude: trackPoint.longitude,
    elevation: trackPoint.altitude,
    accuracy: trackPoint.accuracy,
    speed: trackPoint.speed,
    heading: trackPoint.heading,
    source: trackPoint.source
  };
};

export const trackPointFromApiFormat = (apiTrackPoint: TrackPointApiFormat): TrackPoint => {
  const trackPoint: TrackPoint = {
    latitude: apiTrackPoint.latitude,
    longitude: apiTrackPoint.longitude,
    accuracy: apiTrackPoint.accuracy,
    source: apiTrackPoint.source as TrackPoint['source'],
    timestamp: new Date(apiTrackPoint.timestamp),
    altitude: apiTrackPoint.elevation,
    speed: apiTrackPoint.speed,
    heading: apiTrackPoint.heading
  };
  
  validateTrackPoint(trackPoint);
  return trackPoint;
};

// Utility functions for common operations
export const generateActivityId = (): string => {
  return `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generatePhotoId = (): string => {
  return `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const calculateBounds = (trackPoints: TrackPoint[]): BoundingBox | undefined => {
  if (trackPoints.length === 0) return undefined;
  
  let north = trackPoints[0].latitude;
  let south = trackPoints[0].latitude;
  let east = trackPoints[0].longitude;
  let west = trackPoints[0].longitude;
  
  for (const point of trackPoints) {
    north = Math.max(north, point.latitude);
    south = Math.min(south, point.latitude);
    east = Math.max(east, point.longitude);
    west = Math.min(west, point.longitude);
  }
  
  return { north, south, east, west };
};

export const isActivityComplete = (activity: Activity): boolean => {
  return activity.status === 'completed' && !!activity.endedAt;
};

export const isPhotoSynced = (photo: Photo): boolean => {
  return photo.syncStatus === 'synced' && !!photo.cloudUri;
};