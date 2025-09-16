import { ExifService, ExifError, exifService, ExifData, ExifStripOptions } from '../ExifService';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

// Mock dependencies
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
}));

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

describe('ExifService', () => {
  let service: ExifService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = ExifService.getInstance();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ExifService.getInstance();
      const instance2 = ExifService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export singleton instance', () => {
      expect(exifService).toBeInstanceOf(ExifService);
      expect(exifService).toBe(ExifService.getInstance());
    });
  });

  describe('extractExifData', () => {
    it('should extract EXIF data from existing image', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024000,
      });

      const exifData = await service.extractExifData('/path/to/image.jpg');

      expect(exifData).not.toBeNull();
      expect(exifData).toHaveProperty('make');
      expect(exifData).toHaveProperty('model');
      expect(exifData).toHaveProperty('dateTime');
      expect(exifData).toHaveProperty('orientation');
      expect(exifData).toHaveProperty('software');
    });

    it('should return null for non-existent image', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      await expect(service.extractExifData('/path/to/nonexistent.jpg')).rejects.toThrow(ExifError);
      await expect(service.extractExifData('/path/to/nonexistent.jpg')).rejects.toThrow('Image file does not exist');
    });

    it('should handle file system errors gracefully', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('File system error'));

      const exifData = await service.extractExifData('/path/to/image.jpg');

      expect(exifData).toBeNull();
    });
  });

  describe('addGpsToExif', () => {
    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024000,
      });
    });

    it('should add GPS coordinates to EXIF data', async () => {
      const latitude = 37.7749;
      const longitude = -122.4194;
      const altitude = 100;

      const updatedExif = await service.addGpsToExif('/path/to/image.jpg', latitude, longitude, altitude);

      expect(updatedExif.gpsLatitude).toBe(latitude);
      expect(updatedExif.gpsLongitude).toBe(longitude);
      expect(updatedExif.gpsAltitude).toBe(altitude);
      expect(updatedExif.gpsTimestamp).toBeTruthy();
    });

    it('should add GPS coordinates without altitude', async () => {
      const latitude = 37.7749;
      const longitude = -122.4194;

      const updatedExif = await service.addGpsToExif('/path/to/image.jpg', latitude, longitude);

      expect(updatedExif.gpsLatitude).toBe(latitude);
      expect(updatedExif.gpsLongitude).toBe(longitude);
      expect(updatedExif.gpsAltitude).toBeUndefined();
      expect(updatedExif.gpsTimestamp).toBeTruthy();
    });

    it('should preserve existing EXIF data when adding GPS', async () => {
      const latitude = 37.7749;
      const longitude = -122.4194;

      const updatedExif = await service.addGpsToExif('/path/to/image.jpg', latitude, longitude);

      expect(updatedExif.make).toBe('Unknown'); // From mock data
      expect(updatedExif.model).toBe('Unknown'); // From mock data
      expect(updatedExif.gpsLatitude).toBe(latitude);
      expect(updatedExif.gpsLongitude).toBe(longitude);
    });

    it('should handle errors when adding GPS data', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('File error'));

      await expect(service.addGpsToExif('/path/to/image.jpg', 37.7749, -122.4194)).rejects.toThrow(ExifError);
      await expect(service.addGpsToExif('/path/to/image.jpg', 37.7749, -122.4194)).rejects.toThrow('Failed to add GPS data to EXIF');
    });
  });

  describe('stripExifData', () => {
    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024000,
      });
    });

    it('should strip all EXIF data when removeAll is true', async () => {
      const options: ExifStripOptions = {
        removeLocation: false,
        removeTimestamp: false,
        removeDeviceInfo: false,
        removeAll: true,
      };

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: '/path/to/processed.jpg',
      });

      const processedUri = await service.stripExifData('/path/to/image.jpg', options);

      expect(processedUri).toBe('/path/to/processed.jpg');
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        '/path/to/image.jpg',
        [],
        expect.objectContaining({
          compress: 0.9,
          format: 'jpeg',
          base64: false,
        })
      );
    });

    it('should strip selective EXIF data', async () => {
      const options: ExifStripOptions = {
        removeLocation: true,
        removeTimestamp: false,
        removeDeviceInfo: false,
        removeAll: false,
      };

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: '/path/to/processed.jpg',
      });

      const processedUri = await service.stripExifData('/path/to/image.jpg', options);

      expect(processedUri).toBe('/path/to/processed.jpg');
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
    });

    it('should return original URI when no stripping is needed', async () => {
      const options: ExifStripOptions = {
        removeLocation: false,
        removeTimestamp: false,
        removeDeviceInfo: false,
        removeAll: false,
      };

      const processedUri = await service.stripExifData('/path/to/image.jpg', options);

      expect(processedUri).toBe('/path/to/image.jpg');
      expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
    });

    it('should handle non-existent files', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const options: ExifStripOptions = {
        removeLocation: true,
        removeTimestamp: true,
        removeDeviceInfo: true,
        removeAll: false,
      };

      await expect(service.stripExifData('/path/to/nonexistent.jpg', options)).rejects.toThrow(ExifError);
      await expect(service.stripExifData('/path/to/nonexistent.jpg', options)).rejects.toThrow('Image file does not exist');
    });

    it('should handle ImageManipulator errors', async () => {
      const options: ExifStripOptions = {
        removeLocation: false,
        removeTimestamp: false,
        removeDeviceInfo: false,
        removeAll: true,
      };

      (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(new Error('Manipulation failed'));

      await expect(service.stripExifData('/path/to/image.jpg', options)).rejects.toThrow(ExifError);
      await expect(service.stripExifData('/path/to/image.jpg', options)).rejects.toThrow('Failed to create clean image copy');
    });
  });

  describe('GPS coordinate validation', () => {
    it('should validate correct GPS coordinates', () => {
      const exifData: ExifData = {
        gpsLatitude: 37.7749,
        gpsLongitude: -122.4194,
      };

      const isValid = service.validateGpsCoordinates(exifData);

      expect(isValid).toBe(true);
    });

    it('should reject coordinates outside valid ranges', () => {
      const invalidLatitude: ExifData = {
        gpsLatitude: 91, // Invalid latitude
        gpsLongitude: -122.4194,
      };

      const invalidLongitude: ExifData = {
        gpsLatitude: 37.7749,
        gpsLongitude: 181, // Invalid longitude
      };

      expect(service.validateGpsCoordinates(invalidLatitude)).toBe(false);
      expect(service.validateGpsCoordinates(invalidLongitude)).toBe(false);
    });

    it('should reject null island coordinates (0,0)', () => {
      const nullIsland: ExifData = {
        gpsLatitude: 0,
        gpsLongitude: 0,
      };

      const isValid = service.validateGpsCoordinates(nullIsland);

      expect(isValid).toBe(false);
    });

    it('should reject missing coordinates', () => {
      const missingLatitude: ExifData = {
        gpsLongitude: -122.4194,
      };

      const missingLongitude: ExifData = {
        gpsLatitude: 37.7749,
      };

      const missingBoth: ExifData = {};

      expect(service.validateGpsCoordinates(missingLatitude)).toBe(false);
      expect(service.validateGpsCoordinates(missingLongitude)).toBe(false);
      expect(service.validateGpsCoordinates(missingBoth)).toBe(false);
    });
  });

  describe('extractGpsCoordinates', () => {
    it('should extract valid GPS coordinates', () => {
      const exifData: ExifData = {
        gpsLatitude: 37.7749,
        gpsLongitude: -122.4194,
        gpsAltitude: 100,
      };

      const coordinates = service.extractGpsCoordinates(exifData);

      expect(coordinates).toEqual({
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 100,
      });
    });

    it('should extract coordinates without altitude', () => {
      const exifData: ExifData = {
        gpsLatitude: 37.7749,
        gpsLongitude: -122.4194,
      };

      const coordinates = service.extractGpsCoordinates(exifData);

      expect(coordinates).toEqual({
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: undefined,
      });
    });

    it('should return null for invalid coordinates', () => {
      const invalidExifData: ExifData = {
        gpsLatitude: 0,
        gpsLongitude: 0,
      };

      const coordinates = service.extractGpsCoordinates(invalidExifData);

      expect(coordinates).toBeNull();
    });
  });

  describe('hasLocationData', () => {
    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024000,
      });
    });

    it('should return true for images with valid location data', async () => {
      // Mock extractExifData to return GPS data
      jest.spyOn(service, 'extractExifData').mockResolvedValue({
        gpsLatitude: 37.7749,
        gpsLongitude: -122.4194,
      });

      const hasLocation = await service.hasLocationData('/path/to/image.jpg');

      expect(hasLocation).toBe(true);
    });

    it('should return false for images without location data', async () => {
      jest.spyOn(service, 'extractExifData').mockResolvedValue({
        make: 'Unknown',
        model: 'Unknown',
      });

      const hasLocation = await service.hasLocationData('/path/to/image.jpg');

      expect(hasLocation).toBe(false);
    });

    it('should return false when EXIF extraction fails', async () => {
      jest.spyOn(service, 'extractExifData').mockResolvedValue(null);

      const hasLocation = await service.hasLocationData('/path/to/image.jpg');

      expect(hasLocation).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(service, 'extractExifData').mockRejectedValue(new Error('Extraction failed'));

      const hasLocation = await service.hasLocationData('/path/to/image.jpg');

      expect(hasLocation).toBe(false);
    });
  });

  describe('getImageMetadata', () => {
    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024000,
      });

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: '/path/to/resized.jpg',
      });
    });

    it('should return comprehensive image metadata', async () => {
      jest.spyOn(service, 'extractExifData').mockResolvedValue({
        make: 'Apple',
        model: 'iPhone 12',
        dateTime: '2024-01-01T12:00:00Z',
        gpsLatitude: 37.7749,
        gpsLongitude: -122.4194,
      });

      const metadata = await service.getImageMetadata('/path/to/image.jpg');

      expect(metadata).toEqual({
        hasExif: true,
        hasLocation: true,
        hasTimestamp: true,
        hasDeviceInfo: true,
        fileSize: 1024000,
        dimensions: { width: 0, height: 0 }, // Placeholder in mock
      });
    });

    it('should handle images without EXIF data', async () => {
      jest.spyOn(service, 'extractExifData').mockResolvedValue(null);

      const metadata = await service.getImageMetadata('/path/to/image.jpg');

      expect(metadata).toEqual({
        hasExif: false,
        hasLocation: false,
        hasTimestamp: false,
        hasDeviceInfo: false,
        fileSize: 1024000,
        dimensions: { width: 0, height: 0 },
      });
    });

    it('should handle non-existent files', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      await expect(service.getImageMetadata('/path/to/nonexistent.jpg')).rejects.toThrow(ExifError);
      await expect(service.getImageMetadata('/path/to/nonexistent.jpg')).rejects.toThrow('Image file does not exist');
    });

    it('should handle dimension extraction errors gracefully', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(new Error('Dimension extraction failed'));
      
      jest.spyOn(service, 'extractExifData').mockResolvedValue({
        make: 'Apple',
        model: 'iPhone 12',
      });

      const metadata = await service.getImageMetadata('/path/to/image.jpg');

      expect(metadata.dimensions).toBeUndefined();
      expect(metadata.hasExif).toBe(true);
    });
  });

  describe('createPrivacySafeImage', () => {
    beforeEach(() => {
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: '/path/to/privacy-safe.jpg',
      });
    });

    it('should create privacy-safe image with default options', async () => {
      const processedUri = await service.createPrivacySafeImage('/path/to/image.jpg');

      expect(processedUri).toBe('/path/to/privacy-safe.jpg');
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        '/path/to/image.jpg',
        [{ resize: { width: 2048, height: 2048 } }],
        expect.objectContaining({
          compress: 0.8,
          format: 'jpeg',
          base64: false,
        })
      );
    });

    it('should create privacy-safe image with custom options', async () => {
      const options = {
        stripLocation: true,
        stripTimestamp: false,
        stripDeviceInfo: true,
        maxDimension: 1024,
        quality: 0.6,
      };

      const processedUri = await service.createPrivacySafeImage('/path/to/image.jpg', options);

      expect(processedUri).toBe('/path/to/privacy-safe.jpg');
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        '/path/to/image.jpg',
        [{ resize: { width: 1024, height: 1024 } }],
        expect.objectContaining({
          compress: 0.6,
          format: 'jpeg',
        })
      );
    });

    it('should handle no resizing when maxDimension is not specified', async () => {
      const options = {
        maxDimension: undefined,
      };

      await service.createPrivacySafeImage('/path/to/image.jpg', options);

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        '/path/to/image.jpg',
        [],
        expect.any(Object)
      );
    });

    it('should handle ImageManipulator errors', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(new Error('Processing failed'));

      await expect(service.createPrivacySafeImage('/path/to/image.jpg')).rejects.toThrow(ExifError);
      await expect(service.createPrivacySafeImage('/path/to/image.jpg')).rejects.toThrow('Failed to create privacy-safe image');
    });
  });

  describe('batchStripExifData', () => {
    const imageUris = ['/path/to/image1.jpg', '/path/to/image2.jpg', '/path/to/image3.jpg'];
    const options: ExifStripOptions = {
      removeLocation: true,
      removeTimestamp: true,
      removeDeviceInfo: false,
      removeAll: false,
    };

    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024000,
      });

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: '/path/to/processed.jpg',
      });
    });

    it('should process all images successfully', async () => {
      const results = await service.batchStripExifData(imageUris, options);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.original).toBe(imageUris[index]);
        expect(result.processed).toBe('/path/to/processed.jpg');
      });
    });

    it('should continue processing even if some images fail', async () => {
      // Make the second image fail
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true, size: 1024000 })
        .mockResolvedValueOnce({ exists: false }) // This will cause an error
        .mockResolvedValueOnce({ exists: true, size: 1024000 });

      const results = await service.batchStripExifData(imageUris, options);

      expect(results).toHaveLength(3);
      expect(results[0].processed).toBe('/path/to/processed.jpg');
      expect(results[1].processed).toBe('/path/to/image2.jpg'); // Original URI returned on error
      expect(results[2].processed).toBe('/path/to/processed.jpg');
    });

    it('should handle empty input array', async () => {
      const results = await service.batchStripExifData([], options);

      expect(results).toHaveLength(0);
    });
  });

  describe('cleanupProcessedImages', () => {
    it('should delete temporary processed images', async () => {
      const processedUris = [
        '/path/to/ImageManipulator/processed1.jpg',
        '/path/to/temp/processed2.jpg',
        '/path/to/permanent/image.jpg', // Should not be deleted
      ];

      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await service.cleanupProcessedImages(processedUris);

      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        '/path/to/ImageManipulator/processed1.jpg',
        { idempotent: true }
      );
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        '/path/to/temp/processed2.jpg',
        { idempotent: true }
      );
    });

    it('should handle deletion errors gracefully', async () => {
      const processedUris = ['/path/to/ImageManipulator/processed.jpg'];

      (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(new Error('Deletion failed'));

      await expect(service.cleanupProcessedImages(processedUris)).resolves.not.toThrow();
    });

    it('should handle empty input array', async () => {
      await expect(service.cleanupProcessedImages([])).resolves.not.toThrow();
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should create ExifError with original error', () => {
      const originalError = new Error('Original error');
      const exifError = new ExifError('EXIF error', originalError);

      expect(exifError.message).toBe('EXIF error');
      expect(exifError.originalError).toBe(originalError);
      expect(exifError.name).toBe('ExifError');
    });

    it('should create ExifError without original error', () => {
      const exifError = new ExifError('EXIF error');

      expect(exifError.message).toBe('EXIF error');
      expect(exifError.originalError).toBeUndefined();
      expect(exifError.name).toBe('ExifError');
    });
  });
});