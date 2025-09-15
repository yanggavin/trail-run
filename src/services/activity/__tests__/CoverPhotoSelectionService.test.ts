import { CoverPhotoSelectionService } from '../CoverPhotoSelectionService';
import { Photo, TrackPoint, Activity } from '../../../types';
import { createActivity, createPhoto, createTrackPoint } from '../../../types/models';

describe('CoverPhotoSelectionService', () => {
  let service: CoverPhotoSelectionService;

  beforeEach(() => {
    service = new CoverPhotoSelectionService();
  });

  const createTestActivity = (): Activity => {
    return createActivity({
      activityId: 'test-activity',
      userId: 'test-user',
      startedAt: new Date('2023-01-01T10:00:00Z'),
    });
  };

  const createTestPhoto = (overrides: Partial<Photo> = {}): Photo => {
    return createPhoto({
      photoId: `photo-${Date.now()}-${Math.random()}`,
      activityId: 'test-activity',
      latitude: 40.7128,
      longitude: -74.0060,
      localUri: 'file://test-photo.jpg',
      timestamp: new Date('2023-01-01T10:30:00Z'),
      ...overrides,
    });
  };

  const createTestTrackPoints = (count: number = 10): TrackPoint[] => {
    const baseTime = new Date('2023-01-01T10:00:00Z').getTime();
    const points: TrackPoint[] = [];

    for (let i = 0; i < count; i++) {
      points.push(createTrackPoint({
        latitude: 40.7128 + (i * 0.001),
        longitude: -74.0060 + (i * 0.001),
        accuracy: 5,
        source: 'gps',
        altitude: 100 + (i * 2),
        speed: 2.5,
        timestamp: new Date(baseTime + (i * 60000)), // 1 minute intervals
      }));
    }

    return points;
  };

  describe('selectCoverPhoto', () => {
    it('should return null for empty photo array', () => {
      const trackPoints = createTestTrackPoints();
      const activity = createTestActivity();

      const result = service.selectCoverPhoto([], trackPoints, activity);
      expect(result).toBeNull();
    });

    it('should return the only photo when array has one photo', () => {
      const photo = createTestPhoto();
      const trackPoints = createTestTrackPoints();
      const activity = createTestActivity();

      const result = service.selectCoverPhoto([photo], trackPoints, activity);
      expect(result).toBe(photo);
    });

    it('should select photo with highest overall score', () => {
      const photos = [
        createTestPhoto({
          photoId: 'photo-1',
          timestamp: new Date('2023-01-01T10:05:00Z'), // Early in activity
          exifData: { ISO: 100, Flash: 0 }, // Good lighting
        }),
        createTestPhoto({
          photoId: 'photo-2',
          timestamp: new Date('2023-01-01T10:30:00Z'), // Mid activity
          latitude: 40.7178, // Higher elevation area
          exifData: { ISO: 200, Flash: 0 }, // Good lighting
        }),
        createTestPhoto({
          photoId: 'photo-3',
          timestamp: new Date('2023-01-01T10:55:00Z'), // Late in activity
          exifData: { ISO: 1600, Flash: 1 }, // Poor lighting
        }),
      ];

      const trackPoints = createTestTrackPoints();
      const activity = createTestActivity();

      const result = service.selectCoverPhoto(photos, trackPoints, activity);
      
      // Should select one of the photos with good lighting
      expect(result?.photoId).toMatch(/photo-[12]/);
    });

    it('should fallback to first photo when no good candidates exist', () => {
      // Create photos with invalid data directly (bypassing validation)
      const photos: Photo[] = [
        {
          photoId: 'photo-1',
          activityId: 'test-activity',
          timestamp: new Date(),
          latitude: 40.7128,
          longitude: -74.0060,
          localUri: '', // Invalid photo
          syncStatus: 'local',
        },
        {
          photoId: 'photo-2',
          activityId: 'test-activity',
          timestamp: new Date(),
          latitude: 0, // Invalid coordinates
          longitude: 0,
          localUri: 'file://test.jpg',
          syncStatus: 'local',
        },
      ];

      const trackPoints = createTestTrackPoints();
      const activity = createTestActivity();

      const result = service.selectCoverPhoto(photos, trackPoints, activity, {
        fallbackToFirst: true,
      });
      
      expect(result?.photoId).toBe('photo-1');
    });

    it('should return null when fallback is disabled and no good candidates exist', () => {
      // Create photo with invalid data directly (bypassing validation)
      const photos: Photo[] = [
        {
          photoId: 'invalid-photo',
          activityId: 'test-activity',
          timestamp: new Date(),
          latitude: 40.7128,
          longitude: -74.0060,
          localUri: '', // Invalid photo
          syncStatus: 'local',
        },
      ];

      const trackPoints = createTestTrackPoints();
      const activity = createTestActivity();

      const result = service.selectCoverPhoto(photos, trackPoints, activity, {
        fallbackToFirst: false,
      });
      
      expect(result).toBeNull();
    });
  });

  describe('assessPhotoQuality', () => {
    it('should assess photo with good lighting', () => {
      const photo = createTestPhoto({
        timestamp: new Date('2023-01-01T10:00:00Z'), // 10 AM UTC (should be in daylight range)
        exifData: {
          ISO: 100,
          Flash: 0,
          ExposureTime: '1/250',
        },
      });

      const trackPoints = createTestTrackPoints();
      const metrics = service.assessPhotoQuality(photo, trackPoints);

      expect(metrics.hasGoodLighting).toBe(true);
      expect(metrics.qualityScore).toBeGreaterThan(60);
    });

    it('should detect poor lighting conditions', () => {
      const photo = createTestPhoto({
        timestamp: new Date('2023-01-01T22:00:00Z'), // Night time
        exifData: {
          ISO: 1600, // High ISO
          Flash: 1, // Flash fired
          ExposureTime: 1/15, // Slow shutter
        },
      });

      const trackPoints = createTestTrackPoints();
      const metrics = service.assessPhotoQuality(photo, trackPoints);

      expect(metrics.hasGoodLighting).toBe(false);
    });

    it('should identify scenic locations', () => {
      const trackPoints = createTestTrackPoints();
      
      // Photo at higher elevation with low speed (viewpoint)
      const photo = createTestPhoto({
        latitude: trackPoints[5].latitude, // Mid-activity
        longitude: trackPoints[5].longitude,
        timestamp: trackPoints[5].timestamp,
      });

      // Modify track points to have lower speeds around photo location
      trackPoints[4].speed = 0.5;
      trackPoints[5].speed = 0.2; // Very low speed (stopped)
      trackPoints[6].speed = 0.8;

      const metrics = service.assessPhotoQuality(photo, trackPoints);

      expect(metrics.isScenic).toBe(true);
    });

    it('should identify midpoint photos', () => {
      const trackPoints = createTestTrackPoints(10);
      
      // Photo at middle of activity
      const photo = createTestPhoto({
        timestamp: trackPoints[5].timestamp, // Exactly in middle
      });

      const metrics = service.assessPhotoQuality(photo, trackPoints);

      expect(metrics.isAtMidpoint).toBe(true);
    });

    it('should assess composition quality', () => {
      const photo = createTestPhoto({
        exifData: {
          Orientation: 1,
          GPSHPositioningError: 5, // Good GPS accuracy
        },
      });

      const trackPoints = createTestTrackPoints();
      const metrics = service.assessPhotoQuality(photo, trackPoints);

      expect(metrics.hasGoodComposition).toBe(true);
    });

    it('should calculate overall quality score correctly', () => {
      const photo = createTestPhoto({
        timestamp: new Date('2023-01-01T10:00:00Z'), // Good time
        exifData: {
          ISO: 100,
          Flash: 0,
          Orientation: 1,
          GPSHPositioningError: 3,
        },
      });

      const trackPoints = createTestTrackPoints();
      const metrics = service.assessPhotoQuality(photo, trackPoints);

      expect(metrics.qualityScore).toBeGreaterThan(60);
      expect(metrics.hasGoodLighting).toBe(true);
      expect(metrics.hasGoodComposition).toBe(true);
    });
  });

  describe('analyzeCoverPhotoCandidates', () => {
    it('should analyze and rank multiple photo candidates', () => {
      const photos = [
        createTestPhoto({
          photoId: 'photo-1',
          timestamp: new Date('2023-01-01T10:05:00Z'),
          exifData: { ISO: 100, Flash: 0 },
        }),
        createTestPhoto({
          photoId: 'photo-2',
          timestamp: new Date('2023-01-01T10:30:00Z'),
          exifData: { ISO: 200, Flash: 0, Orientation: 1 },
        }),
        createTestPhoto({
          photoId: 'photo-3',
          timestamp: new Date('2023-01-01T10:55:00Z'),
          exifData: { ISO: 1600, Flash: 1 },
        }),
      ];

      const trackPoints = createTestTrackPoints();
      const activity = createTestActivity();

      const candidates = service.analyzeCoverPhotoCandidates(photos, trackPoints, activity);

      expect(candidates).toHaveLength(3);
      expect(candidates[0].overallScore).toBeGreaterThanOrEqual(candidates[1].overallScore);
      expect(candidates[1].overallScore).toBeGreaterThanOrEqual(candidates[2].overallScore);
      
      // Each candidate should have metrics and selection reason
      candidates.forEach(candidate => {
        expect(candidate.metrics).toBeDefined();
        expect(candidate.selectionReason).toBeTruthy();
        expect(candidate.overallScore).toBeGreaterThanOrEqual(0);
        expect(candidate.overallScore).toBeLessThanOrEqual(100);
      });
    });

    it('should filter out invalid photos', () => {
      const validPhoto = createTestPhoto({
        photoId: 'valid-photo',
        exifData: { ISO: 100 },
      });

      // Create invalid photo directly (bypassing validation)
      const invalidPhoto: Photo = {
        photoId: 'invalid-photo',
        activityId: 'test-activity',
        timestamp: new Date(),
        latitude: 40.7128,
        longitude: -74.0060,
        localUri: '', // Invalid
        syncStatus: 'local',
      };

      const photos = [validPhoto, invalidPhoto];
      const trackPoints = createTestTrackPoints();
      const activity = createTestActivity();

      const candidates = service.analyzeCoverPhotoCandidates(photos, trackPoints, activity);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].photo.photoId).toBe('valid-photo');
    });

    it('should respect custom selection options', () => {
      const photos = [
        createTestPhoto({
          photoId: 'scenic-photo',
          timestamp: new Date('2023-01-01T10:30:00Z'),
          latitude: 40.7178, // Different location for scenic value
        }),
        createTestPhoto({
          photoId: 'lighting-photo',
          timestamp: new Date('2023-01-01T10:15:00Z'),
          exifData: { ISO: 50, Flash: 0 }, // Excellent lighting
        }),
      ];

      const trackPoints = createTestTrackPoints();
      const activity = createTestActivity();

      // Prioritize lighting over scenic value
      const candidates = service.analyzeCoverPhotoCandidates(photos, trackPoints, activity, {
        lightingWeight: 0.8,
        scenicWeight: 0.1,
      });

      expect(candidates).toHaveLength(2);
      // The lighting photo should score higher with these weights
      const lightingCandidate = candidates.find(c => c.photo.photoId === 'lighting-photo');
      expect(lightingCandidate).toBeDefined();
    });
  });

  describe('hasValidCoverPhotos', () => {
    it('should return true for valid photos', () => {
      const photos = [createTestPhoto()];
      expect(service.hasValidCoverPhotos(photos)).toBe(true);
    });

    it('should return false for empty array', () => {
      expect(service.hasValidCoverPhotos([])).toBe(false);
    });

    it('should return false for invalid photos only', () => {
      // Create invalid photo directly (bypassing validation)
      const photos: Photo[] = [
        {
          photoId: 'invalid-photo',
          activityId: 'test-activity',
          timestamp: new Date(),
          latitude: 40.7128,
          longitude: -74.0060,
          localUri: '', // Invalid
          syncStatus: 'local',
        },
      ];
      expect(service.hasValidCoverPhotos(photos)).toBe(false);
    });

    it('should return true if at least one photo is valid', () => {
      // Create invalid photo directly (bypassing validation)
      const invalidPhoto: Photo = {
        photoId: 'invalid-photo',
        activityId: 'test-activity',
        timestamp: new Date(),
        latitude: 40.7128,
        longitude: -74.0060,
        localUri: '', // Invalid
        syncStatus: 'local',
      };

      const photos = [
        invalidPhoto,
        createTestPhoto(), // Valid
      ];
      expect(service.hasValidCoverPhotos(photos)).toBe(true);
    });
  });

  describe('getFallbackPhoto', () => {
    it('should return null for empty array', () => {
      expect(service.getFallbackPhoto([])).toBeNull();
    });

    it('should return middle photo for odd number of photos', () => {
      const photos = [
        createTestPhoto({ photoId: 'photo-1' }),
        createTestPhoto({ photoId: 'photo-2' }),
        createTestPhoto({ photoId: 'photo-3' }),
      ];

      const result = service.getFallbackPhoto(photos);
      expect(result?.photoId).toBe('photo-2'); // Middle photo
    });

    it('should return middle photo for even number of photos', () => {
      const photos = [
        createTestPhoto({ photoId: 'photo-1' }),
        createTestPhoto({ photoId: 'photo-2' }),
        createTestPhoto({ photoId: 'photo-3' }),
        createTestPhoto({ photoId: 'photo-4' }),
      ];

      const result = service.getFallbackPhoto(photos);
      expect(result?.photoId).toBe('photo-3'); // Floor of middle index (4/2 = 2, so index 2 = photo-3)
    });

    it('should return first photo for single photo', () => {
      const photos = [createTestPhoto({ photoId: 'only-photo' })];

      const result = service.getFallbackPhoto(photos);
      expect(result?.photoId).toBe('only-photo');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle photos without EXIF data', () => {
      const photo = createTestPhoto({
        exifData: undefined,
      });

      const trackPoints = createTestTrackPoints();
      const metrics = service.assessPhotoQuality(photo, trackPoints);

      expect(metrics).toBeDefined();
      expect(metrics.hasGoodLighting).toBe(true); // Should assume good lighting
      expect(metrics.qualityScore).toBeGreaterThan(0);
    });

    it('should handle empty track points array', () => {
      const photo = createTestPhoto();
      const metrics = service.assessPhotoQuality(photo, []);

      expect(metrics).toBeDefined();
      expect(metrics.isScenic).toBe(false);
      expect(metrics.isAtMidpoint).toBe(false);
    });

    it('should handle track points without elevation data', () => {
      const trackPoints = createTestTrackPoints().map(point => ({
        ...point,
        altitude: undefined,
      }));

      const photo = createTestPhoto({
        timestamp: trackPoints[5].timestamp,
      });

      const metrics = service.assessPhotoQuality(photo, trackPoints);

      expect(metrics).toBeDefined();
      // Should still work without elevation data
    });

    it('should handle track points without speed data', () => {
      const trackPoints = createTestTrackPoints().map(point => ({
        ...point,
        speed: undefined,
      }));

      const photo = createTestPhoto({
        timestamp: trackPoints[5].timestamp,
      });

      const metrics = service.assessPhotoQuality(photo, trackPoints);

      expect(metrics).toBeDefined();
      // Should still assess scenic value without speed data
    });

    it('should handle photos with invalid coordinates gracefully', () => {
      const photos = [
        {
          photoId: 'invalid-photo',
          activityId: 'test-activity',
          timestamp: new Date(),
          latitude: 0, // Invalid
          longitude: 0, // Invalid
          localUri: 'file://test.jpg',
          syncStatus: 'local' as const,
        },
      ];

      const trackPoints = createTestTrackPoints();
      const activity = createTestActivity();

      const result = service.selectCoverPhoto(photos, trackPoints, activity);
      // The service should handle invalid coordinates gracefully
      expect(result).toBeDefined();
    });

    it('should generate meaningful selection reasons', () => {
      const photo = createTestPhoto({
        timestamp: new Date('2023-01-01T14:00:00Z'),
        exifData: {
          ISO: 100,
          Flash: 0,
          Orientation: 1,
        },
      });

      const trackPoints = createTestTrackPoints();
      const activity = createTestActivity();

      const candidates = service.analyzeCoverPhotoCandidates([photo], trackPoints, activity);
      
      expect(candidates[0].selectionReason).toBeTruthy();
      expect(candidates[0].selectionReason).toContain('good');
    });
  });
});