// Mock implementation for the native location tracker module

export interface MockLocationUpdate {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  timestamp: number;
  source: 'gps' | 'network' | 'passive';
}

export interface MockTrackingStatus {
  isTracking: boolean;
  isPaused: boolean;
  startTime?: number;
  lastLocation?: MockLocationUpdate;
}

export interface MockPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
}

export interface MockLocationConfig {
  accuracy: 'high' | 'balanced' | 'low';
  interval: number;
  distanceFilter: number;
  adaptiveThrottling: boolean;
  backgroundTracking?: boolean;
  kalmanFilterEnabled?: boolean;
  outlierDetectionEnabled?: boolean;
  maxSpeedThreshold?: number;
  maxAccuracyThreshold?: number;
}

class MockExpoLocationTracker {
  private isTracking = false;
  private isPaused = false;
  private startTime: number | null = null;
  private lastLocation: MockLocationUpdate | null = null;
  private listeners: { [key: string]: Function[] } = {
    locationUpdate: [],
    trackingStatus: [],
    permissionStatus: [],
  };

  // Mock location data for testing
  private mockLocations: MockLocationUpdate[] = [
    {
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 100,
      accuracy: 5,
      speed: 2.5,
      heading: 180,
      timestamp: Date.now(),
      source: 'gps',
    },
    {
      latitude: 37.7750,
      longitude: -122.4195,
      altitude: 102,
      accuracy: 4,
      speed: 2.8,
      heading: 185,
      timestamp: Date.now() + 1000,
      source: 'gps',
    },
  ];

  private currentLocationIndex = 0;

  async startLocationUpdates(config: MockLocationConfig): Promise<void> {
    if (this.isTracking) {
      throw new Error('Location tracking is already active');
    }

    this.isTracking = true;
    this.isPaused = false;
    this.startTime = Date.now();

    // Simulate location updates
    this.simulateLocationUpdates();

    // Notify status listeners
    this.notifyTrackingStatusListeners({
      isTracking: true,
      isPaused: false,
      startTime: this.startTime,
    });
  }

  async stopLocationUpdates(): Promise<void> {
    if (!this.isTracking) {
      throw new Error('Location tracking is not active');
    }

    this.isTracking = false;
    this.isPaused = false;
    this.startTime = null;
    this.lastLocation = null;
    this.currentLocationIndex = 0;

    // Notify status listeners
    this.notifyTrackingStatusListeners({
      isTracking: false,
      isPaused: false,
    });
  }

  async pauseLocationUpdates(): Promise<void> {
    if (!this.isTracking) {
      throw new Error('Location tracking is not active');
    }

    this.isPaused = true;

    // Notify status listeners
    this.notifyTrackingStatusListeners({
      isTracking: true,
      isPaused: true,
      startTime: this.startTime,
      lastLocation: this.lastLocation,
    });
  }

  async resumeLocationUpdates(): Promise<void> {
    if (!this.isTracking) {
      throw new Error('Location tracking is not active');
    }

    this.isPaused = false;

    // Resume location updates
    this.simulateLocationUpdates();

    // Notify status listeners
    this.notifyTrackingStatusListeners({
      isTracking: true,
      isPaused: false,
      startTime: this.startTime,
      lastLocation: this.lastLocation,
    });
  }

  async getCurrentLocation(): Promise<MockLocationUpdate> {
    // Return a mock current location
    return {
      latitude: 37.7749 + Math.random() * 0.001,
      longitude: -122.4194 + Math.random() * 0.001,
      altitude: 100 + Math.random() * 10,
      accuracy: 3 + Math.random() * 5,
      speed: 2 + Math.random() * 2,
      heading: Math.random() * 360,
      timestamp: Date.now(),
      source: 'gps',
    };
  }

  async requestPermissions(): Promise<MockPermissionStatus> {
    // Mock permission request - always grant for testing
    return {
      granted: true,
      canAskAgain: false,
      status: 'granted',
    };
  }

