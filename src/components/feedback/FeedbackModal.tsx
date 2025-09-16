import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { userFeedbackService, BugReport, FeatureRequest } from '../../services/monitoring/UserFeedbackService';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialType?: 'bug' | 'feature' | 'general';
}

type FeedbackType = 'bug' | 'feature' | 'general';

export const FeedbackModal: React.FC<Props> = ({ visible, onClose, initialType = 'general' }) => {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(initialType);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // General feedback state
  const [generalMessage, setGeneralMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  // Bug report state
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugSteps, setBugSteps] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [bugSeverity, setBugSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [bugCategory, setBugCategory] = useState<'gps' | 'camera' | 'sync' | 'ui' | 'performance' | 'other'>('other');

  // Feature request state
  const [featureTitle, setFeatureTitle] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [featureUseCase, setFeatureUseCase] = useState('');
  const [featurePriority, setFeaturePriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [featureCategory, setFeatureCategory] = useState<'tracking' | 'photos' | 'sharing' | 'ui' | 'other'>('other');

  const resetForm = () => {
    setGeneralMessage('');
    setRating(null);
    setUserEmail('');
    setUserName('');
    setBugTitle('');
    setBugDescription('');
    setBugSteps('');
    setExpectedBehavior('');
    setActualBehavior('');
    setBugSeverity('medium');
    setBugCategory('other');
    setFeatureTitle('');
    setFeatureDescription('');
    setFeatureUseCase('');
    setFeaturePriority('medium');
    setFeatureCategory('other');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      switch (feedbackType) {
        case 'general':
          if (!generalMessage.trim()) {
            Alert.alert('Error', 'Please enter your feedback message.');
            return;
          }
          await userFeedbackService.submitGeneralFeedback(
            generalMessage,
            rating || undefined,
            userEmail || undefined,
            userName || undefined
          );
          break;

        case 'bug':
          if (!bugTitle.trim() || !bugDescription.trim()) {
            Alert.alert('Error', 'Please fill in the title and description.');
            return;
          }
          const bugReport: BugReport = {
            title: bugTitle,
            description: bugDescription,
            steps: bugSteps.split('\n').filter(step => step.trim()),
            expectedBehavior,
            actualBehavior,
            severity: bugSeverity,
            category: bugCategory,
            userEmail: userEmail || undefined,
            userName: userName || undefined,
            deviceInfo: await userFeedbackService.getDeviceInfo(),
            appVersion: '1.0.0', // This should come from app config
          };
          userFeedbackService.submitBugReport(bugReport);
          break;

        case 'feature':
          if (!featureTitle.trim() || !featureDescription.trim()) {
            Alert.alert('Error', 'Please fill in the title and description.');
            return;
          }
          const featureRequest: FeatureRequest = {
            title: featureTitle,
            description: featureDescription,
            useCase: featureUseCase,
            priority: featurePriority,
            category: featureCategory,
            userEmail: userEmail || undefined,
            userName: userName || undefined,
          };
          userFeedbackService.submitFeatureRequest(featureRequest);
          break;
      }

      Alert.alert(
        'Thank you!',
        'Your feedback has been submitted successfully. We appreciate your input!',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRatingStars = () => (
    <View style={styles.ratingContainer}>
      <Text style={styles.label}>Rating (optional):</Text>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.star}
          >
            <Text style={[styles.starText, rating && star <= rating && styles.starSelected]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderGeneralFeedback = () => (
    <View>
      <Text style={styles.label}>Your feedback:</Text>
      <TextInput
        style={[styles.textInput, styles.multilineInput]}
        value={generalMessage}
        onChangeText={setGeneralMessage}
        placeholder="Tell us what you think about the app..."
        multiline
        numberOfLines={4}
      />
      {renderRatingStars()}
    </View>
  );

  const renderBugReport = () => (
    <View>
      <Text style={styles.label}>Bug Title:</Text>
      <TextInput
        style={styles.textInput}
        value={bugTitle}
        onChangeText={setBugTitle}
        placeholder="Brief description of the bug"
      />

      <Text style={styles.label}>Description:</Text>
      <TextInput
        style={[styles.textInput, styles.multilineInput]}
        value={bugDescription}
        onChangeText={setBugDescription}
        placeholder="Detailed description of the issue"
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Steps to Reproduce (one per line):</Text>
      <TextInput
        style={[styles.textInput, styles.multilineInput]}
        value={bugSteps}
        onChangeText={setBugSteps}
        placeholder="1. Open the app&#10;2. Tap on tracking&#10;3. ..."
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Expected Behavior:</Text>
      <TextInput
        style={styles.textInput}
        value={expectedBehavior}
        onChangeText={setExpectedBehavior}
        placeholder="What should have happened?"
      />

      <Text style={styles.label}>Actual Behavior:</Text>
      <TextInput
        style={styles.textInput}
        value={actualBehavior}
        onChangeText={setActualBehavior}
        placeholder="What actually happened?"
      />

      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <Text style={styles.label}>Severity:</Text>
          <View style={styles.buttonGroup}>
            {(['low', 'medium', 'high', 'critical'] as const).map((severity) => (
              <TouchableOpacity
                key={severity}
                style={[
                  styles.optionButton,
                  bugSeverity === severity && styles.optionButtonSelected,
                ]}
                onPress={() => setBugSeverity(severity)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    bugSeverity === severity && styles.optionButtonTextSelected,
                  ]}
                >
                  {severity}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.halfWidth}>
          <Text style={styles.label}>Category:</Text>
          <View style={styles.buttonGroup}>
            {(['gps', 'camera', 'sync', 'ui', 'performance', 'other'] as const).map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.optionButton,
                  bugCategory === category && styles.optionButtonSelected,
                ]}
                onPress={() => setBugCategory(category)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    bugCategory === category && styles.optionButtonTextSelected,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  const renderFeatureRequest = () => (
    <View>
      <Text style={styles.label}>Feature Title:</Text>
      <TextInput
        style={styles.textInput}
        value={featureTitle}
        onChangeText={setFeatureTitle}
        placeholder="Brief description of the feature"
      />

      <Text style={styles.label}>Description:</Text>
      <TextInput
        style={[styles.textInput, styles.multilineInput]}
        value={featureDescription}
        onChangeText={setFeatureDescription}
        placeholder="Detailed description of the feature"
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Use Case:</Text>
      <TextInput
        style={[styles.textInput, styles.multilineInput]}
        value={featureUseCase}
        onChangeText={setFeatureUseCase}
        placeholder="How would this feature be used? What problem does it solve?"
        multiline
        numberOfLines={2}
      />

      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <Text style={styles.label}>Priority:</Text>
          <View style={styles.buttonGroup}>
            {(['low', 'medium', 'high'] as const).map((priority) => (
              <TouchableOpacity
                key={priority}
                style={[
                  styles.optionButton,
                  featurePriority === priority && styles.optionButtonSelected,
                ]}
                onPress={() => setFeaturePriority(priority)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    featurePriority === priority && styles.optionButtonTextSelected,
                  ]}
                >
                  {priority}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.halfWidth}>
          <Text style={styles.label}>Category:</Text>
          <View style={styles.buttonGroup}>
            {(['tracking', 'photos', 'sharing', 'ui', 'other'] as const).map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.optionButton,
                  featureCategory === category && styles.optionButtonSelected,
                ]}
                onPress={() => setFeatureCategory(category)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    featureCategory === category && styles.optionButtonTextSelected,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  const renderContactInfo = () => (
    <View style={styles.contactSection}>
      <Text style={styles.sectionTitle}>Contact Information (Optional)</Text>
      <Text style={styles.label}>Name:</Text>
      <TextInput
        style={styles.textInput}
        value={userName}
        onChangeText={setUserName}
        placeholder="Your name"
      />
      <Text style={styles.label}>Email:</Text>
      <TextInput
        style={styles.textInput}
        value={userEmail}
        onChangeText={setUserEmail}
        placeholder="your.email@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Feedback</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting}>
            <Text style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.typeSelector}>
            {(['general', 'bug', 'feature'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  feedbackType === type && styles.typeButtonSelected,
                ]}
                onPress={() => setFeedbackType(type)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    feedbackType === type && styles.typeButtonTextSelected,
                  ]}
                >
                  {type === 'general' ? 'General' : type === 'bug' ? 'Bug Report' : 'Feature Request'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {feedbackType === 'general' && renderGeneralFeedback()}
          {feedbackType === 'bug' && renderBugReport()}
          {feedbackType === 'feature' && renderFeatureRequest()}

          {renderContactInfo()}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingVertical: 12,
    backgroundColor: 'white',
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
    color: '#666',
  },
  submitButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  submitButtonDisabled: {
    color: '#ccc',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  typeButtonSelected: {
    backgroundColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextSelected: {
    color: 'white',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  ratingContainer: {
    marginTop: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  star: {
    marginRight: 8,
  },
  starText: {
    fontSize: 24,
    color: '#ddd',
  },
  starSelected: {
    color: '#FFD700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  halfWidth: {
    flex: 0.48,
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
  },
  optionButtonSelected: {
    backgroundColor: '#007AFF',
  },
  optionButtonText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  optionButtonTextSelected: {
    color: 'white',
  },
  contactSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
});