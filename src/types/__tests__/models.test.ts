import {
  ValidationError,
  validateLatitude,
  validateLongitude,
  validateAccuracy,
  validateSpeed,
  validateHeading,
  validateActivity,
  validatePhoto,
  validateTrackPoint,
  createActivity,
  createPhoto,
  createTrackPoint,
  activityToApiFormat,
  activityFromApiFormat,
  photoToApiFormat,
  photoFromApiFormat,
  trackPointToApiFormat,
  trackPointFromApiFormat,
  generateActivityId,
  generatePhotoId,
  calculateBounds,
  isActivityComplete,
  isPhotoSynced
} from '../models';
import { Activity, Photo, TrackPoint, DeviceMeta } from '../index';

describe('Validation Functions', () => {
  describe('validateLatitude', () => {
    it('should validate correct latitudes', () => {
      expect(validateLatitude(0)).toBe(true);
      expect(validateLatitude(45.5)).toBe(true);
      expect(validateLatitude(-45.5)).toBe(true);
      expect(validateLatitude(90)).toBe(true);
      expect(validateLatitude(-90)).toBe(true);
    });

    it('should reject invalid latitudes', () => {
      expect(validateLatitude(91)).toBe(false);
      expect(validateLatitude(-91)).toBe(false);
      expect(validateLatitude(NaN)).toBe(false);
    });
  });

  describe('validateLongitude', () => {
    it('should validate correct longitudes', () => {
      expect(validateLongitude(0)).toBe(true);
      expect(validateLongitude(120.5)).toBe(true);
      expect(validateLongitude(-120.5)).toBe(true);
      expect(validateLongitude(180)).toBe(true);
      expect(validateLongitude(-180)).toBe(true);
    });

    it('should reject invalid longitudes', () => {
      expect(validateLongitude(181)).toBe(false);
      expect(validateLongitude(-181)).toBe(false);
      expect(validateLongitude(NaN)).toBe(false);
    });
  });

  describe('validateAccuracy', () => {
    it('should validate positive accuracy values', () => {
      expect(validateAccuracy(0)).toBe(true);
      expect(validateAccuracy(5.5)).toBe(true);
      expect(validateAccuracy(100)).toBe(true);
    });

    it('should reject negative accuracy values', () => {
      expect(validateAccuracy(-1)).toBe(false);
      expect(validateAccuracy(NaN)).toBe(false);
    });
  });

  describe('validateSpeed', () => {
    it('should validate positive speed values and undefined', () => {
      expect(validateSpeed(undefined)).toBe(true);
      expect(validateSpeed(0)).toBe(true);
      expect(validateSpeed(5.5)).toBe(true);
      expect(validateSpeed(100)).toBe(true);
    });

    it('should reject negative speed values', () => {
      expect(validateSpeed(-1)).toBe(false);
      expect(validateSpeed(NaN)).toBe(false);
    });
  });

  describe('validateHeading', () => {
    it('should validate correct heading values and undefined', () => {
      expect(validateHeading(undefined)).toBe(true);
      expect(validateHeading(0)).toBe(true);
      expect(validateHeading(180)).toBe(true);
      expect(validateHeading(359.9)).toBe(true);
    });

    it('should reject invalid heading values', () => {
      expect(validateHeading(-1)).toBe(false);
      expect(validateHeading(360)).toBe(false);
      expect(validateHeading(NaN)).toBe(false);
    });
  });
});

