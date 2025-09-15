import {
  calculateRouteBounds,
  calculateRouteCenter,
  calculateDistance,
  simplifyPolyline,
  createRouteGeoJSON,
  createPhotoMarkersGeoJSON,
  createStartEndMarkersGeoJSON,
} from '../mapUtils';
import { TrackPoint } from '../../types';

describe('mapUtils', () => {
  const mockTrackPoints: TrackPoint[] = [
    {
      timestamp: new Date('2024-01-01T10:00:00Z'),
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 100,
      accuracy: 5,
      speed: 2.5,
      heading: 90,
      source: 'gps',
    },
    {
      timestamp: new Date('2024-01-01T10:01:00Z'),
      latitude: 37.7750,
      longitude: -122.4190,
      altitude: 105,
      accuracy: 5,
      speed: 2.8,
      heading: 85,
      source: 'gps',
    },
    {
      timestamp: new Date('2024-01-01T10:02:00Z'),
      latitude: 37.7755,
      longitude: -122.4185,
      altitude: 110,
      accuracy: 4,
      speed: 3.0,
      heading: 80,
      source: 'gps',
    },
  ];

  const mockPhotos = [
    {
      photoId: 'photo1',
      activityId: 'activity1',
      timestamp: new Date('2024-01-01T10:01:30Z'),
      latitude: 37.7752,
      longitude: -122.4188,
      localUri: 'file://photo1.jpg',
      syncStatus: 'local' as const,
    },
  ];

  describe('calculateRouteBounds', () => {
    it('should return null for empty track points', () => {
      const bounds = calculateRouteBounds([]);
      expect(bounds).toBeNull();
    });

    it('should calculate bounds for track points', () => {
      const bounds = calculateRouteBounds(mockTrackPoints);
      expect(bounds).toBeDefined();
      expect(bounds!.north).toBeGreaterThan(bounds!.south);
      expect(bounds!.east).toBeGreaterThan(bounds!.west);
    });

    it('should apply padding to bounds', () => {
      const boundsNoPadding = calculateRouteBounds(mockTrackPoints, 0);
      const boundsWithPadding = calculateRouteBounds(mockTrackPoints, 0.1);
      
      expect(boundsWithPadding!.north).toBeGreaterThan(boundsNoPadding!.north);
      expect(boundsWithPadding!.south).toBeLessThan(boundsNoPadding!.south);
      expect(boundsWithPadding!.east).toBeGreaterThan(boundsNoPadding!.east);
      expect(boundsWithPadding!.west).toBeLessThan(boundsNoPadding!.west);
    });
  });

  describe('calculateRouteCenter', () => {
    it('should return null for empty track points', () => {
      const center = calculateRouteCenter([]);
      expect(center).toBeNull();
    });

    it('should calculate center point', () => {
      const center = calculateRouteCenter(mockTrackPoints);
      expect(center).toBeDefined();
      expect(center!.latitude).toBeCloseTo(37.7752, 3);
      expect(center!.longitude).toBeCloseTo(-122.41895, 3);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const distance = calculateDistance(37.7749, -122.4194, 37.7750, -122.4190);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(100); // Should be less than 100 meters
    });

    it('should return 0 for same points', () => {
      const distance = calculateDistance(37.7749, -122.4194, 37.7749, -122.4194);
      expect(distance).toBe(0);
    });
  });

  describe('simplifyPolyline', () => {
    it('should return original points if less than 3 points', () => {
      const simplified = simplifyPolyline(mockTrackPoints.slice(0, 2));
      expect(simplified).toHaveLength(2);
    });

    it('should simplify polyline with tolerance', () => {
      // Create a line with many points
      const manyPoints: TrackPoint[] = [];
      for (let i = 0; i < 10; i++) {
        manyPoints.push({
          timestamp: new Date(),
          latitude: 37.7749 + i * 0.0001,
          longitude: -122.4194 + i * 0.0001,
          altitude: 100,
          accuracy: 5,
          source: 'gps',
        });
      }
      
      const simplified = simplifyPolyline(manyPoints, 0.001);
      expect(simplified.length).toBeLessThanOrEqual(manyPoints.length);
    });
  });

  describe('createRouteGeoJSON', () => {
    it('should return null for insufficient points', () => {
      const geoJSON = createRouteGeoJSON([mockTrackPoints[0]]);
      expect(geoJSON).toBeNull();
    });

    it('should create valid GeoJSON LineString', () => {
      const geoJSON = createRouteGeoJSON(mockTrackPoints);
      expect(geoJSON).toBeDefined();
      expect(geoJSON!.type).toBe('Feature');
      expect(geoJSON!.geometry.type).toBe('LineString');
      expect(geoJSON!.geometry.coordinates).toHaveLength(3);
      expect(geoJSON!.geometry.coordinates[0]).toEqual([-122.4194, 37.7749]);
    });
  });

  describe('createPhotoMarkersGeoJSON', () => {
    it('should return null for empty photos', () => {
      const geoJSON = createPhotoMarkersGeoJSON([]);
      expect(geoJSON).toBeNull();
    });

    it('should create valid GeoJSON FeatureCollection', () => {
      const geoJSON = createPhotoMarkersGeoJSON(mockPhotos);
      expect(geoJSON).toBeDefined();
      expect(geoJSON!.type).toBe('FeatureCollection');
      expect(geoJSON!.features).toHaveLength(1);
      expect(geoJSON!.features[0].geometry.type).toBe('Point');
      expect(geoJSON!.features[0].properties.photoId).toBe('photo1');
    });
  });

  describe('createStartEndMarkersGeoJSON', () => {
    it('should return null for empty track points', () => {
      const geoJSON = createStartEndMarkersGeoJSON([]);
      expect(geoJSON).toBeNull();
    });

    it('should create start marker only for single point', () => {
      const geoJSON = createStartEndMarkersGeoJSON([mockTrackPoints[0]]);
      expect(geoJSON).toBeDefined();
      expect(geoJSON!.features).toHaveLength(1);
      expect(geoJSON!.features[0].properties.type).toBe('start');
    });

    it('should create start and end markers for multiple points', () => {
      const geoJSON = createStartEndMarkersGeoJSON(mockTrackPoints);
      expect(geoJSON).toBeDefined();
      expect(geoJSON!.features).toHaveLength(2);
      expect(geoJSON!.features[0].properties.type).toBe('start');
      expect(geoJSON!.features[1].properties.type).toBe('end');
    });
  });
});