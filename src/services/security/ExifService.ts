import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export interface ExifData {
  make?: string;
  model?: string;
  dateTime?: string;
  orientation?: number;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  gpsTimestamp?: string;
  software?: string;
  [key: string]: any;
}

export interface ExifStripOptions {
  removeLocation: boolean;
  removeTimestamp: boolean;
  removeDeviceInfo: boolean;
  removeAll: boolean;
}

export class ExifError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'ExifError';
  }
}

export class ExifService {
  private static instance: ExifService | null = null;

  static getInstance(): ExifService {
    if (!ExifService.instance) {
      ExifService.instance = new ExifService();
    }
    return ExifService.instance;
  }

  /**
   * Extract EXIF data from image file
   */
  async extractExifData(imageUri: string): Promise<ExifData | null> {
    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        throw new ExifError('Image file does not exist');
      }

      // For React Native, we would typically use a library like react-native-exif
      // Since we're using Expo, we'll use a simplified approach
      // In a real implementation, you would use expo-image-picker's exif data or a dedicated EXIF library

      // This is a placeholder implementation
      // In practice, you would extract actual EXIF data from the image
      const mockExifData: ExifData = {
        make: 'Unknown',
        model: 'Unknown',
        dateTime: new Date().toISOString(),
        orientation: 1,
        software: 'TrailRun App',
      };

