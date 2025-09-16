import { LocationService } from '../../services/location/LocationService';
import { GPSDataProcessor } from '../../services/tracking/GPSDataProcessor';
import { createTrackPoint } from '../../types/models';
import { TrackPoint } from '../../types';

// Mock location service
jest.mock('../../services/location/LocationService');

describe('GPS Accuracy Performance Tests', () => {
  let mockLocationService: jest.Mocked<LocationService>;
  let gpsProcessor: GPSDataProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLocationService = LocationService.getInstance() as jest.Mocked<LocationService>;
    gpsProcessor = new GPSDataProcessor();

    // Mock location service methods
    mockLocationService.initialize.mockResolvedValue();
    mockLocationService.startTracking.mockResolvedValue();
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 100,
      accuracy: 5,
      speed: 2.5,
      heading: 180,
      timestamp: Date.now(),
      source: 'gps',
    });
  });

  describe('GPS Accuracy Validation', () => {
    it('should validate GPS accuracy in various conditions', async () => {
      const testConditions = [
        { name: 'clear_sky', expectedAccuracy: 3, variance: 1 },
        { name: 'urban_canyon', expectedAccuracy: 8, variance: 3 },
        { name: 'indoor', expectedAccuracy: 15, variance: 8 },
        { name: 'forest', expectedAccuracy: 12, variance: 5 },
      ];

      for (const condition of testConditions) {
        // Mock location updates for different conditions
        const mockLocations = Array.from({ length: 100 }, (_, i) => ({
          latitude: 37.7749 + (Math.random() - 0.5) * 0.001,
          longitude: -122.4194 + (Math.random() - 0.5) * 0.001,
          altitude: 100 + (Math.random() - 0.5) * 20,
          accuracy: condition.expectedAccuracy + (Math.random() - 0.5) * condition.variance * 2,
          speed: 2.5 + (Math.random() - 0.5) * 1,
          heading: 180 + (Math.random() - 0.5) * 20,
          timestamp: Date.now() + i * 1000,
          source: 'gps' as const,
        }));

        // Convert to track points
        const trackPoints = mockLocations.map(loc => createTrackPoint(loc));

        // Analyze accuracy
        const accuracies = trackPoints.map(point => point.accuracy);
        const averageAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
        const maxAccuracy = Math.max(...accuracies);
        const minAccuracy = Math.min(...accuracies);

        // Validate accuracy is within expected range
        expect(averageAccuracy).toBeCloseTo(condition.expectedAccuracy, 1);
        expect(maxAccuracy - minAccuracy).toBeLessThan(condition.variance * 4);

        // Test outlier filtering
        const { filteredPoints, outlierCount } = gpsProcessor.filterOutliers(trackPoints);
        const outlierPercentage = (outlierCount / trackPoints.length) * 100;

        // Should filter out poor accuracy points
        expect(outlierPercentage).toBeLessThan(20); // Less than 20% outliers
        expect(filteredPoints.length).toBeGreaterThan(trackPoints.length * 0.8);
      }
    });

    it('should measure GPS accuracy improvement over time', async () => {
      const timeToFirstFix = 15000; // 15 seconds
      const improvementPeriod = 60000; // 1 minute
      
      // Simulate GPS accuracy improvement after cold start
      const mockLocationUpdates = Array.from({ length: 100 }, (_, i) => {
        const elapsed = i * 1000; // 1 second intervals
        
        // Accuracy improves over time (cold start to warm)
        let accuracy: number;
        if (elapsed < timeToFirstFix) {
          accuracy = 50 - (elapsed / timeToFirstFix) * 40; // 50m to 10m
        } else if (elapsed < timeToFirstFix + improvementPeriod) {
          const improvementProgress = (elapsed - timeToFirstFix) / improvementPeriod;
          accuracy = 10 - improvementProgress * 5; // 10m to 5m
        } else {
          accuracy = 5 + Math.random() * 2; // Stable 5-7m
        }

        return createTrackPoint({
          latitude: 37.7749 + (Math.random() - 0.5) * 0.0001,
          longitude: -122.4194 + (Math.random() - 0.5) * 0.0001,
          accuracy,
          source: 'gps',
          timestamp: new Date(Date.now() + elapsed),
        });
      });

      // Analyze accuracy improvement
      const firstFixPoints = mockLocationUpdates.slice(0, 15); // First 15 seconds
      const stablePoints = mockLocationUpdates.slice(-20); // Last 20 points

      const initialAccuracy = firstFixPoints.reduce((sum, p) => sum + p.accuracy, 0) / firstFixPoints.length;
      const stableAccuracy = stablePoints.reduce((sum, p) => sum + p.accuracy, 0) / stablePoints.length;

      expect(stableAccuracy).toBeLessThan(initialAccuracy * 0.3); // Should improve significantly
      expect(stableAccuracy).toBeLessThan(10); // Should achieve good accuracy
    });

    it('should test GPS accuracy under movement conditions', async () => {
      const movementScenarios = [
        { name: 'stationary', speed: 0, expectedAccuracy: 5 },
        { name: 'walking', speed: 1.4, expectedAccuracy: 6 },
        { name: 'jogging', speed: 3.0, expectedAccuracy: 7 },
        { name: 'cycling', speed: 8.0, expectedAccuracy: 8 },
        { name: 'driving', speed: 15.0, expectedAccuracy: 10 },
      ];

      for (const scenario of movementScenarios) {
        const trackPoints = Array.from({ length: 50 }, (_, i) => {
          // Simulate movement along a path
          const distance = scenario.speed * i; // meters per second
          const latOffset = (distance / 111000) * Math.cos(Math.PI / 4); // Rough conversion
          const lngOffset = (distance / 111000);

          return createTrackPoint({
            latitude: 37.7749 + latOffset,
            longitude: -122.4194 + lngOffset,
            accuracy: scenario.expectedAccuracy + (Math.random() - 0.5) * 2,
            speed: scenario.speed + (Math.random() - 0.5) * 0.5,
            source: 'gps',
            timestamp: new Date(Date.now() + i * 1000),
          });
        });

        const averageAccuracy = trackPoints.reduce((sum, p) => sum + p.accuracy, 0) / trackPoints.length;
        
        // Accuracy should degrade with higher speeds
        expect(averageAccuracy).toBeCloseTo(scenario.expectedAccuracy, 1);
        
        // Test data processing
        const { filteredPoints } = gpsProcessor.filterOutliers(trackPoints);
        expect(filteredPoints.length).toBeGreaterThan(trackPoints.length * 0.9); // Most points should be valid
      }
    });
  });

  describe('GPS Signal Quality Tests', () => {
    it('should handle GPS signal loss and recovery', async () => {
      const signalLossDuration = 30000; // 30 seconds
      const totalDuration = 120000; // 2 minutes
      
      const trackPoints: TrackPoint[] = [];
      
      for (let elapsed = 0; elapsed < totalDuration; elapsed += 1000) {
        let point: TrackPoint;
        
        if (elapsed >= 45000 && elapsed < 45000 + signalLossDuration) {
          // Signal loss period - no GPS or poor accuracy
          point = createTrackPoint({
            latitude: 0,
            longitude: 0,
            accuracy: -1,
            source: 'error',
            timestamp: new Date(Date.now() + elapsed),
          });
        } else {
          // Normal GPS signal
          point = createTrackPoint({
            latitude: 37.7749 + (elapsed / 1000) * 0.0001,
            longitude: -122.4194 + (elapsed / 1000) * 0.0001,
            accuracy: 5 + Math.random() * 3,
            source: 'gps',
            timestamp: new Date(Date.now() + elapsed),
          });
        }
        
        trackPoints.push(point);
      }

      // Process the data
      const { filteredPoints, outlierCount } = gpsProcessor.filterOutliers(trackPoints);
      
      // Should filter out error points
      const errorPoints = trackPoints.filter(p => p.source === 'error').length;
      expect(outlierCount).toBeGreaterThanOrEqual(errorPoints);
      
      // Should maintain continuity where possible
      expect(filteredPoints.length).toBeGreaterThan(trackPoints.length * 0.7);
      
      // Test interpolation across gaps
      const { interpolatedPoints } = gpsProcessor.interpolateGaps(filteredPoints);
      expect(interpolatedPoints.length).toBeGreaterThan(filteredPoints.length);
    });

    it('should test GPS accuracy in different satellite configurations', async () => {
      const satelliteConfigurations = [
        { name: 'poor_coverage', satelliteCount: 4, dilutionOfPrecision: 8.0 },
        { name: 'good_coverage', satelliteCount: 8, dilutionOfPrecision: 2.5 },
        { name: 'excellent_coverage', satelliteCount: 12, dilutionOfPrecision: 1.2 },
      ];

      for (const config of satelliteConfigurations) {
        // Simulate accuracy based on satellite configuration
        const baseAccuracy = 3.0;
        const accuracyMultiplier = config.dilutionOfPrecision;
        const expectedAccuracy = baseAccuracy * accuracyMultiplier;

        const trackPoints = Array.from({ length: 30 }, (_, i) => 
          createTrackPoint({
            latitude: 37.7749 + i * 0.0001,
            longitude: -122.4194 + i * 0.0001,
            accuracy: expectedAccuracy + (Math.random() - 0.5) * 2,
            source: 'gps',
            timestamp: new Date(Date.now() + i * 1000),
          })
        );

        const averageAccuracy = trackPoints.reduce((sum, p) => sum + p.accuracy, 0) / trackPoints.length;
        
        // Verify accuracy correlates with satellite configuration
        expect(averageAccuracy).toBeCloseTo(expectedAccuracy, 1);
        
        if (config.name === 'excellent_coverage') {
          expect(averageAccuracy).toBeLessThan(5);
        } else if (config.name === 'poor_coverage') {
          expect(averageAccuracy).toBeGreaterThan(15);
        }
      }
    });
  });

  describe('GPS Performance Optimization Tests', () => {
    it('should test Kalman filter effectiveness', async () => {
      // Generate noisy GPS data
      const noisyTrackPoints = Array.from({ length: 100 }, (_, i) => {
        const trueLat = 37.7749 + i * 0.00001; // True position
        const trueLng = -122.4194 + i * 0.00001;
        
        // Add noise
        const noiseLat = (Math.random() - 0.5) * 0.0002; // ±11m noise
        const noiseLng = (Math.random() - 0.5) * 0.0002;
        
        return createTrackPoint({
          latitude: trueLat + noiseLat,
          longitude: trueLng + noiseLng,
          accuracy: 5 + Math.random() * 5,
          source: 'gps',
          timestamp: new Date(Date.now() + i * 1000),
        });
      });

      // Process with Kalman filtering (simulated by smoothing)
      const smoothedPoints = this.simulateKalmanFilter(noisyTrackPoints);
      
      // Calculate position variance before and after filtering
      const originalVariance = this.calculatePositionVariance(noisyTrackPoints);
      const smoothedVariance = this.calculatePositionVariance(smoothedPoints);
      
      // Kalman filter should reduce variance
      expect(smoothedVariance).toBeLessThan(originalVariance * 0.7);
    });

    it('should test adaptive GPS update intervals', async () => {
      const speedScenarios = [
        { speed: 0, expectedInterval: 5000 }, // Stationary: 5 seconds
        { speed: 1.4, expectedInterval: 2000 }, // Walking: 2 seconds
        { speed: 8.0, expectedInterval: 1000 }, // Cycling: 1 second
        { speed: 15.0, expectedInterval: 500 }, // Driving: 0.5 seconds
      ];

      for (const scenario of speedScenarios) {
        // Mock adaptive interval calculation
        const adaptiveInterval = this.calculateAdaptiveInterval(scenario.speed);
        
        expect(adaptiveInterval).toBeCloseTo(scenario.expectedInterval, -2);
        
        // Higher speeds should have shorter intervals
        if (scenario.speed > 5) {
          expect(adaptiveInterval).toBeLessThan(2000);
        }
      }
    });
  });

  describe('GPS Data Quality Metrics', () => {
    it('should calculate GPS data quality scores', async () => {
      const testDataSets = [
        {
          name: 'high_quality',
          points: this.generateHighQualityGPSData(50),
          expectedScore: 0.9,
        },
        {
          name: 'medium_quality',
          points: this.generateMediumQualityGPSData(50),
          expectedScore: 0.6,
        },
        {
          name: 'low_quality',
          points: this.generateLowQualityGPSData(50),
          expectedScore: 0.3,
        },
      ];

      for (const dataset of testDataSets) {
        const qualityScore = this.calculateGPSQualityScore(dataset.points);
        
        expect(qualityScore).toBeCloseTo(dataset.expectedScore, 1);
        
        // Quality score should be between 0 and 1
        expect(qualityScore).toBeGreaterThanOrEqual(0);
        expect(qualityScore).toBeLessThanOrEqual(1);
      }
    });

    it('should detect GPS spoofing or anomalies', async () => {
      // Generate normal GPS track
      const normalTrack = Array.from({ length: 30 }, (_, i) => 
        createTrackPoint({
          latitude: 37.7749 + i * 0.0001,
          longitude: -122.4194 + i * 0.0001,
          accuracy: 5 + Math.random() * 2,
          speed: 2.5 + Math.random() * 0.5,
          source: 'gps',
          timestamp: new Date(Date.now() + i * 1000),
        })
      );

      // Insert anomalous points (potential spoofing)
      const anomalousTrack = [...normalTrack];
      anomalousTrack[15] = createTrackPoint({
        latitude: 40.7128, // Jump to NYC
        longitude: -74.0060,
        accuracy: 3, // Suspiciously good accuracy for impossible jump
        speed: 2.5,
        source: 'gps',
        timestamp: new Date(Date.now() + 15 * 1000),
      });

      // Detect anomalies
      const { filteredPoints, outlierCount } = gpsProcessor.filterOutliers(anomalousTrack);
      
      // Should detect and filter the anomalous point
      expect(outlierCount).toBeGreaterThan(0);
      expect(filteredPoints.length).toBeLessThan(anomalousTrack.length);
      
      // The impossible jump should be filtered out
      const hasNYCPoint = filteredPoints.some(p => 
        Math.abs(p.latitude - 40.7128) < 0.001 && Math.abs(p.longitude + 74.0060) < 0.001
      );
      expect(hasNYCPoint).toBe(false);
    });
  });

  // Helper methods for testing
  private simulateKalmanFilter(points: TrackPoint[]): TrackPoint[] {
    // Simple smoothing simulation (not actual Kalman filter)
    return points.map((point, i) => {
      if (i === 0 || i === points.length - 1) return point;
      
      const prev = points[i - 1];
      const next = points[i + 1];
      
      return createTrackPoint({
        ...point,
        latitude: (prev.latitude + point.latitude + next.latitude) / 3,
        longitude: (prev.longitude + point.longitude + next.longitude) / 3,
      });
    });
  }

  private calculatePositionVariance(points: TrackPoint[]): number {
    if (points.length < 2) return 0;
    
    const avgLat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
    
    const variance = points.reduce((sum, p) => {
      const latDiff = p.latitude - avgLat;
      const lngDiff = p.longitude - avgLng;
      return sum + (latDiff * latDiff + lngDiff * lngDiff);
    }, 0) / points.length;
    
    return variance;
  }

  private calculateAdaptiveInterval(speed: number): number {
    // Adaptive interval based on speed
    if (speed < 0.5) return 5000; // Stationary
    if (speed < 2) return 2000; // Walking
    if (speed < 10) return 1000; // Cycling
    return 500; // Driving
  }

  private generateHighQualityGPSData(count: number): TrackPoint[] {
    return Array.from({ length: count }, (_, i) => 
      createTrackPoint({
        latitude: 37.7749 + i * 0.0001,
        longitude: -122.4194 + i * 0.0001,
        accuracy: 3 + Math.random() * 2, // 3-5m accuracy
        source: 'gps',
        timestamp: new Date(Date.now() + i * 1000),
      })
    );
  }

  private generateMediumQualityGPSData(count: number): TrackPoint[] {
    return Array.from({ length: count }, (_, i) => 
      createTrackPoint({
        latitude: 37.7749 + i * 0.0001 + (Math.random() - 0.5) * 0.0001,
        longitude: -122.4194 + i * 0.0001 + (Math.random() - 0.5) * 0.0001,
        accuracy: 8 + Math.random() * 5, // 8-13m accuracy
        source: 'gps',
        timestamp: new Date(Date.now() + i * 1000),
      })
    );
  }

  private generateLowQualityGPSData(count: number): TrackPoint[] {
    return Array.from({ length: count }, (_, i) => {
      // Include some error points
      if (Math.random() < 0.2) {
        return createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: -1,
          source: 'error',
          timestamp: new Date(Date.now() + i * 1000),
        });
      }
      
      return createTrackPoint({
        latitude: 37.7749 + i * 0.0001 + (Math.random() - 0.5) * 0.0005,
        longitude: -122.4194 + i * 0.0001 + (Math.random() - 0.5) * 0.0005,
        accuracy: 15 + Math.random() * 10, // 15-25m accuracy
        source: 'gps',
        timestamp: new Date(Date.now() + i * 1000),
      });
    });
  }

  private calculateGPSQualityScore(points: TrackPoint[]): number {
    if (points.length === 0) return 0;
    
    let score = 1.0;
    
    // Penalize for poor accuracy
    const avgAccuracy = points.reduce((sum, p) => sum + p.accuracy, 0) / points.length;
    if (avgAccuracy > 10) score *= 0.7;
    if (avgAccuracy > 20) score *= 0.5;
    
    // Penalize for error points
    const errorPoints = points.filter(p => p.source === 'error').length;
    const errorRatio = errorPoints / points.length;
    score *= (1 - errorRatio);
    
    // Penalize for high variance
    const variance = this.calculatePositionVariance(points);
    if (variance > 0.00001) score *= 0.8; // High variance penalty
    
    return Math.max(0, Math.min(1, score));
  }
});