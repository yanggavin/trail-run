import { TrackPoint } from '../../types';

export interface GPSProcessingConfig {
  outlierSpeedThreshold: number; // m/s - speeds above this are considered outliers
  outlierAccuracyThreshold: number; // meters - accuracy worse than this is filtered
  interpolationEnabled: boolean;
  polylineSimplificationTolerance: number; // meters - Douglas-Peucker tolerance
  elevationChangeThreshold: number; // meters - minimum elevation change to count
}

export interface ProcessedGPSData {
  filteredPoints: TrackPoint[];
  interpolatedPoints: TrackPoint[];
  polyline: string;
  simplifiedPolyline: string;
  elevationGain: number;
  elevationLoss: number;
  totalDistance: number;
  outlierCount: number;
  interpolationCount: number;
}

export interface GPSGap {
  startIndex: number;
  endIndex: number;
  duration: number; // seconds
  distance: number; // meters (estimated)
}

/**
 * Service for processing and validating GPS track points
 * Handles outlier detection, interpolation, polyline encoding, and elevation calculations
 */
export class GPSDataProcessor {
  private config: GPSProcessingConfig;

  constructor(config: Partial<GPSProcessingConfig> = {}) {
    this.config = {
      outlierSpeedThreshold: 10, // 10 m/s = 36 km/h as per requirements
      outlierAccuracyThreshold: 100, // 100 meters
      interpolationEnabled: true,
      polylineSimplificationTolerance: 5, // 5 meters
      elevationChangeThreshold: 3, // 3 meters as per requirements
      ...config,
    };
  }

  /**
   * Process a complete set of track points
   */
  public processTrackPoints(trackPoints: TrackPoint[]): ProcessedGPSData {
    if (trackPoints.length === 0) {
      return this.createEmptyResult();
    }

    // Step 1: Filter outliers
    const { filteredPoints, outlierCount } = this.filterOutliers(trackPoints);

    // Step 2: Detect and interpolate gaps
    const { interpolatedPoints, interpolationCount } = this.interpolateGaps(filteredPoints);

    // Step 3: Calculate elevation changes
    const { elevationGain, elevationLoss } = this.calculateElevationChanges(interpolatedPoints);

    // Step 4: Calculate total distance
    const totalDistance = this.calculateTotalDistance(interpolatedPoints);

    // Step 5: Generate polylines
    const polyline = this.encodePolyline(interpolatedPoints);
    const simplifiedPoints = this.simplifyPolyline(interpolatedPoints);
    const simplifiedPolyline = this.encodePolyline(simplifiedPoints);

    return {
      filteredPoints,
      interpolatedPoints,
      polyline,
      simplifiedPolyline,
      elevationGain,
      elevationLoss,
      totalDistance,
      outlierCount,
      interpolationCount,
    };
  }

  /**
   * Filter outlier points based on speed and accuracy thresholds
   */
  public filterOutliers(trackPoints: TrackPoint[]): { filteredPoints: TrackPoint[]; outlierCount: number } {
    if (trackPoints.length <= 1) {
      return { filteredPoints: [...trackPoints], outlierCount: 0 };
    }

    const filteredPoints: TrackPoint[] = [];
    let outlierCount = 0;

    for (let i = 0; i < trackPoints.length; i++) {
      const point = trackPoints[i];
      
      // Check accuracy threshold
      if (point.accuracy > this.config.outlierAccuracyThreshold) {
        outlierCount++;
        continue;
      }

      // Check speed threshold (if we have a previously accepted point)
      if (filteredPoints.length > 0) {
        const lastAcceptedPoint = filteredPoints[filteredPoints.length - 1];
        const speed = this.calculateInstantaneousSpeed(lastAcceptedPoint, point);
        
        if (speed > this.config.outlierSpeedThreshold) {
          outlierCount++;
          continue;
        }
      }

      filteredPoints.push(point);
    }

    return { filteredPoints, outlierCount };
  }

  /**
   * Interpolate missing GPS data in gaps
   */
  public interpolateGaps(trackPoints: TrackPoint[]): { interpolatedPoints: TrackPoint[]; interpolationCount: number } {
    if (!this.config.interpolationEnabled || trackPoints.length <= 1) {
      return { interpolatedPoints: [...trackPoints], interpolationCount: 0 };
    }

    const gaps = this.detectGaps(trackPoints);
    if (gaps.length === 0) {
      return { interpolatedPoints: [...trackPoints], interpolationCount: 0 };
    }

    const interpolatedPoints: TrackPoint[] = [];
    let interpolationCount = 0;
    let currentIndex = 0;

    for (const gap of gaps) {
      // Add points before the gap
      interpolatedPoints.push(...trackPoints.slice(currentIndex, gap.startIndex + 1));

      // Interpolate points in the gap
      const startPoint = trackPoints[gap.startIndex];
      const endPoint = trackPoints[gap.endIndex];
      const interpolated = this.interpolateBetweenPoints(startPoint, endPoint);
      
      interpolatedPoints.push(...interpolated);
      interpolationCount += interpolated.length;

      currentIndex = gap.endIndex;
    }

    // Add remaining points
    interpolatedPoints.push(...trackPoints.slice(currentIndex));

    return { interpolatedPoints, interpolationCount };
  }

