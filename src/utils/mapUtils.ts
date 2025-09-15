import { TrackPoint } from '../types';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Calculate optimal bounds for a set of track points
 */
export const calculateRouteBounds = (trackPoints: TrackPoint[], padding = 0.1): MapBounds | null => {
  if (trackPoints.length === 0) return null;
  
  let north = trackPoints[0].latitude;
  let south = trackPoints[0].latitude;
  let east = trackPoints[0].longitude;
  let west = trackPoints[0].longitude;
  
  trackPoints.forEach(point => {
    north = Math.max(north, point.latitude);
    south = Math.min(south, point.latitude);
    east = Math.max(east, point.longitude);
    west = Math.min(west, point.longitude);
  });
  
  // Add padding to bounds
  const latPadding = (north - south) * padding;
  const lngPadding = (east - west) * padding;
  
  return {
    north: north + latPadding,
    south: south - latPadding,
    east: east + lngPadding,
    west: west - lngPadding,
  };
};

/**
 * Calculate the center point of a route
 */
export const calculateRouteCenter = (trackPoints: TrackPoint[]): { latitude: number; longitude: number } | null => {
  if (trackPoints.length === 0) return null;
  
  const bounds = calculateRouteBounds(trackPoints, 0);
  if (!bounds) return null;
  
  return {
    latitude: (bounds.north + bounds.south) / 2,
    longitude: (bounds.east + bounds.west) / 2,
  };
};

/**
 * Calculate distance between two points using Haversine formula
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Simplify a polyline using the Douglas-Peucker algorithm
 */
export const simplifyPolyline = (points: TrackPoint[], tolerance = 0.0001): TrackPoint[] => {
  if (points.length <= 2) return points;
  
  const douglasPeucker = (points: TrackPoint[], tolerance: number): TrackPoint[] => {
    if (points.length <= 2) return points;
    
    let maxDistance = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];
    
    for (let i = 1; i < points.length - 1; i++) {
      const distance = perpendicularDistance(points[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    if (maxDistance > tolerance) {
      const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const right = douglasPeucker(points.slice(maxIndex), tolerance);
      return [...left.slice(0, -1), ...right];
    } else {
      return [start, end];
    }
  };
  
  return douglasPeucker(points, tolerance);
};

/**
 * Calculate perpendicular distance from a point to a line
 */
const perpendicularDistance = (point: TrackPoint, lineStart: TrackPoint, lineEnd: TrackPoint): number => {
  const A = lineEnd.latitude - lineStart.latitude;
  const B = lineStart.longitude - lineEnd.longitude;
  const C = lineEnd.longitude * lineStart.latitude - lineStart.longitude * lineEnd.latitude;
  
  return Math.abs(A * point.longitude + B * point.latitude + C) / Math.sqrt(A * A + B * B);
};

/**
 * Create GeoJSON LineString from track points
 */
export const createRouteGeoJSON = (trackPoints: TrackPoint[]) => {
  if (trackPoints.length < 2) return null;
  
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: trackPoints.map(point => [point.longitude, point.latitude]),
    },
    properties: {},
  };
};

/**
 * Create GeoJSON FeatureCollection for photo markers
 */
export const createPhotoMarkersGeoJSON = (photos: any[]) => {
  if (photos.length === 0) return null;
  
  return {
    type: 'FeatureCollection' as const,
    features: photos.map(photo => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [photo.longitude, photo.latitude],
      },
      properties: {
        photoId: photo.photoId,
        timestamp: photo.timestamp,
      },
    })),
  };
};

/**
 * Create GeoJSON for start and end markers
 */
export const createStartEndMarkersGeoJSON = (trackPoints: TrackPoint[]) => {
  if (trackPoints.length === 0) return null;
  
  const features = [];
  
  // Start marker
  features.push({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [trackPoints[0].longitude, trackPoints[0].latitude],
    },
    properties: {
      type: 'start',
      icon: 'start-marker',
    },
  });
  
  // End marker (if different from start)
  if (trackPoints.length > 1) {
    const lastPoint = trackPoints[trackPoints.length - 1];
    features.push({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [lastPoint.longitude, lastPoint.latitude],
      },
      properties: {
        type: 'end',
        icon: 'end-marker',
      },
    });
  }
  
  return {
    type: 'FeatureCollection' as const,
    features,
  };
};