      return mockExifData;
    } catch (error) {
      console.error('Failed to extract EXIF data:', error);
      return null;
    }
  }

  /**
   * Add GPS coordinates to EXIF data
   */
  async addGpsToExif(imageUri: string, latitude: number, longitude: number, altitude?: number): Promise<ExifData> {
    try {
      const existingExif = await this.extractExifData(imageUri) || {};

      const updatedExif: ExifData = {
        ...existingExif,
        gpsLatitude: latitude,
        gpsLongitude: longitude,
        gpsTimestamp: new Date().toISOString(),
      };

      if (altitude !== undefined) {
        updatedExif.gpsAltitude = altitude;
      }

      return updatedExif;
    } catch (error) {
      throw new ExifError('Failed to add GPS data to EXIF', error as Error);
    }
  }

  /**
   * Strip EXIF data from image based on options
   */
  async stripExifData(imageUri: string, options: ExifStripOptions): Promise<string> {
    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        throw new ExifError('Image file does not exist');
      }

      // If removing all EXIF data, use ImageManipulator to create a clean copy
      if (options.removeAll) {
        return this.createCleanImageCopy(imageUri);
      }

      // For selective EXIF removal, we would need a more sophisticated approach
      // This is a simplified implementation
      if (options.removeLocation || options.removeTimestamp || options.removeDeviceInfo) {
        return this.createCleanImageCopy(imageUri);
      }

      // If no stripping is needed, return original URI
      return imageUri;
    } catch (error) {
      throw new ExifError('Failed to strip EXIF data', error as Error);
    }
  }

  /**
   * Create a copy of the image without EXIF data
   */
  private async createCleanImageCopy(imageUri: string): Promise<string> {
    try {
      // Use ImageManipulator to create a new image without EXIF data
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [], // No transformations, just re-encode
        {
          compress: 0.9, // Slight compression to ensure EXIF is removed
          format: ImageManipulator.SaveFormat.JPEG,
          base64: false,
        }
      );

      return result.uri;
    } catch (error) {
      throw new ExifError('Failed to create clean image copy', error as Error);
    }
  }

  /**
   * Validate GPS coordinates in EXIF data
   */
  validateGpsCoordinates(exifData: ExifData): boolean {
    if (!exifData.gpsLatitude || !exifData.gpsLongitude) {
      return false;
    }

    const lat = exifData.gpsLatitude;
    const lng = exifData.gpsLongitude;

    // Check if coordinates are within valid ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return false;
    }

    // Check if coordinates are not null island (0,0)
    if (lat === 0 && lng === 0) {
      return false;
    }

    return true;
  }

  /**
   * Extract GPS coordinates from EXIF data
   */
  extractGpsCoordinates(exifData: ExifData): { latitude: number; longitude: number; altitude?: number } | null {
    if (!this.validateGpsCoordinates(exifData)) {
      return null;
    }

    return {
      latitude: exifData.gpsLatitude!,
      longitude: exifData.gpsLongitude!,
      altitude: exifData.gpsAltitude,
    };
  }

  /**
   * Check if image has location data in EXIF
   */
  async hasLocationData(imageUri: string): Promise<boolean> {
    try {
      const exifData = await this.extractExifData(imageUri);
      return exifData ? this.validateGpsCoordinates(exifData) : false;
    } catch (error) {
      console.error('Failed to check location data:', error);
      return false;
    }
  }

  /**
   * Get image metadata summary
   */
  async getImageMetadata(imageUri: string): Promise<{
    hasExif: boolean;
    hasLocation: boolean;
    hasTimestamp: boolean;
    hasDeviceInfo: boolean;
    fileSize: number;
    dimensions?: { width: number; height: number };
  }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        throw new ExifError('Image file does not exist');
      }

      const exifData = await this.extractExifData(imageUri);
      
      // Get image dimensions using ImageManipulator
      let dimensions: { width: number; height: number } | undefined;
      try {
        // This is a workaround to get image dimensions
        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 1, height: 1 } }], // Minimal resize to get original dimensions
          { format: ImageManipulator.SaveFormat.JPEG }
        );
        // In a real implementation, you would extract dimensions from the manipulation result
        dimensions = { width: 0, height: 0 }; // Placeholder
      } catch (error) {
        console.warn('Failed to get image dimensions:', error);
      }

      return {
        hasExif: exifData !== null,
        hasLocation: exifData ? this.validateGpsCoordinates(exifData) : false,
        hasTimestamp: exifData?.dateTime !== undefined,
        hasDeviceInfo: exifData?.make !== undefined || exifData?.model !== undefined,
        fileSize: fileInfo.size || 0,
        dimensions,
      };
    } catch (error) {
      throw new ExifError('Failed to get image metadata', error as Error);
    }
  }

  /**
   * Create privacy-safe image for sharing
   */
  async createPrivacySafeImage(
    imageUri: string,
    options: {
      stripLocation?: boolean;
      stripTimestamp?: boolean;
      stripDeviceInfo?: boolean;
      maxDimension?: number;
      quality?: number;
    } = {}
  ): Promise<string> {
    try {
      const {
        stripLocation = true,
        stripTimestamp = true,
        stripDeviceInfo = true,
        maxDimension = 2048,
        quality = 0.8,
      } = options;

      // Prepare transformations
      const transformations: ImageManipulator.Action[] = [];

      // Resize if needed
      if (maxDimension) {
        transformations.push({
          resize: {
            width: maxDimension,
            height: maxDimension,
          },
        });
      }

      // Create processed image
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        transformations,
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: false,
        }
      );

      // If we need to strip specific EXIF data (not all), we would do additional processing here
      // For now, ImageManipulator removes most EXIF data by default

      return result.uri;
    } catch (error) {
      throw new ExifError('Failed to create privacy-safe image', error as Error);
    }
  }

  /**
   * Batch process images for privacy
   */
  async batchStripExifData(
    imageUris: string[],
    options: ExifStripOptions
  ): Promise<{ original: string; processed: string }[]> {
    const results: { original: string; processed: string }[] = [];

    for (const imageUri of imageUris) {
      try {
        const processedUri = await this.stripExifData(imageUri, options);
        results.push({ original: imageUri, processed: processedUri });
      } catch (error) {
        console.error(`Failed to process image ${imageUri}:`, error);
        // Continue with other images even if one fails
        results.push({ original: imageUri, processed: imageUri });
      }
    }

    return results;
  }

  /**
   * Clean up temporary processed images
   */
  async cleanupProcessedImages(processedUris: string[]): Promise<void> {
    for (const uri of processedUris) {
      try {
        // Only delete if it's a temporary file (contains 'ImageManipulator' in path)
        if (uri.includes('ImageManipulator') || uri.includes('temp')) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      } catch (error) {
        console.warn(`Failed to cleanup processed image ${uri}:`, error);
      }
    }
  }
}

// Singleton instance
export const exifService = ExifService.getInstance();