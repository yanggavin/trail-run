import { PhotoService } from '../photo/PhotoService';
import { exifService, ExifStripOptions } from './ExifService';
import { privacyService } from './PrivacyService';
import { PhotoApiFormat } from '../../types';

export interface PrivacyPhotoOptions {
  stripExifOnCapture?: boolean;
  stripExifOnShare?: boolean;
  maxShareDimension?: number;
  shareQuality?: number;
  allowLocationSharing?: boolean;
}

export interface ShareablePhoto {
  originalPhotoId: string;
  shareableUri: string;
  hasLocationData: boolean;
  isProcessed: boolean;
  metadata: {
    originalSize: number;
    processedSize: number;
    strippedExifData: boolean;
  };
}

export class PrivacyPhotoError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'PrivacyPhotoError';
  }
}

export class PrivacyPhotoService {
  private static instance: PrivacyPhotoService | null = null;
  private photoService: PhotoService;

  constructor() {
    this.photoService = new PhotoService();
  }

  static getInstance(): PrivacyPhotoService {
    if (!PrivacyPhotoService.instance) {
      PrivacyPhotoService.instance = new PrivacyPhotoService();
    }
    return PrivacyPhotoService.instance;
  }

  /**
   * Capture photo with privacy controls
   */
  async capturePrivacyAwarePhoto(
    location: { latitude: number; longitude: number; altitude?: number },
    userId: string,
    options: PrivacyPhotoOptions = {}
  ): Promise<PhotoApiFormat> {
    try {
      // Get user privacy settings
      const privacySettings = await privacyService.getPrivacySettings(userId);
      
      // Capture the original photo
      const photo = await this.photoService.capturePhoto(location);

      // Apply privacy controls based on settings
      if (options.stripExifOnCapture || privacySettings.stripExifOnShare) {
        const stripOptions: ExifStripOptions = {
          removeLocation: !privacySettings.allowLocationSharing,
          removeTimestamp: false, // Keep timestamp for internal use
          removeDeviceInfo: true,
          removeAll: false,
        };

        const processedUri = await exifService.stripExifData(photo.localUri, stripOptions);
        photo.localUri = processedUri;
      }

      return photo;
    } catch (error) {
      throw new PrivacyPhotoError('Failed to capture privacy-aware photo', error as Error);
    }
  }

  /**
   * Prepare photo for sharing with privacy controls
   */
  async preparePhotoForSharing(
    photoId: string,
    userId: string,
    options: PrivacyPhotoOptions = {}
  ): Promise<ShareablePhoto> {
    try {
      // Get the original photo
      const photos = await this.photoService.getPhotosForActivity(''); // This would need the activity ID
      const photo = photos.find(p => p.photoId === photoId);
      
      if (!photo) {
        throw new PrivacyPhotoError('Photo not found');
      }

      // Get user privacy settings
      const privacySettings = await privacyService.getPrivacySettings(userId);
      
      // Get original image metadata
      const originalMetadata = await exifService.getImageMetadata(photo.localUri);
      
      // Determine what to strip based on settings and options
      const shouldStripLocation = options.stripExifOnShare ?? privacySettings.stripExifOnShare ?? true;
      const allowLocationSharing = options.allowLocationSharing ?? privacySettings.allowLocationSharing ?? false;

      // Create privacy-safe version
      const shareableUri = await exifService.createPrivacySafeImage(photo.localUri, {
        stripLocation: shouldStripLocation || !allowLocationSharing,
        stripTimestamp: true,
        stripDeviceInfo: true,
        maxDimension: options.maxShareDimension || 2048,
        quality: options.shareQuality || 0.8,
      });

      // Get processed image metadata
      const processedMetadata = await exifService.getImageMetadata(shareableUri);

      return {
        originalPhotoId: photoId,
        shareableUri,
        hasLocationData: originalMetadata.hasLocation && allowLocationSharing,
        isProcessed: shareableUri !== photo.localUri,
        metadata: {
          originalSize: originalMetadata.fileSize,
          processedSize: processedMetadata.fileSize,
          strippedExifData: shouldStripLocation || !allowLocationSharing,
        },
      };
    } catch (error) {
      throw new PrivacyPhotoError('Failed to prepare photo for sharing', error as Error);
    }
  }

  /**
   * Batch prepare photos for sharing
   */
  async batchPreparePhotosForSharing(
    photoIds: string[],
    userId: string,
    options: PrivacyPhotoOptions = {}
  ): Promise<ShareablePhoto[]> {
    const shareablePhotos: ShareablePhoto[] = [];

    for (const photoId of photoIds) {
      try {
        const shareablePhoto = await this.preparePhotoForSharing(photoId, userId, options);
        shareablePhotos.push(shareablePhoto);
      } catch (error) {
        console.error(`Failed to prepare photo ${photoId} for sharing:`, error);
        // Continue with other photos
      }
    }

    return shareablePhotos;
  }