describe('Model Validation', () => {
  describe('validateActivity', () => {
    const validActivity: Activity = {
      activityId: 'test-activity-1',
      userId: 'test-user-1',
      startedAt: new Date(),
      status: 'active',
      durationSec: 0,
      distanceM: 0,
      avgPaceSecPerKm: 0,
      elevGainM: 0,
      elevLossM: 0,
      splitKm: [],
      deviceMeta: { platform: 'ios', version: '1.0.0', model: 'iPhone' },
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: 'local'
    };

    it('should validate a correct activity', () => {
      expect(() => validateActivity(validActivity)).not.toThrow();
    });

    it('should throw for missing activityId', () => {
      const invalid = { ...validActivity, activityId: '' };
      expect(() => validateActivity(invalid)).toThrow(ValidationError);
    });

    it('should throw for invalid status', () => {
      const invalid = { ...validActivity, status: 'invalid' as any };
      expect(() => validateActivity(invalid)).toThrow(ValidationError);
    });

    it('should throw for negative duration', () => {
      const invalid = { ...validActivity, durationSec: -1 };
      expect(() => validateActivity(invalid)).toThrow(ValidationError);
    });
  });

  describe('validatePhoto', () => {
    const validPhoto: Photo = {
      photoId: 'test-photo-1',
      activityId: 'test-activity-1',
      timestamp: new Date(),
      latitude: 45.5,
      longitude: -122.5,
      localUri: 'file://test.jpg',
      syncStatus: 'local'
    };

    it('should validate a correct photo', () => {
      expect(() => validatePhoto(validPhoto)).not.toThrow();
    });

    it('should throw for invalid latitude', () => {
      const invalid = { ...validPhoto, latitude: 91 };
      expect(() => validatePhoto(invalid)).toThrow(ValidationError);
    });

    it('should throw for missing localUri', () => {
      const invalid = { ...validPhoto, localUri: '' };
      expect(() => validatePhoto(invalid)).toThrow(ValidationError);
    });
  });

  describe('validateTrackPoint', () => {
    const validTrackPoint: TrackPoint = {
      latitude: 45.5,
      longitude: -122.5,
      accuracy: 5,
      source: 'gps',
      timestamp: new Date()
    };

    it('should validate a correct track point', () => {
      expect(() => validateTrackPoint(validTrackPoint)).not.toThrow();
    });

    it('should throw for invalid source', () => {
      const invalid = { ...validTrackPoint, source: 'invalid' as any };
      expect(() => validateTrackPoint(invalid)).toThrow(ValidationError);
    });

    it('should throw for invalid accuracy', () => {
      const invalid = { ...validTrackPoint, accuracy: -1 };
      expect(() => validateTrackPoint(invalid)).toThrow(ValidationError);
    });
  });
});

