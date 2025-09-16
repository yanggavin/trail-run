import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

interface TermsOfServiceModalProps {
  visible: boolean;
  onClose: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({
  visible,
  onClose,
}) => {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Terms of Service</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.lastUpdated}>Last updated: January 2025</Text>
          
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By using TrailRun, you agree to these Terms of Service. If you do not agree, please do not use the app.
          </Text>
          
          <Text style={styles.sectionTitle}>2. Description of Service</Text>
          <Text style={styles.paragraph}>
            TrailRun is a GPS tracking application for trail runners that records routes, captures geotagged photos, and generates activity summaries.
          </Text>
          
          <Text style={styles.sectionTitle}>3. User Responsibilities</Text>
          <Text style={styles.paragraph}>
            You are responsible for using the app safely and legally. Do not rely solely on the app for navigation in remote areas. Always carry appropriate safety equipment and inform others of your planned route.
          </Text>
          
          <Text style={styles.sectionTitle}>4. Privacy and Data</Text>
          <Text style={styles.paragraph}>
            Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your information.
          </Text>
          
          <Text style={styles.sectionTitle}>5. Accuracy Disclaimer</Text>
          <Text style={styles.paragraph}>
            GPS tracking accuracy may vary based on device capabilities, environmental conditions, and satellite availability. We do not guarantee the accuracy of distance, pace, or location data.
          </Text>
          
          <Text style={styles.sectionTitle}>6. Safety Notice</Text>
          <Text style={styles.paragraph}>
            Trail running involves inherent risks. Use appropriate safety precautions, inform others of your plans, and do not rely solely on the app for emergency situations.
          </Text>
          
          <Text style={styles.sectionTitle}>7. Intellectual Property</Text>
          <Text style={styles.paragraph}>
            The TrailRun app and its content are protected by copyright and other intellectual property laws. You retain ownership of your personal data and photos.
          </Text>
          
          <Text style={styles.sectionTitle}>8. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            TrailRun is provided "as is" without warranties. We are not liable for any damages arising from app use, including but not limited to GPS inaccuracies or data loss.
          </Text>
          
          <Text style={styles.sectionTitle}>9. Termination</Text>
          <Text style={styles.paragraph}>
            You may stop using the app at any time. We may suspend or terminate access for violations of these terms.
          </Text>
          
          <Text style={styles.sectionTitle}>10. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may update these terms periodically. Continued use of the app constitutes acceptance of updated terms.
          </Text>
          
          <Text style={styles.sectionTitle}>11. Contact Information</Text>
          <Text style={styles.paragraph}>
            For questions about these terms, contact us at legal@trailrun.app
          </Text>
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
  lastUpdated: {
    fontSize: 14,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
    marginBottom: 16,
  },
});