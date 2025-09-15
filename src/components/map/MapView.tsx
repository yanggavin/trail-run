import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Mapbox, { MapView as MapboxMapView, Camera, LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { TrackPoint, Photo } from '../../types';
import { MapboxConfigService } from '../../services/map/MapboxConfigService';
import PhotoLightbox from '../photo/PhotoLightbox';
import {
  calculateRouteBounds,
  createRouteGeoJSON,
  createPhotoMarkersGeoJSON,
  createStartEndMarkersGeoJSON,
  simplifyPolyline,
} from '../../utils/mapUtils';

interface MapViewProps {
  trackPoints: TrackPoint[];
  photos: Photo[];
  onPhotoMarkerPress?: (photo: Photo) => void;
  style?: any;
  showControls?: boolean;
  initialZoom?: number;
  enablePhotoLightbox?: boolean;
  simplifyRoute?: boolean;
}

const MapView: React.FC<MapViewProps> = ({
  trackPoints,
  photos,
  onPhotoMarkerPress,
  style,
  showControls = true,
  initialZoom = 14,
  enablePhotoLightbox = true,
  simplifyRoute = true,
}) => {
  const [isMapboxReady, setIsMapboxReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<string>('');
  const [bounds, setBounds] = useState<any>(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState(0);
  const cameraRef = useRef<Camera>(null);
  const mapboxConfig = MapboxConfigService.getInstance();

  useEffect(() => {
    initializeMapbox();
  }, []);

  useEffect(() => {
    if (trackPoints.length > 0) {
      const calculatedBounds = calculateRouteBounds(trackPoints);
      setBounds(calculatedBounds);
      
      // Fit camera to route bounds
      if (calculatedBounds && cameraRef.current) {
        const padding = 50;
        cameraRef.current.fitBounds(
          [calculatedBounds.west, calculatedBounds.south],
          [calculatedBounds.east, calculatedBounds.north],
          padding,
          1000 // animation duration
        );
      }
    }
  }, [trackPoints]);

  const initializeMapbox = async () => {
    try {
      await mapboxConfig.initialize();
      await mapboxConfig.configureOfflineSettings();
      const hasPermissions = await mapboxConfig.requestMapPermissions();
      
      if (hasPermissions) {
        setMapStyle(mapboxConfig.getDefaultStyleURL());
        setIsMapboxReady(true);
      } else {
        Alert.alert('Map Permissions', 'Map functionality requires location permissions.');
      }
    } catch (error) {
      console.error('Failed to initialize Mapbox:', error);
      Alert.alert('Map Error', 'Failed to initialize map. Please check your configuration.');
    }
  };

  const getProcessedTrackPoints = () => {
    if (!simplifyRoute || trackPoints.length < 100) {
      return trackPoints;
    }
    return simplifyPolyline(trackPoints, 0.0001);
  };

  const handleMapStyleToggle = () => {
    const currentStyle = mapStyle;
    const newStyle = currentStyle === mapboxConfig.getDefaultStyleURL() 
      ? mapboxConfig.getSatelliteStyleURL()
      : mapboxConfig.getDefaultStyleURL();
    setMapStyle(newStyle);
  };

  const handleCenterOnRoute = () => {
    if (bounds && cameraRef.current) {
      cameraRef.current.fitBounds(
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
        50,
        1000
      );
    }
  };

  const handlePhotoMarkerPress = (event: any) => {
    const feature = event.nativeEvent.payload;
    if (feature && feature.properties && feature.properties.photoId) {
      const photo = photos.find(p => p.photoId === feature.properties.photoId);
      if (photo) {
        if (enablePhotoLightbox) {
          const photoIndex = photos.findIndex(p => p.photoId === photo.photoId);
          setLightboxPhotoIndex(photoIndex);
          setLightboxVisible(true);
        } else if (onPhotoMarkerPress) {
          onPhotoMarkerPress(photo);
        }
      }
    }
  };

  const handleZoomToFit = () => {
    if (bounds && cameraRef.current) {
      cameraRef.current.fitBounds(
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
        50,
        1000
      );
    }
  };

  const handleZoomIn = () => {
    if (cameraRef.current) {
      cameraRef.current.zoomTo(initialZoom + 2, 500);
    }
  };

  const handleZoomOut = () => {
    if (cameraRef.current) {
      cameraRef.current.zoomTo(initialZoom - 2, 500);
    }
  };

  if (!isMapboxReady) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Initializing map...</Text>
        </View>
      </View>
    );
  }

  const processedTrackPoints = getProcessedTrackPoints();
  const routeGeoJSON = createRouteGeoJSON(processedTrackPoints);
  const photoMarkersGeoJSON = createPhotoMarkersGeoJSON(photos);
  const startEndMarkersGeoJSON = createStartEndMarkersGeoJSON(trackPoints);

  return (
    <View style={[styles.container, style]}>
      <MapboxMapView
        style={styles.map}
        styleURL={mapStyle}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
        attributionEnabled={false}
        logoEnabled={false}
      >
        <Camera
          ref={cameraRef}
          zoomLevel={initialZoom}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {/* Route line with gradient effect */}
        {routeGeoJSON && (
          <ShapeSource id="route-source" shape={routeGeoJSON}>
            {/* Background line (wider, darker) */}
            <LineLayer
              id="route-line-bg"
              style={{
                lineColor: '#1B5E20',
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.8,
              }}
            />
            {/* Main route line */}
            <LineLayer
              id="route-line"
              style={{
                lineColor: '#4CAF50',
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}

        {/* Start/End markers */}
        {startEndMarkersGeoJSON && (
          <ShapeSource id="start-end-markers" shape={startEndMarkersGeoJSON}>
            <SymbolLayer
              id="start-end-symbols"
              style={{
                iconImage: ['get', 'icon'],
                iconSize: 1.2,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
              }}
            />
          </ShapeSource>
        )}

        {/* Photo markers */}
        {photoMarkersGeoJSON && (
          <ShapeSource 
            id="photo-markers" 
            shape={photoMarkersGeoJSON}
            onPress={handlePhotoMarkerPress}
          >
            <SymbolLayer
              id="photo-symbols"
              style={{
                iconImage: 'camera-marker',
                iconSize: 1.0,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
              }}
            />
          </ShapeSource>
        )}
      </MapboxMapView>

      {/* Map controls */}
      {showControls && (
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleMapStyleToggle}
            activeOpacity={0.8}
          >
            <Text style={styles.controlButtonText}>
              {mapStyle === mapboxConfig.getDefaultStyleURL() ? '🛰️' : '🗺️'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleZoomIn}
            activeOpacity={0.8}
          >
            <Text style={styles.controlButtonText}>+</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleZoomOut}
            activeOpacity={0.8}
          >
            <Text style={styles.controlButtonText}>−</Text>
          </TouchableOpacity>
          
          {bounds && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleZoomToFit}
              activeOpacity={0.8}
            >
              <Text style={styles.controlButtonText}>📍</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Photo Lightbox */}
      {enablePhotoLightbox && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxPhotoIndex}
          visible={lightboxVisible}
          onClose={() => setLightboxVisible(false)}
        />
      )}

      {/* Map info */}
      {bounds && (
        <View style={styles.mapInfo}>
          <Text style={styles.mapInfoText}>
            {trackPoints.length} track points • {photos.length} photos
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    position: 'relative',
  },
  map: {
    height: 250,
    width: '100%',
  },
  loadingContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
  controlsContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'column',
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  controlButtonText: {
    fontSize: 18,
  },
  mapInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapInfoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default MapView;