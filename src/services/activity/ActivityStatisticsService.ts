import { Activity, TrackPoint, Split } from '../../types';

export interface ActivityStatistics {
  durationSec: number;
  distanceM: number;
  avgPaceSecPerKm: number;
  elevGainM: number;
  elevLossM: number;
  splitKm: Split[];
  maxSpeed: number; // m/s
  minElevation?: number;
  maxElevation?: number;
  totalAscent: number;
  totalDescent: number;
}

export interface StatisticsCalculationOptions {
  excludePausedTime: boolean;
  elevationThreshold: number; // meters
  smoothingWindow: number; // number of points for elevation smoothing
  minSplitDistance: number; // minimum distance for a valid split (meters)
}

/**
 * Service for calculating comprehensive activity statistics
 * Implements distance calculation using Haversine formula, duration with pause exclusion,
 * pace calculations, elevation analysis with smoothing, and per-kilometer splits
 */
export class ActivityStatisticsService {
  private readonly defaultOptions: StatisticsCalculationOptions = {
    excludePausedTime: true,
    elevationThreshold: 3, // 3m threshold as per requirements
    smoothingWindow: 5, // 5-point moving average for elevation
    minSplitDistance: 950, // 950m minimum for a valid km split (allows for GPS inaccuracy)
  };

  /**
   * Calculate comprehensive statistics for a completed activity
   */
  public calculateActivityStatistics(
    trackPoints: TrackPoint[],
    activity: Activity,
    options: Partial<StatisticsCalculationOptions> = {}
  ): ActivityStatistics {
    const opts = { ...this.defaultOptions, ...options };

    if (trackPoints.length < 2) {
      return this.createEmptyStatistics();
    }

    // Calculate duration with pause time exclusion
    const durationSec = this.calculateDuration(activity, opts.excludePausedTime);

    // Calculate total distance using Haversine formula
    const distanceM = this.calculateTotalDistance(trackPoints);

    // Calculate average pace
    const avgPaceSecPerKm = this.calculateAveragePace(distanceM, durationSec);

    // Calculate elevation changes with smoothing
    const smoothedPoints = this.smoothElevationData(trackPoints, opts.smoothingWindow);
    const { elevGainM, elevLossM, totalAscent, totalDescent, minElevation, maxElevation } = 
      this.calculateElevationStatistics(smoothedPoints, opts.elevationThreshold);

    // Calculate per-kilometer splits
    const splitKm = this.calculateKilometerSplits(trackPoints, opts.minSplitDistance);

    // Calculate maximum speed
    const maxSpeed = this.calculateMaxSpeed(trackPoints);

    return {
      durationSec,
      distanceM,
      avgPaceSecPerKm,
      elevGainM,
      elevLossM,
      splitKm,
      maxSpeed,
      minElevation,
      maxElevation,
      totalAscent,
      totalDescent,
    };
  }

  /**
   * Calculate distance between two GPS points using Haversine formula
   */
  public calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

  /**
   * Calculate total distance for a series of track points
   */
  public calculateTotalDistance(trackPoints: TrackPoint[]): number {
    if (trackPoints.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < trackPoints.length; i++) {
      const prev = trackPoints[i - 1];
      const curr = trackPoints[i];
      totalDistance += this.calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
    }

    return totalDistance;
  }

  /**
   * Calculate duration with pause time exclusion
   */
  public calculateDuration(activity: Activity, excludePausedTime: boolean = true): number {
    if (!activity.startedAt || !activity.endedAt) {
      return activity.durationSec || 0;
    }

    const totalDuration = (activity.endedAt.getTime() - activity.startedAt.getTime()) / 1000;
    
    if (!excludePausedTime) {
      return totalDuration;
    }

    // For now, use the stored duration which should already exclude paused time
    // In a more sophisticated implementation, we could analyze track point gaps
    return activity.durationSec || totalDuration;
  }

  /**
   * Calculate average pace in seconds per kilometer
   */
  public calculateAveragePace(distanceM: number, durationSec: number): number {
    if (distanceM <= 0 || durationSec <= 0) return 0;
    return (durationSec / distanceM) * 1000;
  }

