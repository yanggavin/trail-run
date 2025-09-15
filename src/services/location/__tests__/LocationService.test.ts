import { LocationService, Location, LocationConfig, PermissionStatus, TrackingStatus } from '../LocationService';

// Mock the native module
jest.mock('../../../../modules/expo-location-tracker/src', () => ({
  startLocationUpdates: jest.fn(),
  stopLocationUpdates: jest.fn(),
  pauseLocationUpdates: jest.fn(),
  resumeLocationUpdates: jest.fn(),
  getCurrentLocation: jest.fn(),
  requestPermissions: jest.fn(),
  getTrackingStatus: jest.fn(),
  addLocationUpdateListener: jest.fn(() => ({ remove: jest.fn() })),
  addTrackingStatusListener: jest.fn(() => ({ remove: jest.fn() })),
  addPermissionStatusListener: jest.fn(() => ({ remove: jest.fn() })),
}));

import ExpoLocationTracker from '../../../../modules/expo-location-tracker/src';

describe('LocationService', () => {
  let locationService: LocationService;
  
  beforeEach(() => {
    locationService = LocationService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    locationService.cleanup();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = LocationService.getInstance();
      const instance2 = LocationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(locationService.initialize()).resolves.toBeUndefined();
      expect(ExpoLocationTracker.addLocationUpdateListener).toHaveBeenCalled();
      expect(ExpoLocationTracker.addTrackingStatusListener).toHaveBeenCalled();
      expect(ExpoLocationTracker.addPermissionStatusListener).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await locationService.initialize();
      await locationService.initialize();
      expect(ExpoLocationTracker.addLocationUpdateListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Location Tracking', () => {
    const mockConfig: LocationConfig = {
      accuracy: 'high',
      interval: 1000,
      distanceFilter: 5,
      adaptiveThrottling: true,
      backgroundTracking: true,
    };

    beforeEach(async () => {
      await locationService.initialize();
    });

    it('should start tracking with default config', async () => {
      (ExpoLocationTracker.startLocationUpdates as jest.Mock).mockResolvedValue(undefined);
      
      await locationService.startTracking(mockConfig);
      
      expect(ExpoLocationTracker.startLocationUpdates).toHaveBeenCalledWith(
        expect.objectContaining({
          accuracy: 'high',
          interval: 1000,
          distanceFilter: 5,
          adaptiveThrottling: true,
          backgroundTracking: true,
          kalmanFilterEnabled: true,
          outlierDetectionEnabled: true,
          maxSpeedThreshold: 50,
          maxAccuracyThreshold: 100,
        })
      );
    });

    it('should stop tracking successfully', async () => {
      (ExpoLocationTracker.stopLocationUpdates as jest.Mock).mockResolvedValue(undefined);
      
      await locationService.stopTracking();
      
      expect(ExpoLocationTracker.stopLocationUpdates).toHaveBeenCalled();
    });

    it('should pause tracking successfully', async () => {
      (ExpoLocationTracker.pauseLocationUpdates as jest.Mock).mockResolvedValue(undefined);
      
      await locationService.pauseTracking();
      
      expect(ExpoLocationTracker.pauseLocationUpdates).toHaveBeenCalled();
    });

    it('should resume tracking successfully', async () => {
      (ExpoLocationTracker.resumeLocationUpdates as jest.Mock).mockResolvedValue(undefined);
      
      await locationService.resumeTracking();
      
      expect(ExpoLocationTracker.resumeLocationUpdates).toHaveBeenCalled();
    });

    it('should handle tracking errors', async () => {
      const error = new Error('GPS not available');
      (ExpoLocationTracker.startLocationUpdates as jest.Mock).mockRejectedValue(error);
      
      await expect(locationService.startTracking(mockConfig)).rejects.toThrow(
        'Failed to start location tracking: Error: GPS not available'
      );
    });
  });

  describe('Current Location', () => {
    const mockLocation: Location = {
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 100,
      accuracy: 5,
      speed: 2.5,
      heading: 180,
      timestamp: Date.now(),
      source: 'gps',
    };

    beforeEach(async () => {
      await locationService.initialize();
    });

    it('should get current location successfully', async () => {
      (ExpoLocationTracker.getCurrentLocation as jest.Mock).mockResolvedValue(mockLocation);
      
      const location = await locationService.getCurrentLocation();
      
      expect(location).toEqual(mockLocation);
      expect(ExpoLocationTracker.getCurrentLocation).toHaveBeenCalled();
    });

    it('should handle location errors', async () => {
      const error = new Error('Location unavailable');
      (ExpoLocationTracker.getCurrentLocation as jest.Mock).mockRejectedValue(error);
      
      await expect(locationService.getCurrentLocation()).rejects.toThrow(
        'Failed to get current location: Error: Location unavailable'
      );
    });
  });

  describe('Permissions', () => {
    const mockPermissionStatus: PermissionStatus = {
      granted: true,
      canAskAgain: false,
      status: 'granted',
    };

    beforeEach(async () => {
      await locationService.initialize();
    });

    it('should request permissions successfully', async () => {
      (ExpoLocationTracker.requestPermissions as jest.Mock).mockResolvedValue(mockPermissionStatus);
      
      const status = await locationService.requestPermissions();
      
      expect(status).toEqual(mockPermissionStatus);
      expect(ExpoLocationTracker.requestPermissions).toHaveBeenCalled();
    });

    it('should handle permission errors', async () => {
      const error = new Error('Permission denied');
      (ExpoLocationTracker.requestPermissions as jest.Mock).mockRejectedValue(error);
      
      await expect(locationService.requestPermissions()).rejects.toThrow(
        'Failed to request permissions: Error: Permission denied'
      );
    });
  });

  describe('Tracking Status', () => {
    const mockTrackingStatus: TrackingStatus = {
      isTracking: true,
      isPaused: false,
      startTime: Date.now(),
      lastLocation: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        timestamp: Date.now(),
        source: 'gps',
      },
    };

    beforeEach(async () => {
      await locationService.initialize();
    });

    it('should get tracking status successfully', async () => {
      (ExpoLocationTracker.getTrackingStatus as jest.Mock).mockResolvedValue(mockTrackingStatus);
      
      const status = await locationService.getTrackingStatus();
      
      expect(status).toEqual(mockTrackingStatus);
      expect(ExpoLocationTracker.getTrackingStatus).toHaveBeenCalled();
    });

    it('should return default status when not initialized', async () => {
      const uninitializedService = LocationService.getInstance();
      uninitializedService.cleanup(); // Ensure not initialized
      
      const status = await uninitializedService.getTrackingStatus();
      
      expect(status).toEqual({
        isTracking: false,
        isPaused: false,
      });
    });
  });

  describe('Location Processing', () => {
    beforeEach(async () => {
      await locationService.initialize();
    });

    describe('Outlier Detection', () => {
      it('should filter locations with poor accuracy', async () => {
        (ExpoLocationTracker.startLocationUpdates as jest.Mock).mockResolvedValue(undefined);
        
        const config: LocationConfig = {
          accuracy: 'high',
          interval: 1000,
          distanceFilter: 0,
          adaptiveThrottling: false,
        };
        
        await locationService.startTracking(config);
        
        const mockLocationUpdateListener = (ExpoLocationTracker.addLocationUpdateListener as jest.Mock).mock.calls[0][0];
        
        const locationUpdateSpy = jest.fn();
        locationService.on('locationUpdate', locationUpdateSpy);
        
        // Location with poor accuracy (should be filtered)
        const poorAccuracyLocation: Location = {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 150, // Above threshold
          timestamp: Date.now(),
          source: 'gps',
        };
        
        mockLocationUpdateListener(poorAccuracyLocation);
        
        expect(locationUpdateSpy).not.toHaveBeenCalled();
      });

      it('should filter locations with impossible speed', async () => {
        (ExpoLocationTracker.startLocationUpdates as jest.Mock).mockResolvedValue(undefined);
        
        const config: LocationConfig = {
          accuracy: 'high',
          interval: 1000,
          distanceFilter: 0,
          adaptiveThrottling: false,
        };
        
        await locationService.startTracking(config);
        
        const mockLocationUpdateListener = (ExpoLocationTracker.addLocationUpdateListener as jest.Mock).mock.calls[0][0];
        
        const locationUpdateSpy = jest.fn();
        locationService.on('locationUpdate', locationUpdateSpy);
        
        // First location
        const firstLocation: Location = {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          timestamp: Date.now(),
          source: 'gps',
        };
        
        mockLocationUpdateListener(firstLocation);
        expect(locationUpdateSpy).toHaveBeenCalledTimes(1);
        
        // Second location with impossible speed (teleportation)
        const impossibleLocation: Location = {
          latitude: 38.7749, // ~111km away
          longitude: -122.4194,
          accuracy: 5,
          timestamp: Date.now() + 1000, // 1 second later
          source: 'gps',
        };
        
        mockLocationUpdateListener(impossibleLocation);
        
        // Should still be called only once (second location filtered)
        expect(locationUpdateSpy).toHaveBeenCalledTimes(1);
      });

      it('should pass through error and unavailable locations', async () => {
        (ExpoLocationTracker.startLocationUpdates as jest.Mock).mockResolvedValue(undefined);
        
        const config: LocationConfig = {
          accuracy: 'high',
          interval: 1000,
          distanceFilter: 0,
          adaptiveThrottling: false,
        };
        
        await locationService.startTracking(config);
        
        const mockLocationUpdateListener = (ExpoLocationTracker.addLocationUpdateListener as jest.Mock).mock.calls[0][0];
        
        const locationUpdateSpy = jest.fn();
        locationService.on('locationUpdate', locationUpdateSpy);
        
        const errorLocation: Location = {
          latitude: 0,
          longitude: 0,
          accuracy: -1,
          timestamp: Date.now(),
          source: 'error',
        };
        
        mockLocationUpdateListener(errorLocation);
        
        expect(locationUpdateSpy).toHaveBeenCalledWith(errorLocation);
      });
    });

    describe('Distance Calculation', () => {
      it('should calculate distance correctly using Haversine formula', () => {
        // Test with known coordinates
        const loc1: Location = {
          latitude: 37.7749, // San Francisco
          longitude: -122.4194,
          accuracy: 5,
          timestamp: Date.now(),
          source: 'gps',
        };
        
        const loc2: Location = {
          latitude: 37.7849, // ~1.1km north
          longitude: -122.4194,
          accuracy: 5,
          timestamp: Date.now(),
          source: 'gps',
        };
        
        // Access private method through reflection for testing
        const distance = (locationService as any).calculateDistance(loc1, loc2);
        
        // Should be approximately 1111 meters (1 degree latitude ≈ 111km)
        expect(distance).toBeCloseTo(1111, -2); // Within 100m tolerance
      });
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await locationService.initialize();
    });

    it('should emit location updates', async () => {
      const mockLocationUpdateListener = (ExpoLocationTracker.addLocationUpdateListener as jest.Mock).mock.calls[0][0];
      
      const locationUpdateSpy = jest.fn();
      locationService.on('locationUpdate', locationUpdateSpy);
      
      const mockLocation: Location = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        timestamp: Date.now(),
        source: 'gps',
      };
      
      mockLocationUpdateListener(mockLocation);
      
      expect(locationUpdateSpy).toHaveBeenCalledWith(mockLocation);
    });

    it('should emit tracking status changes', async () => {
      const mockTrackingStatusListener = (ExpoLocationTracker.addTrackingStatusListener as jest.Mock).mock.calls[0][0];
      
      const statusChangeSpy = jest.fn();
      locationService.on('trackingStatusChange', statusChangeSpy);
      
      const mockStatus: TrackingStatus = {
        isTracking: true,
        isPaused: false,
        startTime: Date.now(),
      };
      
      mockTrackingStatusListener(mockStatus);
      
      expect(statusChangeSpy).toHaveBeenCalledWith(mockStatus);
    });

    it('should emit permission status changes', async () => {
      const mockPermissionStatusListener = (ExpoLocationTracker.addPermissionStatusListener as jest.Mock).mock.calls[0][0];
      
      const permissionChangeSpy = jest.fn();
      locationService.on('permissionStatusChange', permissionChangeSpy);
      
      const mockPermissionStatus: PermissionStatus = {
        granted: true,
        canAskAgain: false,
        status: 'granted',
      };
      
      mockPermissionStatusListener(mockPermissionStatus);
      
      expect(permissionChangeSpy).toHaveBeenCalledWith(mockPermissionStatus);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      await locationService.initialize();
      
      const mockRemove = jest.fn();
      (ExpoLocationTracker.addLocationUpdateListener as jest.Mock).mockReturnValue({ remove: mockRemove });
      (ExpoLocationTracker.addTrackingStatusListener as jest.Mock).mockReturnValue({ remove: mockRemove });
      (ExpoLocationTracker.addPermissionStatusListener as jest.Mock).mockReturnValue({ remove: mockRemove });
      
      // Re-initialize to get the mock return values
      locationService.cleanup();
      await locationService.initialize();
      
      locationService.cleanup();
      
      expect(mockRemove).toHaveBeenCalledTimes(3);
    });
  });
});