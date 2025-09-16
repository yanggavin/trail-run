import { analyticsService } from '../AnalyticsService';
import * as Amplitude from '@amplitude/analytics-react-native';

// Mock Amplitude
jest.mock('@amplitude/analytics-react-native', () => ({
  init: jest.fn(),
  track: jest.fn(),
  identify: jest.fn(),
  setUserId: jest.fn(),
  reset: jest.fn(),
}));

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize Amplitude with correct configuration', () => {
      const apiKey = 'test-api-key';
      
      analyticsService.init(apiKey, { enableDebug: true });

      expect(Amplitude.init).toHaveBeenCalledWith(
        apiKey,
        undefined,
        expect.objectContaining({
          logLevel: 1,
          trackingOptions: expect.objectContaining({
            ipAddress: false,
            platform: true,
            osName: true,
            osVersion: true,
            deviceModel: true,
            language: true,
            carrier: false,
          }),
        })
      );
    });

    it('should not reinitialize if already initialized', () => {
      const apiKey = 'test-api-key';
      
      analyticsService.init(apiKey);
      analyticsService.init(apiKey);

      expect(Amplitude.init).toHaveBeenCalledTimes(1);
    });
  });

  describe('setUserConsent', () => {
    beforeEach(() => {
      analyticsService.init('test-key');
    });

    it('should enable tracking when consent is given', () => {
      analyticsService.setUserConsent(true);
      analyticsService.trackEvent('test_event');

      expect(Amplitude.track).toHaveBeenCalledWith(
        'test_event',
        expect.objectContaining({
          platform: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });

    it('should queue events when consent is not given', () => {
      analyticsService.setUserConsent(false);
      analyticsService.trackEvent('test_event');

      expect(Amplitude.track).not.toHaveBeenCalled();
    });

    it('should process queued events when consent is given', () => {
      // Queue events without consent
      analyticsService.setUserConsent(false);
      analyticsService.trackEvent('queued_event_1');
      analyticsService.trackEvent('queued_event_2');

      expect(Amplitude.track).not.toHaveBeenCalled();

      // Give consent and check queued events are processed
      analyticsService.setUserConsent(true);

      expect(Amplitude.track).toHaveBeenCalledTimes(2);
      expect(Amplitude.track).toHaveBeenCalledWith(
        'queued_event_1',
        expect.any(Object)
      );
      expect(Amplitude.track).toHaveBeenCalledWith(
        'queued_event_2',
        expect.any(Object)
      );
    });
  });

  describe('identifyUser', () => {
    beforeEach(() => {
      analyticsService.init('test-key');
      analyticsService.setUserConsent(true);
    });

    it('should identify user with properties', () => {
      const userId = 'user123';
      const properties = {
        email: 'test@example.com',
        name: 'Test User',
        plan: 'premium',
        totalActivities: 50,
      };

      analyticsService.identifyUser(userId, properties);

      expect(Amplitude.setUserId).toHaveBeenCalledWith(userId);
      expect(Amplitude.identify).toHaveBeenCalledWith({
        user_id: userId,
        user_properties: expect.objectContaining({
          email: properties.email,
          name: properties.name,
          plan: properties.plan,
          total_activities: properties.totalActivities,
          platform: expect.any(String),
        }),
      });
    });

    it('should not identify user without consent', () => {
      analyticsService.setUserConsent(false);
      
      analyticsService.identifyUser('user123', { name: 'Test' });

      expect(Amplitude.setUserId).not.toHaveBeenCalled();
      expect(Amplitude.identify).not.toHaveBeenCalled();
    });
  });

  describe('tracking methods', () => {
    beforeEach(() => {
      analyticsService.init('test-key');
      analyticsService.setUserConsent(true);
    });

    it('should track app launched', () => {
      analyticsService.trackAppLaunched();

      expect(Amplitude.track).toHaveBeenCalledWith(
        'App Launched',
        expect.objectContaining({
          platform: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });

    it('should track tracking started', () => {
      analyticsService.trackTrackingStarted('running');

      expect(Amplitude.track).toHaveBeenCalledWith(
        'Tracking Started',
        expect.objectContaining({
          activity_type: 'running',
          timestamp: expect.any(String),
        })
      );
    });

    it('should track tracking stopped with metrics', () => {
      const duration = 3600; // 1 hour
      const distance = 5000; // 5km
      const accuracy = 8;

      analyticsService.trackTrackingStopped(duration, distance, accuracy);

      expect(Amplitude.track).toHaveBeenCalledWith(
        'Tracking Stopped',
        expect.objectContaining({
          duration_minutes: 60,
          distance_km: 5,
          avg_accuracy_meters: 8,
          timestamp: expect.any(String),
        })
      );
    });

    it('should track photo taken', () => {
      const location = { latitude: 37.7749, longitude: -122.4194 };

      analyticsService.trackPhotoTaken(location);

      expect(Amplitude.track).toHaveBeenCalledWith(
        'Photo Taken',
        expect.objectContaining({
          has_location: true,
          timestamp: expect.any(String),
        })
      );
    });

    it('should track activity saved', () => {
      analyticsService.trackActivitySaved('running', 3600, 5000);

      expect(Amplitude.track).toHaveBeenCalledWith(
        'Activity Saved',
        expect.objectContaining({
          activity_type: 'running',
          duration_minutes: 60,
          distance_km: 5,
        })
      );
    });

    it('should track performance issue', () => {
      analyticsService.trackPerformanceIssue('high_battery_usage', {
        usage_rate: 12.5,
        duration: 60,
      });

      expect(Amplitude.track).toHaveBeenCalledWith(
        'Performance Issue',
        expect.objectContaining({
          issue_type: 'high_battery_usage',
          usage_rate: 12.5,
          duration: 60,
        })
      );
    });

    it('should track battery usage with categorization', () => {
      analyticsService.trackBatteryUsage(8.5, 3600);

      expect(Amplitude.track).toHaveBeenCalledWith(
        'Battery Usage',
        expect.objectContaining({
          usage_rate_percent_per_hour: 8.5,
          duration_minutes: 60,
          usage_category: 'high',
        })
      );
    });

    it('should track GPS accuracy with categorization', () => {
      analyticsService.trackGpsAccuracy(12);

      expect(Amplitude.track).toHaveBeenCalledWith(
        'GPS Accuracy',
        expect.objectContaining({
          accuracy_meters: 12,
          accuracy_category: 'fair',
        })
      );
    });

    it('should track screen view', () => {
      analyticsService.trackScreenView('HomeScreen', 5000);

      expect(Amplitude.track).toHaveBeenCalledWith(
        'Screen View',
        expect.objectContaining({
          screen_name: 'HomeScreen',
          time_spent_seconds: 5,
        })
      );
    });

    it('should track A/B test assignment', () => {
      analyticsService.trackABTestAssignment('photo_quality', 'high_quality');

      expect(Amplitude.track).toHaveBeenCalledWith(
        'AB Test Assignment',
        expect.objectContaining({
          experiment_name: 'photo_quality',
          variant_name: 'high_quality',
        })
      );
    });

    it('should track sync events', () => {
      analyticsService.trackSyncCompleted('photos', 25, 5000);

      expect(Amplitude.track).toHaveBeenCalledWith(
        'Sync Completed',
        expect.objectContaining({
          sync_type: 'photos',
          item_count: 25,
          duration_seconds: 5,
        })
      );
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      analyticsService.init('test-key');
    });

    it('should reset analytics data', () => {
      analyticsService.reset();

      expect(Amplitude.reset).toHaveBeenCalled();
    });
  });

  describe('getUserConsentStatus', () => {
    it('should return current consent status', () => {
      analyticsService.init('test-key');
      analyticsService.setUserConsent(true);

      expect(analyticsService.getUserConsentStatus()).toBe(true);

      analyticsService.setUserConsent(false);

      expect(analyticsService.getUserConsentStatus()).toBe(false);
    });
  });
});