  /**
   * Calculate per-kilometer splits with accurate timing
   */
  public calculateKilometerSplits(
    trackPoints: TrackPoint[], 
    minSplitDistance: number = 950
  ): Split[] {
    if (trackPoints.length < 2) return [];

    const splits: Split[] = [];
    let currentDistance = 0;
    let kmIndex = 1;
    let lastKmTime = trackPoints[0].timestamp.getTime();
    let lastKmDistance = 0;

    for (let i = 1; i < trackPoints.length; i++) {
      const segmentDistance = this.calculateDistance(
        trackPoints[i - 1].latitude, trackPoints[i - 1].longitude,
        trackPoints[i].latitude, trackPoints[i].longitude
      );
      currentDistance += segmentDistance;

      // Check if we've completed a kilometer (with tolerance for GPS inaccuracy)
      const kmTarget = kmIndex * 1000;
      if (currentDistance >= Math.max(kmTarget, minSplitDistance)) {
        const currentTime = trackPoints[i].timestamp.getTime();
        const splitDuration = (currentTime - lastKmTime) / 1000;
        const splitDistance = currentDistance - lastKmDistance;
        
        // Calculate pace for the actual distance covered (may be slightly more than 1km)
        const paceSecPerKm = splitDistance > 0 ? (splitDuration / splitDistance) * 1000 : 0;
        
        splits.push({
          kmIndex,
          durationSec: splitDuration,
          paceSecPerKm,
        });

        lastKmTime = currentTime;
        lastKmDistance = currentDistance;
        kmIndex++;
      }
    }

    return splits;
  }

  /**
   * Calculate elevation gain and loss with smoothing and threshold
   */
  public calculateElevationStatistics(
    trackPoints: TrackPoint[], 
    threshold: number = 3
  ): {
    elevGainM: number;
    elevLossM: number;
    totalAscent: number;
    totalDescent: number;
    minElevation?: number;
    maxElevation?: number;
  } {
    const pointsWithElevation = trackPoints.filter(p => p.altitude !== undefined);
    
    if (pointsWithElevation.length < 2) {
      return {
        elevGainM: 0,
        elevLossM: 0,
        totalAscent: 0,
        totalDescent: 0,
      };
    }

    let elevGainM = 0;
    let elevLossM = 0;
    let totalAscent = 0;
    let totalDescent = 0;
    let minElevation = pointsWithElevation[0].altitude!;
    let maxElevation = pointsWithElevation[0].altitude!;

    for (let i = 1; i < pointsWithElevation.length; i++) {
      const prevAltitude = pointsWithElevation[i - 1].altitude!;
      const currentAltitude = pointsWithElevation[i].altitude!;
      const elevationChange = currentAltitude - prevAltitude;

      // Track min/max elevation
      minElevation = Math.min(minElevation, currentAltitude);
      maxElevation = Math.max(maxElevation, currentAltitude);

      // Count all ascent/descent regardless of threshold
      if (elevationChange > 0) {
        totalAscent += elevationChange;
      } else if (elevationChange < 0) {
        totalDescent += Math.abs(elevationChange);
      }

      // Only count significant changes for gain/loss (with threshold)
      if (Math.abs(elevationChange) >= threshold) {
        if (elevationChange > 0) {
          elevGainM += elevationChange;
        } else {
          elevLossM += Math.abs(elevationChange);
        }
      }
    }

    return {
      elevGainM,
      elevLossM,
      totalAscent,
      totalDescent,
      minElevation,
      maxElevation,
    };
  }

