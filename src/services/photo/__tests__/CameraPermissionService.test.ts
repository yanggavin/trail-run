import { CameraPermissionService } from '../CameraPermissionService';

// Mock the dependencies
jest.mock('expo-camera', () => ({
  Camera: {
    getCameraPermissionsAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
  },
}));

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openSettings: jest.fn(),
  },
}));

// Import mocked modules
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking } from 'react-native';

const mockCamera = Camera as jest.Mocked<typeof Camera>;
const mockMediaLibrary = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
const mockAlert = Alert as jest.Mocked<typeof Alert>;
const mockLinking = Linking as jest.Mocked<typeof Linking>;

describe('CameraPermissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestCameraPermissions', () => {
    it('should return true when camera permission is granted', async () => {
      mockCamera.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'granted' as any,
        canAskAgain: true,
        granted: true,
        expires: 'never'
      });

      const result = await CameraPermissionService.requestCameraPermissions();

      expect(result).toBe(true);
      expect(mockCamera.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('should return false when camera permission is denied', async () => {
      mockCamera.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        canAskAgain: true,
        granted: false,
        expires: 'never'
      });

      const result = await CameraPermissionService.requestCameraPermissions();

      expect(result).toBe(false);
      expect(mockCamera.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('should show alert and return false when permission is permanently denied', async () => {
      mockCamera.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        canAskAgain: false,
        granted: false,
        expires: 'never'
      });

      const result = await CameraPermissionService.requestCameraPermissions();

      expect(result).toBe(false);
      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Camera Access Required',
        'TrailRun needs camera access to capture photos during your runs. Please enable camera permissions in Settings.',
        expect.any(Array)
      );
    });

    it('should handle errors gracefully', async () => {
      mockCamera.requestCameraPermissionsAsync.mockRejectedValue(new Error('Permission error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await CameraPermissionService.requestCameraPermissions();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error requesting camera permissions:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('requestMediaLibraryPermissions', () => {
    it('should return true when media library permission is granted', async () => {
      mockMediaLibrary.requestPermissionsAsync.mockResolvedValue({
        status: 'granted' as any,
        canAskAgain: true,
        granted: true,
        expires: 'never',
        accessPrivileges: 'all'
      });

      const result = await CameraPermissionService.requestMediaLibraryPermissions();

      expect(result).toBe(true);
      expect(mockMediaLibrary.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('should return false when media library permission is denied', async () => {
      mockMediaLibrary.requestPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        canAskAgain: true,
        granted: false,
        expires: 'never',
        accessPrivileges: 'none'
      });

      const result = await CameraPermissionService.requestMediaLibraryPermissions();

      expect(result).toBe(false);
      expect(mockMediaLibrary.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('should show alert when permission is permanently denied', async () => {
      mockMediaLibrary.requestPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        canAskAgain: false,
        granted: false,
        expires: 'never',
        accessPrivileges: 'none'
      });

      const result = await CameraPermissionService.requestMediaLibraryPermissions();

      expect(result).toBe(false);
      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Photo Library Access Required',
        'TrailRun needs photo library access to save your trail photos. Please enable photo permissions in Settings.',
        expect.any(Array)
      );
    });
  });

  describe('checkPermissions', () => {
    it('should return correct permission status when both permissions are granted', async () => {
      mockCamera.getCameraPermissionsAsync.mockResolvedValue({
        status: 'granted' as any,
        canAskAgain: true,
        granted: true,
        expires: 'never'
      });

      mockMediaLibrary.getPermissionsAsync.mockResolvedValue({
        status: 'granted' as any,
        canAskAgain: true,
        granted: true,
        expires: 'never',
        accessPrivileges: 'all'
      });

      const result = await CameraPermissionService.checkPermissions();

      expect(result).toEqual({
        camera: true,
        mediaLibrary: true,
        canAskAgain: true
      });
    });

    it('should return correct permission status when permissions are denied', async () => {
      mockCamera.getCameraPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        canAskAgain: false,
        granted: false,
        expires: 'never'
      });

      mockMediaLibrary.getPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        canAskAgain: true,
        granted: false,
        expires: 'never',
        accessPrivileges: 'none'
      });

      const result = await CameraPermissionService.checkPermissions();

      expect(result).toEqual({
        camera: false,
        mediaLibrary: false,
        canAskAgain: false // Should be false if any permission can't ask again
      });
    });

    it('should handle errors gracefully', async () => {
      mockCamera.getCameraPermissionsAsync.mockRejectedValue(new Error('Check error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await CameraPermissionService.checkPermissions();

      expect(result).toEqual({
        camera: false,
        mediaLibrary: false,
        canAskAgain: false
      });
      expect(consoleSpy).toHaveBeenCalledWith('Error checking permissions:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('requestAllPermissions', () => {
    it('should return true when both permissions are granted', async () => {
      mockCamera.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'granted' as any,
        canAskAgain: true,
        granted: true,
        expires: 'never'
      });

      mockMediaLibrary.requestPermissionsAsync.mockResolvedValue({
        status: 'granted' as any,
        canAskAgain: true,
        granted: true,
        expires: 'never',
        accessPrivileges: 'all'
      });

      const result = await CameraPermissionService.requestAllPermissions();

      expect(result).toBe(true);
      expect(mockCamera.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(mockMediaLibrary.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('should return false when any permission is denied', async () => {
      mockCamera.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'granted' as any,
        canAskAgain: true,
        granted: true,
        expires: 'never'
      });

      mockMediaLibrary.requestPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        canAskAgain: true,
        granted: false,
        expires: 'never',
        accessPrivileges: 'none'
      });

      const result = await CameraPermissionService.requestAllPermissions();

      expect(result).toBe(false);
    });
  });

  describe('showCameraPermissionInfo', () => {
    it('should resolve with true when user allows camera access', async () => {
      mockAlert.alert.mockImplementation((title: any, message: any, buttons: any) => {
        // Simulate user pressing "Allow Camera" button
        if (buttons && buttons[1] && buttons[1].onPress) {
          buttons[1].onPress();
        }
      });

      const result = await CameraPermissionService.showCameraPermissionInfo();

      expect(result).toBe(true);
      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Camera Access',
        'TrailRun would like to access your camera to capture photos during your trail runs. These photos will be automatically tagged with your current location and saved to your activity record.',
        expect.any(Array)
      );
    });

    it('should resolve with false when user cancels', async () => {
      mockAlert.alert.mockImplementation((title: any, message: any, buttons: any) => {
        // Simulate user pressing "Not Now" button
        if (buttons && buttons[0] && buttons[0].onPress) {
          buttons[0].onPress();
        }
      });

      const result = await CameraPermissionService.showCameraPermissionInfo();

      expect(result).toBe(false);
    });
  });

  describe('showPhotoLibraryPermissionInfo', () => {
    it('should resolve with true when user allows photo library access', async () => {
      mockAlert.alert.mockImplementation((title: any, message: any, buttons: any) => {
        // Simulate user pressing "Allow Access" button
        if (buttons && buttons[1] && buttons[1].onPress) {
          buttons[1].onPress();
        }
      });

      const result = await CameraPermissionService.showPhotoLibraryPermissionInfo();

      expect(result).toBe(true);
      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Photo Library Access',
        'TrailRun would like to save your trail photos to your photo library and access existing photos for backup purposes.',
        expect.any(Array)
      );
    });

    it('should resolve with false when user cancels', async () => {
      mockAlert.alert.mockImplementation((title: any, message: any, buttons: any) => {
        // Simulate user pressing "Not Now" button
        if (buttons && buttons[0] && buttons[0].onPress) {
          buttons[0].onPress();
        }
      });

      const result = await CameraPermissionService.showPhotoLibraryPermissionInfo();

      expect(result).toBe(false);
    });
  });
});