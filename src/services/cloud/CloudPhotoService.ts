import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Photo } from '../../types/models';
import AuthService from '../auth/AuthService';

export interface UploadProgress {
  photoId: string;
  progress: number; // 0-100
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface SignedUploadUrls {
  photoUploadUrl: string;
  thumbnailUploadUrl: string;
  photoKey: string;
  thumbnailKey: string;
  expiresIn: number;
}

export interface BatchUploadResult {
  successful: Photo[];
  failed: { photo: Photo; error: string }[];
}

class CloudPhotoService {
  private authService: AuthService;
  private uploadProgressListeners: Map<string, (progress: UploadProgress) => void> = new Map();

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  async uploadPhoto(photo: Photo): Promise<Photo> {
    try {
      this.notifyProgress(photo.photoId, 0, 'uploading');

      // Generate signed URLs for upload
      const uploadUrls = await this.getSignedUploadUrls(photo);
      
      this.notifyProgress(photo.photoId, 10, 'processing');

      // Generate thumbnail
      const thumbnailUri = await this.generateThumbnail(photo.uri);
      
      this.notifyProgress(photo.photoId, 30, 'uploading');

      // Upload original photo
      await this.uploadFile(photo.uri, uploadUrls.photoUploadUrl);
      
      this.notifyProgress(photo.photoId, 70, 'uploading');

      // Upload thumbnail
      await this.uploadFile(thumbnailUri, uploadUrls.thumbnailUploadUrl);
      
      this.notifyProgress(photo.photoId, 90, 'processing');

      // Update photo with cloud URLs
      const updatedPhoto: Photo = {
        ...photo,
        cloudUrl: uploadUrls.photoKey,
        thumbnailCloudUrl: uploadUrls.thumbnailKey,
        uploadedAt: new Date(),
      };

      this.notifyProgress(photo.photoId, 100, 'completed');

      // Clean up local thumbnail
      await this.cleanupTempFile(thumbnailUri);

      return updatedPhoto;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      this.notifyProgress(photo.photoId, 0, 'failed', errorMessage);
      throw error;
    }
  }

  async uploadPhotoBatch(photos: Photo[]): Promise<BatchUploadResult> {
    const result: BatchUploadResult = {
      successful: [],
      failed: [],
    };

    const uploadPromises = photos.map(async (photo) => {
      try {
        const uploadedPhoto = await this.uploadPhoto(photo);
        result.successful.push(uploadedPhoto);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        result.failed.push({ photo, error: errorMessage });
      }
    });

    await Promise.allSettled(uploadPromises);
    return result;
  }

  async deletePhoto(photo: Photo): Promise<void> {
    if (!photo.cloudUrl) {
      throw new Error('Photo not uploaded to cloud');
    }

    try {
      const accessToken = await this.authService.getValidAccessToken();
      const apiEndpoint = this.authService['config'].apiEndpoint;

      const response = await fetch(`${apiEndpoint}/photos/${photo.photoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete photo from cloud');
      }

    } catch (error) {
      console.error('Failed to delete photo from cloud:', error);
      throw error;
    }
  }

  async getPhotoDownloadUrl(photoKey: string): Promise<string> {
    try {
      const accessToken = await this.authService.getValidAccessToken();
      const apiEndpoint = this.authService['config'].apiEndpoint;

      const response = await fetch(`${apiEndpoint}/photos/download-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photoKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get download URL');
      }

      const result = await response.json();
      return result.downloadUrl;

    } catch (error) {
      console.error('Failed to get photo download URL:', error);
      throw error;
    }
  }

  addUploadProgressListener(photoId: string, listener: (progress: UploadProgress) => void): void {
    this.uploadProgressListeners.set(photoId, listener);
  }

  removeUploadProgressListener(photoId: string): void {
    this.uploadProgressListeners.delete(photoId);
  }

  private async getSignedUploadUrls(photo: Photo): Promise<SignedUploadUrls> {
    try {
      const accessToken = await this.authService.getValidAccessToken();
      const apiEndpoint = this.authService['config'].apiEndpoint;

      // Get file info to determine content type and size
      const fileInfo = await FileSystem.getInfoAsync(photo.uri);
      if (!fileInfo.exists) {
        throw new Error('Photo file not found');
      }

      const contentType = this.getContentType(photo.uri);
      
      const response = await fetch(`${apiEndpoint}/photos/upload-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activityId: photo.activityId,
          photoId: photo.photoId,
          contentType,
          fileSize: fileInfo.size,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get upload URLs');
      }

      return await response.json();

    } catch (error) {
      console.error('Failed to get signed upload URLs:', error);
      throw error;
    }
  }

  private async generateThumbnail(photoUri: string): Promise<string> {
    try {
      const result = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width: 300, height: 300 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return result.uri;

    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      throw new Error('Failed to generate thumbnail');
    }
  }

  private async uploadFile(fileUri: string, uploadUrl: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('File not found');
      }

      const response = await FileSystem.uploadAsync(uploadUrl, fileUri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  private async cleanupTempFile(fileUri: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri);
      }
    } catch (error) {
      console.warn('Failed to cleanup temp file:', error);
      // Don't throw error for cleanup failures
    }
  }

  private getContentType(uri: string): string {
    const extension = uri.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'heic':
        return 'image/heic';
      default:
        return 'image/jpeg'; // Default fallback
    }
  }

  private notifyProgress(
    photoId: string,
    progress: number,
    status: UploadProgress['status'],
    error?: string
  ): void {
    const listener = this.uploadProgressListeners.get(photoId);
    if (listener) {
      listener({
        photoId,
        progress,
        status,
        error,
      });
    }
  }
}

export default CloudPhotoService;