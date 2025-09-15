import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { Activity } from '../../types';

interface ActivityEditModalProps {
  visible: boolean;
  activity: Activity;
  onSave: (updates: Partial<Activity>) => Promise<void>;
  onClose: () => void;
}

const ActivityEditModal: React.FC<ActivityEditModalProps> = ({
  visible,
  activity,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(activity.coverPhotoId || 'Trail Run');
  const [isPrivate, setIsPrivate] = useState(false); // In a real app, this would come from activity data
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // In a real implementation, you'd have more fields to update
      const updates: Partial<Activity> = {
        // For now, we can only update the updatedAt timestamp
        // In a full implementation, you'd have title, privacy, etc.
        updatedAt: new Date(),
      };

      await onSave(updates);
      onClose();
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={saving}>
            <Text style={[styles.cancelButton, saving && styles.disabledText]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Activity</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveButton, saving && styles.disabledText]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Activity Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity Details</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{formatDate(activity.startedAt)}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Time</Text>
              <Text style={styles.value}>
                {formatTime(activity.startedAt)} - {activity.endedAt ? formatTime(activity.endedAt) : 'In Progress'}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Distance</Text>
              <Text style={styles.value}>
                {activity.distanceM >= 1000 
                  ? `${(activity.distanceM / 1000).toFixed(2)} km`
                  : `${Math.round(activity.distanceM)} m`
                }
              </Text>
            </View>
          </View>

          {/* Editable Fields */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customization</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Activity Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter activity title"
                placeholderTextColor="#999"
                maxLength={50}
              />
              <Text style={styles.hint}>Give your activity a custom name</Text>
            </View>

            <View style={styles.switchGroup}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.label}>Privacy</Text>
                <Text style={styles.hint}>Make this activity private</Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: '#767577', true: '#2E7D32' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Activity Stats (Read-only) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statistics</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {Math.floor(activity.durationSec / 60)}:{(activity.durationSec % 60).toString().padStart(2, '0')}
                </Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {activity.avgPaceSecPerKm > 0 
                    ? `${Math.floor(activity.avgPaceSecPerKm / 60)}:${(activity.avgPaceSecPerKm % 60).toString().padStart(2, '0')}`
                    : '--:--'
                  }
                </Text>
                <Text style={styles.statLabel}>Avg Pace</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.round(activity.elevGainM)}m</Text>
                <Text style={styles.statLabel}>Elevation Gain</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{activity.splitKm.length}</Text>
                <Text style={styles.statLabel}>Splits</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    paddingVertical: 8,
  },
  section: {
    backgroundColor: 'white',
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabelContainer: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    paddingVertical: 8,
    alignItems: 'center',
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
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default ActivityEditModal;