  /**
   * Calculate elevation gain and loss with threshold
   */
  public calculateElevationChanges(trackPoints: TrackPoint[]): { elevationGain: number; elevationLoss: number } {
    if (trackPoints.length < 2) {
      return { elevationGain: 0, elevationLoss: 0 };
    }

    let elevationGain = 0;
    let elevationLoss = 0;

    for (let i = 1; i < trackPoints.length; i++) {
      const prevAltitude = trackPoints[i - 1].altitude;
      const currentAltitude = trackPoints[i].altitude;

      if (prevAltitude !== undefined && currentAltitude !== undefined) {
        const elevationChange = currentAltitude - prevAltitude;
        
        if (Math.abs(elevationChange) >= this.config.elevationChangeThreshold) {
          if (elevationChange > 0) {
            elevationGain += elevationChange;
          } else {
            elevationLoss += Math.abs(elevationChange);
          }
        }
      }
    }

    return { elevationGain, elevationLoss };
  }

  /**
   * Encode track points as a polyline string
   */
  public encodePolyline(trackPoints: TrackPoint[]): string {
    if (trackPoints.length === 0) {
      return '';
    }

    const coordinates = trackPoints.map(point => [point.latitude, point.longitude]);
    return this.encodeCoordinates(coordinates);
  }

  /**
   * Simplify polyline using Douglas-Peucker algorithm
   */
  public simplifyPolyline(trackPoints: TrackPoint[]): TrackPoint[] {
    if (trackPoints.length <= 2) {
      return [...trackPoints];
    }

    return this.douglasPeucker(trackPoints, this.config.polylineSimplificationTolerance);
  }

  /**
   * Calculate total distance of track points
   */
  public calculateTotalDistance(trackPoints: TrackPoint[]): number {
    if (trackPoints.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 1; i < trackPoints.length; i++) {
      totalDistance += this.calculateDistance(trackPoints[i - 1], trackPoints[i]);
    }

    return totalDistance;
  }

  /**
   * Update processing configuration
   */
  public updateConfig(newConfig: Partial<GPSProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): GPSProcessingConfig {
    return { ...this.config };
  }

  // MARK: - Private Methods

  private createEmptyResult(): ProcessedGPSData {
    return {
      filteredPoints: [],
      interpolatedPoints: [],
      polyline: '',
      simplifiedPolyline: '',
      elevationGain: 0,
      elevationLoss: 0,
      totalDistance: 0,
      outlierCount: 0,
      interpolationCount: 0,
    };
  }

  private calculateInstantaneousSpeed(point1: TrackPoint, point2: TrackPoint): number {
    const distance = this.calculateDistance(point1, point2);
    const timeDiff = (point2.timestamp.getTime() - point1.timestamp.getTime()) / 1000; // seconds
    
    return timeDiff > 0 ? distance / timeDiff : 0;
  }

