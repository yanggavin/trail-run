import { useState, useEffect, useCallback } from 'react';
import SyncService, { SyncStatus, SyncResult } from '../services/sync/SyncService';
import { Activity, Photo } from '../types/models';

export interface UseSyncReturn {
  status: SyncStatus;
  syncNow: () => Promise<SyncResult>;
  queueActivity: (activity: Activity, operation: 'create' | 'update' | 'delete') => Promise<void>;
  queuePhoto: (photo: Photo, operation: 'create' | 'update' | 'delete') => Promise<void>;
  setOnlineStatus: (isOnline: boolean) => void;
  clearFailedItems: () => Promise<void>;
  retryFailedItems: () => Promise<void>;
}

export const useSync = (syncService: SyncService): UseSyncReturn => {
  const [status, setStatus] = useState<SyncStatus>(syncService.getSyncStatus());

  useEffect(() => {
    const removeListener = syncService.addListener(setStatus);
    
    // Initialize with current status
    setStatus(syncService.getSyncStatus());
    
    return removeListener;
  }, [syncService]);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    return await syncService.syncNow();
  }, [syncService]);

  const queueActivity = useCallback(async (
    activity: Activity,
    operation: 'create' | 'update' | 'delete'
  ): Promise<void> => {
    await syncService.queueActivity(activity, operation);
  }, [syncService]);

  const queuePhoto = useCallback(async (
    photo: Photo,
    operation: 'create' | 'update' | 'delete'
  ): Promise<void> => {
    await syncService.queuePhoto(photo, operation);
  }, [syncService]);

  const setOnlineStatus = useCallback((isOnline: boolean): void => {
    syncService.setOnlineStatus(isOnline);
  }, [syncService]);

  const clearFailedItems = useCallback(async (): Promise<void> => {
    await syncService.clearFailedItems();
  }, [syncService]);

  const retryFailedItems = useCallback(async (): Promise<void> => {
    await syncService.retryFailedItems();
  }, [syncService]);

  return {
    status,
    syncNow,
    queueActivity,
    queuePhoto,
    setOnlineStatus,
    clearFailedItems,
    retryFailedItems,
  };
};