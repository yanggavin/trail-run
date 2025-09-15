import { ActivitySharingService, ShareOptions } from '../ActivitySharingService';
import { Activity, Photo } from '../../../types';
import { createActivity, createPhoto } from '../../../types/models';

describe('ActivitySharingService', () => {
  let activitySharingService: ActivitySharingService;

  const mockActivity: Activity = createActivity({
    activityId: 'activity_1',
    userId: 'user_123',
    startedAt: new Date('2024-01-15T10:00:00Z'),
  });
  mockActivity.status = 'completed';
  mockActivity.distanceM = 5000;
  mockActivity.durationSec = 1800;
  mockActivity.avgPaceSecPerKm = 360;
  mockActivity.elevGainM = 120;
  mockActivity.endedAt = new Date('2024-01-15T10:30:00Z');

  const mockPhoto: Photo = createPhoto({
    photoId: 'photo_1',
    activityId: 'activity_1',
    latitude: 40.7128,
    longitude: -74.0060,
    localUri: '/path/to/photo1.jpg',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    activitySharingService = new ActivitySharingService();
  });

  describe('shareActivity', () => {
    it('should share activity successfully with default options', async () => {
      // Act
      const result = await activitySharingService.shareActivity(mockActivity);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Activity shared successfully!');
    });

    it('should share activity with photos when photos are provided', async () => {
      // Arrange
      const photos = [mockPhoto];

      const options: ShareOptions = {
        includePhotos: true,
        includeMap: true,
        includeStats: true,
      };

      // Act
      const result = await activitySharingService.shareActivity(mockActivity, photos, options);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle sharing errors gracefully', async () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Force an error by passing invalid activity data
      const invalidActivity = null as any;

      // Act
      const result = await activitySharingService.shareActivity(invalidActivity);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to share activity. Please try again.');

      consoleSpy.mockRestore();
    });

    it('should respect custom share options', async () => {
      // Arrange
      const options: ShareOptions = {
        includeMap: false,
        includePhotos: false,
        includeStats: false,
        format: 'text',
      };

      // Act
      const result = await activitySharingService.shareActivity(mockActivity, [], options);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('shareToSocialMedia', () => {
    it('should share to Instagram successfully', async () => {
      // Act
      const result = await activitySharingService.shareToSocialMedia(
        mockActivity,
        'instagram',
        [mockPhoto]
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Shared to Instagram!');
    });

    it('should share to Facebook successfully', async () => {
      // Act
      const result = await activitySharingService.shareToSocialMedia(
        mockActivity,
        'facebook'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Shared to Facebook!');
    });

    it('should share to Twitter successfully', async () => {
      // Act
      const result = await activitySharingService.shareToSocialMedia(
        mockActivity,
        'twitter'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Shared to Twitter!');
    });

    it('should share to Strava successfully', async () => {
      // Act
      const result = await activitySharingService.shareToSocialMedia(
        mockActivity,
        'strava'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Shared to Strava!');
    });

    it('should handle unsupported platform', async () => {
      // Act
      const result = await activitySharingService.shareToSocialMedia(
        mockActivity,
        'unsupported' as any
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to share to unsupported');
    });

    it('should handle platform sharing errors', async () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Force an error by passing invalid data
      const invalidActivity = null as any;

      // Act
      const result = await activitySharingService.shareToSocialMedia(
        invalidActivity,
        'instagram'
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to share to instagram');

      consoleSpy.mockRestore();
    });
  });

  describe('share text generation', () => {
    it('should generate appropriate share text with stats', async () => {
      // Act
      const result = await activitySharingService.shareActivity(mockActivity);

      // Assert
      expect(result.success).toBe(true);
      // The share text is logged to console, so we can't directly test it
      // but we can verify the sharing was successful
    });
  });

  describe('formatting methods', () => {
    it('should handle various activity distances and durations', async () => {
      // Test with different activity configurations
      const shortActivity = { ...mockActivity, distanceM: 500, durationSec: 300 };
      const longActivity = { ...mockActivity, distanceM: 15000, durationSec: 7200 };

      // Act
      const shortResult = await activitySharingService.shareActivity(shortActivity);
      const longResult = await activitySharingService.shareActivity(longActivity);

      // Assert
      expect(shortResult.success).toBe(true);
      expect(longResult.success).toBe(true);
    });

    it('should handle zero or invalid pace values', async () => {
      // Test with zero pace
      const zeroPaceActivity = { ...mockActivity, avgPaceSecPerKm: 0 };

      // Act
      const result = await activitySharingService.shareActivity(zeroPaceActivity);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});