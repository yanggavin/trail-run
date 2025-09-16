import { privacyAnalyticsService, ConsentStatus } from '../PrivacyAnalyticsService';
import { analyticsService } from '../AnalyticsService';
import { privacyService } from '../../security/PrivacyService';

// Mock dependencies
jest.mock('../AnalyticsService', () => ({
  analyticsService: {
    init: jest.fn(),
    setUserConsent: jest.fn(),
    trackEvent: jest.fn(),
    trackPrivacySettingChanged: jest.fn(),
    trackDataExportRequested: jest.fn(),
    trackDataDeletionRequested: jest.fn(),
    identifyUser: jest.fn(),
    reset: jest.fn(),
  },
}));

jest.mock('../../security/PrivacyService', () => ({
  privacyService: {
    getPrivacySettings: jest.fn(),
    updatePrivacySettings: jest.fn(),
  },
}));

describe('PrivacyAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset service state
    (privacyAnalyticsService as any).consentStatus = {
      analytics: false,
      crashReporting: false,
      performanceMonitoring: false,
      personalization: false,
      lastUpdated: new Date().toISOString(),
    };
  });

  describe('initialization', () => {
    it('should initialize with default consent (no consent)', async () => {
      (privacyService.getPrivacySettings as jest.Mock).mockResolvedValue({
        allowAnalytics: false,
        allowCrashReporting: false,
        allowPerformanceMonitoring: false,
        allowPersonalization: false,
      });

      await privacyAnalyticsService.init('test-api-key');

      expect(analyticsService.init).toHaveBeenCalledWith('test-api-key', { enableDebug: expect.any(Boolean) });
      expect(analyticsService.setUserConsent).toHaveBeenCalledWith(false);
      expect(privacyService.getPrivacySettings).toHaveBeenCalled();
    });

    it('should load existing consent status', async () => {
      const existingConsent = {
        allowAnalytics: true,
        allowCrashReporting: true,
        allowPerformanceMonitoring: false,
        allowPersonalization: true,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      (privacyService.getPrivacySettings as jest.Mock).mockResolvedValue(existingConsent);

      await privacyAnalyticsService.init('test-api-key');

      expect(analyticsService.setUserConsent).toHaveBeenCalledWith(true);
      expect(analyticsService.trackEvent).toHaveBeenCalledWith('Privacy Consent Status', expect.objectContaining({
        analytics_consent: true,
        crash_reporting_consent: true,
        performance_monitoring_consent: false,
        personalization_consent: true,
      }));
    });

    it('should handle failed consent loading gracefully', async () => {
      (privacyService.getPrivacySettings as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(privacyAnalyticsService.init('test-api-key')).resolves.not.toThrow();
      expect(analyticsService.setUserConsent).toHaveBeenCalledWith(false);
    });
  });

  describe('consent management', () => {
    it('should update consent status', async () => {
      const newConsent: Partial<ConsentStatus> = {
        analytics: true,
        crashReporting: true,
      };

      await privacyAnalyticsService.updateConsent(newConsent);

      const consentStatus = privacyAnalyticsService.getConsentStatus();
      expect(consentStatus.analytics).toBe(true);
      expect(consentStatus.crashReporting).toBe(true);
      expect(consentStatus.performanceMonitoring).toBe(false); // unchanged
      expect(consentStatus.personalization).toBe(false); // unchanged

      expect(privacyService.updatePrivacySettings).toHaveBeenCalledWith(expect.objectContaining({
        allowAnalytics: true,
        allowCrashReporting: true,
        allowPerformanceMonitoring: false,
        allowPersonalization: false,
      }));

      expect(analyticsService.setUserConsent).toHaveBeenCalledWith(true);
    });

    it('should track consent changes when analytics is enabled', async () => {
      // First enable analytics
      await privacyAnalyticsService.updateConsent({ analytics: true });
      jest.clearAllMocks();

      // Then change other consent settings
      await privacyAnalyticsService.updateConsent({ crashReporting: true });

      expect(analyticsService.trackPrivacySettingChanged).toHaveBeenCalledWith('consent_crashReporting', true);
    });

    it('should track initial consent status when analytics becomes enabled', async () => {
      await privacyAnalyticsService.updateConsent({ analytics: true });

      expect(analyticsService.trackEvent).toHaveBeenCalledWith('Privacy Consent Status', expect.objectContaining({
        analytics_consent: true,
      }));
    });

    it('should check tracking permissions correctly', () => {
      expect(privacyAnalyticsService.isTrackingAllowed('analytics')).toBe(false);
      expect(privacyAnalyticsService.isTrackingAllowed('lastUpdated')).toBe(false);
    });

    it('should handle consent saving errors gracefully', async () => {
      (privacyService.updatePrivacySettings as jest.Mock).mockRejectedValue(new Error('Save error'));

      await expect(privacyAnalyticsService.updateConsent({ analytics: true })).resolves.not.toThrow();
    });
  });

  describe('privacy-compliant tracking', () => {
    beforeEach(async () => {
      await privacyAnalyticsService.updateConsent({
        analytics: true,
        performanceMonitoring: true,
        personalization: true,
      });
      jest.clearAllMocks();
    });

    it('should track events when analytics consent is given', () => {
      const eventName = 'Test Event';
      const properties = { test_property: 'value' };

      privacyAnalyticsService.trackEvent(eventName, properties, 'user123');

      expect(analyticsService.trackEvent).toHaveBeenCalledWith(eventName, properties, 'user123');
    });

    it('should not track events when analytics consent is not given', async () => {
      await privacyAnalyticsService.updateConsent({ analytics: false });

      privacyAnalyticsService.trackEvent('Test Event', { test: 'value' });

      expect(analyticsService.trackEvent).not.toHaveBeenCalled();
    });

    it('should track performance events when performance monitoring consent is given', () => {
      const eventName = 'Performance Event';
      const properties = { duration: 100 };

      privacyAnalyticsService.trackPerformanceEvent(eventName, properties);

      expect(analyticsService.trackEvent).toHaveBeenCalledWith(eventName, properties);
    });

    it('should not track performance events when performance monitoring consent is not given', async () => {
      await privacyAnalyticsService.updateConsent({ performanceMonitoring: false });

      privacyAnalyticsService.trackPerformanceEvent('Performance Event', { duration: 100 });

      expect(analyticsService.trackEvent).not.toHaveBeenCalled();
    });

    it('should track personalization events when personalization consent is given', () => {
      const eventName = 'Personalization Event';
      const properties = { preference: 'dark_mode' };

      privacyAnalyticsService.trackPersonalizationEvent(eventName, properties);

      expect(analyticsService.trackEvent).toHaveBeenCalledWith(eventName, properties);
    });

    it('should not track personalization events when personalization consent is not given', async () => {
      await privacyAnalyticsService.updateConsent({ personalization: false });

      privacyAnalyticsService.trackPersonalizationEvent('Personalization Event', { preference: 'dark_mode' });

      expect(analyticsService.trackEvent).not.toHaveBeenCalled();
    });
  });

  describe('sensitive data filtering', () => {
    beforeEach(async () => {
      await privacyAnalyticsService.updateConsent({ analytics: true });
      jest.clearAllMocks();
    });

    it('should filter out sensitive properties from events', () => {
      const sensitiveProperties = {
        email: 'user@example.com',
        phone: '+1234567890',
        name: 'John Doe',
        address: '123 Main St',
        precise_location: 'exact coordinates',
        ip_address: '192.168.1.1',
        device_id: 'unique-device-id',
        safe_property: 'this should remain',
      };

      privacyAnalyticsService.trackEvent('Test Event', sensitiveProperties);

      expect(analyticsService.trackEvent).toHaveBeenCalledWith('Test Event', {
        safe_property: 'this should remain',
      });
    });

    it('should anonymize location data', () => {
      const propertiesWithLocation = {
        latitude: 37.7749295,
        longitude: -122.4194155,
        other_property: 'value',
      };

      privacyAnalyticsService.trackEvent('Location Event', propertiesWithLocation);

      expect(analyticsService.trackEvent).toHaveBeenCalledWith('Location Event', {
        latitude: 37.77, // Rounded to 2 decimal places
        longitude: -122.42, // Rounded to 2 decimal places
        other_property: 'value',
      });
    });

    it('should handle undefined properties gracefully', () => {
      privacyAnalyticsService.trackEvent('Test Event', undefined);

      expect(analyticsService.trackEvent).toHaveBeenCalledWith('Test Event', undefined);
    });
  });

  describe('user identification', () => {
    beforeEach(async () => {
      await privacyAnalyticsService.updateConsent({ analytics: true });
      jest.clearAllMocks();
    });

    it('should identify user with filtered properties', () => {
      const userProperties = {
        email: 'user@example.com', // Should be filtered
        name: 'John Doe', // Should be filtered
        plan: 'premium', // Should remain
        signupDate: '2024-01-01', // Should remain
        totalActivities: 50, // Should remain
        sensitiveData: 'secret', // Should be filtered
      };

      privacyAnalyticsService.identifyUser('user123', userProperties);

      expect(analyticsService.identifyUser).toHaveBeenCalledWith('user123', {
        plan: 'premium',
        signupDate: '2024-01-01',
        totalActivities: 50,
      });
    });

    it('should not identify user when analytics consent is not given', async () => {
      await privacyAnalyticsService.updateConsent({ analytics: false });

      privacyAnalyticsService.identifyUser('user123', { plan: 'premium' });

      expect(analyticsService.identifyUser).not.toHaveBeenCalled();
    });

    it('should handle undefined user properties', () => {
      privacyAnalyticsService.identifyUser('user123', undefined);

      expect(analyticsService.identifyUser).toHaveBeenCalledWith('user123', undefined);
    });
  });

  describe('GDPR compliance', () => {
    it('should handle data export request', async () => {
      await privacyAnalyticsService.requestDataExport('user@example.com');

      expect(analyticsService.trackDataExportRequested).toHaveBeenCalled();
    });

    it('should handle data deletion request', async () => {
      await privacyAnalyticsService.requestDataDeletion('user123');

      expect(analyticsService.trackDataDeletionRequested).toHaveBeenCalled();
      expect(analyticsService.reset).toHaveBeenCalled();
      expect(privacyService.updatePrivacySettings).toHaveBeenCalledWith(expect.objectContaining({
        allowAnalytics: false,
        allowCrashReporting: false,
        allowPerformanceMonitoring: false,
        allowPersonalization: false,
      }));
    });

    it('should handle data deletion storage errors gracefully', async () => {
      (privacyService.updatePrivacySettings as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(privacyAnalyticsService.requestDataDeletion('user123')).resolves.not.toThrow();
    });

    it('should provide privacy information', () => {
      const privacyInfo = privacyAnalyticsService.getPrivacyInfo();

      expect(privacyInfo).toHaveProperty('dataRetentionDays');
      expect(privacyInfo).toHaveProperty('dataTypes');
      expect(privacyInfo).toHaveProperty('thirdPartyServices');
      expect(Array.isArray(privacyInfo.dataTypes)).toBe(true);
      expect(Array.isArray(privacyInfo.thirdPartyServices)).toBe(true);
      expect(privacyInfo.dataTypes.length).toBeGreaterThan(0);
      expect(privacyInfo.thirdPartyServices.length).toBeGreaterThan(0);
    });
  });

  describe('consent dialog', () => {
    it('should return default consent status from dialog', async () => {
      const consentResult = await privacyAnalyticsService.showConsentDialog();

      expect(consentResult).not.toBeNull();
      expect(consentResult?.analytics).toBe(false);
      expect(consentResult?.crashReporting).toBe(false);
      expect(consentResult?.performanceMonitoring).toBe(false);
      expect(consentResult?.personalization).toBe(false);
      expect(consentResult?.lastUpdated).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple rapid consent updates', async () => {
      const updates = [
        { analytics: true },
        { crashReporting: true },
        { performanceMonitoring: true },
        { personalization: true },
      ];

      await Promise.all(updates.map(update => privacyAnalyticsService.updateConsent(update)));

      const finalConsent = privacyAnalyticsService.getConsentStatus();
      expect(finalConsent.analytics).toBe(true);
      expect(finalConsent.crashReporting).toBe(true);
      expect(finalConsent.performanceMonitoring).toBe(true);
      expect(finalConsent.personalization).toBe(true);
    });

    it('should handle empty consent updates', async () => {
      const initialConsent = privacyAnalyticsService.getConsentStatus();
      
      await privacyAnalyticsService.updateConsent({});
      
      const updatedConsent = privacyAnalyticsService.getConsentStatus();
      expect(updatedConsent.analytics).toBe(initialConsent.analytics);
      expect(updatedConsent.lastUpdated).not.toBe(initialConsent.lastUpdated);
    });

    it('should handle tracking with empty properties object', () => {
      privacyAnalyticsService.updateConsent({ analytics: true });
      
      privacyAnalyticsService.trackEvent('Test Event', {});

      expect(analyticsService.trackEvent).toHaveBeenCalledWith('Test Event', {});
    });
  });
});