describe('Factory Functions', () => {
  describe('createActivity', () => {
    it('should create a valid activity with defaults', () => {
      const activity = createActivity({
        activityId: 'test-1',
        userId: 'user-1'
      });

      expect(activity.activityId).toBe('test-1');
      expect(activity.userId).toBe('user-1');
      expect(activity.status).toBe('active');
      expect(activity.durationSec).toBe(0);
      expect(activity.distanceM).toBe(0);
      expect(activity.syncStatus).toBe('local');
      expect(activity.startedAt).toBeInstanceOf(Date);
      expect(activity.createdAt).toBeInstanceOf(Date);
    });

    it('should use provided startedAt date', () => {
      const customDate = new Date('2023-01-01');
      const activity = createActivity({
        activityId: 'test-1',
        userId: 'user-1',
        startedAt: customDate
      });

      expect(activity.startedAt).toBe(customDate);
    });
  });

  describe('createPhoto', () => {
    it('should create a valid photo with defaults', () => {
      const photo = createPhoto({
        photoId: 'photo-1',
        activityId: 'activity-1',
        latitude: 45.5,
        longitude: -122.5,
        localUri: 'file://test.jpg'
      });

      expect(photo.photoId).toBe('photo-1');
      expect(photo.activityId).toBe('activity-1');
      expect(photo.latitude).toBe(45.5);
      expect(photo.longitude).toBe(-122.5);
      expect(photo.localUri).toBe('file://test.jpg');
      expect(photo.syncStatus).toBe('local');
      expect(photo.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('createTrackPoint', () => {
    it('should create a valid track point with defaults', () => {
      const trackPoint = createTrackPoint({
        latitude: 45.5,
        longitude: -122.5,
        accuracy: 5,
        source: 'gps'
      });

      expect(trackPoint.latitude).toBe(45.5);
      expect(trackPoint.longitude).toBe(-122.5);
      expect(trackPoint.accuracy).toBe(5);
      expect(trackPoint.source).toBe('gps');
      expect(trackPoint.timestamp).toBeInstanceOf(Date);
    });

    it('should include optional parameters', () => {
      const trackPoint = createTrackPoint({
        latitude: 45.5,
        longitude: -122.5,
        accuracy: 5,
        source: 'gps',
        speed: 2.5,
        heading: 180,
        altitude: 100
      });

      expect(trackPoint.speed).toBe(2.5);
      expect(trackPoint.heading).toBe(180);
      expect(trackPoint.altitude).toBe(100);
    });
  });
});

describe('Data Transformation', () => {
  describe('Activity transformation', () => {
    const activity: Activity = {
      activityId: 'test-1',
      userId: 'user-1',
      startedAt: new Date('2023-01-01T10:00:00Z'),
      endedAt: new Date('2023-01-01T11:00:00Z'),
      status: 'completed',
      durationSec: 3600,
      distanceM: 5000,
      avgPaceSecPerKm: 720,
      elevGainM: 100,
      elevLossM: 50,
      polyline: 'encoded_polyline',
      bounds: { north: 46, south: 45, east: -122, west: -123 },
      splitKm: [{ kmIndex: 1, durationSec: 720, paceSecPerKm: 720 }],
      coverPhotoId: 'photo-1',
      deviceMeta: { platform: 'ios', version: '1.0.0', model: 'iPhone' },
      createdAt: new Date('2023-01-01T09:00:00Z'),
      updatedAt: new Date('2023-01-01T11:00:00Z'),
      syncStatus: 'synced'
    };

    it('should convert activity to API format', () => {
      const apiFormat = activityToApiFormat(activity);
      
      expect(apiFormat.activity_id).toBe('test-1');
      expect(apiFormat.started_at).toBe('2023-01-01T10:00:00.000Z');
      expect(apiFormat.ended_at).toBe('2023-01-01T11:00:00.000Z');
      expect(apiFormat.duration_sec).toBe(3600);
      expect(JSON.parse(apiFormat.bounds!)).toEqual(activity.bounds);
      expect(JSON.parse(apiFormat.splits)).toEqual(activity.splitKm);
    });

    it('should convert API format back to activity', () => {
      const apiFormat = activityToApiFormat(activity);
      const converted = activityFromApiFormat(apiFormat);
      
      expect(converted.activityId).toBe(activity.activityId);
      expect(converted.startedAt.getTime()).toBe(activity.startedAt.getTime());
      expect(converted.endedAt?.getTime()).toBe(activity.endedAt?.getTime());
      expect(converted.bounds).toEqual(activity.bounds);
      expect(converted.splitKm).toEqual(activity.splitKm);
    });
  });
});

describe('Utility Functions', () => {
  describe('generateActivityId', () => {
    it('should generate unique activity IDs', () => {
      const id1 = generateActivityId();
      const id2 = generateActivityId();
      
      expect(id1).toMatch(/^activity_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^activity_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('generatePhotoId', () => {
    it('should generate unique photo IDs', () => {
      const id1 = generatePhotoId();
      const id2 = generatePhotoId();
      
      expect(id1).toMatch(/^photo_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^photo_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('calculateBounds', () => {
    it('should calculate correct bounds from track points', () => {
      const trackPoints: TrackPoint[] = [
        createTrackPoint({ latitude: 45, longitude: -122, accuracy: 5, source: 'gps' }),
        createTrackPoint({ latitude: 46, longitude: -121, accuracy: 5, source: 'gps' }),
        createTrackPoint({ latitude: 44, longitude: -123, accuracy: 5, source: 'gps' })
      ];

      const bounds = calculateBounds(trackPoints);
      
      expect(bounds).toEqual({
        north: 46,
        south: 44,
        east: -121,
        west: -123
      });
    });

    it('should return undefined for empty track points', () => {
      const bounds = calculateBounds([]);
      expect(bounds).toBeUndefined();
    });
  });

  describe('isActivityComplete', () => {
    it('should return true for completed activity with endedAt', () => {
      const activity = createActivity({ activityId: 'test', userId: 'user' });
      activity.status = 'completed';
      activity.endedAt = new Date();
      
      expect(isActivityComplete(activity)).toBe(true);
    });

    it('should return false for active activity', () => {
      const activity = createActivity({ activityId: 'test', userId: 'user' });
      
      expect(isActivityComplete(activity)).toBe(false);
    });
  });

  describe('isPhotoSynced', () => {
    it('should return true for synced photo with cloudUri', () => {
      const photo = createPhoto({
        photoId: 'test',
        activityId: 'activity',
        latitude: 45,
        longitude: -122,
        localUri: 'file://test.jpg'
      });
      photo.syncStatus = 'synced';
      photo.cloudUri = 'https://cloud.com/photo.jpg';
      
      expect(isPhotoSynced(photo)).toBe(true);
    });

    it('should return false for local photo', () => {
      const photo = createPhoto({
        photoId: 'test',
        activityId: 'activity',
        latitude: 45,
        longitude: -122,
        localUri: 'file://test.jpg'
      });
      
      expect(isPhotoSynced(photo)).toBe(false);
    });
  });
});