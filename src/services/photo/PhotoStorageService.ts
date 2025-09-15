import { Photo } from '../../types';

export interface PhotoStorageStats {
  totalPhotos: number;
  totalSize: number;
  orphanedFiles: number;
  validPhotos: number;
  invalidPhotos: number;
}

export interface BatchOperationResult {
  successful: Photo[];
  failed: { photo: Photo; error: string }[];
  totalProcessed: number;
}

export interface PhotoValidationResult {
  isValid: boolean;
  errors: string[];
}

export class PhotoStorageService {
  /**
   * Validate photo data integrity
   */
  static validatePhoto(photo: Photo): PhotoValidationResult {
    const errors: string[] = [];

    if (!photo.photoId || typeof photo.photoId !== 'string') {
      errors.push('Photo ID is required and must be a string');
    }

    if (!photo.activityId || typeof photo.activityId !== 'string') {
      errors.push('Activity ID is required and must be a string');
    }

    if (!photo.timestamp || !(photo.timestamp instanceof Date)) {
      errors.push('Timestamp is required and must be a Date');
    }

    if (typeof photo.latitude !== 'number' || photo.latitude < -90 || photo.latitude > 90) {
      errors.push('Latitude must be a number between -90 and 90');
    }

    if (typeof photo.longitude !== 'number' || photo.longitude < -180 || photo.longitude > 180) {
      errors.push('Longitude must be a number between -180 and 180');
    }

    if (!photo.localUri || typeof photo.localUri !== 'string') {
      errors.push('Local URI is required and must be a string');
    }

    if (!['local', 'uploading', 'synced'].includes(photo.syncStatus)) {
      errors.push('Sync status must be one of: local, uploading, synced');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate photo-to-activity association
   */
  static validatePhotoActivityAssociation(photo: Photo, activityId: string): PhotoValidationResult {
    const errors: string[] = [];

    if (!activityId || typeof activityId !== 'string') {
      errors.push('Activity ID is required and must be a string');
    }

    if (photo.activityId && photo.activityId !== activityId) {
      errors.push('Photo is already associated with a different activity');
    }

    const photoValidation = this.validatePhoto(photo);
    errors.push(...photoValidation.errors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Prepare photo for activity association
   */
  static preparePhotoForActivity(photo: Photo, activityId: string): Photo {
    const validation = this.validatePhotoActivityAssociation(photo, activityId);
    if (!validation.isValid) {
      throw new Error(`Photo validation failed: ${validation.errors.join(', ')}`);
    }

    return {
      ...photo,
      activityId,
      timestamp: photo.timestamp || new Date(),
    };
  }

  /**
   * Filter photos ready for sync
   */
  static filterPhotosForSync(photos: Photo[]): {
    readyForSync: Photo[];
    needsProcessing: Photo[];
    totalSize: number;
  } {
    const readyForSync: Photo[] = [];
    const needsProcessing: Photo[] = [];
    let totalSize = 0;

    for (const photo of photos) {
      const validation = this.validatePhoto(photo);
      
      if (validation.isValid && photo.syncStatus === 'local' && photo.localUri) {
        readyForSync.push(photo);
        totalSize += this.estimatePhotoSize(photo);
      } else {
        needsProcessing.push(photo);
      }
    }

    return {
      readyForSync,
      needsProcessing,
      totalSize,
    };
  }

  /**
   * Prepare batch of photos for sync with size limit
   */
  static prepareBatchForSync(
    photos: Photo[],
    maxBatchSize: number = 50,
    maxTotalSize: number = 50 * 1024 * 1024 // 50MB
  ): {
    batch: Photo[];
    remaining: Photo[];
    totalSize: number;
  } {
    const { readyForSync } = this.filterPhotosForSync(photos);
    
    const batch: Photo[] = [];
    const remaining: Photo[] = [];
    let totalSize = 0;

    for (const photo of readyForSync) {
      const photoSize = this.estimatePhotoSize(photo);
      
      if (batch.length < maxBatchSize && totalSize + photoSize <= maxTotalSize) {
        batch.push(photo);
        totalSize += photoSize;
      } else {
        remaining.push(photo);
      }
    }

    return {
      batch,
      remaining,
      totalSize,
    };
  }

  /**
   * Create batch operation result
   */
  static createBatchResult(
    successful: Photo[],
    failed: { photo: Photo; error: string }[]
  ): BatchOperationResult {
    return {
      successful,
      failed,
      totalProcessed: successful.length + failed.length,
    };
  }

  /**
   * Update photo sync status
   */
  static updatePhotoSyncStatus(
    photo: Photo,
    syncStatus: 'local' | 'uploading' | 'synced',
    cloudUri?: string
  ): Photo {
    const updatedPhoto: Photo = {
      ...photo,
      syncStatus,
      ...(cloudUri && { cloudUri }),
    };

    const validation = this.validatePhoto(updatedPhoto);
    if (!validation.isValid) {
      throw new Error(`Updated photo validation failed: ${validation.errors.join(', ')}`);
    }

    return updatedPhoto;
  }

  /**
   * Find orphaned photos (photos with invalid data)
   */
  static findOrphanedPhotos(photos: Photo[]): Photo[] {
    return photos.filter(photo => {
      const validation = this.validatePhoto(photo);
      return !validation.isValid || !photo.activityId || photo.activityId.trim() === '';
    });
  }

  /**
   * Calculate storage statistics
   */
  static calculateStorageStats(photos: Photo[]): PhotoStorageStats {
    let totalSize = 0;
    let validPhotos = 0;
    let invalidPhotos = 0;

    const orphanedPhotos = this.findOrphanedPhotos(photos);

    for (const photo of photos) {
      const validation = this.validatePhoto(photo);
      
      if (validation.isValid) {
        validPhotos++;
        totalSize += this.estimatePhotoSize(photo);
      } else {
        invalidPhotos++;
      }
    }

    return {
      totalPhotos: photos.length,
      totalSize,
      orphanedFiles: orphanedPhotos.length,
      validPhotos,
      invalidPhotos,
    };
  }

  /**
   * Group photos by activity
   */
  static groupPhotosByActivity(photos: Photo[]): Map<string, Photo[]> {
    const grouped = new Map<string, Photo[]>();

    for (const photo of photos) {
      if (!photo.activityId) continue;

      const existing = grouped.get(photo.activityId) || [];
      existing.push(photo);
      grouped.set(photo.activityId, existing);
    }

    return grouped;
  }

  /**
   * Sort photos by timestamp
   */
  static sortPhotosByTimestamp(photos: Photo[], ascending: boolean = true): Photo[] {
    return [...photos].sort((a, b) => {
      const timeA = a.timestamp.getTime();
      const timeB = b.timestamp.getTime();
      return ascending ? timeA - timeB : timeB - timeA;
    });
  }

  /**
   * Filter photos by date range
   */
  static filterPhotosByDateRange(
    photos: Photo[],
    startDate: Date,
    endDate: Date
  ): Photo[] {
    return photos.filter(photo => {
      const photoTime = photo.timestamp.getTime();
      return photoTime >= startDate.getTime() && photoTime <= endDate.getTime();
    });
  }

  /**
   * Estimate photo file size (placeholder implementation)
   */
  private static estimatePhotoSize(photo: Photo): number {
    // Rough estimate based on typical mobile photo sizes
    // In a real implementation, this would check actual file size
    return 2 * 1024 * 1024; // 2MB average
  }
}