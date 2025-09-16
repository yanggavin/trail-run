import { analyticsService, EventProperties } from './AnalyticsService';
import { privacyService } from '../security/PrivacyService';

export interface PrivacyAnalyticsConfig {
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  enablePerformanceMonitoring: boolean;
  enablePersonalization: boolean;
  dataRetentionDays: number;
}

export interface ConsentStatus {
  analytics: boolean;
  crashReporting: boolean;
  performanceMonitoring: boolean;
  personalization: boolean;
  lastUpdated: string;
}

class PrivacyAnalyticsService {
  private consentStatus: ConsentStatus = {
    analytics: false,
    crashReporting: false,
    performanceMonitoring: false,
    personalization: false,
    lastUpdated: new Date().toISOString(),
  };

  private config: PrivacyAnalyticsConfig = {
    enableAnalytics: false,
    enableCrashReporting: false,
    enablePerformanceMonitoring: false,
    enablePersonalization: false,
    dataRetentionDays: 90,
  };

  /**
   * Initialize privacy-compliant analytics
   */
  async init(amplitudeApiKey: string): Promise<void> {
    // Load saved consent status
    await this.loadConsentStatus();

    // Initialize analytics service
    analyticsService.init(amplitudeApiKey, { enableDebug: __DEV__ });

    // Set user consent based on loaded status
    analyticsService.setUserConsent(this.consentStatus.analytics);

    // Track consent status (if analytics is enabled)
    if (this.consentStatus.analytics) {
      this.trackConsentStatus();
    }
  }

  /**
   * Update user consent for different types of tracking
   */
  async updateConsent(consent: Partial<ConsentStatus>): Promise<void> {
    const previousConsent = { ...this.consentStatus };
    
    this.consentStatus = {
      ...this.consentStatus,
      ...consent,
      lastUpdated: new Date().toISOString(),
    };

    // Save consent status
    await this.saveConsentStatus();

    // Update analytics service consent
    analyticsService.setUserConsent(this.consentStatus.analytics);

    // Track consent changes (if analytics was already enabled)
    if (previousConsent.analytics && this.consentStatus.analytics) {
      Object.keys(consent).forEach(key => {
        const consentKey = key as keyof ConsentStatus;
        if (consentKey !== 'lastUpdated' && previousConsent[consentKey] !== this.consentStatus[consentKey]) {
          analyticsService.trackPrivacySettingChanged(
            `consent_${key}`,
            this.consentStatus[consentKey]
          );
        }
      });
    }

    // Track initial consent if analytics just became enabled
    if (!previousConsent.analytics && this.consentStatus.analytics) {
      this.trackConsentStatus();
    }
  }

  /**
   * Get current consent status
   */
  getConsentStatus(): ConsentStatus {
    return { ...this.consentStatus };
  }

  /**
   * Check if a specific type of tracking is allowed
   */
  isTrackingAllowed(type: keyof ConsentStatus): boolean {
    if (type === 'lastUpdated') return false;
    return this.consentStatus[type];
  }

  /**
   * Track event with privacy checks
   */
  trackEvent(eventName: string, properties?: EventProperties, userId?: string): void {
    if (!this.consentStatus.analytics) {
      return;
    }

    // Filter out sensitive properties based on privacy settings
    const filteredProperties = this.filterSensitiveProperties(properties);
    
    analyticsService.trackEvent(eventName, filteredProperties, userId);
  }

  /**
   * Track performance event with privacy checks
   */
  trackPerformanceEvent(eventName: string, properties?: EventProperties): void {
    if (!this.consentStatus.performanceMonitoring) {
      return;
    }

    const filteredProperties = this.filterSensitiveProperties(properties);
    analyticsService.trackEvent(eventName, filteredProperties);
  }

  /**
   * Track user behavior for personalization
   */
  trackPersonalizationEvent(eventName: string, properties?: EventProperties): void {
    if (!this.consentStatus.personalization) {
      return;
    }

    const filteredProperties = this.filterSensitiveProperties(properties);
    analyticsService.trackEvent(eventName, filteredProperties);
  }

  /**
   * Identify user with privacy-compliant properties
   */
  identifyUser(userId: string, properties?: Record<string, any>): void {
    if (!this.consentStatus.analytics) {
      return;
    }

    // Filter out sensitive user properties
    const filteredProperties = this.filterSensitiveUserProperties(properties);
    
    analyticsService.identifyUser(userId, filteredProperties);
  }

  /**
   * Request data export (GDPR compliance)
   */
  async requestDataExport(userEmail: string): Promise<void> {
    analyticsService.trackDataExportRequested();
    
    // In a real implementation, this would trigger a data export process
    console.log(`Data export requested for ${userEmail}`);
  }