  /**
   * Smooth elevation data using moving average to reduce GPS noise
   */
  public smoothElevationData(trackPoints: TrackPoint[], windowSize: number = 5): TrackPoint[] {
    if (trackPoints.length <= windowSize || windowSize <= 1) {
      return trackPoints;
    }

    const smoothedPoints: TrackPoint[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < trackPoints.length; i++) {
      const point = trackPoints[i];
      
      if (point.altitude === undefined) {
        smoothedPoints.push(point);
        continue;
      }

      // Calculate window bounds
      const startIdx = Math.max(0, i - halfWindow);
      const endIdx = Math.min(trackPoints.length - 1, i + halfWindow);
      
      // Collect elevation values in window
      const elevations: number[] = [];
      for (let j = startIdx; j <= endIdx; j++) {
        if (trackPoints[j].altitude !== undefined) {
          elevations.push(trackPoints[j].altitude!);
        }
      }

      // Calculate smoothed elevation
      let smoothedElevation = point.altitude;
      if (elevations.length > 0) {
        smoothedElevation = elevations.reduce((sum, elev) => sum + elev, 0) / elevations.length;
      }

      smoothedPoints.push({
        ...point,
        altitude: smoothedElevation,
      });
    }

    return smoothedPoints;
  }

  /**
   * Calculate maximum speed from track points
   */
  public calculateMaxSpeed(trackPoints: TrackPoint[]): number {
    let maxSpeed = 0;

    for (const point of trackPoints) {
      if (point.speed !== undefined && point.speed > maxSpeed) {
        maxSpeed = point.speed;
      }
    }

    // If no speed data in track points, calculate from consecutive points
    if (maxSpeed === 0 && trackPoints.length >= 2) {
      for (let i = 1; i < trackPoints.length; i++) {
        const prev = trackPoints[i - 1];
        const curr = trackPoints[i];
        const distance = this.calculateDistance(
          prev.latitude, prev.longitude,
          curr.latitude, curr.longitude
        );
        const timeDiff = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
        
        if (timeDiff > 0) {
          const speed = distance / timeDiff;
          maxSpeed = Math.max(maxSpeed, speed);
        }
      }
    }

    return maxSpeed;
  }

  /**
   * Validate track points for statistics calculation
   */
  public validateTrackPoints(trackPoints: TrackPoint[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (trackPoints.length === 0) {
      errors.push('No track points provided');
      return { isValid: false, errors, warnings };
    }

    if (trackPoints.length < 2) {
      errors.push('At least 2 track points required for statistics calculation');
      return { isValid: false, errors, warnings };
    }

    // Check for basic data integrity
    let pointsWithElevation = 0;
    let pointsWithSpeed = 0;
    let suspiciousSpeedCount = 0;

    for (let i = 0; i < trackPoints.length; i++) {
      const point = trackPoints[i];

      // Check for valid coordinates
      if (Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) {
        errors.push(`Invalid coordinates at point ${i}: lat=${point.latitude}, lon=${point.longitude}`);
      }

      // Count data availability
      if (point.altitude !== undefined) pointsWithElevation++;
      if (point.speed !== undefined) pointsWithSpeed++;

      // Check for suspicious speeds (> 50 m/s = 180 km/h)
      if (point.speed !== undefined && point.speed > 50) {
        suspiciousSpeedCount++;
      }

      // Check for reasonable accuracy
      if (point.accuracy > 100) {
        warnings.push(`Poor GPS accuracy at point ${i}: ${point.accuracy}m`);
      }
    }

    // Generate warnings for data quality
    if (pointsWithElevation < trackPoints.length * 0.5) {
      warnings.push('Less than 50% of track points have elevation data');
    }

    if (suspiciousSpeedCount > 0) {
      warnings.push(`${suspiciousSpeedCount} track points have suspicious speed values (>50 m/s)`);
    }

    // Check time ordering
    for (let i = 1; i < trackPoints.length; i++) {
      if (trackPoints[i].timestamp.getTime() <= trackPoints[i - 1].timestamp.getTime()) {
        warnings.push(`Track points not in chronological order at index ${i}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private createEmptyStatistics(): ActivityStatistics {
    return {
      durationSec: 0,
      distanceM: 0,
      avgPaceSecPerKm: 0,
      elevGainM: 0,
      elevLossM: 0,
      splitKm: [],
      maxSpeed: 0,
      totalAscent: 0,
      totalDescent: 0,
    };
  }
}

// Export singleton instance
export const activityStatisticsService = new ActivityStatisticsService();