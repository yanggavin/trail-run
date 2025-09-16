import { getEncryptedDatabaseService } from './EncryptedDatabaseService';
import { secureStorageService } from './SecureStorageService';
import { ActivityApiFormat, PhotoApiFormat } from '../../types';

export type PrivacyLevel = 'private' | 'shareable' | 'public';

export interface PrivacySettings {
  defaultActivityPrivacy: PrivacyLevel;
  stripExifOnShare: boolean;
  requireAuthForSensitiveData: boolean;
  allowLocationSharing: boolean;
  dataRetentionDays?: number;
}

export interface DataExportRequest {
  userId: string;
  includeActivities: boolean;
  includePhotos: boolean;
  includeTrackPoints: boolean;
  format: 'json' | 'gpx' | 'csv';
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

export interface DataDeletionRequest {
  userId: string;
  deleteActivities: boolean;
  deletePhotos: boolean;
  deleteTrackPoints: boolean;
  deleteUserPreferences: boolean;
  reason?: string;
}

export class PrivacyError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'PrivacyError';
  }
}

export class PrivacyService {
  private static instance: PrivacyService | null = null;
  private dbService = getEncryptedDatabaseService();

  static getInstance(): PrivacyService {
    if (!PrivacyService.instance) {
      PrivacyService.instance = new PrivacyService();
    }
    return PrivacyService.instance;
  }

  /**
   * Get user privacy settings
   */
  async getPrivacySettings(userId: string): Promise<PrivacySettings> {
    try {
      const defaultPrivacy = await this.dbService.getUserPreference('default_activity_privacy') || 'private';
      const stripExif = await this.dbService.getUserPreference('strip_exif_on_share') === 'true';
      const requireAuth = await this.dbService.getUserPreference('require_auth_for_sensitive_data') === 'true';
      const allowLocation = await this.dbService.getUserPreference('allow_location_sharing') !== 'false';
      const retentionDays = await this.dbService.getUserPreference('data_retention_days');

      return {
        defaultActivityPrivacy: defaultPrivacy as PrivacyLevel,
        stripExifOnShare: stripExif,
        requireAuthForSensitiveData: requireAuth,
        allowLocationSharing: allowLocation,
        dataRetentionDays: retentionDays ? parseInt(retentionDays, 10) : undefined,
      };
    } catch (error) {
      throw new PrivacyError('Failed to get privacy settings', error as Error);
    }
  }

  /**
   * Update user privacy settings
   */
  async updatePrivacySettings(userId: string, settings: Partial<PrivacySettings>): Promise<void> {
    try {
      if (settings.defaultActivityPrivacy) {
        await this.dbService.setUserPreference('default_activity_privacy', settings.defaultActivityPrivacy);
      }

      if (settings.stripExifOnShare !== undefined) {
        await this.dbService.setUserPreference('strip_exif_on_share', settings.stripExifOnShare.toString());
      }

      if (settings.requireAuthForSensitiveData !== undefined) {
        await this.dbService.setUserPreference('require_auth_for_sensitive_data', settings.requireAuthForSensitiveData.toString());
      }

      if (settings.allowLocationSharing !== undefined) {
        await this.dbService.setUserPreference('allow_location_sharing', settings.allowLocationSharing.toString());
      }

      if (settings.dataRetentionDays !== undefined) {
        await this.dbService.setUserPreference('data_retention_days', settings.dataRetentionDays.toString());
      }

      console.log(`Privacy settings updated for user ${userId}`);
    } catch (error) {
      throw new PrivacyError('Failed to update privacy settings', error as Error);
    }
  }

  /**
   * Set activity privacy level
   */
  async setActivityPrivacy(activityId: string, privacyLevel: PrivacyLevel): Promise<void> {
    try {
      await this.dbService.executeSql(
        'UPDATE activities SET privacy_level = ? WHERE activity_id = ?',
        [privacyLevel, activityId]
      );

      console.log(`Activity ${activityId} privacy set to ${privacyLevel}`);
    } catch (error) {
      throw new PrivacyError('Failed to set activity privacy', error as Error);
    }
  }

  /**
   * Get activity privacy level
   */
  async getActivityPrivacy(activityId: string): Promise<PrivacyLevel> {
    try {
      const result = await this.dbService.executeQuery<{ privacy_level: PrivacyLevel }>(
        'SELECT privacy_level FROM activities WHERE activity_id = ?',
        [activityId]
      );

      return result.length > 0 ? result[0].privacy_level : 'private';
    } catch (error) {
      throw new PrivacyError('Failed to get activity privacy', error as Error);
    }
  }

