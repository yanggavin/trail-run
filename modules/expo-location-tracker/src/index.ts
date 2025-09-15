import ExpoLocationTrackerModule from './ExpoLocationTrackerModule';

export interface LocationConfig {
  accuracy: 'high' | 'balanced' | 'low';
  interval: number; // milliseconds
  distanceFilter: number; // meters
  adaptiveThrottling: boolean;
}

export interface Location {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  timestamp: number;
  source: 'gps' | 'network' | 'passive';
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

export default {
  /**
   * Start location tracking with the specified configuration
   */
  async startLocationUpdates(config: LocationConfig): Promise<void> {
    return ExpoLocationTrackerModule.startLocationUpdates(config);
  },

  /**
   * Stop location tracking
   */
  async stopLocationUpdates(): Promise<void> {
    return ExpoLocationTrackerModule.stopLocationUpdates();
  },

  /**
   * Pause location tracking (keeps GPS active but stops recording)
   */
  async pauseLocationUpdates(): Promise<void> {
    return ExpoLocationTrackerModule.pauseLocationUpdates();
  },

  /**
   * Resume location tracking
   */
  async resumeLocationUpdates(): Promise<void> {
    return ExpoLocationTrackerModule.resumeLocationUpdates();
  },

  /**
   * Get current location
   */
  async getCurrentLocation(): Promise<Location> {
    return ExpoLocationTrackerModule.getCurrentLocation();
  },

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<PermissionStatus> {
    return ExpoLocationTrackerModule.requestPermissions();
  },

  /**
   * Get current tracking status
   */
  async getTrackingStatus(): Promise<TrackingStatus> {
    return ExpoLocationTrackerModule.getTrackingStatus();
  },

  /**
   * Add location update listener
   */
  addLocationUpdateListener(listener: (location: Location) => void) {
    // For now, return a mock subscription object
    // In a real implementation, this would use the native event emitter
    return { remove: () => {} };
  },

  /**
   * Add tracking status change listener
   */
  addTrackingStatusListener(listener: (status: TrackingStatus) => void) {
    // For now, return a mock subscription object
    // In a real implementation, this would use the native event emitter
    return { remove: () => {} };
  },

  /**
   * Add permission status change listener
   */
  addPermissionStatusListener(listener: (status: PermissionStatus) => void) {
    // For now, return a mock subscription object
    // In a real implementation, this would use the native event emitter
    return { remove: () => {} };
  }
};