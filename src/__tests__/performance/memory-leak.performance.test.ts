import { useAppStore } from '../../store';
import { LocationService } from '../../services/location/LocationService';
import { PhotoService } from '../../services/photo/PhotoService';
import { createTrackPoint } from '../../types/models';

// Mock services
jest.mock('../../services/location/LocationService');
jest.mock('../../services/photo/PhotoService');

describe('Memory Leak Detection and Performance Tests', () => {
  let mockLocationService: jest.Mocked<LocationService>;
  let mockPhotoService: jest.Mocked<PhotoService>;
  let initialMemoryUsage: number;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLocationService = LocationService.getInstance() as jest.Mocked<LocationService>;
    mockPhotoService = new PhotoService() as jest.Mocked<PhotoService>;

    // Mock service methods
    mockLocationService.initialize.mockResolvedValue();
    mockLocationService.startTracking.mockResolvedValue();
    mockLocationService.stopTracking.mockResolvedValue();
    
    mockPhotoService.capturePhoto.mockResolvedValue({
      photoId: 'test-photo',
      activityId: 'test-activity',
      timestamp: new Date(),
      latitude: 37.7749,
      longitude: -122.4194,
      localUri: '/path/to/photo.jpg',
      syncStatus: 'local',
    });

    // Reset store
    useAppStore.getState().resetTracking();
    
    // Record initial memory usage (simulated)
    initialMemoryUsage = this.getMemoryUsage();
  });

  afterEach(() => {
    // Force garbage collection (if available)
    if (global.gc) {
      global.gc();
    }
  });

  describe('Store Memory Management', () => {
    it('should not leak memory during repeated tracking sessions', async () => {
      const userId = 'test-user';
      const sessionCount = 50;
      const memoryReadings: number[] = [];

      for (let i = 0; i < sessionCount; i++) {
        // Start tracking session
        await useAppStore.getState().startTracking(userId);
        
        // Add track points
        for (let j = 0; j < 100; j++) {
          const trackPoint = createTrackPoint({
            latitude: 37.7749 + j * 0.0001,
            longitude: -122.4194 + j * 0.0001,
            accuracy: 5,
            source: 'gps',
            timestamp: new Date(Date.now() + j * 1000),
          });
          useAppStore.getState().addTrackPoint(trackPoint);
        }

        // Complete session
        await useAppStore.getState().stopTracking();
        
        // Force cleanup
        useAppStore.getState().resetTracking();
        
        // Record memory usage every 10 sessions
        if (i % 10 === 0) {
          if (global.gc) global.gc();
          memoryReadings.push(this.getMemoryUsage());
        }
      }

      // Analyze memory growth
      const memoryGrowth = memoryReadings[memoryReadings.length - 1] - memoryReadings[0];
      const maxAcceptableGrowth = initialMemoryUsage * 0.5; // 50% growth max

      expect(memoryGrowth).toBeLessThan(maxAcceptableGrowth);
      
      // Memory should stabilize (not continuously grow)
      const lastThreeReadings = memoryReadings.slice(-3);
      const memoryVariance = Math.max(...lastThreeReadings) - Math.min(...lastThreeReadings);
      expect(memoryVariance).toBeLessThan(initialMemoryUsage * 0.1); // Less than 10% variance
    });

    it('should properly clean up track points in memory', async () => {
      const userId = 'test-user';
      const largeTrackPointCount = 10000;

      await useAppStore.getState().startTracking(userId);
      
      const memoryBeforePoints = this.getMemoryUsage();

      // Add many track points
      for (let i = 0; i < largeTrackPointCount; i++) {
        const trackPoint = createTrackPoint({
          latitude: 37.7749 + i * 0.00001,
          longitude: -122.4194 + i * 0.00001,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(Date.now() + i * 100),
        });
        useAppStore.getState().addTrackPoint(trackPoint);
      }

      const memoryWithPoints = this.getMemoryUsage();
      const memoryIncrease = memoryWithPoints - memoryBeforePoints;

      // Complete and reset tracking
      await useAppStore.getState().stopTracking();
      useAppStore.getState().resetTracking();

      if (global.gc) global.gc();
      
      const memoryAfterCleanup = this.getMemoryUsage();
      const memoryRecovered = memoryWithPoints - memoryAfterCleanup;

      // Should recover most of the memory used by track points
      expect(memoryRecovered).toBeGreaterThan(memoryIncrease * 0.8);
      expect(memoryAfterCleanup).toBeLessThan(memoryBeforePoints * 1.2);
    });

    it('should handle memory pressure during long tracking sessions', async () => {
      const userId = 'test-user';
      const simulatedHours = 8;
      const pointsPerMinute = 60; // 1 point per second
      const totalPoints = simulatedHours * 60 * pointsPerMinute;

      await useAppStore.getState().startTracking(userId);

      const memoryReadings: Array<{ points: number; memory: number }> = [];
      
      for (let i = 0; i < totalPoints; i++) {
        const trackPoint = createTrackPoint({
          latitude: 37.7749 + i * 0.000001,
          longitude: -122.4194 + i * 0.000001,
          accuracy: 5 + Math.random() * 3,
          source: 'gps',
          timestamp: new Date(Date.now() + i * 1000),
        });
        
        useAppStore.getState().addTrackPoint(trackPoint);

        // Record memory usage every 1000 points
        if (i % 1000 === 0) {
          memoryReadings.push({
            points: i,
            memory: this.getMemoryUsage(),
          });
        }
      }

      // Analyze memory growth pattern
      const memoryGrowthRate = this.calculateMemoryGrowthRate(memoryReadings);
      
      // Memory growth should be linear or sublinear, not exponential
      expect(memoryGrowthRate).toBeLessThan(2.0); // Growth rate should be reasonable
      
      // Final memory usage should be proportional to data size
      const finalMemory = memoryReadings[memoryReadings.length - 1].memory;
      const memoryPerPoint = (finalMemory - initialMemoryUsage) / totalPoints;
      
      // Each track point should use reasonable memory (estimated)
      expect(memoryPerPoint).toBeLessThan(1000); // Less than 1KB per point
    });
  });

  describe('Event Listener Memory Leaks', () => {
    it('should properly remove event listeners', async () => {
      const userId = 'test-user';
      const listenerCount = 100;
      
      // Simulate adding many event listeners
      const listeners: Array<() => void> = [];
      
      for (let i = 0; i < listenerCount; i++) {
        const listener = jest.fn();
        listeners.push(listener);
        
        // Simulate adding listener to location service
        mockLocationService.on = jest.fn();
        mockLocationService.off = jest.fn();
      }

      const memoryWithListeners = this.getMemoryUsage();

      // Remove all listeners
      listeners.forEach((listener, index) => {
        // Simulate removing listener
        mockLocationService.off?.('locationUpdate', listener);
      });

      if (global.gc) global.gc();
      
      const memoryAfterRemoval = this.getMemoryUsage();
      
      // Memory should not significantly increase due to listeners
      const listenerMemoryImpact = memoryAfterRemoval - initialMemoryUsage;
      expect(listenerMemoryImpact).toBeLessThan(initialMemoryUsage * 0.1);
    });

    it('should clean up store subscriptions', async () => {
      const subscriptionCount = 50;
      const subscriptions: Array<() => void> = [];

      // Create multiple store subscriptions
      for (let i = 0; i < subscriptionCount; i++) {
        const unsubscribe = useAppStore.subscribe(
          (state) => state.tracking.status,
          (status) => {
            // Simulate subscription callback
            console.log(`Status changed: ${status}`);
          }
        );
        subscriptions.push(unsubscribe);
      }

      const memoryWithSubscriptions = this.getMemoryUsage();

      // Trigger state changes to activate subscriptions
      const userId = 'test-user';
      await useAppStore.getState().startTracking(userId);
      useAppStore.getState().pauseTracking();
      useAppStore.getState().resumeTracking();
      await useAppStore.getState().stopTracking();

      // Unsubscribe all
      subscriptions.forEach(unsubscribe => unsubscribe());

      if (global.gc) global.gc();
      
      const memoryAfterUnsubscribe = this.getMemoryUsage();
      
      // Should not leak memory from subscriptions
      const subscriptionMemoryImpact = memoryAfterUnsubscribe - initialMemoryUsage;
      expect(subscriptionMemoryImpact).toBeLessThan(initialMemoryUsage * 0.05);
    });
  });

  describe('Photo Memory Management', () => {
    it('should not leak memory when capturing many photos', async () => {
      const userId = 'test-user';
      const photoCount = 100;

      await useAppStore.getState().startTracking(userId);
      
      const memoryBeforePhotos = this.getMemoryUsage();

      // Capture many photos
      for (let i = 0; i < photoCount; i++) {
        await mockPhotoService.capturePhoto({
          latitude: 37.7749 + i * 0.001,
          longitude: -122.4194 + i * 0.001,
        });
      }

      const memoryAfterPhotos = this.getMemoryUsage();
      
      // Complete tracking
      await useAppStore.getState().stopTracking();
      
      // Simulate photo cleanup
      mockPhotoService.cleanup = jest.fn().mockResolvedValue();
      await mockPhotoService.cleanup();

      if (global.gc) global.gc();
      
      const memoryAfterCleanup = this.getMemoryUsage();
      
      // Should recover memory after photo cleanup
      const memoryRecovered = memoryAfterPhotos - memoryAfterCleanup;
      const memoryUsedByPhotos = memoryAfterPhotos - memoryBeforePhotos;
      
      expect(memoryRecovered).toBeGreaterThan(memoryUsedByPhotos * 0.7);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle large datasets without memory explosion', async () => {
      const userId = 'test-user';
      const datasetSizes = [1000, 5000, 10000, 25000];
      const memoryUsageBySize: Record<number, number> = {};

      for (const size of datasetSizes) {
        // Reset for each test
        useAppStore.getState().resetTracking();
        if (global.gc) global.gc();
        
        const memoryBefore = this.getMemoryUsage();
        
        await useAppStore.getState().startTracking(userId);
        
        // Add track points
        for (let i = 0; i < size; i++) {
          const trackPoint = createTrackPoint({
            latitude: 37.7749 + i * 0.000001,
            longitude: -122.4194 + i * 0.000001,
            accuracy: 5,
            source: 'gps',
            timestamp: new Date(Date.now() + i * 100),
          });
          useAppStore.getState().addTrackPoint(trackPoint);
        }

        const memoryAfter = this.getMemoryUsage();
        memoryUsageBySize[size] = memoryAfter - memoryBefore;
        
        await useAppStore.getState().stopTracking();
      }

      // Memory usage should scale reasonably with dataset size
      const smallDatasetMemory = memoryUsageBySize[1000];
      const largeDatasetMemory = memoryUsageBySize[25000];
      
      // Should be roughly linear scaling (within 2x of expected)
      const expectedRatio = 25000 / 1000; // 25x
      const actualRatio = largeDatasetMemory / smallDatasetMemory;
      
      expect(actualRatio).toBeLessThan(expectedRatio * 2);
      expect(actualRatio).toBeGreaterThan(expectedRatio * 0.5);
    });

    it('should maintain performance with concurrent operations', async () => {
      const userId = 'test-user';
      const concurrentOperations = 10;
      
      const memoryBefore = this.getMemoryUsage();
      
      // Start multiple concurrent tracking sessions
      const trackingPromises = Array.from({ length: concurrentOperations }, async (_, i) => {
        await useAppStore.getState().startTracking(`${userId}-${i}`);
        
        // Add some track points
        for (let j = 0; j < 100; j++) {
          const trackPoint = createTrackPoint({
            latitude: 37.7749 + i * 0.01 + j * 0.0001,
            longitude: -122.4194 + i * 0.01 + j * 0.0001,
            accuracy: 5,
            source: 'gps',
            timestamp: new Date(Date.now() + j * 1000),
          });
          useAppStore.getState().addTrackPoint(trackPoint);
        }
        
        return useAppStore.getState().stopTracking();
      });

      await Promise.all(trackingPromises);
      
      const memoryAfter = this.getMemoryUsage();
      const memoryIncrease = memoryAfter - memoryBefore;
      
      // Should handle concurrent operations without excessive memory usage
      expect(memoryIncrease).toBeLessThan(initialMemoryUsage * 2);
    });
  });

  // Helper methods
  private getMemoryUsage(): number {
    // Simulate memory usage measurement
    // In a real implementation, this would use process.memoryUsage() or similar
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    
    // Fallback simulation for testing
    return Math.random() * 50000000 + 10000000; // 10-60MB simulated
  }

  private calculateMemoryGrowthRate(readings: Array<{ points: number; memory: number }>): number {
    if (readings.length < 2) return 0;
    
    // Calculate linear regression to determine growth rate
    const n = readings.length;
    const sumX = readings.reduce((sum, r) => sum + r.points, 0);
    const sumY = readings.reduce((sum, r) => sum + r.memory, 0);
    const sumXY = readings.reduce((sum, r) => sum + r.points * r.memory, 0);
    const sumXX = readings.reduce((sum, r) => sum + r.points * r.points, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Normalize slope to get growth rate
    const avgMemory = sumY / n;
    const avgPoints = sumX / n;
    
    return Math.abs(slope * avgPoints / avgMemory);
  }
});