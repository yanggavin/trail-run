import { Camera } from 'expo-camera';
import type { CameraType, FlashMode } from 'expo-camera';

export interface CameraConfig {
  type: CameraType;
  flashMode: FlashMode;
  quality: number;
  ratio: string;
  autoFocus: boolean;
  whiteBalance: string;
}

export interface OptimalCameraSettings {
  quality: number;
  ratio: string;
  flashMode: FlashMode;
  autoFocus: boolean;
}

export class CameraConfigService {
  private static readonly DEFAULT_CONFIG: CameraConfig = {
    type: 'back' as CameraType,
    flashMode: 'auto' as FlashMode,
    quality: 0.8, // High quality but not maximum to balance file size
    ratio: '4:3', // Standard ratio for best compatibility
    autoFocus: true,
    whiteBalance: 'auto'
  };

  /**
   * Get optimal camera configuration for trail photography
   */
  static getOptimalConfig(): CameraConfig {
    return { ...this.DEFAULT_CONFIG };
  }

  /**
   * Get camera settings optimized for outdoor trail conditions
   */
  static getTrailOptimizedSettings(): OptimalCameraSettings {
    return {
      quality: 0.8, // Balance between quality and file size for GPS-tagged photos
      ratio: '4:3', // Best for landscape photography
      flashMode: 'auto' as FlashMode, // Auto flash for varying light conditions
      autoFocus: true // Essential for sharp photos while moving
    };
  }

  /**
   * Get camera settings for rapid capture during active tracking
   */
  static getRapidCaptureSettings(): OptimalCameraSettings {
    return {
      quality: 0.7, // Slightly lower quality for faster processing
      ratio: '4:3',
      flashMode: 'off' as FlashMode, // Disable flash for faster capture
      autoFocus: true
    };
  }

  /**
   * Get default device capabilities (these would be checked with actual camera ref in component)
   */
  static getDefaultDeviceCapabilities(): {
    supportedRatios: string[];
    hasFlash: boolean;
    supportsAutoFocus: boolean;
  } {
    return {
      supportedRatios: ['4:3', '16:9'], // Common ratios
      hasFlash: true, // Assume most devices have flash
      supportsAutoFocus: true // Assume most devices support autofocus
    };
  }

  /**
   * Get recommended settings based on device capabilities
   */
  static getRecommendedSettings(deviceCapabilities: {
    hasFlash: boolean;
    supportsAutoFocus: boolean;
    supportedRatios: string[];
  }): CameraConfig {
    const config = { ...this.DEFAULT_CONFIG };

    // Adjust flash mode based on device capability
    if (!deviceCapabilities.hasFlash) {
      config.flashMode = 'off' as FlashMode;
    }

    // Adjust autofocus based on device capability
    if (!deviceCapabilities.supportsAutoFocus) {
      config.autoFocus = false;
    }

    // Use best available ratio
    if (deviceCapabilities.supportedRatios.includes('4:3')) {
      config.ratio = '4:3';
    } else if (deviceCapabilities.supportedRatios.includes('16:9')) {
      config.ratio = '16:9';
    } else if (deviceCapabilities.supportedRatios.length > 0) {
      config.ratio = deviceCapabilities.supportedRatios[0];
    }

    return config;
  }

  /**
   * Get photo capture options for optimal trail photography
   */
  static getPhotoCaptureOptions() {
    return {
      quality: 0.8,
      base64: false, // Don't include base64 to save memory
      exif: true, // Include EXIF data for geotagging
      skipProcessing: false // Allow processing for better quality
    };
  }

  /**
   * Get photo capture options for rapid burst photography
   */
  static getRapidCaptureOptions() {
    return {
      quality: 0.7,
      base64: false,
      exif: true,
      skipProcessing: true // Skip processing for faster capture
    };
  }
}