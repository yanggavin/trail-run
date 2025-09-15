import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Activity } from '../../types';

interface ActivityCardProps {
  activity: Activity;
  coverPhotoUri?: string;
  onPress: () => void;
}

const { width } = Dimensions.get('window');

const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  coverPhotoUri,
  onPress,
}) => {
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDistance = (distanceM: number): string => {
    const km = distanceM / 1000;
    return km < 10 ? km.toFixed(2) : km.toFixed(1);
  };

  const formatDuration = (durationSec: number): string => {
    const hours = Math.floor(durationSec / 3600);
    const minutes = Math.floor((durationSec % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatPace = (paceSecPerKm: number): string => {
    if (paceSecPerKm === 0) return '--';
    
    const minutes = Math.floor(paceSecPerKm / 60);
    const seconds = Math.floor(paceSecPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getSyncStatusColor = (syncStatus: Activity['syncStatus']): string => {
    switch (syncStatus) {
      case 'synced':
        return '#4CAF50';
      case 'syncing':
        return '#FF9800';
      case 'local':
        return '#757575';
      default:
        return '#757575';
    }
  };

  const getSyncStatusText = (syncStatus: Activity['syncStatus']): string => {
    switch (syncStatus) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'local':
        return 'Local';
      default:
        return 'Unknown';
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.dateContainer}>
          <Text style={styles.date}>{formatDate(activity.startedAt)}</Text>
          <Text style={styles.time}>{formatTime(activity.startedAt)}</Text>
        </View>
        <View style={styles.syncContainer}>
          <View
            style={[
              styles.syncIndicator,
              { backgroundColor: getSyncStatusColor(activity.syncStatus) },
            ]}
          />
          <Text style={styles.syncText}>
            {getSyncStatusText(activity.syncStatus)}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {coverPhotoUri && (
          <View style={styles.photoContainer}>
            <Image source={{ uri: coverPhotoUri }} style={styles.coverPhoto} />
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {formatDistance(activity.distanceM)}
              </Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {formatDuration(activity.durationSec)}
              </Text>
              <Text style={styles.statLabel}>time</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {formatPace(activity.avgPaceSecPerKm)}
              </Text>
              <Text style={styles.statLabel}>pace</Text>
            </View>
          </View>

          {(activity.elevGainM > 0 || activity.elevLossM > 0) && (
            <View style={styles.elevationRow}>
              <Text style={styles.elevationText}>
                ↗ {Math.round(activity.elevGainM)}m ↘ {Math.round(activity.elevLossM)}m
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dateContainer: {
    flex: 1,
  },
  date: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  time: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  syncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  syncText: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  photoContainer: {
    marginRight: 12,
  },
  coverPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  statsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    fontFamily: 'monospace',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  elevationRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  elevationText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});

export default ActivityCard;