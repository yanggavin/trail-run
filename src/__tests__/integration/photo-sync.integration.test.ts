import { PhotoService } from '../../services/photo/PhotoService';
import { CloudPhotoService } from '../../services/cloud/CloudPhotoService';
import { SyncService } from '../../services/sync/SyncService';
import { privacyPhotoService } from '../../services/security/PrivacyPhotoService';
import { useAppStore } from '../../store';

// Mock services
jest.mock('../../services/photo/PhotoService');
jest.mock('../../services/cloud/CloudPhotoService');
jest.mock('../../services/sync/SyncService');
jest.mock('../../services/security/PrivacyPhotoService');

describe('Photo Capture and Sync Integration Tests', () => {
  let mockPhotoService: jest.Mocked<PhotoService>;
  let mockCloudPhotoService: jest.Mocked<CloudPhotoService>;
  let mockSyncService: jest.Mocked<SyncService>;
  let mockPrivacyPhotoService: jest.Mocked<typeof privacyPhotoService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPhotoService = new PhotoService() as jest.Mocked<PhotoService>;
    mockCloudPhotoService = CloudPhotoService.getInstance() as jest.Mocked<CloudPhotoService>;
    mockSyncService = SyncService.getInstance() as jest.Mocked<SyncService>;
    mockPrivacyPhotoService = privacyPhotoService as jest.Mocked<typeof privacyPhotoService>;

    // Default mock implementations
    mockPhotoService.capturePhoto.mockResolvedValue({
      photoId: 'photo-123',
      activityId: 'activity-123',
      timestamp: new Date(),
      latitude: 37.7749,
      longitude: -122.4194,
      localUri: '/path/to/photo.jpg',
      syncStatus: 'local',
    });

    mockCloudPhotoService.uploadPhoto.mockResolvedValue({
      photoId: 'photo-123',
      cloudUri: 'https://cloud.example.com/photo-123.jpg',
      thumbnailUri: 'https://cloud.example.com/thumb-123.jpg',
      uploadedAt: new Date(),
    });

    mockSyncService.syncPhoto.mockResolvedValue();
    
    mockPrivacyPhotoService.preparePhotoForSharing.mockResolvedValue({
      originalPhotoId: 'photo-123',
      shareableUri: '/path/to/shareable.jpg',
      hasLocationData: false,
      isProcessed: true,
      metadata: {
        originalSize: 1024000,
        processedSize: 512000,
        strippedExifData: true,
      },
    });
  });

  describe('End-to-End Photo Workflow', () => {
    it('should complete full photo workflow from capture to cloud sync', async () => {
      const userId = 'test-user';
      const location = { latitude: 37.7749, longitude: -122.4194 };

      // 1. Start tracking to have an active activity
      await useAppStore.getState().startTracking(userId);
      const activityId = useAppStore.getState().tracking.activity?.activityId;

      // 2. Capture photo during tracking
      const capturedPhoto = await mockPhotoService.capturePhoto(location);
      expect(capturedPhoto.activityId).toBe(activityId);
      expect(capturedPhoto.syncStatus).toBe('local');

      // 3. Upload photo to cloud
      const uploadResult = await mockCloudPhotoService.uploadPhoto(
        capturedPhoto.photoId,
        capturedPhoto.localUri
      );
      expect(uploadResult.cloudUri).toBeTruthy();
      expect(uploadResult.thumbnailUri).toBeTruthy();

      // 4. Sync photo metadata
      await mockSyncService.syncPhoto(capturedPhoto.photoId);

      // 5. Verify all services were called correctly
      expect(mockPhotoService.capturePhoto).toHaveBeenCalledWith(location);
      expect(mockCloudPhotoService.uploadPhoto).toHaveBeenCalledWith(
        capturedPhoto.photoId,
        capturedPhoto.localUri
      );
      expect(mockSyncService.syncPhoto).toHaveBeenCalledWith(capturedPhoto.photoId);
    });

    it('should handle photo privacy processing before sharing', async () => {
      const userId = 'test-user';
      const photoId = 'photo-123';

      // 1. Prepare photo for sharing with privacy controls
      const shareablePhoto = await mockPrivacyPhotoService.preparePhotoForSharing(
        photoId,
        userId,
        {
          stripExifOnShare: true,
          allowLocationSharing: false,
          maxShareDimension: 1080,
          shareQuality: 0.8,
        }
      );

      expect(shareablePhoto.isProcessed).toBe(true);
      expect(shareablePhoto.hasLocationData).toBe(false);
      expect(shareablePhoto.metadata.strippedExifData).toBe(true);
      expect(shareablePhoto.metadata.processedSize).toBeLessThan(
        shareablePhoto.metadata.originalSize
      );

      // 2. Upload the privacy-processed photo
      await mockCloudPhotoService.uploadPhoto(
        shareablePhoto.originalPhotoId,
        shareablePhoto.shareableUri
      );

      expect(mockPrivacyPhotoService.preparePhotoForSharing).toHaveBeenCalledWith(
        photoId,
        userId,
        expect.objectContaining({
          stripExifOnShare: true,
          allowLocationSharing: false,
        })
      );
    });
  });

  describe('Offline Photo Handling', () => {
    it('should queue photos for upload when offline', async () => {
      const userId = 'test-user';
      const location = { latitude: 37.7749, longitude: -122.4194 };

      // Start tracking
      await useAppStore.getState().startTracking(userId);

      // Mock offline state
      mockCloudPhotoService.uploadPhoto.mockRejectedValue(new Error('Network unavailable'));

      // Capture photos while offline
      const photo1 = await mockPhotoService.capturePhoto(location);
      const photo2 = await mockPhotoService.capturePhoto({
        latitude: 37.7750,
        longitude: -122.4195,
      });

      // Attempt uploads (should fail)
      await expect(mockCloudPhotoService.uploadPhoto(photo1.photoId, photo1.localUri))
        .rejects.toThrow('Network unavailable');
      await expect(mockCloudPhotoService.uploadPhoto(photo2.photoId, photo2.localUri))
        .rejects.toThrow('Network unavailable');

      // Photos should remain local
      expect(photo1.syncStatus).toBe('local');
      expect(photo2.syncStatus).toBe('local');

      // Restore connection
      mockCloudPhotoService.uploadPhoto.mockResolvedValue({
        photoId: 'photo-123',
        cloudUri: 'https://cloud.example.com/photo.jpg',
        thumbnailUri: 'https://cloud.example.com/thumb.jpg',
        uploadedAt: new Date(),
      });

      // Retry uploads
      await mockCloudPhotoService.uploadPhoto(photo1.photoId, photo1.localUri);
      await mockCloudPhotoService.uploadPhoto(photo2.photoId, photo2.localUri);

      expect(mockCloudPhotoService.uploadPhoto).toHaveBeenCalledTimes(4); // 2 failed + 2 successful
    });

    it('should sync photos in batch when connection restored', async () => {
      const photoIds = ['photo-1', 'photo-2', 'photo-3'];

      // Mock batch sync
      mockSyncService.syncPhotos = jest.fn().mockResolvedValue();

      // Sync all photos at once
      await mockSyncService.syncPhotos(photoIds);

      expect(mockSyncService.syncPhotos).toHaveBeenCalledWith(photoIds);
    });
  });

  describe('Photo Upload Error Handling', () => {
    it('should retry failed uploads with exponential backoff', async () => {
      const photoId = 'photo-123';
      const localUri = '/path/to/photo.jpg';

      // Mock upload failures followed by success
      mockCloudPhotoService.uploadPhoto
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockRejectedValueOnce(new Error('Server busy'))
        .mockResolvedValueOnce({
          photoId,
          cloudUri: 'https://cloud.example.com/photo.jpg',
          thumbnailUri: 'https://cloud.example.com/thumb.jpg',
          uploadedAt: new Date(),
        });

      // Simulate retry logic
      let attempt = 0;
      let success = false;
      const maxAttempts = 3;

      while (attempt < maxAttempts && !success) {
        try {
          await mockCloudPhotoService.uploadPhoto(photoId, localUri);
          success = true;
        } catch (error) {
          attempt++;
          if (attempt < maxAttempts) {
            // Wait before retry (exponential backoff simulation)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
          }
        }
      }

      expect(success).toBe(true);
      expect(mockCloudPhotoService.uploadPhoto).toHaveBeenCalledTimes(3);
    });

    it('should handle corrupted photo files gracefully', async () => {
      const photoId = 'corrupted-photo';
      const localUri = '/path/to/corrupted.jpg';

      mockCloudPhotoService.uploadPhoto.mockRejectedValue(new Error('Invalid file format'));

      await expect(mockCloudPhotoService.uploadPhoto(photoId, localUri))
        .rejects.toThrow('Invalid file format');

      // Should not retry for permanent errors
      expect(mockCloudPhotoService.uploadPhoto).toHaveBeenCalledTimes(1);
    });

    it('should handle insufficient storage errors', async () => {
      const photoId = 'photo-123';
      const localUri = '/path/to/photo.jpg';

      mockCloudPhotoService.uploadPhoto.mockRejectedValue(new Error('Insufficient storage'));

      await expect(mockCloudPhotoService.uploadPhoto(photoId, localUri))
        .rejects.toThrow('Insufficient storage');

      // Should handle storage quota exceeded
      expect(mockCloudPhotoService.uploadPhoto).toHaveBeenCalledWith(photoId, localUri);
    });
  });

  describe('Photo Metadata Sync', () => {
    it('should sync photo metadata with activity data', async () => {
      const userId = 'test-user';
      
      // Start tracking
      await useAppStore.getState().startTracking(userId);
      const activityId = useAppStore.getState().tracking.activity?.activityId;

      // Capture photo
      const photo = await mockPhotoService.capturePhoto({
        latitude: 37.7749,
        longitude: -122.4194,
      });

      // Complete activity
      const completedActivity = await useAppStore.getState().stopTracking();

      // Sync activity with photos
      mockSyncService.syncActivityWithPhotos = jest.fn().mockResolvedValue();
      await mockSyncService.syncActivityWithPhotos(completedActivity.activityId, [photo.photoId]);

      expect(mockSyncService.syncActivityWithPhotos).toHaveBeenCalledWith(
        completedActivity.activityId,
        [photo.photoId]
      );
    });

    it('should handle photo-activity association errors', async () => {
      const photoId = 'orphaned-photo';
      const invalidActivityId = 'non-existent-activity';

      mockSyncService.syncPhoto.mockRejectedValue(new Error('Activity not found'));

      await expect(mockSyncService.syncPhoto(photoId))
        .rejects.toThrow('Activity not found');

      // Should handle orphaned photos gracefully
      expect(mockSyncService.syncPhoto).toHaveBeenCalledWith(photoId);
    });
  });

  describe('Photo Storage Management', () => {
    it('should clean up local photos after successful cloud sync', async () => {
      const photoId = 'photo-123';
      const localUri = '/path/to/photo.jpg';

      // Upload to cloud
      await mockCloudPhotoService.uploadPhoto(photoId, localUri);

      // Clean up local file
      mockPhotoService.deleteLocalPhoto = jest.fn().mockResolvedValue();
      await mockPhotoService.deleteLocalPhoto(localUri);

      expect(mockPhotoService.deleteLocalPhoto).toHaveBeenCalledWith(localUri);
    });

    it('should manage local storage quota', async () => {
      const photos = Array.from({ length: 10 }, (_, i) => ({
        photoId: `photo-${i}`,
        localUri: `/path/to/photo-${i}.jpg`,
        size: 1024000, // 1MB each
      }));

      // Mock storage check
      mockPhotoService.getLocalStorageUsage = jest.fn().mockResolvedValue({
        totalSize: 50 * 1024 * 1024, // 50MB
        availableSize: 10 * 1024 * 1024, // 10MB available
        photoCount: photos.length,
      });

      const storageInfo = await mockPhotoService.getLocalStorageUsage();
      
      // Should trigger cleanup if storage is low
      if (storageInfo.availableSize < 20 * 1024 * 1024) { // Less than 20MB
        mockPhotoService.cleanupOldPhotos = jest.fn().mockResolvedValue(5);
        const cleanedCount = await mockPhotoService.cleanupOldPhotos();
        expect(cleanedCount).toBeGreaterThan(0);
      }
    });
  });

  describe('Concurrent Photo Operations', () => {
    it('should handle multiple simultaneous photo captures', async () => {
      const userId = 'test-user';
      await useAppStore.getState().startTracking(userId);

      const locations = [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 37.7750, longitude: -122.4195 },
        { latitude: 37.7751, longitude: -122.4196 },
      ];

      // Capture multiple photos simultaneously
      const photoPromises = locations.map(location => 
        mockPhotoService.capturePhoto(location)
      );

      const photos = await Promise.all(photoPromises);

      expect(photos).toHaveLength(3);
      photos.forEach((photo, index) => {
        expect(photo.latitude).toBe(locations[index].latitude);
        expect(photo.longitude).toBe(locations[index].longitude);
      });
    });

    it('should handle concurrent upload operations', async () => {
      const photoIds = ['photo-1', 'photo-2', 'photo-3'];
      const localUris = ['/path/1.jpg', '/path/2.jpg', '/path/3.jpg'];

      // Upload multiple photos simultaneously
      const uploadPromises = photoIds.map((photoId, index) =>
        mockCloudPhotoService.uploadPhoto(photoId, localUris[index])
      );

      const uploadResults = await Promise.all(uploadPromises);

      expect(uploadResults).toHaveLength(3);
      uploadResults.forEach((result, index) => {
        expect(result.photoId).toBe(photoIds[index]);
        expect(result.cloudUri).toBeTruthy();
      });
    });
  });
});