  /**
   * Request data deletion (GDPR compliance)
   */
  async requestDataDeletion(userId: string): Promise<void> {
    analyticsService.trackDataDeletionRequested();
    
    // Reset analytics data
    analyticsService.reset();
    
    // Clear local consent
    await this.clearConsentStatus();
    
    // In a real implementation, this would trigger server-side deletion
    console.log(`Data deletion requested for user ${userId}`);
  }

  /**
   * Get privacy policy compliance info
   */
  getPrivacyInfo(): {
    dataRetentionDays: number;
    dataTypes: string[];
    thirdPartyServices: string[];
  } {
    return {
      dataRetentionDays: this.config.dataRetentionDays,
      dataTypes: [
        'App usage events',
        'Performance metrics',
        'Crash reports',
        'Device information',
        'Location data (anonymized)',
      ],
      thirdPartyServices: [
        'Amplitude (Analytics)',
        'Sentry (Error Reporting)',
      ],
    };
  }

  /**
   * Show consent dialog (returns user choices)
   */
  async showConsentDialog(): Promise<ConsentStatus | null> {
    // This would typically show a native dialog or modal
    // For now, return a default consent object
    return {
      analytics: false,
      crashReporting: false,
      performanceMonitoring: false,
      personalization: false,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Load consent status from secure storage
   */
  private async loadConsentStatus(): Promise<void> {
    try {
      const settings = await privacyService.getPrivacySettings();
      
      this.consentStatus = {
        analytics: settings.allowAnalytics,
        crashReporting: settings.allowCrashReporting,
        performanceMonitoring: settings.allowPerformanceMonitoring,
        personalization: settings.allowPersonalization,
        lastUpdated: settings.lastUpdated || new Date().toISOString(),
      };
    } catch (error) {
      console.warn('Failed to load consent status:', error);
      // Use default (no consent)
    }
  }

  /**
   * Save consent status to secure storage
   */
  private async saveConsentStatus(): Promise<void> {
    try {
      await privacyService.updatePrivacySettings({
        allowAnalytics: this.consentStatus.analytics,
        allowCrashReporting: this.consentStatus.crashReporting,
        allowPerformanceMonitoring: this.consentStatus.performanceMonitoring,
        allowPersonalization: this.consentStatus.personalization,
        lastUpdated: this.consentStatus.lastUpdated,
      });
    } catch (error) {
      console.error('Failed to save consent status:', error);
    }
  }

  /**
   * Clear consent status from storage
   */
  private async clearConsentStatus(): Promise<void> {
    try {
      await privacyService.updatePrivacySettings({
        allowAnalytics: false,
        allowCrashReporting: false,
        allowPerformanceMonitoring: false,
        allowPersonalization: false,
        lastUpdated: new Date().toISOString(),
      });
      
      this.consentStatus = {
        analytics: false,
        crashReporting: false,
        performanceMonitoring: false,
        personalization: false,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to clear consent status:', error);
    }
  }

  /**
   * Track current consent status
   */
  private trackConsentStatus(): void {
    analyticsService.trackEvent('Privacy Consent Status', {
      analytics_consent: this.consentStatus.analytics,
      crash_reporting_consent: this.consentStatus.crashReporting,
      performance_monitoring_consent: this.consentStatus.performanceMonitoring,
      personalization_consent: this.consentStatus.personalization,
      consent_last_updated: this.consentStatus.lastUpdated,
    });
  }

  /**
   * Filter out sensitive properties from event data
   */
  private filterSensitiveProperties(properties?: EventProperties): EventProperties | undefined {
    if (!properties) return properties;

    const filtered = { ...properties };
    
    // Remove potentially sensitive data
    const sensitiveKeys = [
      'email',
      'phone',
      'name',
      'address',
      'precise_location',
      'ip_address',
      'device_id',
    ];

    sensitiveKeys.forEach(key => {
      delete filtered[key];
    });

    // Anonymize location data if present
    if (filtered.latitude && filtered.longitude) {
      // Round to ~1km precision for privacy
      filtered.latitude = Math.round(filtered.latitude * 100) / 100;
      filtered.longitude = Math.round(filtered.longitude * 100) / 100;
    }

    return filtered;
  }

  /**
   * Filter out sensitive user properties
   */
  private filterSensitiveUserProperties(properties?: Record<string, any>): Record<string, any> | undefined {
    if (!properties) return properties;

    const filtered = { ...properties };
    
    // Only include non-sensitive user properties
    const allowedKeys = [
      'plan',
      'signupDate',
      'totalActivities',
      'totalDistance',
      'preferredUnits',
      'privacyLevel',
    ];

    // Remove all keys except allowed ones
    Object.keys(filtered).forEach(key => {
      if (!allowedKeys.includes(key)) {
        delete filtered[key];
      }
    });

    return filtered;
  }
}

export const privacyAnalyticsService = new PrivacyAnalyticsService();