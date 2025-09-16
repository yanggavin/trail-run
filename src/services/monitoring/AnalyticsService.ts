import { init, track, identify, setUserId, reset } from '@amplitude/analytics-react-native';
import { Platform } from 'react-native';

export interface UserProperties {
  userId?: string;
  email?: string;
  name?: string;
  plan?: string;
  signupDate?: string;
  totalActivities?: number;
  totalDistance?: number;
  preferredUnits?: 'metric' | 'imperial';
  privacyLevel?: 'public' | 'friends' | 'private';
}

export interface EventProperties {
  [key: string]: any;
}

export interface TrackingEvent {
  eventName: string;
  properties?: EventProperties;
  userId?: string;
}

export interface ABTestVariant {
  experimentName: string;
  variantName: string;
  userId?: string;
}

class AnalyticsService {
  private isInitialized = false;
  private hasUserConsent = false;
  private queuedEvents: TrackingEvent[] = [];

  /**
   * Initialize analytics with API key
   */
  init(apiKey: string, options?: { enableDebug?: boolean }): void {
    if (this.isInitialized) {
      return;
    }

    init(apiKey, undefined, {
      logLevel: options?.enableDebug ? 1 : 0, // 0 = None, 1 = Error, 2 = Warn, 3 = Log
      trackingOptions: {
        ipAddress: false, // Don't track IP for privacy
        platform: true,
        osName: true,
        osVersion: true,
        deviceModel: true,
        language: true,
        carrier: false, // Don't track carrier for privacy
      },
    });

    this.isInitialized = true;
  }

  /**
   * Set user consent for analytics tracking
   */
  setUserConsent(hasConsent: boolean): void {
    this.hasUserConsent = hasConsent;

    if (hasConsent && this.queuedEvents.length > 0) {
      // Process queued events
      this.queuedEvents.forEach(event => {
        this.trackEventInternal(event.eventName, event.properties, event.userId);
      });
      this.queuedEvents = [];
    } else if (!hasConsent) {
      // Clear any existing user data
      this.reset();
    }
  }

  /**
   * Identify user with properties
   */
  identifyUser(userId: string, properties?: UserProperties): void {
    if (!this.hasUserConsent || !this.isInitialized) {
      return;
    }

    setUserId(userId);
    
    if (properties) {
      identify({
        user_properties: {
          email: properties.email,
          name: properties.name,
          plan: properties.plan,
          signup_date: properties.signupDate,
          total_activities: properties.totalActivities,
          total_distance: properties.totalDistance,
          preferred_units: properties.preferredUnits,
          privacy_level: properties.privacyLevel,
          platform: Platform.OS,
        },
      });
    }
  }

  /**
   * Track an event
   */
  trackEvent(eventName: string, properties?: EventProperties, userId?: string): void {
    if (!this.isInitialized) {
      console.warn('Analytics not initialized');
      return;
    }

    if (!this.hasUserConsent) {
      // Queue event for later if user hasn't given consent yet
      this.queuedEvents.push({ eventName, properties, userId });
      return;
    }

    this.trackEventInternal(eventName, properties, userId);
  }

  /**
   * Track app lifecycle events
   */
  trackAppLaunched(): void {
    this.trackEvent('App Launched', {
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    });
  }

  trackAppBackgrounded(): void {
    this.trackEvent('App Backgrounded', {
      timestamp: new Date().toISOString(),
    });
  }

