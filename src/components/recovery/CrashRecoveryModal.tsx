import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAppLifecycle } from '../../hooks/useAppLifecycle';

interface CrashRecoveryModalProps {
  visible: boolean;
  onClose: () => void;
  onRecoveryComplete?: (recovered: boolean) => void;
}

export function CrashRecoveryModal({
  visible,
  onClose,
  onRecoveryComplete,
}: CrashRecoveryModalProps) {
  const [isRecovering, setIsRecovering] = useState(false);
  const { attemptRecovery, cleanupAbandonedSessions } = useAppLifecycle();

  const handleAttemptRecovery = async () => {
    setIsRecovering(true);
    
    try {
      const recovered = await attemptRecovery();
      
      if (recovered) {
        Alert.alert(
          'Recovery Successful',
          'Your previous tracking session has been restored.',
          [{ text: 'OK', onPress: onClose }]
        );
        onRecoveryComplete?.(true);
      } else {
        Alert.alert(
          'Recovery Failed',
          'Unable to restore your previous session. The data may have been lost or corrupted.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clean Up', onPress: handleCleanup },
          ]
        );
        onRecoveryComplete?.(false);
      }
    } catch (error) {
      Alert.alert(
        'Recovery Error',
        'An error occurred while attempting to recover your session.',
        [{ text: 'OK' }]
      );
      onRecoveryComplete?.(false);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleCleanup = async () => {
    try {
      await cleanupAbandonedSessions();
      Alert.alert(
        'Cleanup Complete',
        'Abandoned session data has been cleaned up.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert(
        'Cleanup Error',
        'An error occurred while cleaning up session data.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSkipRecovery = () => {
    Alert.alert(
      'Skip Recovery',
      'Are you sure you want to skip recovery? Your previous session data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          style: 'destructive',
          onPress: () => {
            handleCleanup();
            onRecoveryComplete?.(false);
          }
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Session Recovery</Text>
            <Text style={styles.subtitle}>
              It looks like the app was interrupted during a tracking session.
            </Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.description}>
              We detected that you had an active tracking session that was interrupted. 
              Would you like to attempt to recover your session data?
            </Text>

            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Recovery may not always be successful. If recovery fails, 
                some tracking data may be lost.
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleSkipRecovery}
              disabled={isRecovering}
            >
              <Text style={styles.secondaryButtonText}>Skip Recovery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleAttemptRecovery}
              disabled={isRecovering}
            >
              {isRecovering ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Attempt Recovery</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  content: {
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButton: {
    backgroundColor: '#059669',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    borderWidth: 1,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});