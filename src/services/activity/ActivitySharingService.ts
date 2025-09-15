import { Activity, Photo } from '../../types';

export interface ShareOptions {
  includeMap?: boolean;
  includePhotos?: boolean;
  includeStats?: boolean;
  format?: 'image' | 'text' | 'both';
}

export interface ShareResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class ActivitySharingService {
  constructor() {}

  async shareActivity(
    activity: Activity,
    photos: Photo[] = [],
    options: ShareOptions = {}
  ): Promise<ShareResult> {
    try {
      const {
        includeMap = true,
        includePhotos = true,
        includeStats = true,
        format = 'both',
      } = options;

      // Generate shareable content
      const shareableContent = await this.generateShareableContent(
        activity,
        photos,
        { includeMap, includePhotos, includeStats }
      );

      // In a real implementation, this would use React Native's Share API
      // or integrate with social media platforms
      const shareText = this.generateShareText(activity, includeStats);
      
      console.log('Sharing activity:', {
        text: shareText,
        image: shareableContent.uri,
        format,
      });

      // Simulate sharing success
      return {
        success: true,
        message: 'Activity shared successfully!',
      };
    } catch (error) {
      console.error('Error sharing activity:', error);
      return {
        success: false,
        error: 'Failed to share activity. Please try again.',
      };
    }
  }

  async shareToSocialMedia(
    activity: Activity,
    platform: 'instagram' | 'facebook' | 'twitter' | 'strava',
    photos: Photo[] = []
  ): Promise<ShareResult> {
    try {
      // Platform-specific sharing logic would go here
      const shareText = this.generateShareText(activity, true);
      
      switch (platform) {
        case 'instagram':
          return this.shareToInstagram(activity, photos, shareText);
        case 'facebook':
          return this.shareToFacebook(activity, shareText);
        case 'twitter':
          return this.shareToTwitter(activity, shareText);
        case 'strava':
          return this.shareToStrava(activity);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error(`Error sharing to ${platform}:`, error);
      return {
        success: false,
        error: `Failed to share to ${platform}. Please try again.`,
      };
    }
  }

  private async generateShareableContent(
    activity: Activity,
    photos: Photo[],
    options: { includeMap: boolean; includePhotos: boolean; includeStats: boolean }
  ) {
    // For now, we'll create a mock result since the ShareableContentService
    // requires additional parameters that we don't have in this context
    // In a real implementation, you'd pass the required statistics and trackPoints
    
    const mockResult = {
      uri: '/path/to/generated/image.jpg',
      width: 1080,
      height: 1080,
      fileSize: 1024000,
      processingTime: 500,
    };

    if (options.includePhotos && photos.length > 0) {
      return {
        ...mockResult,
        photosIncluded: photos.length,
        layout: 'grid' as const,
      };
    } else {
      return mockResult;
    }
  }

  private generateShareText(activity: Activity, includeStats: boolean): string {
    const distance = activity.distanceM >= 1000 
      ? `${(activity.distanceM / 1000).toFixed(2)}km`
      : `${Math.round(activity.distanceM)}m`;
    
    const duration = this.formatDuration(activity.durationSec);
    const pace = this.formatPace(activity.avgPaceSecPerKm);
    
    let text = `Just completed a ${distance} trail run! 🏃‍♂️`;
    
    if (includeStats) {
      text += `\n\n📊 Stats:\n`;
      text += `⏱️ Time: ${duration}\n`;
      text += `🏃 Pace: ${pace}/km\n`;
      
      if (activity.elevGainM > 0) {
        text += `⛰️ Elevation: +${Math.round(activity.elevGainM)}m\n`;
      }
    }
    
    text += `\n#TrailRunning #Running #Fitness`;
    
    return text;
  }

  private async shareToInstagram(
    activity: Activity,
    photos: Photo[],
    text: string
  ): Promise<ShareResult> {
    // Instagram sharing would require the Instagram app to be installed
    // and would use deep linking or the Instagram sharing API
    console.log('Sharing to Instagram:', { text, photos: photos.length });
    
    return {
      success: true,
      message: 'Shared to Instagram!',
    };
  }

  private async shareToFacebook(
    activity: Activity,
    text: string
  ): Promise<ShareResult> {
    // Facebook sharing would use the Facebook SDK
    console.log('Sharing to Facebook:', { text });
    
    return {
      success: true,
      message: 'Shared to Facebook!',
    };
  }

  private async shareToTwitter(
    activity: Activity,
    text: string
  ): Promise<ShareResult> {
    // Twitter sharing would use deep linking or Twitter API
    console.log('Sharing to Twitter:', { text });
    
    return {
      success: true,
      message: 'Shared to Twitter!',
    };
  }

  private async shareToStrava(activity: Activity): Promise<ShareResult> {
    // Strava sharing would require Strava API integration
    console.log('Sharing to Strava:', { activityId: activity.activityId });
    
    return {
      success: true,
      message: 'Shared to Strava!',
    };
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  private formatPace(secondsPerKm: number): string {
    if (secondsPerKm === 0 || !isFinite(secondsPerKm)) {
      return '--:--';
    }
    
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}