import CloudPhotoService, { UploadProgress } from '../CloudPhotoService';
import AuthService from '../../auth/AuthService';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Photo } from '../../../types/models';

// Mock dependencies
jest.mock('../../auth/AuthService');
jest.mock('expo-file-system');
jest.mock('expo-image-manipulator');

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('CloudPhotoService', () => {
  let cloudPhotoService: CloudPhotoService;
  let mockAuthService: jest.Mocked<AuthService>;

  const mockPhoto: Photo = {
    photoId: 'photo-1',
    activityId: 'activity-1',
    uri: 'file://photo.jpg',
    thumbnailUri: 'file://thumb.jpg',
    latitude: 37.7749,
    longitude: -122.4194,
    timestamp: new Date(),
    createdAt: new Date(),
  };

  const mockSignedUrls = {
    photoUploadUrl: 'https://s3.amazonaws.com/bucket/photo-upload-url',
    thumbnailUploadUrl: 'https://s3.amazonaws.com/bucket/thumbnail-upload-url',
    photoKey: 'user/activity/photo.jpg',
    thumbnailKey: 'user/activity/photo_thumb.jpg',
    expiresIn: 3600,
  };

  beforeEach(() => {
    // Create mock instances
    mockAuthService = new AuthService({} as any) as jest.Mocked<AuthService>;
    mockAuthService.getValidAccessToken.mockResolvedValue('mock-token');
    mockAuthService['config'] = { apiEndpoint: 'https://api.example.com' } as any;

    cloudPhotoService = new CloudPhotoService(mockAuthService);

    // Setup FileSystem mocks
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      size: 1024000,
    });
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValue({
      status: 200,
    });
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

    // Setup ImageManipulator mocks
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file://thumbnail.jpg',
    });

    // Clear all mocks
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('uploadPhoto', () => {
    it('should upload photo successfully', async () => {
      // Mock signed URLs response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSignedUrls,
      } as Response);

      const progressListener = jest.fn();
      cloudPhotoService.addUploadProgressListener(mockPhoto.photoId, progressListener);

      const result = await cloudPhotoService.uploadPhoto(mockPhoto);

      expect(result).toEqual({
        ...mockPhoto,
        cloudUrl: mockSignedUrls.photoKey,
        thumbnailCloudUrl: mockSignedUrls.thumbnailKey,
        uploadedAt: expect.any(Date),
      });

      // Verify API calls
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/photos/upload-url',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
          body: JSON.stringify({
            activityId: mockPhoto.activityId,
            photoId: mockPhoto.photoId,
            contentType: 'image/jpeg',
            fileSize: 1024000,
          }),
        })
      );

      // Verify file uploads
      expect(FileSystem.uploadAsync).toHaveBeenCalledWith(
        mockSignedUrls.photoUploadUrl,
        mockPhoto.uri,
        expect.objectContaining({
          httpMethod: 'PUT',
        })
      );

      expect(FileSystem.uploadAsync).toHaveBeenCalledWith(
        mockSignedUrls.thumbnailUploadUrl,
        'file://thumbnail.jpg',
        expect.objectContaining({
          httpMethod: 'PUT',
        })
      );

      // Verify progress notifications
      expect(progressListener).toHaveBeenCalledWith({
        photoId: mockPhoto.photoId,
        progress: 0,
        status: 'uploading',
      });

      expect(progressListener).toHaveBeenCalledWith({
        photoId: mockPhoto.photoId,
        progress: 100,
        status: 'completed',
      });

      // Verify thumbnail generation
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockPhoto.uri,
        [{ resize: { width: 300, height: 300 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Verify cleanup
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file://thumbnail.jpg');
    });

    it('should handle upload failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const progressListener = jest.fn();
      cloudPhotoService.addUploadProgressListener(mockPhoto.photoId, progressListener);

      await expect(cloudPhotoService.uploadPhoto(mockPhoto)).rejects.toThrow('Network error');

      expect(progressListener).toHaveBeenCalledWith({
        photoId: mockPhoto.photoId,
        progress: 0,
        status: 'failed',
        error: 'Network error',
      });
    });

    it('should handle file not found error', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
        exists: false,
      });

      await expect(cloudPhotoService.uploadPhoto(mockPhoto)).rejects.toThrow('Photo file not found');
    });

    it('should handle thumbnail generation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSignedUrls,
      } as Response);

      (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Thumbnail generation failed')
      );

      await expect(cloudPhotoService.uploadPhoto(mockPhoto)).rejects.toThrow(
        'Failed to generate thumbnail'
      );
    });

    it('should handle file upload failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSignedUrls,
      } as Response);

      (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({
        status: 500,
      });

      await expect(cloudPhotoService.uploadPhoto(mockPhoto)).rejects.toThrow(
        'Upload failed with status 500'
      );
    });
  });

  describe('uploadPhotoBatch', () => {
    it('should upload multiple photos successfully', async () => {
      const photos = [mockPhoto, { ...mockPhoto, photoId: 'photo-2' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSignedUrls,
      } as Response);

      const result = await cloudPhotoService.uploadPhotoBatch(photos);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch upload', async () => {
      const photos = [mockPhoto, { ...mockPhoto, photoId: 'photo-2' }];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSignedUrls,
        } as Response)
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await cloudPhotoService.uploadPhotoBatch(photos);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe('Network error');
    });
  });

  describe('deletePhoto', () => {
    it('should delete photo from cloud successfully', async () => {
      const photoWithCloudUrl = {
        ...mockPhoto,
        cloudUrl: 'user/activity/photo.jpg',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await cloudPhotoService.deletePhoto(photoWithCloudUrl);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/photos/${photoWithCloudUrl.photoId}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });

    it('should throw error if photo not uploaded to cloud', async () => {
      await expect(cloudPhotoService.deletePhoto(mockPhoto)).rejects.toThrow(
        'Photo not uploaded to cloud'
      );
    });

    it('should handle delete failure', async () => {
      const photoWithCloudUrl = {
        ...mockPhoto,
        cloudUrl: 'user/activity/photo.jpg',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Photo not found' }),
      } as Response);

      await expect(cloudPhotoService.deletePhoto(photoWithCloudUrl)).rejects.toThrow(
        'Photo not found'
      );
    });
  });

  describe('getPhotoDownloadUrl', () => {
    it('should get download URL successfully', async () => {
      const downloadUrl = 'https://s3.amazonaws.com/bucket/download-url';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ downloadUrl }),
      } as Response);

      const result = await cloudPhotoService.getPhotoDownloadUrl('photo-key');

      expect(result).toBe(downloadUrl);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/photos/download-url',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ photoKey: 'photo-key' }),
        })
      );
    });

    it('should handle download URL failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Photo not found' }),
      } as Response);

      await expect(cloudPhotoService.getPhotoDownloadUrl('invalid-key')).rejects.toThrow(
        'Photo not found'
      );
    });
  });

  describe('progress listeners', () => {
    it('should add and remove progress listeners', () => {
      const listener = jest.fn();
      
      cloudPhotoService.addUploadProgressListener('photo-1', listener);
      cloudPhotoService.removeUploadProgressListener('photo-1');

      // Listener should not be called after removal
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('content type detection', () => {
    it('should detect JPEG content type', async () => {
      const jpegPhoto = { ...mockPhoto, uri: 'file://photo.jpg' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSignedUrls,
      } as Response);

      await cloudPhotoService.uploadPhoto(jpegPhoto);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"contentType":"image/jpeg"'),
        })
      );
    });

    it('should detect PNG content type', async () => {
      const pngPhoto = { ...mockPhoto, uri: 'file://photo.png' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSignedUrls,
      } as Response);

      await cloudPhotoService.uploadPhoto(pngPhoto);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"contentType":"image/png"'),
        })
      );
    });

    it('should detect HEIC content type', async () => {
      const heicPhoto = { ...mockPhoto, uri: 'file://photo.heic' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSignedUrls,
      } as Response);

      await cloudPhotoService.uploadPhoto(heicPhoto);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"contentType":"image/heic"'),
        })
      );
    });

    it('should default to JPEG for unknown extensions', async () => {
      const unknownPhoto = { ...mockPhoto, uri: 'file://photo.unknown' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSignedUrls,
      } as Response);

      await cloudPhotoService.uploadPhoto(unknownPhoto);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"contentType":"image/jpeg"'),
        })
      );
    });
  });
});