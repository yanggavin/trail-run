import { PrivacyPhotoService, PrivacyPhotoError, privacyPhotoService, PrivacyPhotoOptions, ShareablePhoto } from '../PrivacyPhotoService';
import { PhotoService } from '../../photo/PhotoService';
import { exifService } from '../ExifService';
import { privacyService } from '../PrivacyService';
import { PhotoApiFormat } from '../../../types';

// Mock dependencies
jest.mock('../../photo/PhotoService');
jest.mock('../ExifService', () => ({
  exifService: {
    stripExifData: jest.fn(),
    createPrivacySafeImage: jest.fn(),
    getImageMetadata: jest.fn(),
    hasLocationData: jest.fn(),
    cleanupProcessedImages: jest.fn(),
  },
}));

jest.mock('../PrivacyService', () => ({
  privacyService: {
    getPrivacySettings: jest.fn(),
    canShareActivity: jest.fn(),
  },
}));

describe('PrivacyPhotoService', () => {
  let service: PrivacyPhotoService;
  let mockPhotoService: jest.Mocked<PhotoService>;

  const mockPhoto: PhotoApiFormat = {
    photoId: 'photo123',
    activityId: 'activity123',
    timestamp: new Date(),
    latitude: 37.7749,
    longitude: -122.4194,
    localUri: '/path/to/photo.jpg',
    cloudUri: undefined,
    thumbnailUri: '/path/to/thumbnail.jpg',
    exifData: undefined,
    caption: undefined,
    syncStatus: 'local',
  };

  const mockPrivacySettings = {
    allowAnalytics: true,
    allowCrashReporting: true,
    allowPerformanceMonitoring: false,
    allowPersonalization: true,
    stripExifOnShare: true,
    allowLocationSharing: false,
    lastUpdated: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = PrivacyPhotoService.getInstance();
    mockPhotoService = new PhotoService() as jest.Mocked<PhotoService>;
    (service as any).photoService = mockPhotoService;

    // Default mock implementations
    (privacyService.getPrivacySettings as jest.Mock).mockResolvedValue(mockPrivacySettings);
    (privacyService.canShareActivity as jest.Mock).mockResolvedValue(true);
    (exifService.getImageMetadata as jest.Mock).mockResolvedValue({
      hasExif: true,
      hasLocation: true,
      hasTimestamp: true,
      hasDeviceInfo: true,
      fileSize: 1024000,
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PrivacyPhotoService.getInstance();
      const instance2 = PrivacyPhotoService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export singleton instance', () => {
      expect(privacyPhotoService).toBeInstanceOf(PrivacyPhotoService);
      expect(privacyPhotoService).toBe(PrivacyPhotoService.getInstance());
    });
  });

  describe('capturePrivacyAwarePhoto', () => {
    const location = { latitude: 37.7749, longitude: -122.4194, altitude: 100 };
    const userId = 'user123';

    beforeEach(() => {
      mockPhotoService.capturePhoto.mockResolvedValue(mockPhoto);
      (exifService.stripExifData as jest.Mock).mockResolvedValue('/path/to/processed.jpg');
    });

    it('should capture photo with default privacy settings', async () => {
      const photo = await service.capturePrivacyAwarePhoto(location, userId);

      expect(mockPhotoService.capturePhoto).toHaveBeenCalledWith(location);
      expect(privacyService.getPrivacySettings).toHaveBeenCalledWith(userId);
      expect(photo).toEqual(expect.objectContaining({
        photoId: 'photo123',
        localUri: '/path/to/processed.jpg', // Should be processed
      }));
    });

    it('should strip EXIF data when stripExifOnCapture is true', async () => {
      const options: PrivacyPhotoOptions = {
        stripExifOnCapture: true,
      };

      await service.capturePrivacyAwarePhoto(location, userId, options);

      expect(exifService.stripExifData).toHaveBeenCalledWith('/path/to/photo.jpg', {
        removeLocation: true, // Based on privacy settings
        removeTimestamp: false,
        removeDeviceInfo: true,
        removeAll: false,
      });
    });

    it('should not strip EXIF data when not required', async () => {
      (privacyService.getPrivacySettings as jest.Mock).mockResolvedValue({
        ...mockPrivacySettings,
        stripExifOnShare: false,
      });

      const options: PrivacyPhotoOptions = {
        stripExifOnCapture: false,
      };

      const photo = await service.capturePrivacyAwarePhoto(location, userId, options);

      expect(exifService.stripExifData).not.toHaveBeenCalled();
      expect(photo.localUri).toBe('/path/to/photo.jpg'); // Original URI
    });

    it('should handle photo capture errors', async () => {
      mockPhotoService.capturePhoto.mockRejectedValue(new Error('Camera error'));

      await expect(service.capturePrivacyAwarePhoto(location, userId)).rejects.toThrow(PrivacyPhotoError);
      await expect(service.capturePrivacyAwarePhoto(location, userId)).rejects.toThrow('Failed to capture privacy-aware photo');
    });

    it('should handle EXIF stripping errors', async () => {
      (exifService.stripExifData as jest.Mock).mockRejectedValue(new Error('EXIF error'));

      await expect(service.capturePrivacyAwarePhoto(location, userId)).rejects.toThrow(PrivacyPhotoError);
    });
  });

  describe('preparePhotoForSharing', () => {
    const photoId = 'photo123';
    const userId = 'user123';

    beforeEach(() => {
      mockPhotoService.getPhotosForActivity.mockResolvedValue([mockPhoto]);
      (exifService.createPrivacySafeImage as jest.Mock).mockResolvedValue('/path/to/shareable.jpg');
      (exifService.getImageMetadata as jest.Mock)
        .mockResolvedValueOnce({
          hasExif: true,
          hasLocation: true,
          hasTimestamp: true,
          hasDeviceInfo: true,
          fileSize: 1024000,
        })
        .mockResolvedValueOnce({
          hasExif: false,
          hasLocation: false,
          hasTimestamp: false,
          hasDeviceInfo: false,
          fileSize: 512000,
        });
    });

    it('should prepare photo for sharing with default settings', async () => {
      const shareablePhoto = await service.preparePhotoForSharing(photoId, userId);

      expect(shareablePhoto).toEqual({
        originalPhotoId: photoId,
        shareableUri: '/path/to/shareable.jpg',
        hasLocationData: false, // Location sharing not allowed
        isProcessed: true,
        metadata: {
          originalSize: 1024000,
          processedSize: 512000,
          strippedExifData: true,
        },
      });
    });

    it('should prepare photo with custom options', async () => {
      const options: PrivacyPhotoOptions = {
        stripExifOnShare: false,
        allowLocationSharing: true,
        maxShareDimension: 1024,
        shareQuality: 0.6,
      };

      const shareablePhoto = await service.preparePhotoForSharing(photoId, userId, options);

      expect(exifService.createPrivacySafeImage).toHaveBeenCalledWith('/path/to/photo.jpg', {
        stripLocation: false, // Location sharing allowed
        stripTimestamp: true,
        stripDeviceInfo: true,
        maxDimension: 1024,
        quality: 0.6,
      });

      expect(shareablePhoto.hasLocationData).toBe(true);
    });

    it('should handle photo not found', async () => {
      mockPhotoService.getPhotosForActivity.mockResolvedValue([]);

      await expect(service.preparePhotoForSharing(photoId, userId)).rejects.toThrow(PrivacyPhotoError);
      await expect(service.preparePhotoForSharing(photoId, userId)).rejects.toThrow('Photo not found');
    });

    it('should handle privacy settings errors', async () => {
      (privacyService.getPrivacySettings as jest.Mock).mockRejectedValue(new Error('Settings error'));

      await expect(service.preparePhotoForSharing(photoId, userId)).rejects.toThrow(PrivacyPhotoError);
    });

    it('should handle image processing errors', async () => {
      (exifService.createPrivacySafeImage as jest.Mock).mockRejectedValue(new Error('Processing error'));

      await expect(service.preparePhotoForSharing(photoId, userId)).rejects.toThrow(PrivacyPhotoError);
    });
  });

  describe('batchPreparePhotosForSharing', () => {
    const photoIds = ['photo1', 'photo2', 'photo3'];
    const userId = 'user123';

    beforeEach(() => {
      mockPhotoService.getPhotosForActivity.mockResolvedValue([
        { ...mockPhoto, photoId: 'photo1' },
        { ...mockPhoto, photoId: 'photo2' },
        { ...mockPhoto, photoId: 'photo3' },
      ]);
      (exifService.createPrivacySafeImage as jest.Mock).mockResolvedValue('/path/to/shareable.jpg');
      (exifService.getImageMetadata as jest.Mock).mockResolvedValue({
        hasExif: true,
        hasLocation: true,
        hasTimestamp: true,
        hasDeviceInfo: true,
        fileSize: 1024000,
      });
    });

    it('should prepare all photos successfully', async () => {
      const shareablePhotos = await service.batchPreparePhotosForSharing(photoIds, userId);

      expect(shareablePhotos).toHaveLength(3);
      shareablePhotos.forEach((photo, index) => {
        expect(photo.originalPhotoId).toBe(photoIds[index]);
        expect(photo.shareableUri).toBe('/path/to/shareable.jpg');
      });
    });

    it('should continue processing even if some photos fail', async () => {
      // Make the second photo fail
      mockPhotoService.getPhotosForActivity
        .mockResolvedValueOnce([{ ...mockPhoto, photoId: 'photo1' }])
        .mockResolvedValueOnce([]) // Empty array will cause "Photo not found" error
        .mockResolvedValueOnce([{ ...mockPhoto, photoId: 'photo3' }]);

      const shareablePhotos = await service.batchPreparePhotosForSharing(photoIds, userId);

      expect(shareablePhotos).toHaveLength(2); // Only successful ones
      expect(shareablePhotos[0].originalPhotoId).toBe('photo1');
      expect(shareablePhotos[1].originalPhotoId).toBe('photo3');
    });

    it('should handle empty input array', async () => {
      const shareablePhotos = await service.batchPreparePhotosForSharing([], userId);

      expect(shareablePhotos).toHaveLength(0);
    });
  });

  describe('getShareablePhotos', () => {
    const activityId = 'activity123';
    const userId = 'user123';

    beforeEach(() => {
      mockPhotoService.getPhotosForActivity.mockResolvedValue([mockPhoto]);
    });

    it('should return photos when activity can be shared', async () => {
      const photos = await service.getShareablePhotos(activityId, userId);

      expect(privacyService.canShareActivity).toHaveBeenCalledWith(activityId);
      expect(mockPhotoService.getPhotosForActivity).toHaveBeenCalledWith(activityId);
      expect(photos).toHaveLength(1);
      expect(photos[0].exifData).toBeUndefined(); // EXIF data should be removed
    });

    it('should return empty array when activity cannot be shared', async () => {
      (privacyService.canShareActivity as jest.Mock).mockResolvedValue(false);

      const photos = await service.getShareablePhotos(activityId, userId);

      expect(photos).toHaveLength(0);
    });

    it('should handle privacy service errors', async () => {
      (privacyService.canShareActivity as jest.Mock).mockRejectedValue(new Error('Privacy error'));

      await expect(service.getShareablePhotos(activityId, userId)).rejects.toThrow(PrivacyPhotoError);
    });
  });

  describe('createPrivacyAwareCollage', () => {
    const photoIds = ['photo1', 'photo2', 'photo3'];
    const userId = 'user123';

    beforeEach(() => {
      jest.spyOn(service, 'batchPreparePhotosForSharing').mockResolvedValue([
        {
          originalPhotoId: 'photo1',
          shareableUri: '/path/to/shareable1.jpg',
          hasLocationData: false,
          isProcessed: true,
          metadata: { originalSize: 1024000, processedSize: 512000, strippedExifData: true },
        },
        {
          originalPhotoId: 'photo2',
          shareableUri: '/path/to/shareable2.jpg',
          hasLocationData: false,
          isProcessed: true,
          metadata: { originalSize: 1024000, processedSize: 512000, strippedExifData: true },
        },
      ]);
    });

    it('should create collage with default options', async () => {
      const collageUri = await service.createPrivacyAwareCollage(photoIds, userId);

      expect(service.batchPreparePhotosForSharing).toHaveBeenCalledWith(
        photoIds.slice(0, 4), // Default maxPhotos
        userId,
        { stripExifOnShare: true }
      );
      expect(collageUri).toBe('/path/to/shareable1.jpg'); // Placeholder implementation
    });

    it('should create collage with custom options', async () => {
      const options = {
        maxPhotos: 2,
        collageSize: { width: 800, height: 600 },
        quality: 0.9,
      };

      const collageUri = await service.createPrivacyAwareCollage(photoIds, userId, options);

      expect(service.batchPreparePhotosForSharing).toHaveBeenCalledWith(
        photoIds.slice(0, 2),
        userId,
        { stripExifOnShare: true }
      );
      expect(collageUri).toBe('/path/to/shareable1.jpg');
    });

    it('should handle no available photos', async () => {
      jest.spyOn(service, 'batchPreparePhotosForSharing').mockResolvedValue([]);

      await expect(service.createPrivacyAwareCollage(photoIds, userId)).rejects.toThrow(PrivacyPhotoError);
      await expect(service.createPrivacyAwareCollage(photoIds, userId)).rejects.toThrow('No photos available for collage');
    });
  });

  describe('validatePhotoSharingPermissions', () => {
    const photoId = 'photo123';
    const userId = 'user123';

    beforeEach(() => {
      mockPhotoService.getPhotosForActivity.mockResolvedValue([mockPhoto]);
      (exifService.hasLocationData as jest.Mock).mockResolvedValue(true);
    });

    it('should validate sharing permissions for shareable photo', async () => {
      const permissions = await service.validatePhotoSharingPermissions(photoId, userId);

      expect(permissions).toEqual({
        canShare: true,
        requiresProcessing: true, // Has location data and privacy settings require stripping
      });
    });

    it('should reject sharing for non-existent photo', async () => {
      mockPhotoService.getPhotosForActivity.mockResolvedValue([]);

      const permissions = await service.validatePhotoSharingPermissions(photoId, userId);

      expect(permissions).toEqual({
        canShare: false,
        reason: 'Photo not found',
        requiresProcessing: false,
      });
    });

    it('should reject sharing for private activity', async () => {
      (privacyService.canShareActivity as jest.Mock).mockResolvedValue(false);

      const permissions = await service.validatePhotoSharingPermissions(photoId, userId);

      expect(permissions).toEqual({
        canShare: false,
        reason: 'Activity is private',
        requiresProcessing: false,
      });
    });

    it('should not require processing when no location data', async () => {
      (exifService.hasLocationData as jest.Mock).mockResolvedValue(false);

      const permissions = await service.validatePhotoSharingPermissions(photoId, userId);

      expect(permissions).toEqual({
        canShare: true,
        requiresProcessing: false,
      });
    });

    it('should handle validation errors gracefully', async () => {
      (privacyService.canShareActivity as jest.Mock).mockRejectedValue(new Error('Validation error'));

      const permissions = await service.validatePhotoSharingPermissions(photoId, userId);

      expect(permissions).toEqual({
        canShare: false,
        reason: 'Permission validation failed',
        requiresProcessing: false,
      });
    });
  });

  describe('cleanupShareableImages', () => {
    it('should cleanup processed shareable images', async () => {
      const shareablePhotos: ShareablePhoto[] = [
        {
          originalPhotoId: 'photo1',
          shareableUri: '/path/to/processed1.jpg',
          hasLocationData: false,
          isProcessed: true,
          metadata: { originalSize: 1024000, processedSize: 512000, strippedExifData: true },
        },
        {
          originalPhotoId: 'photo2',
          shareableUri: '/path/to/original2.jpg',
          hasLocationData: false,
          isProcessed: false, // Not processed, should not be cleaned up
          metadata: { originalSize: 1024000, processedSize: 1024000, strippedExifData: false },
        },
      ];

      await service.cleanupShareableImages(shareablePhotos);

      expect(exifService.cleanupProcessedImages).toHaveBeenCalledWith(['/path/to/processed1.jpg']);
    });

    it('should handle empty shareable photos array', async () => {
      await service.cleanupShareableImages([]);

      expect(exifService.cleanupProcessedImages).toHaveBeenCalledWith([]);
    });
  });

  describe('getPhotoPrivacySummary', () => {
    const photoId = 'photo123';

    beforeEach(() => {
      mockPhotoService.getPhotosForActivity.mockResolvedValue([mockPhoto]);
    });

    it('should return high privacy risk for photo with location and timestamp', async () => {
      (exifService.getImageMetadata as jest.Mock).mockResolvedValue({
        hasExif: true,
        hasLocation: true,
        hasTimestamp: true,
        hasDeviceInfo: true,
        fileSize: 1024000,
      });

      const summary = await service.getPhotoPrivacySummary(photoId);

      expect(summary).toEqual({
        hasExifData: true,
        hasLocationData: true,
        hasTimestamp: true,
        hasDeviceInfo: true,
        isShareable: false, // High risk = not shareable
        privacyRisk: 'high',
      });
    });

    it('should return medium privacy risk for photo with location only', async () => {
      (exifService.getImageMetadata as jest.Mock).mockResolvedValue({
        hasExif: true,
        hasLocation: true,
        hasTimestamp: false,
        hasDeviceInfo: false,
        fileSize: 1024000,
      });

      const summary = await service.getPhotoPrivacySummary(photoId);

      expect(summary).toEqual({
        hasExifData: true,
        hasLocationData: true,
        hasTimestamp: false,
        hasDeviceInfo: false,
        isShareable: true,
        privacyRisk: 'medium',
      });
    });

    it('should return low privacy risk for photo without sensitive data', async () => {
      (exifService.getImageMetadata as jest.Mock).mockResolvedValue({
        hasExif: false,
        hasLocation: false,
        hasTimestamp: false,
        hasDeviceInfo: false,
        fileSize: 1024000,
      });

      const summary = await service.getPhotoPrivacySummary(photoId);

      expect(summary).toEqual({
        hasExifData: false,
        hasLocationData: false,
        hasTimestamp: false,
        hasDeviceInfo: false,
        isShareable: true,
        privacyRisk: 'low',
      });
    });

    it('should handle photo not found', async () => {
      mockPhotoService.getPhotosForActivity.mockResolvedValue([]);

      await expect(service.getPhotoPrivacySummary(photoId)).rejects.toThrow(PrivacyPhotoError);
      await expect(service.getPhotoPrivacySummary(photoId)).rejects.toThrow('Photo not found');
    });

    it('should handle metadata extraction errors', async () => {
      (exifService.getImageMetadata as jest.Mock).mockRejectedValue(new Error('Metadata error'));

      await expect(service.getPhotoPrivacySummary(photoId)).rejects.toThrow(PrivacyPhotoError);
    });
  });

  describe('error handling', () => {
    it('should create PrivacyPhotoError with original error', () => {
      const originalError = new Error('Original error');
      const privacyError = new PrivacyPhotoError('Privacy error', originalError);

      expect(privacyError.message).toBe('Privacy error');
      expect(privacyError.originalError).toBe(originalError);
      expect(privacyError.name).toBe('PrivacyPhotoError');
    });

    it('should create PrivacyPhotoError without original error', () => {
      const privacyError = new PrivacyPhotoError('Privacy error');

      expect(privacyError.message).toBe('Privacy error');
      expect(privacyError.originalError).toBeUndefined();
      expect(privacyError.name).toBe('PrivacyPhotoError');
    });
  });
});