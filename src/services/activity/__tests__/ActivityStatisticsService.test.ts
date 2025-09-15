import { ActivityStatisticsService } from '../ActivityStatisticsService';
import { Activity, TrackPoint } from '../../../types';
import { createActivity, createTrackPoint } from '../../../types/models';

describe('ActivityStatisticsService', () => {
  let service: ActivityStatisticsService;

  beforeEach(() => {
    service = new ActivityStatisticsService();
  });

  describe('calculateDistance', () => {
    it('should calculate distance using Haversine formula', () => {
      // Test with known coordinates (approximately 111km apart)
      const lat1 = 0;
      const lon1 = 0;
      const lat2 = 1;
      const lon2 = 0;

      const distance = service.calculateDistance(lat1, lon1, lat2, lon2);
      
      // 1 degree latitude ≈ 111,195 meters (actual Haversine result)
      expect(distance).toBeCloseTo(111195, -2); // Within 100m tolerance
    });

    it('should return 0 for identical coordinates', () => {
      const distance = service.calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
      expect(distance).toBe(0);
    });

    it('should handle antipodal points correctly', () => {
      // Test with points on opposite sides of Earth
      const distance = service.calculateDistance(0, 0, 0, 180);
      
      // Half the Earth's circumference ≈ 20,015,086 meters
      expect(distance).toBeCloseTo(20015086, -3);
    });
  });

  describe('calculateTotalDistance', () => {
    it('should return 0 for empty or single point arrays', () => {
      expect(service.calculateTotalDistance([])).toBe(0);
      
      const singlePoint = [createTrackPoint({
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 5,
        source: 'gps'
      })];
      expect(service.calculateTotalDistance(singlePoint)).toBe(0);
    });

    it('should calculate cumulative distance for multiple points', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: 5,
          source: 'gps'
        }),
        createTrackPoint({
          latitude: 0.001,
          longitude: 0,
          accuracy: 5,
          source: 'gps'
        }),
        createTrackPoint({
          latitude: 0.002,
          longitude: 0,
          accuracy: 5,
          source: 'gps'
        })
      ];

      const totalDistance = service.calculateTotalDistance(trackPoints);
      
      // Each 0.001 degree ≈ 111.32m, so total ≈ 222.64m
      expect(totalDistance).toBeCloseTo(222.64, 0);
    });
  });

  describe('calculateDuration', () => {
    it('should return stored duration when available', () => {
      const activity = createActivity({
        activityId: 'test-1',
        userId: 'user-1',
        startedAt: new Date('2023-01-01T10:00:00Z'),
      });
      activity.endedAt = new Date('2023-01-01T11:30:00Z');
      activity.durationSec = 5400; // 1.5 hours

      const duration = service.calculateDuration(activity, true);
      expect(duration).toBe(5400);
    });

    it('should calculate duration from timestamps when stored duration unavailable', () => {
      const activity = createActivity({
        activityId: 'test-1',
        userId: 'user-1',
        startedAt: new Date('2023-01-01T10:00:00Z'),
      });
      activity.endedAt = new Date('2023-01-01T11:00:00Z');
      activity.durationSec = 0;

      const duration = service.calculateDuration(activity, false);
      expect(duration).toBe(3600); // 1 hour
    });

    it('should return 0 for incomplete activities', () => {
      const activity = createActivity({
        activityId: 'test-1',
        userId: 'user-1',
        startedAt: new Date('2023-01-01T10:00:00Z'),
      });
      // No endedAt

      const duration = service.calculateDuration(activity, true);
      expect(duration).toBe(0);
    });
  });

  describe('calculateAveragePace', () => {
    it('should calculate pace in seconds per kilometer', () => {
      const distanceM = 5000; // 5km
      const durationSec = 1500; // 25 minutes

      const pace = service.calculateAveragePace(distanceM, durationSec);
      
      // 1500 seconds / 5km = 300 seconds per km (5:00/km)
      expect(pace).toBe(300);
    });

    it('should return 0 for zero distance or duration', () => {
      expect(service.calculateAveragePace(0, 1000)).toBe(0);
      expect(service.calculateAveragePace(1000, 0)).toBe(0);
      expect(service.calculateAveragePace(0, 0)).toBe(0);
    });

    it('should handle very fast paces correctly', () => {
      const distanceM = 1000; // 1km
      const durationSec = 180; // 3 minutes

      const pace = service.calculateAveragePace(distanceM, durationSec);
      expect(pace).toBe(180); // 3:00/km
    });
  });

  describe('calculateKilometerSplits', () => {
    it('should return empty array for insufficient data', () => {
      const trackPoints = [createTrackPoint({
        latitude: 0,
        longitude: 0,
        accuracy: 5,
        source: 'gps'
      })];

      const splits = service.calculateKilometerSplits(trackPoints);
      expect(splits).toEqual([]);
    });

    it('should calculate splits for completed kilometers', () => {
      const baseTime = new Date('2023-01-01T10:00:00Z').getTime();
      const trackPoints: TrackPoint[] = [];

      // Create track points for approximately 2.5km with 5-minute splits
      for (let i = 0; i <= 25; i++) {
        trackPoints.push(createTrackPoint({
          latitude: i * 0.001, // Each 0.001 degree ≈ 111m, so 9 points ≈ 1km
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime + i * 60000) // 1 minute intervals
        }));
      }

      const splits = service.calculateKilometerSplits(trackPoints);
      
      // Should have 2 complete km splits
      expect(splits.length).toBeGreaterThanOrEqual(1);
      expect(splits[0].kmIndex).toBe(1);
      expect(splits[0].durationSec).toBeGreaterThan(0);
      expect(splits[0].paceSecPerKm).toBeGreaterThan(0);
    });

    it('should respect minimum split distance', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date('2023-01-01T10:00:00Z')
        }),
        createTrackPoint({
          latitude: 0.005, // ~500m
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date('2023-01-01T10:05:00Z')
        })
      ];

      const splits = service.calculateKilometerSplits(trackPoints, 950);
      expect(splits).toEqual([]); // Should not create split for <950m
    });
  });

  describe('calculateElevationStatistics', () => {
    it('should return zeros for points without elevation', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: 5,
          source: 'gps'
        }),
        createTrackPoint({
          latitude: 0.001,
          longitude: 0,
          accuracy: 5,
          source: 'gps'
        })
      ];

      const stats = service.calculateElevationStatistics(trackPoints);
      
      expect(stats.elevGainM).toBe(0);
      expect(stats.elevLossM).toBe(0);
      expect(stats.totalAscent).toBe(0);
      expect(stats.totalDescent).toBe(0);
      expect(stats.minElevation).toBeUndefined();
      expect(stats.maxElevation).toBeUndefined();
    });

    it('should calculate elevation changes with threshold', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 100
        }),
        createTrackPoint({
          latitude: 0.001,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 102 // +2m (below 3m threshold)
        }),
        createTrackPoint({
          latitude: 0.002,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 105 // +3m (meets threshold)
        }),
        createTrackPoint({
          latitude: 0.003,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 101 // -4m (meets threshold)
        })
      ];

      const stats = service.calculateElevationStatistics(trackPoints, 3);
      
      expect(stats.elevGainM).toBe(3); // Only the 3m gain counts
      expect(stats.elevLossM).toBe(4); // Only the 4m loss counts
      expect(stats.totalAscent).toBe(5); // 2m + 3m total ascent
      expect(stats.totalDescent).toBe(4); // 4m total descent
      expect(stats.minElevation).toBe(100);
      expect(stats.maxElevation).toBe(105);
    });

    it('should handle mixed elevation data', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 100
        }),
        createTrackPoint({
          latitude: 0.001,
          longitude: 0,
          accuracy: 5,
          source: 'gps'
          // No altitude
        }),
        createTrackPoint({
          latitude: 0.002,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 110
        })
      ];

      const stats = service.calculateElevationStatistics(trackPoints);
      
      // Should only consider points with elevation data
      expect(stats.elevGainM).toBe(10);
      expect(stats.minElevation).toBe(100);
      expect(stats.maxElevation).toBe(110);
    });
  });

  describe('smoothElevationData', () => {
    it('should return original data for small datasets', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 100
        }),
        createTrackPoint({
          latitude: 0.001,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 105
        })
      ];

      const smoothed = service.smoothElevationData(trackPoints, 5);
      expect(smoothed).toEqual(trackPoints);
    });

    it('should smooth elevation using moving average', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 100
        }),
        createTrackPoint({
          latitude: 0.001,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 120 // Spike
        }),
        createTrackPoint({
          latitude: 0.002,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 102
        }),
        createTrackPoint({
          latitude: 0.003,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 103
        }),
        createTrackPoint({
          latitude: 0.004,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 104
        })
      ];

      const smoothed = service.smoothElevationData(trackPoints, 3);
      
      // The spike at index 1 should be smoothed
      expect(smoothed[1].altitude).toBeLessThan(120);
      expect(smoothed[1].altitude).toBeGreaterThan(100);
    });

    it('should preserve points without elevation data', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 100
        }),
        createTrackPoint({
          latitude: 0.001,
          longitude: 0,
          accuracy: 5,
          source: 'gps'
          // No altitude
        }),
        createTrackPoint({
          latitude: 0.002,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 102
        })
      ];

      const smoothed = service.smoothElevationData(trackPoints, 3);
      
      expect(smoothed[1].altitude).toBeUndefined();
      expect(smoothed[0].altitude).toBe(100);
      expect(smoothed[2].altitude).toBe(102);
    });
  });

  describe('calculateMaxSpeed', () => {
    it('should return max speed from track point data', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          speed: 2.5
        }),
        createTrackPoint({
          latitude: 0.001,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          speed: 5.0
        }),
        createTrackPoint({
          latitude: 0.002,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          speed: 3.2
        })
      ];

      const maxSpeed = service.calculateMaxSpeed(trackPoints);
      expect(maxSpeed).toBe(5.0);
    });

    it('should calculate speed from consecutive points when speed data unavailable', () => {
      const baseTime = new Date('2023-01-01T10:00:00Z').getTime();
      const trackPoints = [
        createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime)
        }),
        createTrackPoint({
          latitude: 0.001, // ~111m
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime + 10000) // 10 seconds later
        })
      ];

      const maxSpeed = service.calculateMaxSpeed(trackPoints);
      
      // ~111m in 10s = ~11.1 m/s
      expect(maxSpeed).toBeCloseTo(11.1, 0);
    });

    it('should return 0 for insufficient data', () => {
      const trackPoints = [createTrackPoint({
        latitude: 0,
        longitude: 0,
        accuracy: 5,
        source: 'gps'
      })];

      const maxSpeed = service.calculateMaxSpeed(trackPoints);
      expect(maxSpeed).toBe(0);
    });
  });

  describe('validateTrackPoints', () => {
    it('should validate correct track points', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 5,
          source: 'gps',
          altitude: 10,
          speed: 2.5
        }),
        createTrackPoint({
          latitude: 40.7129,
          longitude: -74.0061,
          accuracy: 8,
          source: 'gps',
          altitude: 12,
          speed: 3.0,
          timestamp: new Date(Date.now() + 1000)
        })
      ];

      const validation = service.validateTrackPoints(trackPoints);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect invalid coordinates', () => {
      // Create track points with invalid coordinates directly (bypassing validation)
      const trackPoints: TrackPoint[] = [
        {
          latitude: 91, // Invalid latitude
          longitude: -74.0060,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date()
        },
        {
          latitude: 40.7128,
          longitude: 181, // Invalid longitude
          accuracy: 5,
          source: 'gps',
          timestamp: new Date()
        }
      ];

      const validation = service.validateTrackPoints(trackPoints);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBe(2);
      expect(validation.errors[0]).toContain('Invalid coordinates');
      expect(validation.errors[1]).toContain('Invalid coordinates');
    });

    it('should warn about poor GPS accuracy', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 150, // Poor accuracy
          source: 'gps'
        }),
        createTrackPoint({
          latitude: 40.7129,
          longitude: -74.0061,
          accuracy: 5,
          source: 'gps'
        })
      ];

      const validation = service.validateTrackPoints(trackPoints);
      
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('Poor GPS accuracy');
    });

    it('should warn about suspicious speeds', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 5,
          source: 'gps',
          speed: 60 // 60 m/s = 216 km/h (suspicious)
        }),
        createTrackPoint({
          latitude: 40.7129,
          longitude: -74.0061,
          accuracy: 5,
          source: 'gps',
          speed: 3.0
        })
      ];

      const validation = service.validateTrackPoints(trackPoints);
      
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.some(w => w.includes('suspicious speed'))).toBe(true);
    });

    it('should require minimum number of points', () => {
      const trackPoints = [createTrackPoint({
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 5,
        source: 'gps'
      })];

      const validation = service.validateTrackPoints(trackPoints);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('At least 2 track points required');
    });
  });

  describe('calculateActivityStatistics', () => {
    it('should calculate comprehensive statistics for a complete activity', () => {
      const baseTime = new Date('2023-01-01T10:00:00Z');
      const activity = createActivity({
        activityId: 'test-1',
        userId: 'user-1',
        startedAt: baseTime,
      });
      activity.endedAt = new Date(baseTime.getTime() + 3600000); // 1 hour later
      activity.durationSec = 3600;

      const trackPoints: TrackPoint[] = [];
      
      // Create a 5km route with elevation changes
      for (let i = 0; i <= 50; i++) {
        trackPoints.push(createTrackPoint({
          latitude: i * 0.001, // ~5.5km total
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 100 + Math.sin(i * 0.2) * 20, // Elevation varies ±20m
          speed: 2.5, // 2.5 m/s
          timestamp: new Date(baseTime.getTime() + i * 60000) // 1 minute intervals
        }));
      }

      const stats = service.calculateActivityStatistics(trackPoints, activity);
      
      expect(stats.durationSec).toBe(3600);
      expect(stats.distanceM).toBeGreaterThan(5000);
      expect(stats.avgPaceSecPerKm).toBeGreaterThan(0);
      expect(stats.maxSpeed).toBeGreaterThanOrEqual(2.5);
      expect(stats.splitKm.length).toBeGreaterThanOrEqual(4); // Should have 4-5 km splits
      expect(stats.elevGainM).toBeGreaterThanOrEqual(0);
      expect(stats.elevLossM).toBeGreaterThanOrEqual(0);
      expect(stats.minElevation).toBeDefined();
      expect(stats.maxElevation).toBeDefined();
    });

    it('should handle empty track points gracefully', () => {
      const activity = createActivity({
        activityId: 'test-1',
        userId: 'user-1',
      });

      const stats = service.calculateActivityStatistics([], activity);
      
      expect(stats.durationSec).toBe(0);
      expect(stats.distanceM).toBe(0);
      expect(stats.avgPaceSecPerKm).toBe(0);
      expect(stats.elevGainM).toBe(0);
      expect(stats.elevLossM).toBe(0);
      expect(stats.splitKm).toEqual([]);
      expect(stats.maxSpeed).toBe(0);
    });

    it('should respect custom calculation options', () => {
      const baseTime = new Date('2023-01-01T10:00:00Z');
      const activity = createActivity({
        activityId: 'test-1',
        userId: 'user-1',
        startedAt: baseTime,
      });
      activity.endedAt = new Date(baseTime.getTime() + 1800000); // 30 minutes
      activity.durationSec = 1800;

      const trackPoints = [
        createTrackPoint({
          latitude: 0,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 100
        }),
        createTrackPoint({
          latitude: 0.001,
          longitude: 0,
          accuracy: 5,
          source: 'gps',
          altitude: 102 // +2m change
        })
      ];

      // Use custom threshold that should exclude the 2m elevation change
      const stats = service.calculateActivityStatistics(trackPoints, activity, {
        elevationThreshold: 5,
        smoothingWindow: 1
      });
      
      expect(stats.elevGainM).toBe(0); // Should be 0 with 5m threshold
      expect(stats.totalAscent).toBe(2); // But total ascent should still be 2m
    });
  });
});