  async getTrackingStatus(): Promise<MockTrackingStatus> {
    return {
      isTracking: this.isTracking,
      isPaused: this.isPaused,
      startTime: this.startTime || undefined,
      lastLocation: this.lastLocation || undefined,
    };
  }

  // Event listener management
  addLocationUpdateListener(callback: (location: MockLocationUpdate) => void): { remove: () => void } {
    this.listeners.locationUpdate.push(callback);
    return {
      remove: () => {
        const index = this.listeners.locationUpdate.indexOf(callback);
        if (index > -1) {
          this.listeners.locationUpdate.splice(index, 1);
        }
      },
    };
  }

  addTrackingStatusListener(callback: (status: MockTrackingStatus) => void): { remove: () => void } {
    this.listeners.trackingStatus.push(callback);
    return {
      remove: () => {
        const index = this.listeners.trackingStatus.indexOf(callback);
        if (index > -1) {
          this.listeners.trackingStatus.splice(index, 1);
        }
      },
    };
  }

  addPermissionStatusListener(callback: (status: MockPermissionStatus) => void): { remove: () => void } {
    this.listeners.permissionStatus.push(callback);
    return {
      remove: () => {
        const index = this.listeners.permissionStatus.indexOf(callback);
        if (index > -1) {
          this.listeners.permissionStatus.splice(index, 1);
        }
      },
    };
  }

  // Test utilities
  setMockLocations(locations: MockLocationUpdate[]): void {
    this.mockLocations = locations;
    this.currentLocationIndex = 0;
  }

  triggerLocationUpdate(location?: MockLocationUpdate): void {
    const locationToSend = location || this.getNextMockLocation();
    this.lastLocation = locationToSend;
    this.notifyLocationListeners(locationToSend);
  }

  triggerPermissionChange(status: MockPermissionStatus): void {
    this.notifyPermissionListeners(status);
  }

  // Private methods
  private simulateLocationUpdates(): void {
    if (!this.isTracking || this.isPaused) {
      return;
    }

    // Simulate location update every 2 seconds
    setTimeout(() => {
      if (this.isTracking && !this.isPaused) {
        const location = this.getNextMockLocation();
        this.lastLocation = location;
        this.notifyLocationListeners(location);
        this.simulateLocationUpdates(); // Continue simulation
      }
    }, 2000);
  }

  private getNextMockLocation(): MockLocationUpdate {
    const location = this.mockLocations[this.currentLocationIndex % this.mockLocations.length];
    this.currentLocationIndex++;
    
    // Add some randomness to make it more realistic
    return {
      ...location,
      latitude: location.latitude + (Math.random() - 0.5) * 0.0001,
      longitude: location.longitude + (Math.random() - 0.5) * 0.0001,
      timestamp: Date.now(),
    };
  }

  private notifyLocationListeners(location: MockLocationUpdate): void {
    this.listeners.locationUpdate.forEach(callback => {
      try {
        callback(location);
      } catch (error) {
        console.error('Error in location update listener:', error);
      }
    });
  }

  private notifyTrackingStatusListeners(status: MockTrackingStatus): void {
    this.listeners.trackingStatus.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in tracking status listener:', error);
      }
    });
  }

  private notifyPermissionListeners(status: MockPermissionStatus): void {
    this.listeners.permissionStatus.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in permission status listener:', error);
      }
    });
  }

  // Reset mock state (useful for testing)
  reset(): void {
    this.isTracking = false;
    this.isPaused = false;
    this.startTime = null;
    this.lastLocation = null;
    this.currentLocationIndex = 0;
    this.listeners = {
      locationUpdate: [],
      trackingStatus: [],
      permissionStatus: [],
    };
  }
}

// Export singleton instance
export default new MockExpoLocationTracker();

// Export types for use in tests
export type {
  MockLocationUpdate as LocationUpdate,
  MockTrackingStatus as TrackingStatus,
  MockPermissionStatus as PermissionStatus,
  MockLocationConfig as LocationConfig,
};