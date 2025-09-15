// Mock all dependencies before importing anything
jest.mock('expo-camera', () => ({
  Camera: {
    getCameraPermissionsAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
  },
}));

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

jest.mock('../CameraPermissionService', () => ({
  CameraPermissionService: {
    requestAllPermissions: jest.fn(),
    requestMediaLibraryPermissions: jest.fn(),
  },
}));

jest.mock('../CameraConfigService', () => ({
  CameraConfigService: {
    getPhotoCaptureOptions: jest.fn(),
    getRapidCaptureOptions: jest.fn(),
  },
}));

import { PhotoService } from '../PhotoService';
import { Location } from '../../../types';
import { manipulateAsync } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { CameraPermissionService } from '../CameraPermissionService';
import { CameraConfigService } from '../CameraConfigService';

const mockManipulateAsync = manipulateAsync as jest.MockedFunction<typeof manipulateAsync>;
const mockMediaLibrary = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
const mockCameraPermissionService = CameraPermissionService as jest.Mocked<typeof CameraPermissionService>;
const mockCameraConfigService = CameraConfigService as jest.Mocked<typeof CameraConfigService>;

describe('PhotoService', () => {
  const mockLocation: Location = {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 100,
    accuracy: 5,
    timestamp: new Date(),
  };

  const mockCameraRef = {
    takePictureAsync: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockCameraPermissionService.requestAllPermissions.mockResolvedValue(true);
    mockCameraPermissionService.requestMediaLibraryPermissions.mockResolvedValue(true);
    mockCameraConfigService.getPhotoCaptureOptions.mockReturnValue({
      quality: 0.8,
      base64: false,
      exif: true,
      skipProcessing: false,
    });
    mockCameraConfigService.getRapidCaptureOptions.mockReturnValue({
      quality: 0.7,
      base64: false,
      exif: true,
      skipProcessing: true,
    });
  });

  describe('capturePhoto', () => {
    it('should capture photo with geotagging successfully', async () => {
      const mockCapturedPhoto = {
        uri: 'file:///temp/photo.jpg',
        width: 1920,
        height: 1080,
        exif: { Make: 'Apple', Model: 'iPhone' },
      };

      mockCameraRef.takePictureAsync.mockResolvedValue(mockCapturedPhoto);
      mockManipulateAsync.mockResolvedValue({
        uri: 'file:///temp/thumbnail.jpg',
        width: 200,
        height: 200,
      });

      const result = await PhotoService.capturePhoto(
        mockCameraRef,
        mockLocation,
        'activity123'
      );

      expect(result.photo).toMatchObject({
        activityId: 'activity123',
        latitude: mockLocation.latitude,
        longitude: mockLocation.longitude,
        syncStatus: 'local',
        localUri: mockCapturedPhoto.uri,
      });
      expect(result.photo.photoId).toMatch(/^photo_\d+_[a-z0-9]+$/);
      expect(result.photo.exifData).toMatchObject({
        GPSLatitude: mockLocation.latitude,
        GPSLongitude: mockLocation.longitude,
        GPSLatitudeRef: 'N',
        GPSLongitudeRef: 'W',
        Software: 'TrailRun',
      });
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.thumbnailUri).toBe('file:///temp/thumbnail.jpg');
    });

    it('should handle rapid capture mode', async () => {
      const mockCapturedPhoto = {
        uri: 'file:///temp/photo.jpg',
        width: 1920,
        height: 1080,
      };

      mockCameraRef.takePictureAsync.mockResolvedValue(mockCapturedPhoto);

      await PhotoService.capturePhoto(
        mockCameraRef,
        mockLocation,
        'activity123',
        { rapidCapture: true, generateThumbnail: false }
      );

      expect(mockCameraConfigService.getRapidCaptureOptions).toHaveBeenCalled();
      expect(mockCameraRef.takePictureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 0.7,
          skipProcessing: true,
        })
      );
    });

    it('should throw error when permissions are not granted', async () => {
      mockCameraPermissionService.requestAllPermissions.mockResolvedValue(false);

      await expect(
        PhotoService.capturePhoto(mockCameraRef, mockLocation, 'activity123')
      ).rejects.toThrow('Camera or media library permissions not granted');
    });

    it('should throw error when photo capture fails', async () => {
      mockCameraRef.takePictureAsync.mockResolvedValue(null);

      await expect(
        PhotoService.capturePhoto(mockCameraRef, mockLocation, 'activity123')
      ).rejects.toThrow('Failed to capture photo');
    });

    it('should handle photo without thumbnail generation', async () => {
      const mockCapturedPhoto = {
        uri: 'file:///temp/photo.jpg',
        width: 1920,
        height: 1080,
      };

      mockCameraRef.takePictureAsync.mockResolvedValue(mockCapturedPhoto);

      const result = await PhotoService.capturePhoto(
        mockCameraRef,
        mockLocation,
        'activity123',
        { generateThumbnail: false }
      );

      expect(result.thumbnailUri).toBeUndefined();
      expect(result.photo.thumbnailUri).toBeUndefined();
      expect(mockManipulateAsync).not.toHaveBeenCalled();
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail successfully', async () => {
      mockManipulateAsync.mockResolvedValue({
        uri: 'file:///temp/thumbnail.jpg',
        width: 200,
        height: 200,
      });

      const thumbnailUri = await PhotoService.generateThumbnail('file:///photos/photo.jpg');

      expect(thumbnailUri).toBe('file:///temp/thumbnail.jpg');
      expect(mockManipulateAsync).toHaveBeenCalledWith(
        'file:///photos/photo.jpg',
        [{ resize: { width: 200, height: 200 } }],
        {
          compress: 0.7,
          format: 'jpeg',
        }
      );
    });

    it('should handle thumbnail generation errors', async () => {
      mockManipulateAsync.mockRejectedValue(new Error('Manipulation failed'));

      await expect(
        PhotoService.generateThumbnail('file:///photos/photo.jpg')
      ).rejects.toThrow('Manipulation failed');
    });
  });

  describe('stripExifData', () => {
    it('should strip EXIF data successfully', async () => {
      mockManipulateAsync.mockResolvedValue({
        uri: 'file:///temp/stripped.jpg',
        width: 1920,
        height: 1080,
      });

      const strippedUri = await PhotoService.stripExifData('file:///photos/photo.jpg');

      expect(strippedUri).toBe('file:///temp/stripped.jpg');
      expect(mockManipulateAsync).toHaveBeenCalledWith(
        'file:///photos/photo.jpg',
        [],
        {
          compress: 1.0,
          format: 'jpeg',
        }
      );
    });
  });

  describe('saveToPhotoLibrary', () => {
    it('should save photo to library successfully', async () => {
      mockMediaLibrary.saveToLibraryAsync.mockResolvedValue({} as any);

      await PhotoService.saveToPhotoLibrary('file:///photos/photo.jpg');

      expect(mockCameraPermissionService.requestMediaLibraryPermissions).toHaveBeenCalled();
      expect(mockMediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith('file:///photos/photo.jpg');
    });

    it('should throw error when media library permission is not granted', async () => {
      mockCameraPermissionService.requestMediaLibraryPermissions.mockResolvedValue(false);

      await expect(
        PhotoService.saveToPhotoLibrary('file:///photos/photo.jpg')
      ).rejects.toThrow('Media library permission not granted');
    });
  });

  describe('validatePhotoUri', () => {
    it('should return true for valid file URI', () => {
      const isValid = PhotoService.validatePhotoUri('file:///photos/photo.jpg');
      expect(isValid).toBe(true);
    });

    it('should return true for valid content URI', () => {
      const isValid = PhotoService.validatePhotoUri('content://media/external/images/media/123');
      expect(isValid).toBe(true);
    });

    it('should return false for invalid URI', () => {
      const isValid = PhotoService.validatePhotoUri('http://example.com/photo.jpg');
      expect(isValid).toBe(false);
    });

    it('should return false for empty URI', () => {
      const isValid = PhotoService.validatePhotoUri('');
      expect(isValid).toBe(false);
    });
  });

  describe('getPhotosForActivity', () => {
    it('should return empty array as placeholder', async () => {
      const photos = await PhotoService.getPhotosForActivity('activity123');
      expect(photos).toEqual([]);
    });
  });
});