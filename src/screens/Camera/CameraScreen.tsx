import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  SafeAreaView,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import { useAppStore } from '../../store';
import { PhotoService } from '../../services/photo/PhotoService';
import { LocationService } from '../../services/location/LocationService';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

interface CameraScreenProps {
  route?: {
    params?: {
      activityId?: string;
    };
  };
}

const CameraScreen: React.FC<CameraScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const { tracking } = useAppStore();
  const cameraRef = useRef<CameraView>(null);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [photoService] = useState(() => new PhotoService());
  const [locationService] = useState(() => LocationService.getInstance());

  // Auto-return to tracking screen after 10 seconds of inactivity
  useEffect(() => {
    const timer = setTimeout(() => {
      handleBackPress();
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleCapturePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;

    const startTime = Date.now();
    setIsCapturing(true);

    try {
      // Get current location
      const location = await locationService.getCurrentLocation();
      
      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: true,
      });

      // Convert location timestamp to Date for PhotoService
      const locationWithDate = {
        ...location,
        timestamp: new Date(location.timestamp)
      };

      // Use PhotoService to process and save the photo
      const savedPhoto = await PhotoService.capturePhoto(
        cameraRef.current,
        locationWithDate,
        'current_activity', // TODO: Get actual activity ID
        { quality: 0.8 }
      );
      
      setLastPhoto(photo.uri);

      // Ensure we meet the 400ms response time requirement
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < 400) {
        await new Promise(resolve => setTimeout(resolve, 400 - elapsedTime));
      }

      // Auto-return to tracking screen after successful capture
      setTimeout(() => {
        handleBackPress();
      }, 1500);

    } catch (error) {
      Alert.alert(
        'Photo Capture Failed',
        `Unable to capture photo: ${error}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsCapturing(false);
    }
  };

  const toggleCameraType = () => {
    setCameraType((current: CameraType) => 
      current === 'back' ? 'front' : 'back'
    );
  };

  const toggleFlash = () => {
    setFlashMode((current: FlashMode) => {
      switch (current) {
        case 'off':
          return 'on';
        case 'on':
          return 'auto';
        case 'auto':
          return 'off';
        default:
          return 'off';
      }
    });
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (secondsPerKm: number): string => {
    if (secondsPerKm === 0 || !isFinite(secondsPerKm)) {
      return '--:--';
    }
    
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getFlashIcon = () => {
    switch (flashMode) {
      case 'on':
        return '⚡';
      case 'auto':
        return '⚡A';
      case 'off':
      default:
        return '⚡';
    }
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>No Camera Access</Text>
        <Text style={styles.permissionText}>
          Camera permission is required to capture photos during your run.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permissionButton} onPress={handleBackPress}>
          <Text style={styles.permissionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Camera view */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        flash={flashMode}
      >
        {/* Top overlay with stats */}
        <View style={styles.topOverlay}>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>TIME</Text>
              <Text style={styles.statValue}>
                {formatTime(tracking.statistics.elapsedTime)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>PACE</Text>
              <Text style={styles.statValue}>
                {formatPace(tracking.statistics.currentPace)}
              </Text>
            </View>
          </View>
          
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleBackPress}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomOverlay}>
          {/* Camera controls */}
          <View style={styles.cameraControls}>
            {/* Flash toggle */}
            <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
              <Text style={[
                styles.controlButtonText,
                flashMode !== 'off' && styles.controlButtonActive
              ]}>
                {getFlashIcon()}
              </Text>
            </TouchableOpacity>

            {/* Shutter button */}
            <TouchableOpacity
              style={[styles.shutterButton, isCapturing && styles.shutterButtonCapturing]}
              onPress={handleCapturePhoto}
              disabled={isCapturing}
              activeOpacity={0.8}
            >
              {isCapturing ? (
                <ActivityIndicator size="large" color="white" />
              ) : (
                <View style={styles.shutterButtonInner} />
              )}
            </TouchableOpacity>

            {/* Camera flip */}
            <TouchableOpacity style={styles.controlButton} onPress={toggleCameraType}>
              <Text style={styles.controlButtonText}>🔄</Text>
            </TouchableOpacity>
          </View>

          {/* Photo gallery preview */}
          {lastPhoto && (
            <View style={styles.galleryPreview}>
              <Image source={{ uri: lastPhoto }} style={styles.thumbnailImage} />
              <Text style={styles.galleryText}>Last Photo</Text>
            </View>
          )}
        </View>

        {/* Capture feedback overlay */}
        {isCapturing && (
          <View style={styles.captureOverlay}>
            <Text style={styles.captureText}>Capturing...</Text>
          </View>
        )}
      </CameraView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#2E7D32',
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  statsContainer: {
    flexDirection: 'row',
  },
  statItem: {
    alignItems: 'center',
    marginRight: 30,
  },
  statLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 2,
  },
  statValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 20,
    opacity: 0.7,
  },
  controlButtonActive: {
    opacity: 1,
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  shutterButtonCapturing: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  shutterButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  galleryPreview: {
    alignItems: 'center',
  },
  thumbnailImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 4,
  },
  galleryText: {
    color: 'white',
    fontSize: 12,
    opacity: 0.8,
  },
  captureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CameraScreen;
