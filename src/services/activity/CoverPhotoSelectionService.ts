import { Photo, TrackPoint, Activity } from '../../types';

export interface PhotoQualityMetrics {
  hasGoodLighting: boolean;
  isScenic: boolean;
  isAtMidpoint: boolean;
  hasGoodComposition: boolean;
  qualityScore: number; // 0-100
}

export interface CoverPhotoCandidate {
  photo: Photo;
  metrics: PhotoQualityMetrics;
  overallScore: number;
  selectionReason: string;
}

export interface CoverPhotoSelectionOptions {
  preferMidpoint: boolean;
  scenicWeight: number; // 0-1
  lightingWeight: number; // 0-1
  compositionWeight: number; // 0-1
  fallbackToFirst: boolean;
}

/**
 * Service for selecting the best cover photo for an activity
 * Uses heuristic-based selection considering scenic value, lighting, and position
 */
export class CoverPhotoSelectionService {
  private readonly defaultOptions: CoverPhotoSelectionOptions = {
    preferMidpoint: true,
    scenicWeight: 0.4,
    lightingWeight: 0.3,
    compositionWeight: 0.3,
    fallbackToFirst: true,
  };

  /**
   * Select the best cover photo for an activity
   */
  public selectCoverPhoto(
    photos: Photo[],
    trackPoints: TrackPoint[],
    activity: Activity,
    options: Partial<CoverPhotoSelectionOptions> = {}
  ): Photo | null {
    const opts = { ...this.defaultOptions, ...options };

    if (photos.length === 0) {
      return null;
    }

    if (photos.length === 1) {
      return this.isPhotoValid(photos[0]) ? photos[0] : (opts.fallbackToFirst ? photos[0] : null);
    }

    // Analyze all photos and calculate scores
    const candidates = this.analyzePhotoCandidates(photos, trackPoints, activity, opts);

    if (candidates.length === 0) {
      if (opts.fallbackToFirst) {
        // Find the first valid photo, or return the first photo if none are valid
        const firstValidPhoto = photos.find(photo => this.isPhotoValid(photo));
        return firstValidPhoto || photos[0];
      }
      return null;
    }

    // Sort by overall score (highest first)
    candidates.sort((a, b) => b.overallScore - a.overallScore);

    return candidates[0].photo;
  }

  /**
   * Get detailed analysis of all photo candidates
   */
  public analyzeCoverPhotoCandidates(
    photos: Photo[],
    trackPoints: TrackPoint[],
    activity: Activity,
    options: Partial<CoverPhotoSelectionOptions> = {}
  ): CoverPhotoCandidate[] {
    const opts = { ...this.defaultOptions, ...options };
    return this.analyzePhotoCandidates(photos, trackPoints, activity, opts);
  }

  /**
   * Assess photo quality based on available metadata
   */
  public assessPhotoQuality(photo: Photo, trackPoints: TrackPoint[]): PhotoQualityMetrics {
    const hasGoodLighting = this.assessLighting(photo);
    const isScenic = this.assessScenicValue(photo, trackPoints);
    const isAtMidpoint = this.isAtActivityMidpoint(photo, trackPoints);
    const hasGoodComposition = this.assessComposition(photo);

    // Calculate overall quality score
    const qualityScore = this.calculateQualityScore({
      hasGoodLighting,
      isScenic,
      isAtMidpoint,
      hasGoodComposition,
    });

    return {
      hasGoodLighting,
      isScenic,
      isAtMidpoint,
      hasGoodComposition,
      qualityScore,
    };
  }

  /**
   * Check if there are any suitable photos for cover selection
   */
  public hasValidCoverPhotos(photos: Photo[]): boolean {
    return photos.length > 0 && photos.some(photo => this.isPhotoValid(photo));
  }

  /**
   * Get fallback photo when no good candidates exist
   */
  public getFallbackPhoto(photos: Photo[]): Photo | null {
    if (photos.length === 0) return null;

    // Prefer photos from the middle of the activity
    const midIndex = Math.floor(photos.length / 2);
    return photos[midIndex] || photos[0];
  }

  // MARK: - Private Methods