  private calculateDistance(point1: TrackPoint, point2: TrackPoint): number {
    // Haversine formula
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = (point1.latitude * Math.PI) / 180;
    const lat2Rad = (point2.latitude * Math.PI) / 180;
    const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLonRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  private detectGaps(trackPoints: TrackPoint[]): GPSGap[] {
    const gaps: GPSGap[] = [];
    const maxGapDuration = 30; // seconds - gaps longer than this need interpolation
    const maxGapDistance = 200; // meters - gaps longer than this need interpolation

    for (let i = 1; i < trackPoints.length; i++) {
      const prevPoint = trackPoints[i - 1];
      const currentPoint = trackPoints[i];
      
      const timeDiff = (currentPoint.timestamp.getTime() - prevPoint.timestamp.getTime()) / 1000;
      const distance = this.calculateDistance(prevPoint, currentPoint);

      if (timeDiff > maxGapDuration || distance > maxGapDistance) {
        gaps.push({
          startIndex: i - 1,
          endIndex: i,
          duration: timeDiff,
          distance,
        });
      }
    }

    return gaps;
  }

  private interpolateBetweenPoints(startPoint: TrackPoint, endPoint: TrackPoint): TrackPoint[] {
    const timeDiff = (endPoint.timestamp.getTime() - startPoint.timestamp.getTime()) / 1000;
    const distance = this.calculateDistance(startPoint, endPoint);
    
    // Don't interpolate if the gap is too small or too large
    if (timeDiff < 5 || timeDiff > 120) {
      return [];
    }

    // Calculate number of interpolated points (one every 5 seconds)
    const numPoints = Math.floor(timeDiff / 5) - 1;
    if (numPoints <= 0) {
      return [];
    }

    const interpolatedPoints: TrackPoint[] = [];
    const latStep = (endPoint.latitude - startPoint.latitude) / (numPoints + 1);
    const lonStep = (endPoint.longitude - startPoint.longitude) / (numPoints + 1);
    const timeStep = timeDiff / (numPoints + 1) * 1000; // milliseconds
    
    // Calculate altitude step if both points have altitude
    let altStep = 0;
    if (startPoint.altitude !== undefined && endPoint.altitude !== undefined) {
      altStep = (endPoint.altitude - startPoint.altitude) / (numPoints + 1);
    }

    // Estimate speed and heading
    const estimatedSpeed = distance / timeDiff;
    const estimatedHeading = this.calculateBearing(startPoint, endPoint);

    for (let i = 1; i <= numPoints; i++) {
      const interpolatedPoint: TrackPoint = {
        latitude: startPoint.latitude + latStep * i,
        longitude: startPoint.longitude + lonStep * i,
        accuracy: Math.max(startPoint.accuracy, endPoint.accuracy) * 1.5, // Lower confidence
        timestamp: new Date(startPoint.timestamp.getTime() + timeStep * i),
        source: 'gps', // Mark as interpolated in a real implementation
        speed: estimatedSpeed,
        heading: estimatedHeading,
      };

      if (startPoint.altitude !== undefined && endPoint.altitude !== undefined) {
        interpolatedPoint.altitude = startPoint.altitude + altStep * i;
      }

      interpolatedPoints.push(interpolatedPoint);
    }

    return interpolatedPoints;
  }

  private calculateBearing(point1: TrackPoint, point2: TrackPoint): number {
    const lat1Rad = (point1.latitude * Math.PI) / 180;
    const lat2Rad = (point2.latitude * Math.PI) / 180;
    const deltaLonRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);

    const bearingRad = Math.atan2(y, x);
    const bearingDeg = (bearingRad * 180) / Math.PI;

    return (bearingDeg + 360) % 360;
  }

  private douglasPeucker(points: TrackPoint[], tolerance: number): TrackPoint[] {
    if (points.length <= 2) {
      return points;
    }

    // Find the point with the maximum distance from the line between first and last points
    let maxDistance = 0;
    let maxIndex = 0;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.perpendicularDistance(points[i], firstPoint, lastPoint);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
      const leftSegment = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const rightSegment = this.douglasPeucker(points.slice(maxIndex), tolerance);
      
      // Combine results (remove duplicate point at junction)
      return [...leftSegment.slice(0, -1), ...rightSegment];
    } else {
      // All points are within tolerance, return just the endpoints
      return [firstPoint, lastPoint];
    }
  }

  private perpendicularDistance(point: TrackPoint, lineStart: TrackPoint, lineEnd: TrackPoint): number {
    // Calculate perpendicular distance from point to line segment
    const A = point.latitude - lineStart.latitude;
    const B = point.longitude - lineStart.longitude;
    const C = lineEnd.latitude - lineStart.latitude;
    const D = lineEnd.longitude - lineStart.longitude;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) {
      // Line start and end are the same point
      return this.calculateDistance(point, lineStart);
    }

    const param = dot / lenSq;

    let closestPoint: { latitude: number; longitude: number };
    
    if (param < 0) {
      closestPoint = { latitude: lineStart.latitude, longitude: lineStart.longitude };
    } else if (param > 1) {
      closestPoint = { latitude: lineEnd.latitude, longitude: lineEnd.longitude };
    } else {
      closestPoint = {
        latitude: lineStart.latitude + param * C,
        longitude: lineStart.longitude + param * D,
      };
    }

    return this.calculateDistance(
      point,
      { ...closestPoint, accuracy: 0, timestamp: new Date(), source: 'gps' }
    );
  }

  private encodeCoordinates(coordinates: number[][]): string {
    // Simplified polyline encoding (Google's algorithm)
    if (coordinates.length === 0) {
      return '';
    }

    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const coord of coordinates) {
      const lat = Math.round(coord[0] * 1e5);
      const lng = Math.round(coord[1] * 1e5);

      const deltaLat = lat - prevLat;
      const deltaLng = lng - prevLng;

      encoded += this.encodeSignedNumber(deltaLat);
      encoded += this.encodeSignedNumber(deltaLng);

      prevLat = lat;
      prevLng = lng;
    }

    return encoded;
  }

  private encodeSignedNumber(num: number): string {
    let sgn_num = num << 1;
    if (num < 0) {
      sgn_num = ~sgn_num;
    }
    return this.encodeNumber(sgn_num);
  }

  private encodeNumber(num: number): string {
    let encoded = '';
    while (num >= 0x20) {
      encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
      num >>= 5;
    }
    encoded += String.fromCharCode(num + 63);
    return encoded;
  }
}

// Export singleton instance
export const gpsDataProcessor = new GPSDataProcessor();