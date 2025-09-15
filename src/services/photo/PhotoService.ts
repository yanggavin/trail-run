import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Photo, Location, ExifData } from '../../types';
import { CameraPermissionService } from './CameraPermissionService';
import { CameraConfigService } from './CameraConfigService';

export interface PhotoCaptureOptions {
  quality?: number;
  includeExif?: boolean;
  generateThumbnail?: boolean;
  rapidCapture?: boolean;
}

export interface PhotoCaptureResult {
  photo: Photo;
  thumbnailUri?: string;
  processingTime: number;
}

export class PhotoService {
  private static readonly THUMBNAIL_SIZE = { width: 200, height: 200 };

  /**
   * Capture photo with automatic geotagging
   */
  static async capturePhoto(
    cameraRef: any, // Camera component ref
    location: Location,
    activityId: string,
    options: PhotoCaptureOptions = {}
  ): Promise<PhotoCaptureResult> {
    const startTime = Date.now();

    try {
      // Check permissions
      const hasPermissions = await CameraPermissionService.requestAllPermissions();
      if (!hasPermissions) {
        throw new Error('Camera or media library permissions not granted');
      }

      // Get capture options
      const captureOptions = options.rapidCapture
        ? CameraConfigService.getRapidCaptureOptions()
        : CameraConfigService.getPhotoCaptureOptions();

      // Capture photo
      const capturedPhoto = await cameraRef.takePictureAsync({
        ...captureOptions,
        exif: options.includeExif !== false,
      });

      if (!capturedPhoto || !capturedPhoto.uri) {
        throw new Error('Failed to capture photo');
      }

      // Generate unique photo ID
      const photoId = this.generatePhotoId();

      // Create photo object with geotag data
      const photo: Photo = {
        photoId,
        activityId,
        timestamp: new Date(),
        latitude: location.latitude,
        longitude: location.longitude,
        localUri: capturedPhoto.uri,
        exifData: this.createExifData(location, capturedPhoto.exif),
        syncStatus: 'local',
      };

      // Generate thumbnail if requested
      let thumbnailUri: string | undefined;
      if (options.generateThumbnail !== false) {
        thumbnailUri = await this.generateThumbnail(capturedPhoto.uri);
        photo.thumbnailUri = thumbnailUri;
      }

      const processingTime = Date.now() - startTime;

      return {
        photo,
        thumbnailUri,
        processingTime,
      };
    } catch (error) {
      console.error('Error capturing photo:', error);
      throw error;
    }
  }

  /**
   * Generate thumbnail for photo
   */
  static async generateThumbnail(photoUri: string): Promise<string> {
    try {
      const manipulatedImage = await manipulateAsync(
        photoUri,
        [{ resize: this.THUMBNAIL_SIZE }],
        {
          compress: 0.7,
          format: SaveFormat.JPEG,
        }
      );

      return manipulatedImage.uri;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      throw error;
    }
  }

  /**
   * Strip EXIF data from photo for privacy
   */
  static async stripExifData(photoUri: string): Promise<string> {
    try {
      const strippedPhoto = await manipulateAsync(
        photoUri,
        [], // No manipulations, just re-save without EXIF
        {
          compress: 1.0, // No compression to maintain quality
          format: SaveFormat.JPEG,
        }
      );

      return strippedPhoto.uri;
    } catch (error) {
      console.error('Error stripping EXIF data:', error);
      throw error;
    }
  }

  /**
   * Save photo to device photo library
   */
  static async saveToPhotoLibrary(photoUri: string): Promise<void> {
    try {
      const hasPermission = await CameraPermissionService.requestMediaLibraryPermissions();
      if (!hasPermission) {
        throw new Error('Media library permission not granted');
      }

      await MediaLibrary.saveToLibraryAsync(photoUri);
    } catch (error) {
      console.error('Error saving photo to library:', error);
      throw error;
    }
  }

  /**
   * Validate photo URI format
   */
  static validatePhotoUri(photoUri: string): boolean {
    try {
      return photoUri.startsWith('file://') || photoUri.startsWith('content://');
    } catch (error) {
      console.error('Error validating photo URI:', error);
      return false;
    }
  }

  /**
   * Get photos for activity (placeholder - would integrate with PhotoRepository)
   */
  static async getPhotosForActivity(activityId: string): Promise<Photo[]> {
    // This would integrate with PhotoRepository in a real implementation
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Generate unique photo ID
   */
  private static generatePhotoId(): string {
    return `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create EXIF data with GPS coordinates
   */
  private static createExifData(location: Location, originalExif?: any): ExifData {
    const exifData: ExifData = {
      // GPS coordinates
      GPSLatitude: location.latitude,
      GPSLongitude: location.longitude,
      GPSLatitudeRef: location.latitude >= 0 ? 'N' : 'S',
      GPSLongitudeRef: location.longitude >= 0 ? 'E' : 'W',
      GPSTimeStamp: new Date().toISOString(),
      
      // Device and app info
      Software: 'TrailRun',
      DateTime: new Date().toISOString(),
      
      // Location accuracy if available
      ...(location.accuracy && { GPSHPositioningError: location.accuracy }),
      ...(location.altitude && { GPSAltitude: location.altitude }),
    };

    // Merge with original EXIF data if available
    if (originalExif) {
      return { ...originalExif, ...exifData };
    }

    return exifData;
  }
}