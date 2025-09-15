import ExpoLocationTracker from '../../../modules/expo-location-tracker/src';
import { EventEmitter } from 'events';

export interface LocationConfig {
  accuracy: 'high' | 'balanced' | 'low';
  interval: number; // milliseconds
  distanceFilter: number; // meters
  adaptiveThrottling: boolean;
  backgroundTracking?: boolean;
}

export interface Location {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  timestamp: number;
  source: 'gps' | 'network' | 'passive' | 'error' | 'unavailable';
}

export interface PermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined' | 'restricted';
}

export interface TrackingStatus {
  isTracking: boolean;
  isPaused: boolean;
  startTime?: number;
  lastLocation?: Location;
}

export interface LocationServiceConfig extends LocationConfig {
  kalmanFilterEnabled?: boolean;
  outlierDetectionEnabled?: boolean;
  maxSpeedThreshold?: number; // m/s
  maxAccuracyThreshold?: number; // meters
}

/**
 * Unified LocationService that provides cross-platform GPS tracking functionality
 * with advanced filtering, smoothing, and adaptive sampling capabilities.
 */
export class LocationService extends EventEmitter {
  private static instance: LocationService;
  private isInitialized = false;
  private currentConfig?: LocationServiceConfig;
  private trackingStatus: TrackingStatus = {
    isTracking: false,
    isPaused: false,
  };
  
  // Kalman filter state
  private kalmanState: KalmanFilterState | null = null;
  
  // Location history for adaptive sampling
  private locationHistory: Location[] = [];
  private readonly historySize = 10;
  
  // Listeners
  private locationUpdateSubscription?: any;
  private trackingStatusSubscription?: any;
  private permissionStatusSubscription?: any;

  private constructor() {
    super();
  }

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Initialize the location service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Set up event listeners
      this.locationUpdateSubscription = ExpoLocationTracker.addLocationUpdateListener(
        this.handleLocationUpdate.bind(this)
      );
      
      this.trackingStatusSubscription = ExpoLocationTracker.addTrackingStatusListener(
        this.handleTrackingStatusChange.bind(this)
      );
      
