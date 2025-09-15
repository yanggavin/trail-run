import { Activity, Photo } from '../../types/models';
import { AuthService } from '../auth/AuthService';
import { ActivityRepository } from '../repositories/ActivityRepository';
import { PhotoRepository } from '../repositories/PhotoRepository';

export interface SyncQueueItem {
  id: string;
  type: 'activity' | 'photo';
  operation: 'create' | 'update' | 'delete';
  data: any;
  retryCount: number;
  lastAttempt?: Date;
  createdAt: Date;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime?: Date;
  pendingItems: number;
  failedItems: number;
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  errors: string[];
}

class SyncService {
  private authService: AuthService;
  private activityRepository: ActivityRepository;
  private photoRepository: PhotoRepository;
  private syncQueue: SyncQueueItem[] = [];
  private isSyncing = false;
  private isOnline = true;
  private maxRetries = 3;
  private baseRetryDelay = 1000; // 1 second
  private syncInterval?: NodeJS.Timeout;
  private listeners: ((status: SyncStatus) => void)[] = [];

  constructor(
    authService: AuthService,
    activityRepository: ActivityRepository,
    photoRepository: PhotoRepository
  ) {
    this.authService = authService;
    this.activityRepository = activityRepository;
    this.photoRepository = photoRepository;
    
    this.loadSyncQueue();
    this.startPeriodicSync();
  }

  async initialize(): Promise<void> {
    await this.loadSyncQueue();
    this.notifyListeners();
  }

