/**
 * Integration tests for LocationService
 * These tests verify the integration between LocationService and native modules
 */

import { LocationService, LocationConfig } from '../LocationService';

// Note: These tests require a real device or simulator with location services
// They are marked as integration tests and should be run separately from unit tests

describe('LocationService Integration Tests', () => {
  let locationService: LocationService;
  
  beforeEach(() => {
    locationService = LocationService.getInstance();
  });

  afterEach(() => {
    locationService.cleanup();
  });

  // Skip these tests in CI/CD environments where location services aren't available
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  
  describe.skip('Real Device Tests', () => {
    it('should request permissions on real device', async () => {
      if (isTestEnvironment) return;
      
      const permissionStatus = await locationService.requestPermissions();
      
      expect(permissionStatus).toHaveProperty('granted');
      expect(permissionStatus).toHaveProperty('canAskAgain');
      expect(permissionStatus).toHaveProperty('status');
      expect(['granted', 'denied', 'undetermined', 'restricted']).toContain(permissionStatus.status);
    }, 10000);

    it('should start and stop tracking on real device', async () => {
      if (isTestEnvironment) return;
      
      const config: LocationConfig = {
        accuracy: 'high',
        interval: 2000,
        distanceFilter: 1,
        adaptiveThrottling: true,
        backgroundTracking: false, // Don't test background in integration tests
      };

      // Start tracking
      await locationService.startTracking(config);
      
      let status = await locationService.getTrackingStatus();
      expect(status.isTracking).toBe(true);
      expect(status.isPaused).toBe(false);

      // Wait a bit for location updates
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Stop tracking
      await locationService.stopTracking();
      
      status = await locationService.getTrackingStatus();
      expect(status.isTracking).toBe(false);
    }, 15000);

    it('should pause and resume tracking on real device', async () => {
      if (isTestEnvironment) return;
      
      const config: LocationConfig = {
        accuracy: 'balanced',
        interval: 1000,
        distanceFilter: 0,
        adaptiveThrottling: false,
        backgroundTracking: false,
      };

      // Start tracking
      await locationService.startTracking(config);
      
      // Pause tracking
      await locationService.pauseTracking();
      
      let status = await locationService.getTrackingStatus();
      expect(status.isTracking).toBe(true);
      expect(status.isPaused).toBe(true);

      // Resume tracking
      await locationService.resumeTracking();
      
      status = await locationService.getTrackingStatus();
      expect(status.isTracking).toBe(true);
      expect(status.isPaused).toBe(false);

      // Cleanup
      await locationService.stopTracking();
    }, 10000);

    it('should get current location on real device', async () => {
      if (isTestEnvironment) return;
      
      const location = await locationService.getCurrentLocation();
      
      expect(location).toHaveProperty('latitude');
      expect(location).toHaveProperty('longitude');
      expect(location).toHaveProperty('accuracy');
      expect(location).toHaveProperty('timestamp');
      expect(location).toHaveProperty('source');
      
      expect(typeof location.latitude).toBe('number');
      expect(typeof location.longitude).toBe('number');
      expect(typeof location.accuracy).toBe('number');
      expect(typeof location.timestamp).toBe('number');
      
      // Validate coordinate ranges
      expect(location.latitude).toBeGreaterThanOrEqual(-90);
      expect(location.latitude).toBeLessThanOrEqual(90);
      expect(location.longitude).toBeGreaterThanOrEqual(-180);
      expect(location.longitude).toBeLessThanOrEqual(180);
    }, 10000);

    it('should emit location updates during tracking', async () => {
      if (isTestEnvironment) return;
      
      const locationUpdates: any[] = [];
      
      locationService.on('locationUpdate', (location) => {
        locationUpdates.push(location);
      });

      const config: LocationConfig = {
        accuracy: 'high',
        interval: 1000,
        distanceFilter: 0,
        adaptiveThrottling: false,
        backgroundTracking: false,
      };

      await locationService.startTracking(config);
      
      // Wait for some location updates
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      await locationService.stopTracking();
      
      expect(locationUpdates.length).toBeGreaterThan(0);
      
      // Verify location update structure
      const firstUpdate = locationUpdates[0];
      expect(firstUpdate).toHaveProperty('latitude');
      expect(firstUpdate).toHaveProperty('longitude');
      expect(firstUpdate).toHaveProperty('accuracy');
      expect(firstUpdate).toHaveProperty('timestamp');
    }, 15000);
  });

  describe('Mock Environment Tests', () => {
    it('should handle initialization in test environment', async () => {
      // This test runs in all environments
      await expect(locationService.initialize()).resolves.toBeUndefined();
    });

    it('should handle cleanup properly', () => {
      // This test runs in all environments
      expect(() => locationService.cleanup()).not.toThrow();
    });
  });
});