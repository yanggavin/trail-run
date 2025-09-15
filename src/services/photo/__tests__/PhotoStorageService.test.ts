import { PhotoStorageService } from '../PhotoStorageService';
import { Photo } from '../../../types';

describe('PhotoStorageService', () => {
  const mockPhoto: Photo = {
    photoId: 'photo123',
    activityId: 'activity123',
    timestamp: new Date('2023-01-01T10:00:00Z'),
    latitude: 37.7749,
    longitude: -122.4194,
    localUri: 'file:///photos/photo123.jpg',
    syncStatus: 'local',
  };

  describe('validatePhoto', () => {
    it('should validate a correct photo', () => {
      const result = PhotoStorageService.validatePhoto(mockPhoto);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing photo ID', () => {
      const invalidPhoto = { ...mockPhoto, photoId: '' };
      const result = PhotoStorageService.validatePhoto(invalidPhoto);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Photo ID is required and must be a string');
    });

    it('should detect invalid latitude', () => {
      const invalidPhoto = { ...mockPhoto, latitude: 200 };
      const result = PhotoStorageService.validatePhoto(invalidPhoto);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Latitude must be a number between -90 and 90');
    });

    it('should detect invalid longitude', () => {
      const invalidPhoto = { ...mockPhoto, longitude: -200 };
      const result = PhotoStorageService.validatePhoto(invalidPhoto);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Longitude must be a number between -180 and 180');
    });

    it('should detect invalid sync status', () => {
      const invalidPhoto = { ...mockPhoto, syncStatus: 'invalid' as any };
      const result = PhotoStorageService.validatePhoto(invalidPhoto);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Sync status must be one of: local, uploading, synced');
    });

    it('should detect invalid timestamp', () => {
      const invalidPhoto = { ...mockPhoto, timestamp: 'invalid' as any };
      const result = PhotoStorageService.validatePhoto(invalidPhoto);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Timestamp is required and must be a Date');
    });

    it('should detect missing local URI', () => {
      const invalidPhoto = { ...mockPhoto, localUri: '' };
      const result = PhotoStorageService.validatePhoto(invalidPhoto);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Local URI is required and must be a string');
    });
  });

  describe('validatePhotoActivityAssociation', () => {
    it('should validate correct photo-activity association', () => {
      const result = PhotoStorageService.validatePhotoActivityAssociation(mockPhoto, 'activity123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid activity ID', () => {
      const result = PhotoStorageService.validatePhotoActivityAssociation(mockPhoto, '');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Activity ID is required and must be a string');
    });

    it('should detect conflicting activity association', () => {
      const result = PhotoStorageService.validatePhotoActivityAssociation(mockPhoto, 'different-activity');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Photo is already associated with a different activity');
    });

    it('should allow association with same activity', () => {
      const result = PhotoStorageService.validatePhotoActivityAssociation(mockPhoto, 'activity123');

      expect(result.isValid).toBe(true);
    });
  });

  describe('preparePhotoForActivity', () => {
    it('should prepare photo for activity association', () => {
      const photoWithoutActivity = { ...mockPhoto, activityId: 'activity456' };
      const result = PhotoStorageService.preparePhotoForActivity(photoWithoutActivity, 'activity456');

      expect(result.activityId).toBe('activity456');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should throw error for invalid photo', () => {
      const invalidPhoto = { ...mockPhoto, latitude: 200 };

      expect(() => {
        PhotoStorageService.preparePhotoForActivity(invalidPhoto, 'activity123');
      }).toThrow('Photo validation failed');
    });

    it('should preserve existing timestamp', () => {
      const originalTimestamp = new Date('2022-01-01');
      const photoWithTimestamp = { ...mockPhoto, timestamp: originalTimestamp };
      const result = PhotoStorageService.preparePhotoForActivity(photoWithTimestamp, 'activity123');

      expect(result.timestamp).toBe(originalTimestamp);
    });
  });

  describe('filterPhotosForSync', () => {
    it('should filter photos ready for sync', () => {
      const photos = [
        mockPhoto, // Ready for sync
        { ...mockPhoto, photoId: 'photo2', syncStatus: 'synced' as const }, // Already synced
        { ...mockPhoto, photoId: 'photo3', localUri: '' }, // Missing URI
        { ...mockPhoto, photoId: 'photo4', syncStatus: 'uploading' as const }, // Currently uploading
      ];

      const result = PhotoStorageService.filterPhotosForSync(photos);

      expect(result.readyForSync).toHaveLength(1);
      expect(result.readyForSync[0].photoId).toBe('photo123');
      expect(result.needsProcessing).toHaveLength(3);
      expect(result.totalSize).toBeGreaterThan(0);
    });

    it('should handle empty photo array', () => {
      const result = PhotoStorageService.filterPhotosForSync([]);

      expect(result.readyForSync).toHaveLength(0);
      expect(result.needsProcessing).toHaveLength(0);
      expect(result.totalSize).toBe(0);
    });
  });

  describe('prepareBatchForSync', () => {
    it('should prepare batch within size limits', () => {
      const photos = Array.from({ length: 10 }, (_, i) => ({
        ...mockPhoto,
        photoId: `photo${i}`,
      }));

      const result = PhotoStorageService.prepareBatchForSync(photos, 5);

      expect(result.batch.length).toBeLessThanOrEqual(5);
      expect(result.remaining.length).toBeGreaterThanOrEqual(0);
      expect(result.totalSize).toBeGreaterThan(0);
    });

    it('should respect total size limit', () => {
      const photos = Array.from({ length: 100 }, (_, i) => ({
        ...mockPhoto,
        photoId: `photo${i}`,
      }));

      const smallSizeLimit = 5 * 1024 * 1024; // 5MB
      const result = PhotoStorageService.prepareBatchForSync(photos, 100, smallSizeLimit);

      expect(result.totalSize).toBeLessThanOrEqual(smallSizeLimit);
    });
  });

  describe('createBatchResult', () => {
    it('should create correct batch result', () => {
      const successful = [mockPhoto];
      const failed = [{ photo: mockPhoto, error: 'Test error' }];

      const result = PhotoStorageService.createBatchResult(successful, failed);

      expect(result.successful).toEqual(successful);
      expect(result.failed).toEqual(failed);
      expect(result.totalProcessed).toBe(2);
    });
  });

  describe('updatePhotoSyncStatus', () => {
    it('should update sync status successfully', () => {
      const result = PhotoStorageService.updatePhotoSyncStatus(
        mockPhoto,
        'synced',
        'https://cloud.com/photo123.jpg'
      );

      expect(result.syncStatus).toBe('synced');
      expect(result.cloudUri).toBe('https://cloud.com/photo123.jpg');
    });

    it('should validate updated photo', () => {
      const invalidPhoto = { ...mockPhoto, latitude: 200 };

      expect(() => {
        PhotoStorageService.updatePhotoSyncStatus(invalidPhoto, 'synced');
      }).toThrow('Updated photo validation failed');
    });

    it('should update without cloud URI', () => {
      const result = PhotoStorageService.updatePhotoSyncStatus(mockPhoto, 'uploading');

      expect(result.syncStatus).toBe('uploading');
      expect(result.cloudUri).toBeUndefined();
    });
  });

  describe('findOrphanedPhotos', () => {
    it('should find photos with invalid data', () => {
      const photos = [
        mockPhoto, // Valid
        { ...mockPhoto, photoId: 'photo2', activityId: '' }, // No activity
        { ...mockPhoto, photoId: 'photo3', latitude: 200 }, // Invalid latitude
        { ...mockPhoto, photoId: 'photo4', activityId: '   ' }, // Whitespace activity
      ];

      const result = PhotoStorageService.findOrphanedPhotos(photos);

      expect(result).toHaveLength(3);
      expect(result.map(p => p.photoId)).toEqual(['photo2', 'photo3', 'photo4']);
    });

    it('should return empty array for valid photos', () => {
      const result = PhotoStorageService.findOrphanedPhotos([mockPhoto]);

      expect(result).toHaveLength(0);
    });
  });

  describe('calculateStorageStats', () => {
    it('should calculate correct statistics', () => {
      const photos = [
        mockPhoto, // Valid
        { ...mockPhoto, photoId: 'photo2' }, // Valid
        { ...mockPhoto, photoId: 'photo3', activityId: '' }, // Orphaned
        { ...mockPhoto, photoId: 'photo4', latitude: 200 }, // Invalid
      ];

      const result = PhotoStorageService.calculateStorageStats(photos);

      expect(result.totalPhotos).toBe(4);
      expect(result.validPhotos).toBe(2);
      expect(result.invalidPhotos).toBe(2);
      expect(result.orphanedFiles).toBe(2); // Both orphaned and invalid are considered orphaned
      expect(result.totalSize).toBeGreaterThan(0);
    });
  });

  describe('groupPhotosByActivity', () => {
    it('should group photos by activity ID', () => {
      const photos = [
        { ...mockPhoto, photoId: 'photo1', activityId: 'activity1' },
        { ...mockPhoto, photoId: 'photo2', activityId: 'activity1' },
        { ...mockPhoto, photoId: 'photo3', activityId: 'activity2' },
        { ...mockPhoto, photoId: 'photo4', activityId: '' }, // Should be ignored
      ];

      const result = PhotoStorageService.groupPhotosByActivity(photos);

      expect(result.size).toBe(2);
      expect(result.get('activity1')).toHaveLength(2);
      expect(result.get('activity2')).toHaveLength(1);
      expect(result.has('')).toBe(false);
    });
  });

  describe('sortPhotosByTimestamp', () => {
    it('should sort photos by timestamp ascending', () => {
      const photos = [
        { ...mockPhoto, photoId: 'photo1', timestamp: new Date('2023-01-03') },
        { ...mockPhoto, photoId: 'photo2', timestamp: new Date('2023-01-01') },
        { ...mockPhoto, photoId: 'photo3', timestamp: new Date('2023-01-02') },
      ];

      const result = PhotoStorageService.sortPhotosByTimestamp(photos, true);

      expect(result.map(p => p.photoId)).toEqual(['photo2', 'photo3', 'photo1']);
    });

    it('should sort photos by timestamp descending', () => {
      const photos = [
        { ...mockPhoto, photoId: 'photo1', timestamp: new Date('2023-01-01') },
        { ...mockPhoto, photoId: 'photo2', timestamp: new Date('2023-01-03') },
        { ...mockPhoto, photoId: 'photo3', timestamp: new Date('2023-01-02') },
      ];

      const result = PhotoStorageService.sortPhotosByTimestamp(photos, false);

      expect(result.map(p => p.photoId)).toEqual(['photo2', 'photo3', 'photo1']);
    });
  });

  describe('filterPhotosByDateRange', () => {
    it('should filter photos within date range', () => {
      const photos = [
        { ...mockPhoto, photoId: 'photo1', timestamp: new Date('2023-01-01') },
        { ...mockPhoto, photoId: 'photo2', timestamp: new Date('2023-01-15') },
        { ...mockPhoto, photoId: 'photo3', timestamp: new Date('2023-02-01') },
      ];

      const startDate = new Date('2023-01-10');
      const endDate = new Date('2023-01-20');
      const result = PhotoStorageService.filterPhotosByDateRange(photos, startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].photoId).toBe('photo2');
    });

    it('should return empty array when no photos in range', () => {
      const photos = [
        { ...mockPhoto, photoId: 'photo1', timestamp: new Date('2023-01-01') },
      ];

      const startDate = new Date('2023-02-01');
      const endDate = new Date('2023-02-28');
      const result = PhotoStorageService.filterPhotosByDateRange(photos, startDate, endDate);

      expect(result).toHaveLength(0);
    });
  });
});