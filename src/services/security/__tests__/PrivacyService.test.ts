import { PrivacyService, PrivacyLevel } from '../PrivacyService';
import { getEncryptedDatabaseService } from '../EncryptedDatabaseService';

// Mock the encrypted database service
jest.mock('../EncryptedDatabaseService', () => ({
  getEncryptedDatabaseService: jest.fn(() => ({
    getUserPreference: jest.fn(),
    setUserPreference: jest.fn(),
    executeSql: jest.fn(),
    executeQuery: jest.fn(),
    executeUpdate: jest.fn(),
    logDataDeletion: jest.fn(),
    transaction: jest.fn(),
    deleteAllUserData: jest.fn(),
  })),
}));

// Mock secure storage service
jest.mock('../SecureStorageService', () => ({
  secureStorageService: {
    clearAllData: jest.fn(),
  },
}));

describe('PrivacyService', () => {
  let service: PrivacyService;
  let mockDbService: any;

  beforeEach(() => {
    service = PrivacyService.getInstance();
    mockDbService = getEncryptedDatabaseService();
    jest.clearAllMocks();
  });

  describe('getPrivacySettings', () => {
    it('should return default privacy settings', async () => {
      mockDbService.getUserPreference
        .mockResolvedValueOnce('private') // default_activity_privacy
        .mockResolvedValueOnce('true') // strip_exif_on_share
        .mockResolvedValueOnce('true') // require_auth_for_sensitive_data
        .mockResolvedValueOnce(null) // allow_location_sharing (default to true)
        .mockResolvedValueOnce(null); // data_retention_days

      const settings = await service.getPrivacySettings('user123');

      expect(settings).toEqual({
        defaultActivityPrivacy: 'private',
        stripExifOnShare: true,
        requireAuthForSensitiveData: true,
        allowLocationSharing: true, // Default when not set
        dataRetentionDays: undefined,
      });
    });

    it('should handle custom privacy settings', async () => {
      mockDbService.getUserPreference
        .mockResolvedValueOnce('shareable')
        .mockResolvedValueOnce('false')
        .mockResolvedValueOnce('false')
        .mockResolvedValueOnce('false')
        .mockResolvedValueOnce('30');

      const settings = await service.getPrivacySettings('user123');

      expect(settings).toEqual({
        defaultActivityPrivacy: 'shareable',
        stripExifOnShare: false,
        requireAuthForSensitiveData: false,
        allowLocationSharing: false,
        dataRetentionDays: 30,
      });
    });
  });

  describe('updatePrivacySettings', () => {
    it('should update privacy settings', async () => {
      mockDbService.setUserPreference.mockResolvedValue(undefined);

      const newSettings = {
        defaultActivityPrivacy: 'public' as PrivacyLevel,
        stripExifOnShare: false,
        allowLocationSharing: true,
      };

      await service.updatePrivacySettings('user123', newSettings);

      expect(mockDbService.setUserPreference).toHaveBeenCalledWith('default_activity_privacy', 'public');
      expect(mockDbService.setUserPreference).toHaveBeenCalledWith('strip_exif_on_share', 'false');
      expect(mockDbService.setUserPreference).toHaveBeenCalledWith('allow_location_sharing', 'true');
    });

    it('should only update provided settings', async () => {
      mockDbService.setUserPreference.mockResolvedValue(undefined);

      const partialSettings = {
        stripExifOnShare: true,
      };

      await service.updatePrivacySettings('user123', partialSettings);

      expect(mockDbService.setUserPreference).toHaveBeenCalledTimes(1);
      expect(mockDbService.setUserPreference).toHaveBeenCalledWith('strip_exif_on_share', 'true');
    });
  });

  describe('setActivityPrivacy', () => {
    it('should set activity privacy level', async () => {
      mockDbService.executeSql.mockResolvedValue(undefined);

      await service.setActivityPrivacy('activity123', 'shareable');

      expect(mockDbService.executeSql).toHaveBeenCalledWith(
        'UPDATE activities SET privacy_level = ? WHERE activity_id = ?',
        ['shareable', 'activity123']
      );
    });
  });

  describe('getActivityPrivacy', () => {
    it('should return activity privacy level', async () => {
      mockDbService.executeQuery.mockResolvedValue([{ privacy_level: 'public' }]);

      const privacy = await service.getActivityPrivacy('activity123');

      expect(privacy).toBe('public');
      expect(mockDbService.executeQuery).toHaveBeenCalledWith(
        'SELECT privacy_level FROM activities WHERE activity_id = ?',
        ['activity123']
      );
    });

    it('should return default privacy for non-existent activity', async () => {
      mockDbService.executeQuery.mockResolvedValue([]);

      const privacy = await service.getActivityPrivacy('nonexistent');

      expect(privacy).toBe('private');
    });
  });

  describe('canShareActivity', () => {
    it('should return true for shareable activity', async () => {
      mockDbService.executeQuery.mockResolvedValue([{ privacy_level: 'shareable' }]);

      const canShare = await service.canShareActivity('activity123');

      expect(canShare).toBe(true);
    });

    it('should return true for public activity', async () => {
      mockDbService.executeQuery.mockResolvedValue([{ privacy_level: 'public' }]);

      const canShare = await service.canShareActivity('activity123');

      expect(canShare).toBe(true);
    });

    it('should return false for private activity', async () => {
      mockDbService.executeQuery.mockResolvedValue([{ privacy_level: 'private' }]);

      const canShare = await service.canShareActivity('activity123');

      expect(canShare).toBe(false);
    });

    it('should return false on error', async () => {
      mockDbService.executeQuery.mockRejectedValue(new Error('Database error'));

      const canShare = await service.canShareActivity('activity123');

      expect(canShare).toBe(false);
    });
  });

  describe('getShareableActivities', () => {
    it('should return shareable and public activities', async () => {
      const mockActivities = [
        {
          activity_id: 'activity1',
          user_id: 'user123',
          privacy_level: 'shareable',
          started_at: Date.now(),
          created_at: Date.now(),
          updated_at: Date.now(),
          status: 'completed',
          duration_sec: 3600,
          distance_m: 5000,
          sync_status: 'synced',
        },
        {
          activity_id: 'activity2',
          user_id: 'user123',
          privacy_level: 'public',
          started_at: Date.now(),
          created_at: Date.now(),
          updated_at: Date.now(),
          status: 'completed',
          duration_sec: 1800,
          distance_m: 2500,
          sync_status: 'synced',
        },
      ];

      mockDbService.executeQuery.mockResolvedValue(mockActivities);

      const activities = await service.getShareableActivities('user123');

      expect(activities).toHaveLength(2);
      expect(activities[0].activityId).toBe('activity1');
      expect(activities[1].activityId).toBe('activity2');
    });
  });

  describe('exportUserData', () => {
    it('should export user data in requested format', async () => {
      const mockActivities = [{ activity_id: 'activity1', user_id: 'user123' }];
      const mockPhotos = [{ photo_id: 'photo1', activity_id: 'activity1' }];
      const mockTrackPoints = [{ id: 1, activity_id: 'activity1' }];

      mockDbService.executeQuery
        .mockResolvedValueOnce(mockActivities) // activities
        .mockResolvedValueOnce(mockPhotos) // photos
        .mockResolvedValueOnce(mockTrackPoints); // track points

      mockDbService.logDataDeletion.mockResolvedValue(undefined);

      const exportRequest = {
        userId: 'user123',
        includeActivities: true,
        includePhotos: true,
        includeTrackPoints: true,
        format: 'json' as const,
      };

      const exportData = await service.exportUserData(exportRequest);

      expect(exportData).toHaveProperty('userId', 'user123');
      expect(exportData).toHaveProperty('format', 'json');
      expect(exportData).toHaveProperty('activities');
      expect(exportData).toHaveProperty('photos');
      expect(exportData).toHaveProperty('trackPoints');
      expect(mockDbService.logDataDeletion).toHaveBeenCalledWith(
        'user123',
        'data_export',
        'GDPR data export - format: json'
      );
    });
  });

  describe('deleteUserData', () => {
    it('should delete user data based on request', async () => {
      mockDbService.transaction.mockImplementation(async (callback) => {
        await callback();
      });
      mockDbService.executeSql.mockResolvedValue(undefined);
      mockDbService.logDataDeletion.mockResolvedValue(undefined);

      const deleteRequest = {
        userId: 'user123',
        deleteActivities: true,
        deletePhotos: false,
        deleteTrackPoints: false,
        deleteUserPreferences: true,
        reason: 'User requested deletion',
      };

      await service.deleteUserData(deleteRequest);

      expect(mockDbService.executeSql).toHaveBeenCalledWith(
        'DELETE FROM activities WHERE user_id = ?',
        ['user123']
      );
      expect(mockDbService.executeSql).toHaveBeenCalledWith(
        'DELETE FROM user_preferences WHERE key LIKE ?',
        ['user_user123_%']
      );
      expect(mockDbService.logDataDeletion).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteAllUserData', () => {
    it('should delete all user data and clear secure storage', async () => {
      mockDbService.deleteAllUserData.mockResolvedValue(undefined);
      const { secureStorageService } = require('../SecureStorageService');
      secureStorageService.clearAllData.mockResolvedValue(undefined);

      await service.deleteAllUserData('user123', 'Complete account deletion');

      expect(mockDbService.deleteAllUserData).toHaveBeenCalledWith('user123');
      expect(secureStorageService.clearAllData).toHaveBeenCalled();
    });
  });

  describe('cleanupOldData', () => {
    it('should cleanup old data based on retention policy', async () => {
      // Mock privacy settings with retention policy
      mockDbService.getUserPreference
        .mockResolvedValueOnce('private')
        .mockResolvedValueOnce('true')
        .mockResolvedValueOnce('true')
        .mockResolvedValueOnce('true')
        .mockResolvedValueOnce('30'); // 30 days retention

      mockDbService.executeUpdate.mockResolvedValue(5); // 5 activities deleted
      mockDbService.logDataDeletion.mockResolvedValue(undefined);

      await service.cleanupOldData('user123');

      expect(mockDbService.executeUpdate).toHaveBeenCalledWith(
        'DELETE FROM activities WHERE user_id = ? AND created_at < ?',
        expect.arrayContaining(['user123', expect.any(Number)])
      );
      expect(mockDbService.logDataDeletion).toHaveBeenCalledWith(
        'user123',
        'old_activities',
        'Automatic cleanup - retention policy: 30 days'
      );
    });

    it('should skip cleanup if no retention policy is set', async () => {
      // Mock privacy settings without retention policy
      mockDbService.getUserPreference
        .mockResolvedValueOnce('private')
        .mockResolvedValueOnce('true')
        .mockResolvedValueOnce('true')
        .mockResolvedValueOnce('true')
        .mockResolvedValueOnce(null); // No retention policy

      await service.cleanupOldData('user123');

      expect(mockDbService.executeUpdate).not.toHaveBeenCalled();
    });
  });
});