  trackAppForegrounded(): void {
    this.trackEvent('App Foregrounded', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track GPS tracking events
   */
  trackTrackingStarted(activityType?: string): void {
    this.trackEvent('Tracking Started', {
      activity_type: activityType || 'unknown',
      timestamp: new Date().toISOString(),
    });
  }

  trackTrackingStopped(duration: number, distance: number, accuracy: number): void {
    this.trackEvent('Tracking Stopped', {
      duration_minutes: Math.round(duration / 60),
      distance_km: Math.round(distance / 1000 * 100) / 100,
      avg_accuracy_meters: Math.round(accuracy),
      timestamp: new Date().toISOString(),
    });
  }

  trackTrackingPaused(): void {
    this.trackEvent('Tracking Paused');
  }

  trackTrackingResumed(): void {
    this.trackEvent('Tracking Resumed');
  }

  /**
   * Track photo events
   */
  trackPhotoTaken(location?: { latitude: number; longitude: number }): void {
    this.trackEvent('Photo Taken', {
      has_location: !!location,
      timestamp: new Date().toISOString(),
    });
  }

  trackPhotoDeleted(): void {
    this.trackEvent('Photo Deleted');
  }

  trackPhotoShared(method: string): void {
    this.trackEvent('Photo Shared', {
      share_method: method,
    });
  }

  /**
   * Track activity events
   */
  trackActivitySaved(activityType: string, duration: number, distance: number): void {
    this.trackEvent('Activity Saved', {
      activity_type: activityType,
      duration_minutes: Math.round(duration / 60),
      distance_km: Math.round(distance / 1000 * 100) / 100,
    });
  }

  trackActivityShared(method: string): void {
    this.trackEvent('Activity Shared', {
      share_method: method,
    });
  }

  trackActivityDeleted(): void {
    this.trackEvent('Activity Deleted');
  }

  /**
   * Track performance events
   */
  trackPerformanceIssue(issueType: string, details: EventProperties): void {
    this.trackEvent('Performance Issue', {
      issue_type: issueType,
      ...details,
    });
  }

  trackBatteryUsage(usageRate: number, duration: number): void {
    this.trackEvent('Battery Usage', {
      usage_rate_percent_per_hour: Math.round(usageRate * 100) / 100,
      duration_minutes: Math.round(duration / 60),
      usage_category: this.getBatteryUsageCategory(usageRate),
    });
  }

  trackGpsAccuracy(accuracy: number): void {
    this.trackEvent('GPS Accuracy', {
      accuracy_meters: Math.round(accuracy),
      accuracy_category: this.getAccuracyCategory(accuracy),
    });
  }

  /**
   * Track user engagement
   */
  trackScreenView(screenName: string, timeSpent?: number): void {
    this.trackEvent('Screen View', {
      screen_name: screenName,
      time_spent_seconds: timeSpent ? Math.round(timeSpent / 1000) : undefined,
    });
  }

  trackFeatureUsed(featureName: string, context?: EventProperties): void {
    this.trackEvent('Feature Used', {
      feature_name: featureName,
      ...context,
    });
  }

  trackUserFeedback(feedbackType: string, rating?: number): void {
    this.trackEvent('User Feedback', {
      feedback_type: feedbackType,
      rating,
    });
  }

  /**
   * Track A/B test events
   */
  trackABTestAssignment(experimentName: string, variantName: string): void {
    this.trackEvent('AB Test Assignment', {
      experiment_name: experimentName,
      variant_name: variantName,
    });
  }

  trackABTestConversion(experimentName: string, variantName: string, conversionType: string): void {
    this.trackEvent('AB Test Conversion', {
      experiment_name: experimentName,
      variant_name: variantName,
      conversion_type: conversionType,
    });
  }

  /**
   * Track privacy and security events
   */
  trackPrivacySettingChanged(setting: string, value: any): void {
    this.trackEvent('Privacy Setting Changed', {
      setting_name: setting,
      setting_value: value,
    });
  }

  trackDataExportRequested(): void {
    this.trackEvent('Data Export Requested');
  }

  trackDataDeletionRequested(): void {
    this.trackEvent('Data Deletion Requested');
  }

  /**
   * Track sync events
   */
  trackSyncStarted(syncType: string): void {
    this.trackEvent('Sync Started', {
      sync_type: syncType,
    });
  }

  trackSyncCompleted(syncType: string, itemCount: number, duration: number): void {
    this.trackEvent('Sync Completed', {
      sync_type: syncType,
      item_count: itemCount,
      duration_seconds: Math.round(duration / 1000),
    });
  }

  trackSyncFailed(syncType: string, errorType: string): void {
    this.trackEvent('Sync Failed', {
      sync_type: syncType,
      error_type: errorType,
    });
  }

  /**
   * Reset analytics (clear user data)
   */
  reset(): void {
    if (!this.isInitialized) {
      return;
    }

    reset();
    this.queuedEvents = [];
  }

  /**
   * Get current user consent status
   */
  getUserConsentStatus(): boolean {
    return this.hasUserConsent;
  }

  /**
   * Internal method to actually track events
   */
  private trackEventInternal(eventName: string, properties?: EventProperties, userId?: string): void {
    const eventProperties = {
      ...properties,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    };

    if (userId) {
      track(eventName, eventProperties, { user_id: userId });
    } else {
      track(eventName, eventProperties);
    }
  }

  private getBatteryUsageCategory(usageRate: number): string {
    if (usageRate <= 3) return 'low';
    if (usageRate <= 6) return 'normal';
    if (usageRate <= 10) return 'high';
    return 'excessive';
  }

  private getAccuracyCategory(accuracy: number): string {
    if (accuracy <= 5) return 'excellent';
    if (accuracy <= 10) return 'good';
    if (accuracy <= 20) return 'fair';
    return 'poor';
  }
}

export const analyticsService = new AnalyticsService();