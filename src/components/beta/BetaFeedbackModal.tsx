import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';

interface BetaFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FeedbackData {
  deviceModel: string;
  osVersion: string;
  trailType: string;
  gpsAccuracy: number;
  batteryUsage: number;
  photoQuality: number;
  overallPerformance: number;
  specificIssues: string;
  featureRequests: string;
  wouldRecommend: boolean | null;
}

export const BetaFeedbackModal: React.FC<BetaFeedbackModalProps> = ({
  visible,
  onClose,
}) => {
  const [feedback, setFeedback] = useState<FeedbackData>({
    deviceModel: '',
    osVersion: '',
    trailType: '',
    gpsAccuracy: 0,
    batteryUsage: 0,
    photoQuality: 0,
    overallPerformance: 0,
    specificIssues: '',
    featureRequests: '',
    wouldRecommend: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRatingPress = (field: keyof FeedbackData, rating: number) => {
    setFeedback(prev => ({ ...prev, [field]: rating }));
  };

  const handleRecommendPress = (recommend: boolean) => {
    setFeedback(prev => ({ ...prev, wouldRecommend: recommend }));
  };

  const handleSubmit = async () => {
    if (!feedback.deviceModel || !feedback.trailType) {
      Alert.alert('Missing Information', 'Please fill in device model and trail type.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // In a real app, this would send to your analytics service
      console.log('Beta Feedback Submitted:', feedback);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      Alert.alert(
        'Thank You!',
        'Your beta feedback has been submitted. We appreciate your help in making TrailRun better!',
        [{ text: 'OK', onPress: onClose }]
      );
      
      // Reset form
      setFeedback({
        deviceModel: '',
        osVersion: '',
        trailType: '',
        gpsAccuracy: 0,
        batteryUsage: 0,
        photoQuality: 0,
        overallPerformance: 0,
        specificIssues: '',
        featureRequests: '',
        wouldRecommend: null,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarRating = (
    label: string,
    field: keyof FeedbackData,
    value: number
  ) => (
    <View style={styles.ratingSection}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity
            key={star}
            onPress={() => handleRatingPress(field, star)}
            style={styles.starButton}
          >
            <Text style={[
              styles.star,
              { color: star <= value ? '#FFD700' : '#DDD' }
            ]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Beta Feedback</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            Help us improve TrailRun by sharing your beta testing experience!
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Device Model *</Text>
              <TextInput
                style={styles.textInput}
                value={feedback.deviceModel}
                onChangeText={(text) => setFeedback(prev => ({ ...prev, deviceModel: text }))}
                placeholder="e.g., iPhone 14 Pro, Samsung Galaxy S23"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>OS Version</Text>
              <TextInput
                style={styles.textInput}
                value={feedback.osVersion}
                onChangeText={(text) => setFeedback(prev => ({ ...prev, osVersion: text }))}
                placeholder="e.g., iOS 17.1, Android 14"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Trail Type *</Text>
              <TextInput
                style={styles.textInput}
                value={feedback.trailType}
                onChangeText={(text) => setFeedback(prev => ({ ...prev, trailType: text }))}
                placeholder="e.g., Forest trail, Mountain path, Urban park"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Ratings</Text>
            
            {renderStarRating('GPS Accuracy', 'gpsAccuracy', feedback.gpsAccuracy)}
            {renderStarRating('Battery Usage', 'batteryUsage', feedback.batteryUsage)}
            {renderStarRating('Photo Quality', 'photoQuality', feedback.photoQuality)}
            {renderStarRating('Overall Performance', 'overallPerformance', feedback.overallPerformance)}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detailed Feedback</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Specific Issues Encountered</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={feedback.specificIssues}
                onChangeText={(text) => setFeedback(prev => ({ ...prev, specificIssues: text }))}
                placeholder="Describe any bugs, crashes, or problems you experienced..."
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Feature Requests</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={feedback.featureRequests}
                onChangeText={(text) => setFeedback(prev => ({ ...prev, featureRequests: text }))}
                placeholder="What features would you like to see added or improved?"
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendation</Text>
            <Text style={styles.questionText}>
              Would you recommend TrailRun to other trail runners?
            </Text>
            <View style={styles.recommendButtons}>
              <TouchableOpacity
                style={[
                  styles.recommendButton,
                  feedback.wouldRecommend === true && styles.recommendButtonSelected
                ]}
                onPress={() => handleRecommendPress(true)}
              >
                <Text style={[
                  styles.recommendButtonText,
                  feedback.wouldRecommend === true && styles.recommendButtonTextSelected
                ]}>
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recommendButton,
                  feedback.wouldRecommend === false && styles.recommendButtonSelected
                ]}
                onPress={() => handleRecommendPress(false)}
              >
                <Text style={[
                  styles.recommendButtonText,
                  feedback.wouldRecommend === false && styles.recommendButtonTextSelected
                ]}>
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  ratingSection: {
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    paddingHorizontal: 4,
  },
  star: {
    fontSize: 24,
  },
  questionText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  recommendButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  recommendButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  recommendButtonSelected: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  recommendButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  recommendButtonTextSelected: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 32,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});