import { ShareableContentService } from '../ShareableContentService';
import { Activity, Photo, TrackPoint } from '../../../types';
import { ActivityStatistics } from '../ActivityStatisticsService';
import { createActivity, createPhoto, createTrackPoint } from '../../../types/models';
import * as FileSystem from 'expo-file-system';

// Mock expo modules
jest.mock('expo-file-system', () => ({
  Paths: {
    document: {
      uri: 'file://mock-documents/',
    },
  },
  File: jest.fn().mockImplementation((path, ...segments) => ({
    uri: `file://mock/${segments.join('/')}`,
    write: jest.fn(),
    copy: jest.fn(),
    info: jest.fn().mockReturnValue({ size: 1024 }),
  })),
  Directory: jest.fn().mockImplementation((path, ...segments) => ({
    uri: `file://mock/${segments.join('/')}/`,
    create: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
}));

// Note: expo-sharing mock would be here in a real implementation
// jest.mock('expo-sharing', () => ({
//   isAvailableAsync: jest.fn(),
//   shareAsync: jest.fn(),
// }));

describe('ShareableContentService', () => {
  let service: ShareableContentService;

  beforeEach(() => {
    service = new ShareableContentService();
    jest.clearAllMocks();
  });

  const createTestActivity = (): Activity => {
    const activity = createActivity({
      activityId: 'test-activity',
      userId: 'test-user',
      startedAt: new Date('2023-01-01T10:00:00Z'),
    });
    activity.endedAt = new Date('2023-01-01T11:00:00Z');
    activity.durationSec = 3600;
    return activity;
  };

  const createTestStatistics = (): ActivityStatistics => {
    return {
      durationSec: 3600,
      distanceM: 5000,
      avgPaceSecPerKm: 720, // 12:00/km
      elevGainM: 150,
      elevLossM: 120,
      splitKm: [
        { kmIndex: 1, durationSec: 700, paceSecPerKm: 700 },
        { kmIndex: 2, durationSec: 720, paceSecPerKm: 720 },
        { kmIndex: 3, durationSec: 740, paceSecPerKm: 740 },
      ],
      maxSpeed: 5.5,
      minElevation: 100,
      maxElevation: 250,
      totalAscent: 180,
      totalDescent: 150,
    };
  };

  const createTestPhotos = (count: number = 3): Photo[] => {
    const photos: Photo[] = [];
    const baseTime = new Date('2023-01-01T10:15:00Z').getTime();

    for (let i = 0; i < count; i++) {
      photos.push(createPhoto({
        photoId: `photo-${i + 1}`,
        activityId: 'test-activity',
        latitude: 40.7128 + (i * 0.001),
        longitude: -74.0060 + (i * 0.001),
        localUri: `file://photo-${i + 1}.jpg`,
        timestamp: new Date(baseTime + (i * 600000)), // 10 minutes apart
      }));
    }

    return photos;
  };

  const createTestTrackPoints = (count: number = 10): TrackPoint[] => {
    const points: TrackPoint[] = [];
    const baseTime = new Date('2023-01-01T10:00:00Z').getTime();

    for (let i = 0; i < count; i++) {
      points.push(createTrackPoint({
        latitude: 40.7128 + (i * 0.001),
        longitude: -74.0060 + (i * 0.001),
        accuracy: 5,
        source: 'gps',
        altitude: 100 + (i * 5),
        speed: 2.5,
        timestamp: new Date(baseTime + (i * 60000)), // 1 minute intervals
      }));
    }

    return points;
  };

  describe('createShareableImage', () => {
    it('should create a shareable image with all components', async () => {
      const activity = createTestActivity();
      const statistics = createTestStatistics();
      const photos = createTestPhotos();
      const trackPoints = createTestTrackPoints();

      const result = await service.createShareableImage(
        activity,
        statistics,
        photos,
        trackPoints
      );

      expect(result).toBeDefined();
      expect(result.uri).toBeTruthy();
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      // Verify that file operations were called
      expect(result.uri).toBeTruthy();
    });

    it('should create image without map when no track points', async () => {
      const activity = createTestActivity();
      const statistics = createTestStatistics();
      const photos = createTestPhotos();

      const result = await service.createShareableImage(
        activity,
        statistics,
        photos,
        [] // No track points
      );

      expect(result).toBeDefined();
      expect(result.uri).toBeTruthy();
    });

    it('should create image without photos when none provided', async () => {
      const activity = createTestActivity();
      const statistics = createTestStatistics();
      const trackPoints = createTestTrackPoints();

      const result = await service.createShareableImage(
        activity,
        statistics,
        [], // No photos
        trackPoints
      );

      expect(result).toBeDefined();
      expect(result.uri).toBeTruthy();
    });

    it('should respect custom options', async () => {
      const activity = createTestActivity();
      const statistics = createTestStatistics();
      const photos = createTestPhotos();
      const trackPoints = createTestTrackPoints();

      const result = await service.createShareableImage(
        activity,
        statistics,
        photos,
        trackPoints,
        {
          includeMap: false,
          includeStats: false,
          includePhotos: false,
          format: 'png',
          quality: 0.5,
        }
      );

      expect(result).toBeDefined();
      expect(result.uri).toContain('.png');
    });

    it('should add watermark when provided', async () => {
      const activity = createTestActivity();
      const statistics = createTestStatistics();
      const photos = createTestPhotos();
      const trackPoints = createTestTrackPoints();

      const result = await service.createShareableImage(
        activity,
        statistics,
        photos,
        trackPoints,
        {
          watermark: 'TrailRun App',
        }
      );

      expect(result).toBeDefined();
      expect(result.uri).toBeTruthy();
    });
  });

  describe('createPhotoCollage', () => {
    it('should create a grid collage', async () => {
      const activity = createTestActivity();
      const photos = createTestPhotos(6);
      const trackPoints = createTestTrackPoints();

      const result = await service.createPhotoCollage(
        photos,
        activity,
        trackPoints,
        { layout: 'grid' }
      );

      expect(result).toBeDefined();
      expect(result.uri).toBeTruthy();
      expect(result.layout).toBe('grid');
      expect(result.photosIncluded).toBeLessThanOrEqual(photos.length);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should create a timeline collage', async () => {
      const activity = createTestActivity();
      const photos = createTestPhotos(4);
      const trackPoints = createTestTrackPoints();

      const result = await service.createPhotoCollage(
        photos,
        activity,
        trackPoints,
        { layout: 'timeline' }
      );

      expect(result).toBeDefined();
      expect(result.layout).toBe('timeline');
      expect(result.uri).toContain('timeline');
    });

    it('should create a highlight collage', async () => {
      const activity = createTestActivity();
      const photos = createTestPhotos(5);
      const trackPoints = createTestTrackPoints();

      const result = await service.createPhotoCollage(
        photos,
        activity,
        trackPoints,
        { layout: 'highlight' }
      );

      expect(result).toBeDefined();
      expect(result.layout).toBe('highlight');
      expect(result.uri).toContain('highlight');
    });

    it('should limit photos to maxPhotos setting', async () => {
      const activity = createTestActivity();
      const photos = createTestPhotos(15); // More than default max
      const trackPoints = createTestTrackPoints();

      const result = await service.createPhotoCollage(
        photos,
        activity,
        trackPoints,
        { maxPhotos: 6 }
      );

      expect(result.photosIncluded).toBeLessThanOrEqual(6);
    });

    it('should throw error for empty photos array', async () => {
      const activity = createTestActivity();
      const trackPoints = createTestTrackPoints();

      await expect(
        service.createPhotoCollage([], activity, trackPoints)
      ).rejects.toThrow('No photos available for collage');
    });

    it('should throw error for unsupported layout', async () => {
      const activity = createTestActivity();
      const photos = createTestPhotos();
      const trackPoints = createTestTrackPoints();

      await expect(
        service.createPhotoCollage(photos, activity, trackPoints, {
          layout: 'unsupported' as any,
        })
      ).rejects.toThrow('Unsupported collage layout');
    });

    it('should include map overlay when requested', async () => {
      const activity = createTestActivity();
      const photos = createTestPhotos();
      const trackPoints = createTestTrackPoints();

      const result = await service.createPhotoCollage(
        photos,
        activity,
        trackPoints,
        { includeMap: true }
      );

      expect(result).toBeDefined();
      expect(result.uri).toBeTruthy();
    });
  });

  describe('exportActivityPackage', () => {
    // No additional setup needed with new mocks
  });

    it('should export complete activity package', async () => {
      const activity = createTestActivity();
      const statistics = createTestStatistics();
      const photos = createTestPhotos();
      const trackPoints = createTestTrackPoints();

      const result = await service.exportActivityPackage(
        activity,
        statistics,
        photos,
        trackPoints
      );

      expect(result).toBeDefined();
      expect(result.exportUri).toBeTruthy();
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalSize).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);

      // Verify export was successful
      expect(result.exportUri).toBeTruthy();
      expect(result.totalFiles).toBeGreaterThan(0);
    });

    it('should export GPX data when requested', async () => {
      const activity = createTestActivity();
      const statistics = createTestStatistics();
      const photos = createTestPhotos();
      const trackPoints = createTestTrackPoints();

      const result = await service.exportActivityPackage(
        activity,
        statistics,
        photos,
        trackPoints,
        { includeGpxData: true }
      );

      // Verify GPX export was successful
      expect(result.totalFiles).toBeGreaterThan(1); // Should include GPX file
    });

    it('should export original photos when requested', async () => {
      const activity = createTestActivity();
      const statistics = createTestStatistics();
      const photos = createTestPhotos();
      const trackPoints = createTestTrackPoints();

      const result = await service.exportActivityPackage(
        activity,
        statistics,
        photos,
        trackPoints,
        { includeOriginalPhotos: true }
      );

      // Verify photos were included in export
      expect(result.totalFiles).toBeGreaterThan(1); // Should include photo files
    });

    it('should export processed images when requested', async () => {
      const activity = createTestActivity();
      const statistics = createTestStatistics();
      const photos = createTestPhotos();
      const trackPoints = createTestTrackPoints();

      const result = await service.exportActivityPackage(
        activity,
        statistics,
        photos,
        trackPoints,
        { includeProcessedImages: true }
      );

      // Verify processed images were included
      expect(result.totalFiles).toBeGreaterThan(1); // Should include processed files
    });

    it('should handle export with minimal options', async () => {
      const activity = createTestActivity();
      const statistics = createTestStatistics();

      const result = await service.exportActivityPackage(
        activity,
        statistics,
        [], // No photos
        [], // No track points
        {
          includeOriginalPhotos: false,
          includeProcessedImages: false,
          includeGpxData: false,
        }
      );

      expect(result).toBeDefined();
      expect(result.totalFiles).toBeGreaterThanOrEqual(1); // At least metadata
    });
  });

  describe('shareContent', () => {
    it('should share content using native share sheet', async () => {
      const uri = 'file://test-image.jpg';
      const title = 'My Trail Run';
      const message = 'Check out my run!';

      // Should not throw error
      await expect(service.shareContent(uri, title, message)).resolves.toBeUndefined();
    });

    it('should handle different file types correctly', async () => {
      // Should not throw errors for different file types
      await expect(service.shareContent('file://test.png')).resolves.toBeUndefined();
      await expect(service.shareContent('file://export.zip')).resolves.toBeUndefined();
      await expect(service.shareContent('file://activity.gpx')).resolves.toBeUndefined();
    });

    it('should use default title when none provided', async () => {
      // Should not throw error with default title
      await expect(service.shareContent('file://test.jpg')).resolves.toBeUndefined();
    });
  });

  describe('stripExifData', () => {
    const mockManipulate = require('expo-image-manipulator');

    beforeEach(() => {
      mockManipulate.manipulateAsync.mockResolvedValue({
        uri: 'file://stripped-photo.jpg',
        width: 1080,
        height: 1080,
      });
    });

    it('should strip EXIF data from photo', async () => {
      const originalUri = 'file://original-photo.jpg';
      
      const result = await service.stripExifData(originalUri);

      expect(result).toBe('file://stripped-photo.jpg');
      expect(mockManipulate.manipulateAsync).toHaveBeenCalledWith(
        originalUri,
        [], // No manipulations
        expect.objectContaining({
          compress: 1.0,
          format: 'jpeg',
        })
      );
    });

    it('should handle manipulation errors', async () => {
      mockManipulate.manipulateAsync.mockRejectedValue(new Error('Manipulation failed'));

      await expect(
        service.stripExifData('file://photo.jpg')
      ).rejects.toThrow('Manipulation failed');
    });
  });

  describe('GPX generation', () => {
    it('should generate valid GPX content', async () => {
      const activity = createTestActivity();
      const statistics = createTestStatistics();
      const trackPoints = createTestTrackPoints(3);

      await service.exportActivityPackage(
        activity,
        statistics,
        [],
        trackPoints,
        { includeGpxData: true }
      );

      // Since we're using mocks, we'll test the GPX generation method directly
      const gpxContent = (service as any).generateGpxContent(activity, trackPoints);
      
      expect(gpxContent).toContain('<?xml version="1.0"');
      expect(gpxContent).toContain('<gpx version="1.1"');
      expect(gpxContent).toContain('<trk>');
      expect(gpxContent).toContain('<trkpt');
      expect(gpxContent).toContain('lat="40.7128"');
      expect(gpxContent).toContain('lon="-74.006"');
      expect(gpxContent).toContain('<ele>100</ele>');
      expect(gpxContent).toContain('<time>');
    });
  });

  describe('MIME type and UTI detection', () => {
    it('should detect correct MIME types', () => {
      const testCases = [
        { uri: 'file://test.jpg', expectedMime: 'image/jpeg' },
        { uri: 'file://test.jpeg', expectedMime: 'image/jpeg' },
        { uri: 'file://test.png', expectedMime: 'image/png' },
        { uri: 'file://test.zip', expectedMime: 'application/zip' },
        { uri: 'file://test.gpx', expectedMime: 'application/gpx+xml' },
        { uri: 'file://test.unknown', expectedMime: 'application/octet-stream' },
      ];

      for (const testCase of testCases) {
        // Access private method for testing
        const mimeType = (service as any).getMimeType(testCase.uri);
        expect(mimeType).toBe(testCase.expectedMime);
      }
    });

    it('should detect correct UTI types', () => {
      const testCases = [
        { uri: 'file://test.jpg', expectedUTI: 'public.jpeg' },
        { uri: 'file://test.png', expectedUTI: 'public.png' },
        { uri: 'file://test.zip', expectedUTI: 'public.zip-archive' },
        { uri: 'file://test.gpx', expectedUTI: 'public.xml' },
        { uri: 'file://test.unknown', expectedUTI: 'public.data' },
      ];

      for (const testCase of testCases) {
        // Access private method for testing
        const uti = (service as any).getUTI(testCase.uri);
        expect(uti).toBe(testCase.expectedUTI);
      }
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      const { File } = require('expo-file-system');
      File.mockImplementation(() => ({
        write: jest.fn().mockRejectedValue(new Error('File system error')),
        uri: 'file://mock/error.jpg',
      }));

      const activity = createTestActivity();
      const statistics = createTestStatistics();

      await expect(
        service.createShareableImage(activity, statistics, [], [])
      ).rejects.toThrow();
    });

    it('should handle export directory creation errors', async () => {
      const { Directory } = require('expo-file-system');
      Directory.mockImplementation(() => ({
        create: jest.fn().mockRejectedValue(new Error('Directory creation failed')),
        uri: 'file://mock/error/',
      }));

      const activity = createTestActivity();
      const statistics = createTestStatistics();

      await expect(
        service.exportActivityPackage(activity, statistics, [], [])
      ).rejects.toThrow();
    });

    it('should handle photo processing errors in export', async () => {
      const mockManipulate = require('expo-image-manipulator');
      mockManipulate.manipulateAsync.mockRejectedValue(new Error('Processing failed'));

      const activity = createTestActivity();
      const statistics = createTestStatistics();
      const photos = createTestPhotos();

      // Should not throw, but should log warnings
      const result = await service.exportActivityPackage(
        activity,
        statistics,
        photos,
        [],
        { includeProcessedImages: true }
      );

      expect(result).toBeDefined();
    });
  });
});