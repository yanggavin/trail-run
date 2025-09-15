import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useAppStore } from '../../store';
import { LocationService } from '../../services/location/LocationService';

const { width } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
  const {
    tracking,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    updateStatistics,
  } = useAppStore();

  const [gpsStatus, setGpsStatus] = useState<'good' | 'poor' | 'unavailable'>('good');
  const [locationService] = useState(() => LocationService.getInstance());

  // Update statistics every second when tracking is active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (tracking.status === 'active') {
      interval = setInterval(() => {
        updateStatistics();
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [tracking.status, updateStatistics]);

  // Monitor GPS status
  useEffect(() => {
    let statusInterval: NodeJS.Timeout;

    if (tracking.status === 'active') {
      statusInterval = setInterval(async () => {
        try {
          const location = await locationService.getCurrentLocation();
          if (location.accuracy > 50) {
            setGpsStatus('poor');
          } else if (location.accuracy > 20) {
            setGpsStatus('good');
          } else {
            setGpsStatus('good');
          }
        } catch (error) {
          setGpsStatus('unavailable');
        }
      }, 5000);
    }

    return () => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [tracking.status, locationService]);

  const handleStartStop = async () => {
    try {
      if (tracking.status === 'inactive') {
        // Start tracking
        await startTracking('user123'); // TODO: Get actual user ID
        
        // Start location service
        await locationService.startTracking({
          accuracy: 'high',
          interval: 2000,
          distanceFilter: 2,
          adaptiveThrottling: true,
        });
      } else {
        // Stop tracking
        await stopTracking();
        await locationService.stopTracking();
        
        Alert.alert(
          'Run Completed!',
          'Your activity has been saved successfully.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        `Failed to ${tracking.status === 'inactive' ? 'start' : 'stop'} tracking: ${error}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handlePauseResume = () => {
    if (tracking.status === 'active') {
      pauseTracking();
    } else if (tracking.status === 'paused') {
      resumeTracking();
    }
  };

  const handleCameraPress = () => {
    // Navigate to camera screen with current activity ID
    if (tracking.activity) {
      // TODO: Add proper navigation when navigation is set up
      // For now, show alert that camera screen is implemented
      Alert.alert('Camera', 'Camera screen is ready! Navigation will be connected when navigation is configured.');
    }
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

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatPace = (secondsPerKm: number): string => {
    if (secondsPerKm === 0 || !isFinite(secondsPerKm)) {
      return '--:--';
    }
    
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStartStopButtonStyle = () => {
    if (tracking.status === 'inactive') {
      return [styles.startStopButton, styles.startButton];
    }
    return [styles.startStopButton, styles.stopButton];
  };

  const getStartStopButtonText = () => {
    if (tracking.status === 'inactive') {
      return 'START';
    }
    return 'STOP';
  };

  const getPauseResumeButtonText = () => {
    if (tracking.status === 'active') {
      return tracking.isAutoPaused ? 'AUTO PAUSED' : 'PAUSE';
    }
    return 'RESUME';
  };

  const renderGpsStatusIndicator = () => {
    let statusColor = '#4CAF50'; // Good
    let statusText = 'GPS Ready';
    
    if (gpsStatus === 'poor') {
      statusColor = '#FF9800';
      statusText = 'GPS Weak';
    } else if (gpsStatus === 'unavailable') {
      statusColor = '#F44336';
      statusText = 'GPS Unavailable';
    }

    return (
      <View style={[styles.gpsStatus, { backgroundColor: statusColor }]}>
        <Text style={styles.gpsStatusText}>{statusText}</Text>
      </View>
    );
  };

  const renderBackgroundIndicator = () => {
    if (tracking.status === 'active' || tracking.status === 'paused') {
      return (
        <View style={styles.backgroundIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.backgroundText}>Recording in background</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
      
      {/* Header with GPS status */}
      <View style={styles.header}>
        {renderGpsStatusIndicator()}
        {renderBackgroundIndicator()}
      </View>

      {/* Main statistics display */}
      <View style={styles.statsContainer}>
        <View style={styles.primaryStat}>
          <Text style={styles.primaryStatLabel}>TIME</Text>
          <Text style={styles.primaryStatValue}>
            {formatTime(tracking.statistics.elapsedTime)}
          </Text>
        </View>

        <View style={styles.secondaryStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>DISTANCE</Text>
            <Text style={styles.statValue}>
              {formatDistance(tracking.statistics.distance)}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>AVG PACE</Text>
            <Text style={styles.statValue}>
              {formatPace(tracking.statistics.avgPace)}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>CURRENT PACE</Text>
            <Text style={styles.statValue}>
              {formatPace(tracking.statistics.currentPace)}
            </Text>
          </View>
        </View>
      </View>

      {/* Control buttons */}
      <View style={styles.controlsContainer}>
        {/* Start/Stop button */}
        <TouchableOpacity
          style={getStartStopButtonStyle()}
          onPress={handleStartStop}
          activeOpacity={0.8}
        >
          <Text style={styles.startStopButtonText}>
            {getStartStopButtonText()}
          </Text>
        </TouchableOpacity>

        {/* Secondary controls */}
        {tracking.status !== 'inactive' && (
          <View style={styles.secondaryControls}>
            {/* Pause/Resume button */}
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                tracking.status === 'paused' ? styles.resumeButton : styles.pauseButton,
                tracking.isAutoPaused && styles.autoPausedButton,
              ]}
              onPress={handlePauseResume}
              disabled={tracking.isAutoPaused}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.secondaryButtonText,
                tracking.isAutoPaused && styles.autoPausedButtonText,
              ]}>
                {getPauseResumeButtonText()}
              </Text>
            </TouchableOpacity>

            {/* Camera button */}
            <TouchableOpacity
              style={[styles.secondaryButton, styles.cameraButton]}
              onPress={handleCameraPress}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>📷</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Status messages */}
      {tracking.status === 'paused' && !tracking.isAutoPaused && (
        <View style={styles.statusMessage}>
          <Text style={styles.statusMessageText}>
            Tracking paused. Tap RESUME to continue.
          </Text>
        </View>
      )}

      {tracking.isAutoPaused && (
        <View style={styles.statusMessage}>
          <Text style={styles.statusMessageText}>
            Auto-paused due to low speed. Start moving to resume.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B5E20',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  gpsStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  gpsStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  backgroundIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5252',
    marginRight: 6,
  },
  backgroundText: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
  },
  statsContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryStat: {
    alignItems: 'center',
    marginBottom: 40,
  },
  primaryStatLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  primaryStatValue: {
    color: 'white',
    fontSize: 64,
    fontWeight: '300',
    fontFamily: 'monospace',
  },
  secondaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  startStopButton: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  startStopButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  secondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pauseButton: {
    backgroundColor: '#FF9800',
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
  },
  autoPausedButton: {
    backgroundColor: '#757575',
  },
  cameraButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  autoPausedButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusMessage: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  statusMessageText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
  },
});

export default HomeScreen;
