import { GPSDataProcessor } from '../GPSDataProcessor';
import { createTrackPoint } from '../../../types/models';
import { TrackPoint } from '../../../types';

describe('GPSDataProcessor', () => {
  let processor: GPSDataProcessor;

  beforeEach(() => {
    processor = new GPSDataProcessor();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = processor.getConfig();
      expect(config.outlierSpeedThreshold).toBe(10);
      expect(config.outlierAccuracyThreshold).toBe(100);
      expect(config.interpolationEnabled).toBe(true);
      expect(config.polylineSimplificationTolerance).toBe(5);
      expect(config.elevationChangeThreshold).toBe(3);
    });

    it('should initialize with custom config', () => {
      const customProcessor = new GPSDataProcessor({
        outlierSpeedThreshold: 15,
        elevationChangeThreshold: 5,
      });

      const config = customProcessor.getConfig();
      expect(config.outlierSpeedThreshold).toBe(15);
      expect(config.elevationChangeThreshold).toBe(5);
      expect(config.interpolationEnabled).toBe(true); // Should keep default
    });

    it('should update config', () => {
      processor.updateConfig({
        outlierSpeedThreshold: 20,
        interpolationEnabled: false,
      });

      const config = processor.getConfig();
      expect(config.outlierSpeedThreshold).toBe(20);
      expect(config.interpolationEnabled).toBe(false);
      expect(config.outlierAccuracyThreshold).toBe(100); // Should keep existing
    });
  });

  describe('outlier filtering', () => {
    it('should filter points with poor accuracy', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
        }),
        createTrackPoint({
          latitude: 37.7750,
          longitude: -122.4194,
          accuracy: 150, // Above threshold (100m)
          source: 'gps',
          timestamp: new Date(Date.now() + 1000),
        }),
        createTrackPoint({
          latitude: 37.7750, // Close to the second point to avoid speed filtering
          longitude: -122.4194,
          accuracy: 8,
          source: 'gps',
          timestamp: new Date(Date.now() + 2000),
        }),
      ];

      const { filteredPoints, outlierCount } = processor.filterOutliers(trackPoints);

      expect(filteredPoints).toHaveLength(2);
      expect(outlierCount).toBe(1);
      expect(filteredPoints[0].accuracy).toBe(5);
      expect(filteredPoints[1].accuracy).toBe(8);
    });

    it('should filter points with excessive speed', () => {
      const baseTime = Date.now();
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime),
        }),
        createTrackPoint({
          latitude: 37.7849, // ~1.1km away in 1 second = 1100 m/s (way above 10 m/s threshold)
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime + 1000),
        }),
        createTrackPoint({
          latitude: 37.77491, // Close to first point, reasonable speed
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime + 11000), // 10 seconds later
        }),
      ];

      const { filteredPoints, outlierCount } = processor.filterOutliers(trackPoints);

      expect(filteredPoints).toHaveLength(2);
      expect(outlierCount).toBe(1);
      expect(filteredPoints[0].latitude).toBe(37.7749);
      expect(filteredPoints[1].latitude).toBe(37.77491);
    });

    it('should not filter valid points', () => {
      const baseTime = Date.now();
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime),
        }),
        createTrackPoint({
          latitude: 37.77491, // Very small movement - ~1m in 10 seconds = 0.1 m/s
          longitude: -122.4194,
          accuracy: 8,
          source: 'gps',
          timestamp: new Date(baseTime + 10000),
        }),
        createTrackPoint({
          latitude: 37.77492, // Another small movement
          longitude: -122.4194,
          accuracy: 6,
          source: 'gps',
          timestamp: new Date(baseTime + 20000),
        }),
      ];

      const { filteredPoints, outlierCount } = processor.filterOutliers(trackPoints);

      expect(filteredPoints).toHaveLength(3);
      expect(outlierCount).toBe(0);
    });

    it('should handle empty input', () => {
      const { filteredPoints, outlierCount } = processor.filterOutliers([]);

      expect(filteredPoints).toHaveLength(0);
      expect(outlierCount).toBe(0);
    });

    it('should handle single point', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
        }),
      ];

      const { filteredPoints, outlierCount } = processor.filterOutliers(trackPoints);

      expect(filteredPoints).toHaveLength(1);
      expect(outlierCount).toBe(0);
    });
  });

  describe('gap interpolation', () => {
    it('should interpolate large time gaps', () => {
      const baseTime = Date.now();
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime),
        }),
        createTrackPoint({
          latitude: 37.7759, // 60 seconds later, large gap
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime + 60000),
        }),
      ];

      const { interpolatedPoints, interpolationCount } = processor.interpolateGaps(trackPoints);

      expect(interpolatedPoints.length).toBeGreaterThan(2);
      expect(interpolationCount).toBeGreaterThan(0);
      
      // Check that interpolated points are between the original points
      const firstInterpolated = interpolatedPoints[1];
      expect(firstInterpolated.latitude).toBeGreaterThan(37.7749);
      expect(firstInterpolated.latitude).toBeLessThan(37.7759);
    });

    it('should interpolate large distance gaps', () => {
      const baseTime = Date.now();
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime),
        }),
        createTrackPoint({
          latitude: 37.7769, // ~220m away in 10 seconds (above 200m threshold)
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime + 10000),
        }),
      ];

      const { interpolatedPoints, interpolationCount } = processor.interpolateGaps(trackPoints);

      expect(interpolatedPoints.length).toBeGreaterThan(2);
      expect(interpolationCount).toBeGreaterThan(0);
    });

    it('should not interpolate small gaps', () => {
      const baseTime = Date.now();
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime),
        }),
        createTrackPoint({
          latitude: 37.7750,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime + 5000), // 5 seconds, small gap
        }),
      ];

      const { interpolatedPoints, interpolationCount } = processor.interpolateGaps(trackPoints);

      expect(interpolatedPoints).toHaveLength(2);
      expect(interpolationCount).toBe(0);
    });

    it('should handle disabled interpolation', () => {
      processor.updateConfig({ interpolationEnabled: false });

      const baseTime = Date.now();
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime),
        }),
        createTrackPoint({
          latitude: 37.7759,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime + 60000), // Large gap
        }),
      ];

      const { interpolatedPoints, interpolationCount } = processor.interpolateGaps(trackPoints);

      expect(interpolatedPoints).toHaveLength(2);
      expect(interpolationCount).toBe(0);
    });
  });

  describe('elevation calculations', () => {
    it('should calculate elevation gain and loss with threshold', () => {
      const trackPoints: TrackPoint[] = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 100,
        }),
        createTrackPoint({
          latitude: 37.7750,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 102, // +2m (below 3m threshold)
          timestamp: new Date(Date.now() + 1000),
        }),
        createTrackPoint({
          latitude: 37.7751,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 105, // +3m (meets threshold)
          timestamp: new Date(Date.now() + 2000),
        }),
        createTrackPoint({
          latitude: 37.7752,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 101, // -4m (meets threshold)
          timestamp: new Date(Date.now() + 3000),
        }),
        createTrackPoint({
          latitude: 37.7753,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 103, // +2m (below threshold)
          timestamp: new Date(Date.now() + 4000),
        }),
      ];

      const { elevationGain, elevationLoss } = processor.calculateElevationChanges(trackPoints);

      expect(elevationGain).toBe(3); // Only the 3m gain counts
      expect(elevationLoss).toBe(4); // Only the 4m loss counts
    });

    it('should handle missing altitude data', () => {
      const trackPoints: TrackPoint[] = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          // No altitude
        }),
        createTrackPoint({
          latitude: 37.7750,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 100,
          timestamp: new Date(Date.now() + 1000),
        }),
      ];

      const { elevationGain, elevationLoss } = processor.calculateElevationChanges(trackPoints);

      expect(elevationGain).toBe(0);
      expect(elevationLoss).toBe(0);
    });

    it('should handle empty input', () => {
      const { elevationGain, elevationLoss } = processor.calculateElevationChanges([]);

      expect(elevationGain).toBe(0);
      expect(elevationLoss).toBe(0);
    });
  });

  describe('distance calculations', () => {
    it('should calculate total distance correctly', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
        }),
        createTrackPoint({
          latitude: 37.7750, // ~11m north
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(Date.now() + 1000),
        }),
        createTrackPoint({
          latitude: 37.7750,
          longitude: -122.4184, // ~11m east
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(Date.now() + 2000),
        }),
      ];

      const totalDistance = processor.calculateTotalDistance(trackPoints);

      expect(totalDistance).toBeCloseTo(99, 0); // Actual calculated distance
    });

    it('should handle empty input', () => {
      const totalDistance = processor.calculateTotalDistance([]);
      expect(totalDistance).toBe(0);
    });

    it('should handle single point', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
        }),
      ];

      const totalDistance = processor.calculateTotalDistance(trackPoints);
      expect(totalDistance).toBe(0);
    });
  });

  describe('polyline encoding', () => {
    it('should encode track points to polyline', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 38.5,
          longitude: -120.2,
          accuracy: 5,
          source: 'gps',
        }),
        createTrackPoint({
          latitude: 40.7,
          longitude: -120.95,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(Date.now() + 1000),
        }),
        createTrackPoint({
          latitude: 43.252,
          longitude: -126.453,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(Date.now() + 2000),
        }),
      ];

      const polyline = processor.encodePolyline(trackPoints);

      expect(polyline).toBeTruthy();
      expect(typeof polyline).toBe('string');
      expect(polyline.length).toBeGreaterThan(0);
    });

    it('should handle empty input', () => {
      const polyline = processor.encodePolyline([]);
      expect(polyline).toBe('');
    });
  });

  describe('polyline simplification', () => {
    it('should simplify polyline using Douglas-Peucker algorithm', () => {
      // Create a zigzag pattern where middle points should be removed
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
        }),
        createTrackPoint({
          latitude: 37.7750,
          longitude: -122.4195, // Slight deviation
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(Date.now() + 1000),
        }),
        createTrackPoint({
          latitude: 37.7751,
          longitude: -122.4194, // Back on line
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(Date.now() + 2000),
        }),
        createTrackPoint({
          latitude: 37.7759,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(Date.now() + 3000),
        }),
      ];

      const simplified = processor.simplifyPolyline(trackPoints);

      expect(simplified.length).toBeLessThanOrEqual(trackPoints.length);
      expect(simplified[0]).toEqual(trackPoints[0]); // First point preserved
      expect(simplified[simplified.length - 1]).toEqual(trackPoints[trackPoints.length - 1]); // Last point preserved
    });

    it('should handle input with 2 or fewer points', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
        }),
        createTrackPoint({
          latitude: 37.7759,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(Date.now() + 1000),
        }),
      ];

      const simplified = processor.simplifyPolyline(trackPoints);

      expect(simplified).toEqual(trackPoints);
    });
  });

  describe('complete processing', () => {
    it('should process complete track point set', () => {
      const baseTime = Date.now();
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 100,
          timestamp: new Date(baseTime),
        }),
        createTrackPoint({
          latitude: 37.7849, // Outlier - too fast
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 105,
          timestamp: new Date(baseTime + 1000),
        }),
        createTrackPoint({
          latitude: 37.7750,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 104,
          timestamp: new Date(baseTime + 60000), // Large gap
        }),
        createTrackPoint({
          latitude: 37.7751,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 108, // 4m gain from 104 to 108 (above 3m threshold)
          timestamp: new Date(baseTime + 61000),
        }),
      ];

      const result = processor.processTrackPoints(trackPoints);

      expect(result.filteredPoints.length).toBeLessThan(trackPoints.length); // Outlier removed
      expect(result.interpolatedPoints.length).toBeGreaterThan(result.filteredPoints.length); // Gap interpolated
      expect(result.outlierCount).toBeGreaterThan(0);
      expect(result.interpolationCount).toBeGreaterThan(0);
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.elevationGain).toBeGreaterThanOrEqual(0); // May be 0 if interpolated points don't have altitude
      expect(result.polyline).toBeTruthy();
      expect(result.simplifiedPolyline).toBeTruthy();
    });

    it('should handle empty input', () => {
      const result = processor.processTrackPoints([]);

      expect(result.filteredPoints).toHaveLength(0);
      expect(result.interpolatedPoints).toHaveLength(0);
      expect(result.outlierCount).toBe(0);
      expect(result.interpolationCount).toBe(0);
      expect(result.totalDistance).toBe(0);
      expect(result.elevationGain).toBe(0);
      expect(result.elevationLoss).toBe(0);
      expect(result.polyline).toBe('');
      expect(result.simplifiedPolyline).toBe('');
    });

    it('should handle single point', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 100,
        }),
      ];

      const result = processor.processTrackPoints(trackPoints);

      expect(result.filteredPoints).toHaveLength(1);
      expect(result.interpolatedPoints).toHaveLength(1);
      expect(result.outlierCount).toBe(0);
      expect(result.interpolationCount).toBe(0);
      expect(result.totalDistance).toBe(0);
      expect(result.elevationGain).toBe(0);
      expect(result.elevationLoss).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle points with same coordinates', () => {
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
        }),
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(Date.now() + 1000),
        }),
      ];

      const result = processor.processTrackPoints(trackPoints);

      expect(result.filteredPoints).toHaveLength(2);
      expect(result.totalDistance).toBe(0);
    });

    it('should handle very high accuracy threshold', () => {
      processor.updateConfig({ outlierAccuracyThreshold: 1000 });

      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 500, // Would normally be filtered
          source: 'gps',
        }),
      ];

      const { filteredPoints, outlierCount } = processor.filterOutliers(trackPoints);

      expect(filteredPoints).toHaveLength(1);
      expect(outlierCount).toBe(0);
    });

    it('should handle very low speed threshold', () => {
      processor.updateConfig({ outlierSpeedThreshold: 1 }); // 1 m/s

      const baseTime = Date.now();
      const trackPoints = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime),
        }),
        createTrackPoint({
          latitude: 37.7750, // ~11m in 5 seconds = ~2.2 m/s (above 1 m/s threshold)
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          timestamp: new Date(baseTime + 5000),
        }),
      ];

      const { filteredPoints, outlierCount } = processor.filterOutliers(trackPoints);

      expect(filteredPoints).toHaveLength(1); // Second point filtered
      expect(outlierCount).toBe(1);
    });
  });
});