  /**
   * Check if activity can be shared based on privacy settings
   */
  async canShareActivity(activityId: string): Promise<boolean> {
    try {
      const privacyLevel = await this.getActivityPrivacy(activityId);
      return privacyLevel === 'shareable' || privacyLevel === 'public';
    } catch (error) {
      console.error('Error checking activity sharing permissions:', error);
      return false;
    }
  }

  /**
   * Get shareable activities for a user
   */
  async getShareableActivities(userId: string): Promise<ActivityApiFormat[]> {
    try {
      const activities = await this.dbService.executeQuery<any>(
        `SELECT * FROM activities 
         WHERE user_id = ? AND privacy_level IN ('shareable', 'public')
         ORDER BY created_at DESC`,
        [userId]
      );

      return activities.map(this.mapDatabaseActivityToApi);
    } catch (error) {
      throw new PrivacyError('Failed to get shareable activities', error as Error);
    }
  }

  /**
   * Export user data for GDPR compliance
   */
  async exportUserData(request: DataExportRequest): Promise<any> {
    try {
      const exportData: any = {
        userId: request.userId,
        exportDate: new Date().toISOString(),
        format: request.format,
      };

      if (request.includeActivities) {
        exportData.activities = await this.exportActivities(request);
      }

      if (request.includePhotos) {
        exportData.photos = await this.exportPhotos(request);
      }

      if (request.includeTrackPoints) {
        exportData.trackPoints = await this.exportTrackPoints(request);
      }

      // Log the export for audit purposes
      await this.dbService.logDataDeletion(
        request.userId,
        'data_export',
        `GDPR data export - format: ${request.format}`
      );

      return exportData;
    } catch (error) {
      throw new PrivacyError('Failed to export user data', error as Error);
    }
  }

  /**
   * Delete user data for GDPR compliance
   */
  async deleteUserData(request: DataDeletionRequest): Promise<void> {
    try {
      await this.dbService.transaction(async () => {
        if (request.deleteActivities) {
          // This will cascade delete track_points and photos due to foreign key constraints
          await this.dbService.executeSql(
            'DELETE FROM activities WHERE user_id = ?',
            [request.userId]
          );

          await this.dbService.logDataDeletion(
            request.userId,
            'activities',
            request.reason || 'User requested deletion'
          );
        }

        if (request.deletePhotos && !request.deleteActivities) {
          // Only delete photos if activities aren't being deleted (to avoid cascade conflicts)
          await this.dbService.executeSql(
            'DELETE FROM photos WHERE activity_id IN (SELECT activity_id FROM activities WHERE user_id = ?)',
            [request.userId]
          );

          await this.dbService.logDataDeletion(
            request.userId,
            'photos',
            request.reason || 'User requested deletion'
          );
        }

        if (request.deleteTrackPoints && !request.deleteActivities) {
          // Only delete track points if activities aren't being deleted
          await this.dbService.executeSql(
            'DELETE FROM track_points WHERE activity_id IN (SELECT activity_id FROM activities WHERE user_id = ?)',
            [request.userId]
          );

          await this.dbService.logDataDeletion(
            request.userId,
            'track_points',
            request.reason || 'User requested deletion'
          );
        }

        if (request.deleteUserPreferences) {
          await this.dbService.executeSql(
            'DELETE FROM user_preferences WHERE key LIKE ?',
            [`user_${request.userId}_%`]
          );

          await this.dbService.logDataDeletion(
            request.userId,
            'user_preferences',
            request.reason || 'User requested deletion'
          );
        }
      });

      console.log(`User data deletion completed for user ${request.userId}`);
    } catch (error) {
      throw new PrivacyError('Failed to delete user data', error as Error);
    }
  }

  /**
   * Delete all user data (complete account deletion)
   */
  async deleteAllUserData(userId: string, reason?: string): Promise<void> {
    try {
      // Delete from local database
      await this.dbService.deleteAllUserData(userId);

      // Clear secure storage
      await secureStorageService.clearAllData();

      console.log(`Complete account deletion completed for user ${userId}`);
    } catch (error) {
      throw new PrivacyError('Failed to delete all user data', error as Error);
    }
  }

