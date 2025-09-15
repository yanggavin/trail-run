import { useState, useCallback } from 'react';
import CloudPhotoService, { UploadProgress, BatchUploadResult } from '../services/cloud/CloudPhotoService';
import { Photo } from '../types/models';

export interface UseCloudPhotoReturn {
  uploadPhoto: (photo: Photo) => Promise<Photo>;
  uploadPhotoBatch: (photos: Photo[]) => Promise<BatchUploadResult>;
  deletePhoto: (photo: Photo) => Promise<void>;
  getPhotoDownloadUrl: (photoKey: string) => Promise<string>;
  uploadProgress: Map<string, UploadProgress>;
  isUploading: boolean;
}

export const useCloudPhoto = (cloudPhotoService: CloudPhotoService): UseCloudPhotoReturn => {
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  const updateProgress = useCallback((photoId: string, progress: UploadProgress) => {
    setUploadProgress(prev => {
      const newMap = new Map(prev);
      newMap.set(photoId, progress);
      return newMap;
    });

    // Update uploading status
    setIsUploading(progress.status === 'uploading' || progress.status === 'processing');
  }, []);

  const uploadPhoto = useCallback(async (photo: Photo): Promise<Photo> => {
    try {
      setIsUploading(true);
      
      // Add progress listener
      cloudPhotoService.addUploadProgressListener(photo.photoId, (progress) => {
        updateProgress(photo.photoId, progress);
      });

      const result = await cloudPhotoService.uploadPhoto(photo);

      // Remove progress listener
      cloudPhotoService.removeUploadProgressListener(photo.photoId);
      
      // Clear progress
      setUploadProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(photo.photoId);
        return newMap;
      });

      return result;
    } catch (error) {
      // Remove progress listener on error
      cloudPhotoService.removeUploadProgressListener(photo.photoId);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [cloudPhotoService, updateProgress]);

  const uploadPhotoBatch = useCallback(async (photos: Photo[]): Promise<BatchUploadResult> => {
    try {
      setIsUploading(true);

      // Add progress listeners for all photos
      photos.forEach(photo => {
        cloudPhotoService.addUploadProgressListener(photo.photoId, (progress) => {
          updateProgress(photo.photoId, progress);
        });
      });

      const result = await cloudPhotoService.uploadPhotoBatch(photos);

      // Remove progress listeners
      photos.forEach(photo => {
        cloudPhotoService.removeUploadProgressListener(photo.photoId);
      });

      // Clear progress for all photos
      setUploadProgress(prev => {
        const newMap = new Map(prev);
        photos.forEach(photo => {
          newMap.delete(photo.photoId);
        });
        return newMap;
      });

      return result;
    } catch (error) {
      // Remove progress listeners on error
      photos.forEach(photo => {
        cloudPhotoService.removeUploadProgressListener(photo.photoId);
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [cloudPhotoService, updateProgress]);

  const deletePhoto = useCallback(async (photo: Photo): Promise<void> => {
    return await cloudPhotoService.deletePhoto(photo);
  }, [cloudPhotoService]);

  const getPhotoDownloadUrl = useCallback(async (photoKey: string): Promise<string> => {
    return await cloudPhotoService.getPhotoDownloadUrl(photoKey);
  }, [cloudPhotoService]);

  return {
    uploadPhoto,
    uploadPhotoBatch,
    deletePhoto,
    getPhotoDownloadUrl,
    uploadProgress,
    isUploading,
  };
};