import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { privacyService, PrivacySettings, PrivacyLevel } from '../../services/security/PrivacyService';

interface PrivacySettingsModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

export const PrivacySettingsModal: React.FC<PrivacySettingsModalProps> = ({
  visible,
  onClose,
  userId,
}) => {
  const [settings, setSettings] = useState<PrivacySettings>({
    defaultActivityPrivacy: 'private',
    stripExifOnShare: true,
    requireAuthForSensitiveData: true,
    allowLocationSharing: false,
  });
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPrivacySettings();
    }
  }, [visible, userId]);

  const loadPrivacySettings = async () => {
    try {
      setLoading(true);
      const currentSettings = await privacyService.getPrivacySettings(userId);
      setSettings(currentSettings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load privacy settings:', error);
      Alert.alert('Error', 'Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof PrivacySettings>(
    key: K,
    value: PrivacySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      await privacyService.updatePrivacySettings(userId, settings);
      setHasChanges(false);
      Alert.alert('Success', 'Privacy settings updated successfully');
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
      Alert.alert('Error', 'Failed to save privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to save them before closing?',
        [
          { text: 'Discard', style: 'destructive', onPress: onClose },
          { text: 'Save', onPress: () => saveSettings().then(onClose) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      onClose();
    }
  };

  const requestDataExport = () => {
    Alert.alert(
      'Data Export',
      'This will create a complete export of your data. This may take a few minutes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            try {
              setLoading(true);
              const exportData = await privacyService.exportUserData({
                userId,
                includeActivities: true,
                includePhotos: true,
                includeTrackPoints: true,
                format: 'json',
              });
              
              // In a real app, you would save this to a file or send it to the user
              console.log('Export data:', exportData);
              Alert.alert('Success', 'Data export completed');
            } catch (error) {
              console.error('Failed to export data:', error);
              Alert.alert('Error', 'Failed to export data');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const requestDataDeletion = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your data including activities, photos, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Are you absolutely sure? This will delete everything and cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setLoading(true);
                      await privacyService.deleteAllUserData(userId, 'User requested complete deletion');
                      Alert.alert('Success', 'All data has been deleted');
                      onClose();
                    } catch (error) {
                      console.error('Failed to delete data:', error);
                      Alert.alert('Error', 'Failed to delete data');
                    } finally {
                      setLoading(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Privacy Settings</Text>
          <TouchableOpacity onPress={saveSettings} disabled={!hasChanges || loading}>
            <Text style={[styles.saveButton, (!hasChanges || loading) && styles.disabledButton]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Default Activity Privacy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Default Activity Privacy</Text>
            <Text style={styles.sectionDescription}>
              Choose the default privacy level for new activities
            </Text>
            
            {(['private', 'shareable', 'public'] as PrivacyLevel[]).map((level) => (
              <TouchableOpacity
                key={level}
                style={styles.radioOption}
                onPress={() => updateSetting('defaultActivityPrivacy', level)}
              >
                <View style={styles.radioButton}>
                  {settings.defaultActivityPrivacy === level && (
                    <View style={styles.radioButtonSelected} />
                  )}
                </View>
                <View style={styles.radioContent}>
                  <Text style={styles.radioLabel}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                  <Text style={styles.radioDescription}>
                    {level === 'private' && 'Only visible to you'}
                    {level === 'shareable' && 'Can be shared with others'}
                    {level === 'public' && 'Visible to everyone'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Photo Privacy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photo Privacy</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Strip EXIF Data When Sharing</Text>
                <Text style={styles.settingDescription}>
                  Remove metadata like location and device info from shared photos
                </Text>
              </View>
              <Switch
                value={settings.stripExifOnShare}
                onValueChange={(value) => updateSetting('stripExifOnShare', value)}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Allow Location Sharing</Text>
                <Text style={styles.settingDescription}>
                  Include GPS coordinates when sharing photos and activities
                </Text>
              </View>
              <Switch
                value={settings.allowLocationSharing}
                onValueChange={(value) => updateSetting('allowLocationSharing', value)}
              />
            </View>
          </View>

          {/* Security */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Require Authentication</Text>
                <Text style={styles.settingDescription}>
                  Require biometric or PIN authentication for sensitive data
                </Text>
              </View>
              <Switch
                value={settings.requireAuthForSensitiveData}
                onValueChange={(value) => updateSetting('requireAuthForSensitiveData', value)}
              />
            </View>
          </View>

          {/* Data Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Management</Text>
            
            <TouchableOpacity style={styles.actionButton} onPress={requestDataExport}>
              <Text style={styles.actionButtonText}>Export My Data</Text>
              <Text style={styles.actionButtonDescription}>
                Download a copy of all your data (GDPR compliance)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.dangerButton]} 
              onPress={requestDataDeletion}
            >
              <Text style={[styles.actionButtonText, styles.dangerText]}>
                Delete All Data
              </Text>
              <Text style={styles.actionButtonDescription}>
                Permanently delete all your data and account
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  disabledButton: {
    color: '#ccc',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  radioDescription: {
    fontSize: 14,
    color: '#666',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 4,
  },
  actionButtonDescription: {
    fontSize: 14,
    color: '#666',
  },
  dangerButton: {
    // No additional styles needed, just for semantic purposes
  },
  dangerText: {
    color: '#FF3B30',
  },
});