  /**
   * Clean up old data based on retention policy
   */
  async cleanupOldData(userId: string): Promise<void> {
    try {
      const settings = await this.getPrivacySettings(userId);
      
      if (!settings.dataRetentionDays) {
        return; // No retention policy set
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - settings.dataRetentionDays);
      const cutoffTimestamp = cutoffDate.getTime();

      // Delete old activities and related data
      const deletedCount = await this.dbService.executeUpdate(
        'DELETE FROM activities WHERE user_id = ? AND created_at < ?',
        [userId, cutoffTimestamp]
      );

      if (deletedCount > 0) {
        await this.dbService.logDataDeletion(
          userId,
          'old_activities',
          `Automatic cleanup - retention policy: ${settings.dataRetentionDays} days`
        );

        console.log(`Cleaned up ${deletedCount} old activities for user ${userId}`);
      }
    } catch (error) {
      throw new PrivacyError('Failed to cleanup old data', error as Error);
    }
  }

  private async exportActivities(request: DataExportRequest): Promise<any[]> {
    let query = 'SELECT * FROM activities WHERE user_id = ?';
    const params: any[] = [request.userId];

    if (request.dateRange) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(request.dateRange.startDate.getTime(), request.dateRange.endDate.getTime());
    }

    query += ' ORDER BY created_at DESC';

    const activities = await this.dbService.executeQuery(query, params);
    return activities.map(this.mapDatabaseActivityToApi);
  }

  private async exportPhotos(request: DataExportRequest): Promise<any[]> {
    let query = `
      SELECT p.* FROM photos p
      JOIN activities a ON p.activity_id = a.activity_id
      WHERE a.user_id = ?
    `;
    const params: any[] = [request.userId];

    if (request.dateRange) {
      query += ' AND p.timestamp BETWEEN ? AND ?';
      params.push(request.dateRange.startDate.getTime(), request.dateRange.endDate.getTime());
    }

    query += ' ORDER BY p.timestamp DESC';

    const photos = await this.dbService.executeQuery(query, params);
    return photos.map(this.mapDatabasePhotoToApi);
  }

  private async exportTrackPoints(request: DataExportRequest): Promise<any[]> {
    let query = `
      SELECT tp.* FROM track_points tp
      JOIN activities a ON tp.activity_id = a.activity_id
      WHERE a.user_id = ?
    `;
    const params: any[] = [request.userId];

    if (request.dateRange) {
      query += ' AND tp.timestamp BETWEEN ? AND ?';
      params.push(request.dateRange.startDate.getTime(), request.dateRange.endDate.getTime());
    }

    query += ' ORDER BY tp.timestamp DESC';

    return this.dbService.executeQuery(query, params);
  }

  private mapDatabaseActivityToApi(dbActivity: any): ActivityApiFormat {
    return {
      activityId: dbActivity.activity_id,
      userId: dbActivity.user_id,
      startedAt: new Date(dbActivity.started_at),
      endedAt: dbActivity.ended_at ? new Date(dbActivity.ended_at) : undefined,
      status: dbActivity.status,
      durationSec: dbActivity.duration_sec,
      distanceM: dbActivity.distance_m,
      avgPaceSecPerKm: dbActivity.avg_pace_sec_per_km,
      elevGainM: dbActivity.elev_gain_m,
      elevLossM: dbActivity.elev_loss_m,
      polyline: dbActivity.polyline,
      bounds: dbActivity.bounds ? JSON.parse(dbActivity.bounds) : undefined,
      splitKm: dbActivity.splits ? JSON.parse(dbActivity.splits) : [],
      coverPhotoId: dbActivity.cover_photo_id,
      deviceMeta: dbActivity.device_meta ? JSON.parse(dbActivity.device_meta) : undefined,
      createdAt: new Date(dbActivity.created_at),
      updatedAt: new Date(dbActivity.updated_at),
      syncStatus: dbActivity.sync_status,
    };
  }

  private mapDatabasePhotoToApi(dbPhoto: any): PhotoApiFormat {
    return {
      photoId: dbPhoto.photo_id,
      activityId: dbPhoto.activity_id,
      timestamp: new Date(dbPhoto.timestamp),
      latitude: dbPhoto.latitude,
      longitude: dbPhoto.longitude,
      localUri: dbPhoto.local_uri,
      cloudUri: dbPhoto.cloud_uri,
      thumbnailUri: dbPhoto.thumbnail_uri,
      exifData: dbPhoto.exif_data ? JSON.parse(dbPhoto.exif_data) : undefined,
      caption: dbPhoto.caption,
      syncStatus: dbPhoto.sync_status,
    };
  }
}

// Singleton instance
export const privacyService = PrivacyService.getInstance();