      this.permissionStatusSubscription = ExpoLocationTracker.addPermissionStatusListener(
        this.handlePermissionStatusChange.bind(this)
      );

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize LocationService: ${error}`);
    }
  }

  /**
   * Start location tracking with the specified configuration
   */
  public async startTracking(config: LocationServiceConfig): Promise<void> {
    await this.initialize();
    
    this.currentConfig = {
      kalmanFilterEnabled: true,
      outlierDetectionEnabled: true,
      maxSpeedThreshold: 50, // 50 m/s = 180 km/h
      maxAccuracyThreshold: 100, // 100 meters
      ...config,
      // Set defaults for required fields if not provided
      accuracy: config.accuracy || 'high',
      interval: config.interval || 1000,
      distanceFilter: config.distanceFilter || 0,
      adaptiveThrottling: config.adaptiveThrottling !== undefined ? config.adaptiveThrottling : true,
      backgroundTracking: config.backgroundTracking !== undefined ? config.backgroundTracking : true,
    };

    // Initialize Kalman filter if enabled
    if (this.currentConfig.kalmanFilterEnabled) {
      this.kalmanState = this.initializeKalmanFilter();
    }

    // Clear location history
    this.locationHistory = [];

    try {
      await ExpoLocationTracker.startLocationUpdates(this.currentConfig);
    } catch (error) {
      throw new Error(`Failed to start location tracking: ${error}`);
    }
  }

  /**
   * Stop location tracking
   */
  public async stopTracking(): Promise<void> {
    try {
      await ExpoLocationTracker.stopLocationUpdates();
      this.kalmanState = null;
      this.locationHistory = [];
    } catch (error) {
      throw new Error(`Failed to stop location tracking: ${error}`);
    }
  }

  /**
   * Pause location tracking
   */
  public async pauseTracking(): Promise<void> {
    try {
      await ExpoLocationTracker.pauseLocationUpdates();
    } catch (error) {
      throw new Error(`Failed to pause location tracking: ${error}`);
    }
  }

  /**
   * Resume location tracking
   */
  public async resumeTracking(): Promise<void> {
    try {
      await ExpoLocationTracker.resumeLocationUpdates();
    } catch (error) {
      throw new Error(`Failed to resume location tracking: ${error}`);
    }
  }

  /**
   * Get current location
   */
  public async getCurrentLocation(): Promise<Location> {
    await this.initialize();
    
    try {
      const location = await ExpoLocationTracker.getCurrentLocation();
      const processedLocation = this.processLocation(location);
      if (processedLocation === null) {
        throw new Error('Location processing failed');
      }
      return processedLocation;
    } catch (error) {
      throw new Error(`Failed to get current location: ${error}`);
    }
  }

  /**
   * Request location permissions
   */
  public async requestPermissions(): Promise<PermissionStatus> {
    await this.initialize();
    
    try {
      return await ExpoLocationTracker.requestPermissions();
    } catch (error) {
      throw new Error(`Failed to request permissions: ${error}`);
    }
  }

  /**
   * Get current tracking status
   */
  public async getTrackingStatus(): Promise<TrackingStatus> {
    if (!this.isInitialized) {
      return this.trackingStatus;
    }
    
    try {
      return await ExpoLocationTracker.getTrackingStatus();
    } catch (error) {
      return this.trackingStatus;
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.locationUpdateSubscription) {
      this.locationUpdateSubscription.remove();
    }
    if (this.trackingStatusSubscription) {
      this.trackingStatusSubscription.remove();
    }
    if (this.permissionStatusSubscription) {
      this.permissionStatusSubscription.remove();
    }
    
    this.isInitialized = false;
    this.kalmanState = null;
    this.locationHistory = [];
  }

  // MARK: - Private Methods

  private handleLocationUpdate(rawLocation: Location): void {
    try {
      const processedLocation = this.processLocation(rawLocation);
      
      if (processedLocation) {
        this.emit('locationUpdate', processedLocation);
      }
    } catch (error) {
      console.error('Error processing location update:', error);
    }
  }

  private handleTrackingStatusChange(status: TrackingStatus): void {
    this.trackingStatus = status;
    this.emit('trackingStatusChange', status);
  }

  private handlePermissionStatusChange(status: PermissionStatus): void {
    this.emit('permissionStatusChange', status);
  }

  private processLocation(rawLocation: Location): Location | null {
    if (!this.currentConfig) {
      return rawLocation;
    }

    // Skip processing for error/unavailable locations
    if (rawLocation.source === 'error' || rawLocation.source === 'unavailable') {
      return rawLocation;
    }

    // Outlier detection
    if (this.currentConfig.outlierDetectionEnabled && this.isOutlier(rawLocation)) {
      console.log('Location filtered as outlier:', rawLocation);
      return null;
    }

    // Apply Kalman filter if enabled
    let processedLocation = rawLocation;
    if (this.currentConfig.kalmanFilterEnabled && this.kalmanState) {
      processedLocation = this.applyKalmanFilter(rawLocation);
    }

    // Update location history
    this.updateLocationHistory(processedLocation);

    // Apply adaptive throttling if enabled
    if (this.currentConfig.adaptiveThrottling) {
      processedLocation = this.applyAdaptiveThrottling(processedLocation);
    }

    return processedLocation;
  }

  private isOutlier(location: Location): boolean {
    if (!this.currentConfig) return false;

    // Check accuracy threshold
    if (location.accuracy > this.currentConfig.maxAccuracyThreshold!) {
      return true;
    }

    // Check speed threshold if we have previous location
    if (this.locationHistory.length > 0) {
      const lastLocation = this.locationHistory[this.locationHistory.length - 1];
      const distance = this.calculateDistance(lastLocation, location);
      const timeInterval = (location.timestamp - lastLocation.timestamp) / 1000; // seconds
      
      if (timeInterval > 0) {
        const speed = distance / timeInterval;
        if (speed > this.currentConfig.maxSpeedThreshold!) {
          return true;
        }
      }
    }

    return false;
  }

  private initializeKalmanFilter(): KalmanFilterState {
    return {
      // State vector: [latitude, longitude, velocity_lat, velocity_lon]
      x: [0, 0, 0, 0],
      // Covariance matrix (4x4)
      P: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
      ],
      // Process noise
      Q: 0.1,
      // Measurement noise
      R: 1.0,
      initialized: false
    };
  }

  private applyKalmanFilter(location: Location): Location {
    if (!this.kalmanState) {
      return location;
    }

    if (!this.kalmanState.initialized) {
      // Initialize with first location
      this.kalmanState.x = [location.latitude, location.longitude, 0, 0];
      this.kalmanState.initialized = true;
      return location;
    }

    // Simplified Kalman filter implementation
    // In a real implementation, you would use a proper matrix library
    const dt = this.locationHistory.length > 0 
      ? (location.timestamp - this.locationHistory[this.locationHistory.length - 1].timestamp) / 1000
      : 1;

    // Predict step
    const predictedLat = this.kalmanState.x[0] + this.kalmanState.x[2] * dt;
    const predictedLon = this.kalmanState.x[1] + this.kalmanState.x[3] * dt;

    // Update step (simplified)
    const kalmanGain = 0.5; // Simplified gain
    const filteredLat = predictedLat + kalmanGain * (location.latitude - predictedLat);
    const filteredLon = predictedLon + kalmanGain * (location.longitude - predictedLon);

    // Update state
    this.kalmanState.x[0] = filteredLat;
    this.kalmanState.x[1] = filteredLon;
    this.kalmanState.x[2] = (filteredLat - predictedLat) / dt; // velocity
    this.kalmanState.x[3] = (filteredLon - predictedLon) / dt; // velocity

    return {
      ...location,
      latitude: filteredLat,
      longitude: filteredLon,
    };
  }

  private applyAdaptiveThrottling(location: Location): Location {
    // Implement adaptive sampling based on movement patterns
    // For now, return the location as-is
    // In a full implementation, you would adjust sampling rate based on speed and movement patterns
    return location;
  }

  private updateLocationHistory(location: Location): void {
    this.locationHistory.push(location);
    
    if (this.locationHistory.length > this.historySize) {
      this.locationHistory.shift();
    }
  }

  private calculateDistance(loc1: Location, loc2: Location): number {
    // Haversine formula for calculating distance between two points
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = (loc1.latitude * Math.PI) / 180;
    const lat2Rad = (loc2.latitude * Math.PI) / 180;
    const deltaLatRad = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const deltaLonRad = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }
}

// MARK: - Supporting Types

interface KalmanFilterState {
  x: number[]; // State vector
  P: number[][]; // Covariance matrix
  Q: number; // Process noise
  R: number; // Measurement noise
  initialized: boolean;
}

// Export singleton instance
export const locationService = LocationService.getInstance();