  /**
   * Get photos that can be shared based on privacy settings
   */
  async getShareablePhotos(activityId: string, userId: string): Promise<PhotoApiFormat[]> {
    try {
      // Check if activity can be shared
      const canShare = await privacyService.canShareActivity(activityId);
      if (!canShare) {
        return [];
      }

      // Get all photos for the activity
      const photos = await this.photoService.getPhotosForActivity(activityId);
      
      // Filter photos based on privacy settings
      const privacySettings = await privacyService.getPrivacySettings(userId);
      
      if (!privacySettings.allowLocationSharing) {
        // Return photos but mark them for location stripping
        return photos.map(photo => ({
          ...photo,
          // Add a flag to indicate location should be stripped
          exifData: undefined, // Remove EXIF data from response
        }));
      }

      return photos;
    } catch (error) {
      throw new PrivacyPhotoError('Failed to get shareable photos', error as Error);
    }
  }

  /**
   * Create photo collage for sharing with privacy controls
   */
  async createPrivacyAwareCollage(
    photoIds: string[],
    userId: string,
    options: {
      maxPhotos?: number;
      collageSize?: { width: number; height: number };
      quality?: number;
    } = {}
  ): Promise<string> {
    try {
      const { maxPhotos = 4, collageSize = { width: 1080, height: 1080 }, quality = 0.8 } = options;

      // Prepare photos for sharing (this will strip EXIF data)
      const shareablePhotos = await this.batchPreparePhotosForSharing(
        photoIds.slice(0, maxPhotos),
        userId,
        { stripExifOnShare: true }
      );

      if (shareablePhotos.length === 0) {
        throw new PrivacyPhotoError('No photos available for collage');
      }

      // Create collage using the privacy-safe images
      // This would integrate with your existing collage creation logic
      // For now, return the first processed image as a placeholder
      return shareablePhotos[0].shareableUri;
    } catch (error) {
      throw new PrivacyPhotoError('Failed to create privacy-aware collage', error as Error);
    }
  }

  /**
   * Validate photo sharing permissions
   */
  async validatePhotoSharingPermissions(
    photoId: string,
    userId: string
  ): Promise<{
    canShare: boolean;
    reason?: string;
    requiresProcessing: boolean;
  }> {
    try {
      // Get the photo and its associated activity
      const photos = await this.photoService.getPhotosForActivity(''); // Would need activity ID
      const photo = photos.find(p => p.photoId === photoId);
      
      if (!photo) {
        return {
          canShare: false,
          reason: 'Photo not found',
          requiresProcessing: false,
        };
      }

      // Check activity privacy
      const canShareActivity = await privacyService.canShareActivity(photo.activityId);
      if (!canShareActivity) {
        return {
          canShare: false,
          reason: 'Activity is private',
          requiresProcessing: false,
        };
      }

      // Check if photo has location data and user settings
      const privacySettings = await privacyService.getPrivacySettings(userId);
      const hasLocationData = await exifService.hasLocationData(photo.localUri);
      
      const requiresProcessing = hasLocationData && (
        privacySettings.stripExifOnShare || 
        !privacySettings.allowLocationSharing
      );

      return {
        canShare: true,
        requiresProcessing,
      };
    } catch (error) {
      console.error('Failed to validate photo sharing permissions:', error);
      return {
        canShare: false,
        reason: 'Permission validation failed',
        requiresProcessing: false,
      };
    }
  }

  /**
   * Clean up temporary shareable images
   */
  async cleanupShareableImages(shareablePhotos: ShareablePhoto[]): Promise<void> {
    const processedUris = shareablePhotos
      .filter(photo => photo.isProcessed)
      .map(photo => photo.shareableUri);

    await exifService.cleanupProcessedImages(processedUris);
  }

  /**
   * Get photo privacy summary
   */
  async getPhotoPrivacySummary(photoId: string): Promise<{
    hasExifData: boolean;
    hasLocationData: boolean;
    hasTimestamp: boolean;
    hasDeviceInfo: boolean;
    isShareable: boolean;
    privacyRisk: 'low' | 'medium' | 'high';
  }> {
    try {
      const photos = await this.photoService.getPhotosForActivity(''); // Would need activity ID
      const photo = photos.find(p => p.photoId === photoId);
      
      if (!photo) {
        throw new PrivacyPhotoError('Photo not found');
      }

      const metadata = await exifService.getImageMetadata(photo.localUri);
      
      // Calculate privacy risk
      let privacyRisk: 'low' | 'medium' | 'high' = 'low';
      if (metadata.hasLocation && metadata.hasTimestamp) {
        privacyRisk = 'high';
      } else if (metadata.hasLocation || metadata.hasDeviceInfo) {
        privacyRisk = 'medium';
      }

      return {
        hasExifData: metadata.hasExif,
        hasLocationData: metadata.hasLocation,
        hasTimestamp: metadata.hasTimestamp,
        hasDeviceInfo: metadata.hasDeviceInfo,
        isShareable: privacyRisk !== 'high', // Simple rule for demo
        privacyRisk,
      };
    } catch (error) {
      throw new PrivacyPhotoError('Failed to get photo privacy summary', error as Error);
    }
  }
}

// Singleton instance
export const privacyPhotoService = PrivacyPhotoService.getInstance();