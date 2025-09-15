import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Activity, Photo, TrackPoint } from '../../types';
import { ActivityRepository } from '../../services/repositories/ActivityRepository';
import { PhotoRepository } from '../../services/repositories/PhotoRepository';
import { DatabaseService } from '../../services/database/DatabaseService';
import { TrackPointRepository } from '../../services/repositories/TrackPointRepository';
import { ActivitySharingService } from '../../services/activity/ActivitySharingService';
import StatsCard from '../../components/stats/StatsCard';
import MapView from '../../components/map/MapView';
import PhotoGallery from '../../components/photo/PhotoGallery';
import ElevationChart from '../../components/common/ElevationChart';
import ActivityEditModal from '../../components/activity/ActivityEditModal';

interface ActivityDetailScreenProps {
  route?: {
    params?: {
      activityId?: string;
      activity?: Activity; // Can pass activity directly for performance
    };
  };
  navigation?: any;
}

const ActivityDetailScreen: React.FC<ActivityDetailScreenProps> = ({ route, navigation }) => {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  
  const [activityRepository] = useState(() => {
    const db = new DatabaseService();
    return new ActivityRepository(db);
  });
  const [photoRepository] = useState(() => {
    const db = new DatabaseService();
    return new PhotoRepository(db);
  });
  const [trackPointRepository] = useState(() => {
    const db = new DatabaseService();
    return new TrackPointRepository(db);
  });
  const [activitySharingService] = useState(() => {
    return new ActivitySharingService();
  });

  // Get activity ID from route params or use demo data
  const activityId = route?.params?.activityId || 'demo_activity';
  const passedActivity = route?.params?.activity;

  useEffect(() => {
    loadActivityData();
  }, [activityId]);

  const loadActivityData = async () => {
    try {
      setLoading(true);

      // Use passed activity if available, otherwise fetch from repository
      let activityData: Activity | null = passedActivity || null;
      
      if (!activityData) {
        activityData = await activityRepository.findById(activityId);
      }

      if (!activityData) {
        // Create demo data for demonstration
        activityData = createDemoActivity();
      }

      setActivity(activityData);

      // Load photos and track points
      const [photosData, trackPointsData] = await Promise.all([
        photoRepository.findAll({ activityId }),
        trackPointRepository.findAll({ activityId }),
      ]);

      setPhotos(photosData);
      setTrackPoints(trackPointsData.length > 0 ? trackPointsData : createDemoTrackPoints());

    } catch (error) {
      console.error('Failed to load activity data:', error);
      Alert.alert('Error', 'Failed to load activity details');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivityData();
    setRefreshing(false);
  };

  const handlePhotoPress = (photo: Photo) => {
    // Photo lightbox is handled within PhotoGallery component
    console.log('Photo pressed:', photo.photoId);
  };

  const handlePhotoMarkerPress = (photo: Photo) => {
    // Could scroll to photo in gallery or show photo details
    Alert.alert('Photo', `Photo taken at ${photo.timestamp.toLocaleTimeString()}`);
  };

  const handleShare = () => {
    if (!activity) return;

    const shareOptions = [
      'Share Activity',
      'Share to Instagram',
      'Share to Facebook', 
      'Share to Twitter',
      'Share to Strava',
      'Cancel',
    ];

    const showActionSheet = () => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: shareOptions,
            cancelButtonIndex: shareOptions.length - 1,
            title: 'Share Activity',
          },
          (buttonIndex) => {
            handleShareOption(buttonIndex);
          }
        );
      } else {
        // For Android, show a simple alert with options
        Alert.alert(
          'Share Activity',
          'Choose sharing option',
          [
            { text: 'General Share', onPress: () => handleShareOption(0) },
            { text: 'Instagram', onPress: () => handleShareOption(1) },
            { text: 'Facebook', onPress: () => handleShareOption(2) },
            { text: 'Twitter', onPress: () => handleShareOption(3) },
            { text: 'Strava', onPress: () => handleShareOption(4) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    };

    const handleShareOption = async (buttonIndex: number) => {
      if (buttonIndex === shareOptions.length - 1) return; // Cancel

      setSharing(true);
      try {
        let result;
        
        switch (buttonIndex) {
          case 0: // General share
            result = await activitySharingService.shareActivity(activity, photos);
            break;
          case 1: // Instagram
            result = await activitySharingService.shareToSocialMedia(activity, 'instagram', photos);
            break;
          case 2: // Facebook
            result = await activitySharingService.shareToSocialMedia(activity, 'facebook');
            break;
          case 3: // Twitter
            result = await activitySharingService.shareToSocialMedia(activity, 'twitter');
            break;
          case 4: // Strava
            result = await activitySharingService.shareToSocialMedia(activity, 'strava');
            break;
          default:
            return;
        }

        if (result.success) {
          Alert.alert('Success', result.message);
        } else {
          Alert.alert('Error', result.error);
        }
      } catch (error) {
        console.error('Error sharing activity:', error);
        Alert.alert('Error', 'Failed to share activity. Please try again.');
      } finally {
        setSharing(false);
      }
    };

    showActionSheet();
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleSaveEdit = async (updates: Partial<Activity>) => {
    if (!activity) return;

    try {
      const updatedActivity = await activityRepository.update(activity.activityId, updates);
      if (updatedActivity) {
        setActivity(updatedActivity);
        Alert.alert('Success', 'Activity updated successfully!');
      }
    } catch (error) {
      console.error('Error updating activity:', error);
      throw error; // Re-throw to let the modal handle it
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to delete this activity? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete associated photos first
              for (const photo of photos) {
                await photoRepository.delete(photo.photoId);
              }
              
              // Delete track points
              await trackPointRepository.deleteByActivityId(activityId);
              
              // Delete the activity
              await activityRepository.delete(activityId);
              
              Alert.alert('Success', 'Activity deleted successfully', [
                { text: 'OK', onPress: () => navigation?.goBack() }
              ]);
            } catch (error) {
              console.error('Error deleting activity:', error);
              Alert.alert('Error', 'Failed to delete activity. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Helper functions for formatting
  const formatDuration = (seconds: number): string => {
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
      return `${Math.round(meters)}`;
    }
    return `${(meters / 1000).toFixed(2)}`;
  };

  const formatPace = (secondsPerKm: number): string => {
    if (secondsPerKm === 0 || !isFinite(secondsPerKm)) {
      return '--:--';
    }
    
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Render splits table
  const renderSplitsTable = () => {
    if (!activity || activity.splitKm.length === 0) {
      return (
        <View style={styles.splitsContainer}>
          <Text style={styles.sectionTitle}>Kilometer Splits</Text>
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>No split data available</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.splitsContainer}>
        <Text style={styles.sectionTitle}>Kilometer Splits</Text>
        <View style={styles.splitsTable}>
          <View style={styles.splitsHeader}>
            <Text style={styles.splitsHeaderText}>KM</Text>
            <Text style={styles.splitsHeaderText}>Time</Text>
            <Text style={styles.splitsHeaderText}>Pace</Text>
          </View>
          {activity.splitKm.map((split, index) => (
            <View key={split.kmIndex} style={styles.splitsRow}>
              <Text style={styles.splitsCell}>{split.kmIndex}</Text>
              <Text style={styles.splitsCell}>{formatDuration(split.durationSec)}</Text>
              <Text style={styles.splitsCell}>{formatPace(split.paceSecPerKm)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading activity details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!activity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Activity not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleShare}
            disabled={sharing}
          >
            <Text style={[styles.actionButtonText, sharing && styles.disabledText]}>
              {sharing ? 'Sharing...' : 'Share'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleEdit}>
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Activity title and date */}
        <View style={styles.titleContainer}>
          <Text style={styles.activityTitle}>
            {activity.coverPhotoId ? 'Trail Run' : 'Trail Run'} {/* TODO: Add custom titles */}
          </Text>
          <Text style={styles.activityDate}>{formatDate(activity.startedAt)}</Text>
          <Text style={styles.activityTime}>
            {formatTime(activity.startedAt)} - {activity.endedAt ? formatTime(activity.endedAt) : 'In Progress'}
          </Text>
        </View>

        {/* Main statistics cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <StatsCard
                title="Distance"
                value={formatDistance(activity.distanceM)}
                unit={activity.distanceM >= 1000 ? 'km' : 'm'}
                color="#2E7D32"
              />
            </View>
            <View style={styles.statCard}>
              <StatsCard
                title="Duration"
                value={formatDuration(activity.durationSec)}
                color="#1976D2"
              />
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <StatsCard
                title="Avg Pace"
                value={formatPace(activity.avgPaceSecPerKm)}
                unit="/km"
                color="#F57C00"
              />
            </View>
            <View style={styles.statCard}>
              <StatsCard
                title="Elevation"
                value={Math.round(activity.elevGainM).toString()}
                unit="m ↑"
                subtitle={`${Math.round(activity.elevLossM)}m ↓`}
                color="#7B1FA2"
              />
            </View>
          </View>
        </View>

        {/* Map */}
        <MapView
          trackPoints={trackPoints}
          photos={photos}
          onPhotoMarkerPress={handlePhotoMarkerPress}
        />

        {/* Photo gallery */}
        <PhotoGallery
          photos={photos}
          onPhotoPress={handlePhotoPress}
        />

        {/* Elevation chart */}
        <ElevationChart trackPoints={trackPoints} />

        {/* Splits table */}
        {renderSplitsTable()}
      </ScrollView>

      {/* Edit Modal */}
      {activity && (
        <ActivityEditModal
          visible={showEditModal}
          activity={activity}
          onSave={handleSaveEdit}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </SafeAreaView>
  );
};

// Demo data functions for testing
const createDemoActivity = (): Activity => {
  const startTime = new Date(Date.now() - 3600000); // 1 hour ago
  const endTime = new Date();
  
  return {
    activityId: 'demo_activity',
    userId: 'demo_user',
    startedAt: startTime,
    endedAt: endTime,
    status: 'completed',
    durationSec: 3600,
    distanceM: 5200,
    avgPaceSecPerKm: 415, // 6:55 per km
    elevGainM: 120,
    elevLossM: 95,
    splitKm: [
      { kmIndex: 1, durationSec: 400, paceSecPerKm: 400 },
      { kmIndex: 2, durationSec: 420, paceSecPerKm: 420 },
      { kmIndex: 3, durationSec: 410, paceSecPerKm: 410 },
      { kmIndex: 4, durationSec: 430, paceSecPerKm: 430 },
      { kmIndex: 5, durationSec: 415, paceSecPerKm: 415 },
    ],
    deviceMeta: {
      platform: 'ios',
      version: '1.0.0',
      model: 'iPhone 14',
    },
    createdAt: startTime,
    updatedAt: endTime,
    syncStatus: 'local',
  };
};

const createDemoTrackPoints = (): TrackPoint[] => {
  const points: TrackPoint[] = [];
  const baseTime = Date.now() - 3600000;
  
  // Create a simple route with elevation changes
  for (let i = 0; i < 100; i++) {
    const progress = i / 99;
    points.push({
      timestamp: new Date(baseTime + i * 36000), // 36 seconds apart
      latitude: 37.7749 + progress * 0.01 + Math.sin(progress * Math.PI * 4) * 0.002,
      longitude: -122.4194 + progress * 0.015 + Math.cos(progress * Math.PI * 3) * 0.003,
      altitude: 100 + Math.sin(progress * Math.PI * 2) * 50 + Math.random() * 10,
      accuracy: 3 + Math.random() * 2,
      speed: 2.5 + Math.sin(progress * Math.PI * 6) * 0.5,
      heading: (progress * 180 + Math.sin(progress * Math.PI * 8) * 30) % 360,
      source: 'gps',
    });
  }
  
  return points;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#ffebee',
  },
  deleteButtonText: {
    color: '#d32f2f',
  },
  disabledText: {
    opacity: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  titleContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 8,
  },
  activityTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  activityDate: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 14,
    color: '#999',
  },
  statsGrid: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  splitsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  noDataContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noDataText: {
    color: '#999',
    fontSize: 14,
  },
  splitsTable: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  splitsHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  splitsHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  splitsRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  splitsCell: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});

export default ActivityDetailScreen;