  private analyzePhotoCandidates(
    photos: Photo[],
    trackPoints: TrackPoint[],
    activity: Activity,
    options: CoverPhotoSelectionOptions
  ): CoverPhotoCandidate[] {
    const candidates: CoverPhotoCandidate[] = [];

    for (const photo of photos) {
      if (!this.isPhotoValid(photo)) {
        continue;
      }

      const metrics = this.assessPhotoQuality(photo, trackPoints);
      const overallScore = this.calculateOverallScore(metrics, options);
      const selectionReason = this.generateSelectionReason(metrics);

      candidates.push({
        photo,
        metrics,
        overallScore,
        selectionReason,
      });
    }

    return candidates;
  }

  private calculateOverallScore(
    metrics: PhotoQualityMetrics,
    options: CoverPhotoSelectionOptions
  ): number {
    let score = 0;

    // Base quality score (0-40 points)
    score += metrics.qualityScore * 0.4;

    // Scenic value (weighted)
    if (metrics.isScenic) {
      score += options.scenicWeight * 30;
    }

    // Lighting quality (weighted)
    if (metrics.hasGoodLighting) {
      score += options.lightingWeight * 20;
    }

    // Composition quality (weighted)
    if (metrics.hasGoodComposition) {
      score += options.compositionWeight * 15;
    }

    // Midpoint bonus (if preferred)
    if (options.preferMidpoint && metrics.isAtMidpoint) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private calculateQualityScore(metrics: Omit<PhotoQualityMetrics, 'qualityScore'>): number {
    let score = 50; // Base score

    if (metrics.hasGoodLighting) score += 20;
    if (metrics.isScenic) score += 20;
    if (metrics.hasGoodComposition) score += 15;
    if (metrics.isAtMidpoint) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  private assessLighting(photo: Photo): boolean {
    // Check EXIF data for lighting conditions
    if (!photo.exifData) {
      return true; // Assume good lighting if no data
    }

    const exif = photo.exifData;

    // Check for flash usage (prefer natural light)
    if (exif.Flash !== undefined) {
      const flashFired = (exif.Flash & 0x01) === 1;
      if (flashFired) {
        return false; // Flash usually indicates poor lighting
      }
    }

    // Check ISO (lower is generally better for outdoor photos)
    if (exif.ISO !== undefined) {
      const iso = parseInt(exif.ISO.toString(), 10);
      if (iso > 800) {
        return false; // High ISO suggests low light
      }
    }

    // Check exposure time (very fast or very slow might indicate poor conditions)
    if (exif.ExposureTime !== undefined) {
      let exposureTime: number;
      if (typeof exif.ExposureTime === 'string') {
        // Handle fractional strings like "1/250"
        if (exif.ExposureTime.includes('/')) {
          const [numerator, denominator] = exif.ExposureTime.split('/').map(Number);
          exposureTime = numerator / denominator;
        } else {
          exposureTime = parseFloat(exif.ExposureTime);
        }
      } else {
        exposureTime = parseFloat(exif.ExposureTime.toString());
      }
      
      if (exposureTime > 1/30 || exposureTime < 1/2000) {
        return false;
      }
    }

    // Check time of day (prefer daylight hours)
    const hour = photo.timestamp.getHours();
    if (hour < 6 || hour > 19) {
      return false; // Early morning or evening
    }

    return true;
  }

  private assessScenicValue(photo: Photo, trackPoints: TrackPoint[]): boolean {
    // Find the track point closest to the photo location
    const photoTrackPoint = this.findNearestTrackPoint(photo, trackPoints);
    
    if (!photoTrackPoint) {
      return false;
    }

    // Check elevation - higher elevations often more scenic
    if (photoTrackPoint.altitude !== undefined) {
      const avgElevation = this.calculateAverageElevation(trackPoints);
      if (photoTrackPoint.altitude > avgElevation + 50) {
        return true; // Significantly above average elevation
      }
    }

    // Check if photo is at a viewpoint (low speed area)
    const nearbyPoints = this.getNearbyTrackPoints(photo, trackPoints, 100); // 100m radius
    const avgSpeed = this.calculateAverageSpeed(nearbyPoints);
    
    if (avgSpeed < 1.0) { // Less than 1 m/s suggests a stop/viewpoint
      return true;
    }

    // Check distance from start - middle portions often more scenic
    const activityProgress = this.calculateActivityProgress(photo, trackPoints);
    if (activityProgress > 0.2 && activityProgress < 0.8) {
      return true; // Middle 60% of activity
    }

    return false;
  }

  private assessComposition(photo: Photo): boolean {
    // Basic composition assessment based on available metadata
    
    // Check if photo has EXIF orientation data (suggests intentional framing)
    if (photo.exifData?.Orientation) {
      return true;
    }

    // Check for GPS accuracy (better accuracy suggests more intentional photo)
    if (photo.exifData?.GPSHPositioningError) {
      const accuracy = parseFloat(photo.exifData.GPSHPositioningError.toString());
      return accuracy < 10; // Good GPS accuracy
    }

    // Default to true if no negative indicators
    return true;
  }

  private isAtActivityMidpoint(photo: Photo, trackPoints: TrackPoint[]): boolean {
    const progress = this.calculateActivityProgress(photo, trackPoints);
    return progress >= 0.3 && progress <= 0.7; // Middle 40% of activity
  }

  private calculateActivityProgress(photo: Photo, trackPoints: TrackPoint[]): number {
    if (trackPoints.length === 0) return 0;

    const photoTime = photo.timestamp.getTime();
    const startTime = trackPoints[0].timestamp.getTime();
    const endTime = trackPoints[trackPoints.length - 1].timestamp.getTime();

    if (endTime === startTime) return 0;

    const progress = (photoTime - startTime) / (endTime - startTime);
    return Math.max(0, Math.min(1, progress));
  }

  private findNearestTrackPoint(photo: Photo, trackPoints: TrackPoint[]): TrackPoint | null {
    if (trackPoints.length === 0) return null;

    let nearestPoint = trackPoints[0];
    let minDistance = this.calculateDistance(
      photo.latitude, photo.longitude,
      nearestPoint.latitude, nearestPoint.longitude
    );

    for (const point of trackPoints) {
      const distance = this.calculateDistance(
        photo.latitude, photo.longitude,
        point.latitude, point.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    }

    return minDistance < 200 ? nearestPoint : null; // Within 200m
  }

  private getNearbyTrackPoints(photo: Photo, trackPoints: TrackPoint[], radiusM: number): TrackPoint[] {
    return trackPoints.filter(point => {
      const distance = this.calculateDistance(
        photo.latitude, photo.longitude,
        point.latitude, point.longitude
      );
      return distance <= radiusM;
    });
  }

  private calculateAverageElevation(trackPoints: TrackPoint[]): number {
    const pointsWithElevation = trackPoints.filter(p => p.altitude !== undefined);
    if (pointsWithElevation.length === 0) return 0;

    const totalElevation = pointsWithElevation.reduce((sum, p) => sum + p.altitude!, 0);
    return totalElevation / pointsWithElevation.length;
  }

  private calculateAverageSpeed(trackPoints: TrackPoint[]): number {
    const pointsWithSpeed = trackPoints.filter(p => p.speed !== undefined);
    if (pointsWithSpeed.length === 0) return 0;

    const totalSpeed = pointsWithSpeed.reduce((sum, p) => sum + p.speed!, 0);
    return totalSpeed / pointsWithSpeed.length;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const deltaLatRad = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLonRad = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  private isPhotoValid(photo: Photo): boolean {
    return !!(
      photo.localUri &&
      photo.localUri.length > 0 &&
      photo.latitude !== undefined &&
      photo.longitude !== undefined &&
      photo.timestamp &&
      Math.abs(photo.latitude) <= 90 &&
      Math.abs(photo.longitude) <= 180 &&
      photo.latitude !== 0 &&
      photo.longitude !== 0
    );
  }

  private generateSelectionReason(metrics: PhotoQualityMetrics): string {
    const reasons: string[] = [];

    if (metrics.hasGoodLighting) reasons.push('good lighting');
    if (metrics.isScenic) reasons.push('scenic location');
    if (metrics.isAtMidpoint) reasons.push('mid-activity timing');
    if (metrics.hasGoodComposition) reasons.push('good composition');

    if (reasons.length === 0) {
      return 'basic quality criteria met';
    }

    if (reasons.length === 1) {
      return reasons[0];
    }

    if (reasons.length === 2) {
      return reasons.join(' and ');
    }

    return reasons.slice(0, -1).join(', ') + ', and ' + reasons[reasons.length - 1];
  }
}

// Export singleton instance
export const coverPhotoSelectionService = new CoverPhotoSelectionService();