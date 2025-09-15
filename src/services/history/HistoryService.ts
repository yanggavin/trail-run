import { ActivityRepository, ActivityFilters } from '../repositories/ActivityRepository';
import { PhotoRepository } from '../repositories/PhotoRepository';
import { Activity, Photo } from '../../types';

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface HistoryFilters extends Omit<ActivityFilters, 'limit' | 'offset'> {
  searchText?: string;
  minDistance?: number;
  maxDistance?: number;
  minDuration?: number;
  maxDuration?: number;
  sortBy?: 'date' | 'distance' | 'duration';
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityWithCoverPhoto {
  activity: Activity;
  coverPhotoUri?: string;
}

export interface HistoryResult {
  activities: ActivityWithCoverPhoto[];
  totalCount: number;
  hasMore: boolean;
}

export class HistoryService {
  constructor(
    private activityRepository: ActivityRepository,
    private photoRepository: PhotoRepository
  ) {}

  async getActivities(
    userId: string,
    filters: HistoryFilters = {},
    pagination: PaginationParams = { limit: 20, offset: 0 }
  ): Promise<HistoryResult> {
    // Convert history filters to activity repository filters
    const activityFilters: ActivityFilters = {
      userId,
      status: 'completed', // Only show completed activities in history
      startDate: filters.startDate,
      endDate: filters.endDate,
      syncStatus: filters.syncStatus,
      limit: pagination.limit,
      offset: pagination.offset,
    };

    // Get activities from repository
    let activities = await this.activityRepository.findAll(activityFilters);

    // Apply additional filters that aren't handled by the repository
    activities = this.applyAdditionalFilters(activities, filters);

    // Apply sorting
    activities = this.applySorting(activities, filters.sortBy, filters.sortOrder);

    // Get cover photos for activities
    const activitiesWithPhotos = await this.attachCoverPhotos(activities);

    // Get total count for pagination
    const totalCount = await this.getTotalCount(userId, filters);

    return {
      activities: activitiesWithPhotos,
      totalCount,
      hasMore: pagination.offset + activities.length < totalCount,
    };
  }

  async refreshActivities(userId: string): Promise<void> {
    // This method can be called when pull-to-refresh is triggered
    // In a real implementation, this would trigger a sync operation
    // For now, we'll just return as the data is already fresh from local storage
    return Promise.resolve();
  }

  async searchActivities(
    userId: string,
    searchText: string,
    pagination: PaginationParams = { limit: 20, offset: 0 }
  ): Promise<HistoryResult> {
    const filters: HistoryFilters = {
      searchText: searchText.toLowerCase(),
    };

    return this.getActivities(userId, filters, pagination);
  }

  async getActivityStats(userId: string, dateRange?: { startDate: Date; endDate: Date }) {
    const filters: Omit<ActivityFilters, 'userId'> = dateRange ? {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    } : {};

    return this.activityRepository.getStats(userId, filters);
  }

  private applyAdditionalFilters(activities: Activity[], filters: HistoryFilters): Activity[] {
    if (!activities) return [];
    
    let filtered = activities;

    // Text search (would search in activity titles/locations if we had them)
    if (filters.searchText) {
      // For now, we'll search in the activity ID or any available text fields
      // In a real implementation, you might have activity titles or location names
      filtered = filtered.filter(activity => 
        activity.activityId.toLowerCase().includes(filters.searchText!) ||
        activity.startedAt.toLocaleDateString().toLowerCase().includes(filters.searchText!)
      );
    }

    // Distance filters
    if (filters.minDistance !== undefined) {
      filtered = filtered.filter(activity => activity.distanceM >= filters.minDistance! * 1000);
    }
    if (filters.maxDistance !== undefined) {
      filtered = filtered.filter(activity => activity.distanceM <= filters.maxDistance! * 1000);
    }

    // Duration filters
    if (filters.minDuration !== undefined) {
      filtered = filtered.filter(activity => activity.durationSec >= filters.minDuration! * 60);
    }
    if (filters.maxDuration !== undefined) {
      filtered = filtered.filter(activity => activity.durationSec <= filters.maxDuration! * 60);
    }

    return filtered;
  }

  private applySorting(
    activities: Activity[],
    sortBy: HistoryFilters['sortBy'] = 'date',
    sortOrder: HistoryFilters['sortOrder'] = 'desc'
  ): Activity[] {
    const sorted = [...activities];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = a.startedAt.getTime() - b.startedAt.getTime();
          break;
        case 'distance':
          comparison = a.distanceM - b.distanceM;
          break;
        case 'duration':
          comparison = a.durationSec - b.durationSec;
          break;
        default:
          comparison = a.startedAt.getTime() - b.startedAt.getTime();
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  private async attachCoverPhotos(activities: Activity[]): Promise<ActivityWithCoverPhoto[]> {
    const activitiesWithPhotos: ActivityWithCoverPhoto[] = [];

    for (const activity of activities) {
      let coverPhotoUri: string | undefined;

      if (activity.coverPhotoId) {
        // Get the specific cover photo
        const coverPhoto = await this.photoRepository.findById(activity.coverPhotoId);
        coverPhotoUri = coverPhoto?.thumbnailUri || coverPhoto?.localUri;
      } else {
        // Get the first photo for this activity as a fallback
        const photos = await this.photoRepository.findByActivityId(activity.activityId);
        if (photos && photos.length > 0) {
          coverPhotoUri = photos[0].thumbnailUri || photos[0].localUri;
        }
      }

      activitiesWithPhotos.push({
        activity,
        coverPhotoUri,
      });
    }

    return activitiesWithPhotos;
  }

  private async getTotalCount(userId: string, filters: HistoryFilters): Promise<number> {
    // For simplicity, we'll get all activities and apply filters
    // In a production app, you'd want to optimize this with a proper count query
    const allActivities = await this.activityRepository.findByUserId(userId, {
      status: 'completed',
      startDate: filters.startDate,
      endDate: filters.endDate,
      syncStatus: filters.syncStatus,
    });

    if (!allActivities) return 0;
    
    const filtered = this.applyAdditionalFilters(allActivities, filters);
    return filtered.length;
  }
}