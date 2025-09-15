import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking } from 'react-native';

export interface PermissionStatus {
  camera: boolean;
  mediaLibrary: boolean;
  canAskAgain: boolean;
}

export class CameraPermissionService {
  /**
   * Request camera permissions with user-friendly messaging
   */
  static async requestCameraPermissions(): Promise<boolean> {
    try {
      const { status, canAskAgain } = await Camera.requestCameraPermissionsAsync();
      
      if (status === 'granted') {
        return true;
      }
      
      if (status === 'denied' && !canAskAgain) {
        this.showPermissionDeniedAlert('camera');
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return false;
    }
  }

  /**
   * Request media library permissions for photo saving
   */
  static async requestMediaLibraryPermissions(): Promise<boolean> {
    try {
      const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
      
      if (status === 'granted') {
        return true;
      }
      
      if (status === 'denied' && !canAskAgain) {
        this.showPermissionDeniedAlert('photos');
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting media library permissions:', error);
      return false;
    }
  }

  /**
   * Check current permission status for both camera and media library
   */
  static async checkPermissions(): Promise<PermissionStatus> {
    try {
      const [cameraResult, mediaResult] = await Promise.all([
        Camera.getCameraPermissionsAsync(),
        MediaLibrary.getPermissionsAsync()
      ]);

      return {
        camera: cameraResult.status === 'granted',
        mediaLibrary: mediaResult.status === 'granted',
        canAskAgain: cameraResult.canAskAgain && mediaResult.canAskAgain
      };
    } catch (error) {
      console.error('Error checking permissions:', error);
      return {
        camera: false,
        mediaLibrary: false,
        canAskAgain: false
      };
    }
  }

  /**
   * Request all required permissions for photo capture
   */
  static async requestAllPermissions(): Promise<boolean> {
    const [cameraGranted, mediaGranted] = await Promise.all([
      this.requestCameraPermissions(),
      this.requestMediaLibraryPermissions()
    ]);

    return cameraGranted && mediaGranted;
  }

  /**
   * Show user-friendly alert when permissions are permanently denied
   */
  private static showPermissionDeniedAlert(type: 'camera' | 'photos'): void {
    const title = type === 'camera' ? 'Camera Access Required' : 'Photo Library Access Required';
    const message = type === 'camera' 
      ? 'TrailRun needs camera access to capture photos during your runs. Please enable camera permissions in Settings.'
      : 'TrailRun needs photo library access to save your trail photos. Please enable photo permissions in Settings.';

    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings()
        }
      ]
    );
  }

  /**
   * Show informative alert about camera permissions before first request
   */
  static showCameraPermissionInfo(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Camera Access',
        'TrailRun would like to access your camera to capture photos during your trail runs. These photos will be automatically tagged with your current location and saved to your activity record.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Allow Camera',
            onPress: () => resolve(true)
          }
        ]
      );
    });
  }

  /**
   * Show informative alert about photo library permissions
   */
  static showPhotoLibraryPermissionInfo(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Photo Library Access',
        'TrailRun would like to save your trail photos to your photo library and access existing photos for backup purposes.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Allow Access',
            onPress: () => resolve(true)
          }
        ]
      );
    });
  }
}