  addListener(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async queueActivity(activity: Activity, operation: 'create' | 'update' | 'delete'): Promise<void> {
    const queueItem: SyncQueueItem = {
      id: `activity_${activity.activityId}_${Date.now()}`,
      type: 'activity',
      operation,
      data: activity,
      retryCount: 0,
      createdAt: new Date(),
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();
    this.notifyListeners();

    // Try immediate sync if online
    if (this.isOnline && !this.isSyncing) {
      this.syncNow();
    }
  }

  async queuePhoto(photo: Photo, operation: 'create' | 'update' | 'delete'): Promise<void> {
    const queueItem: SyncQueueItem = {
      id: `photo_${photo.photoId}_${Date.now()}`,
      type: 'photo',
      operation,
      data: photo,
      retryCount: 0,
      createdAt: new Date(),
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();
    this.notifyListeners();

    // Try immediate sync if online
    if (this.isOnline && !this.isSyncing) {
      this.syncNow();
    }
  }

  async syncNow(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    if (!this.authService.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    this.isSyncing = true;
    this.notifyListeners();

    const result: SyncResult = {
      success: true,
      syncedItems: 0,
      failedItems: 0,
      errors: [],
    };

    try {
      const accessToken = await this.authService.getValidAccessToken();
      const itemsToSync = this.getItemsToSync();

      for (const item of itemsToSync) {
        try {
          await this.syncItem(item, accessToken);
          this.removeFromQueue(item.id);
          result.syncedItems++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to sync ${item.type} ${item.id}: ${errorMessage}`);
          
          item.retryCount++;
          item.lastAttempt = new Date();
          
          if (item.retryCount >= this.maxRetries) {
            this.removeFromQueue(item.id);
            result.failedItems++;
          }
        }
      }

      await this.saveSyncQueue();
      
      if (result.failedItems > 0) {
        result.success = false;
      }

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }

    return result;
  }

  setOnlineStatus(isOnline: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;
    
    // If we just came back online, try to sync
    if (wasOffline && isOnline && !this.isSyncing && this.syncQueue.length > 0) {
      this.syncNow();
    }
    
    this.notifyListeners();
  }

  getSyncStatus(): SyncStatus {
    const failedItems = this.syncQueue.filter(item => item.retryCount >= this.maxRetries).length;
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: this.getLastSyncTime(),
      pendingItems: this.syncQueue.length - failedItems,
      failedItems,
    };
  }

  async clearFailedItems(): Promise<void> {
    this.syncQueue = this.syncQueue.filter(item => item.retryCount < this.maxRetries);
    await this.saveSyncQueue();
    this.notifyListeners();
  }

  async retryFailedItems(): Promise<void> {
    this.syncQueue.forEach(item => {
      if (item.retryCount >= this.maxRetries) {
        item.retryCount = 0;
        item.lastAttempt = undefined;
      }
    });
    
    await this.saveSyncQueue();
    this.notifyListeners();
    
    if (this.isOnline && !this.isSyncing) {
      this.syncNow();
    }
  }

  private async syncItem(item: SyncQueueItem, accessToken: string): Promise<void> {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };

    if (item.type === 'activity') {
      await this.syncActivity(item, headers);
    } else if (item.type === 'photo') {
      await this.syncPhoto(item, headers);
    }
  }

  private async syncActivity(item: SyncQueueItem, headers: Record<string, string>): Promise<void> {
    const activity = item.data as Activity;
    const apiEndpoint = this.authService['config'].apiEndpoint;

    switch (item.operation) {
      case 'create':
        const createResponse = await fetch(`${apiEndpoint}/activities`, {
          method: 'POST',
          headers,
          body: JSON.stringify(activity),
        });
        
        if (!createResponse.ok) {
          const error = await createResponse.json();
          throw new Error(error.error || 'Failed to create activity');
        }
        break;

      case 'update':
        const updateResponse = await fetch(`${apiEndpoint}/activities/${activity.activityId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(activity),
        });
        
        if (!updateResponse.ok) {
          const error = await updateResponse.json();
          throw new Error(error.error || 'Failed to update activity');
        }
        break;

      case 'delete':
        const deleteResponse = await fetch(`${apiEndpoint}/activities/${activity.activityId}`, {
          method: 'DELETE',
          headers,
        });
        
        if (!deleteResponse.ok) {
          const error = await deleteResponse.json();
          throw new Error(error.error || 'Failed to delete activity');
        }
        break;
    }
  }

  private async syncPhoto(item: SyncQueueItem, headers: Record<string, string>): Promise<void> {
    const photo = item.data as Photo;
    const apiEndpoint = this.authService['config'].apiEndpoint;

    switch (item.operation) {
      case 'create':
        const createResponse = await fetch(`${apiEndpoint}/photos`, {
          method: 'POST',
          headers,
          body: JSON.stringify(photo),
        });
        
        if (!createResponse.ok) {
          const error = await createResponse.json();
          throw new Error(error.error || 'Failed to create photo');
        }
        break;

      case 'delete':
        const deleteResponse = await fetch(`${apiEndpoint}/photos/${photo.photoId}`, {
          method: 'DELETE',
          headers,
        });
        
        if (!deleteResponse.ok) {
          const error = await deleteResponse.json();
          throw new Error(error.error || 'Failed to delete photo');
        }
        break;
    }
  }

  private getItemsToSync(): SyncQueueItem[] {
    const now = new Date();
    
    return this.syncQueue.filter(item => {
      // Don't retry items that have exceeded max retries
      if (item.retryCount >= this.maxRetries) {
        return false;
      }

      // If never attempted, sync immediately
      if (!item.lastAttempt) {
        return true;
      }

      // Calculate exponential backoff delay
      const delay = this.baseRetryDelay * Math.pow(2, item.retryCount);
      const nextAttemptTime = new Date(item.lastAttempt.getTime() + delay);
      
      return now >= nextAttemptTime;
    });
  }

  private removeFromQueue(itemId: string): void {
    const index = this.syncQueue.findIndex(item => item.id === itemId);
    if (index > -1) {
      this.syncQueue.splice(index, 1);
    }
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      // In a real implementation, this would load from persistent storage
      // For now, we'll use an empty queue
      this.syncQueue = [];
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      // In a real implementation, this would save to persistent storage
      // For now, we'll just keep it in memory
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  private getLastSyncTime(): Date | undefined {
    // In a real implementation, this would be persisted
    return undefined;
  }

  private startPeriodicSync(): void {
    // Sync every 5 minutes when online
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing && this.syncQueue.length > 0) {
        this.syncNow().catch(error => {
          console.error('Periodic sync failed:', error);
        });
      }
    }, 5 * 60 * 1000);
  }

  private notifyListeners(): void {
    const status = this.getSyncStatus();
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Sync listener error:', error);
      }
    });
  }

  dispose(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.listeners = [];
  }
}

export default SyncService;