import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

export interface PerformanceMetrics {
  batteryLevel?: number;
  gpsAccuracy?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  networkLatency?: number;
}

export interface UserFeedback {
  message: string;
  email?: string;
  name?: string;
  tags?: Record<string, string>;
}

class SentryService {
  private isInitialized = false;

  /**
   * Initialize Sentry with configuration
   */
  init(dsn: string, environment: string = 'development'): void {
    if (this.isInitialized) {
      return;
    }

    Sentry.init({
      dsn,
      environment,
      debug: __DEV__,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      enableNativeCrashHandling: true,
      enableAutoPerformanceTracing: true,
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      beforeSend: (event) => {
        // Filter out sensitive data
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }
        return event;
      },
      integrations: [
        // Add integrations as needed
      ],
    });

    this.isInitialized = true;
  }

  /**
   * Set user context for crash reports
   */
  setUser(userId: string, additionalData?: Record<string, any>): void {
    Sentry.setUser({
      id: userId,
      ...additionalData,
    });
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    Sentry.setUser(null);
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, category: string, level: Sentry.SeverityLevel = 'info', data?: any): void {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Capture exception with context
   */
  captureException(error: Error, context?: Record<string, any>): void {
    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  }

  /**
   * Capture message with level
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): void {
    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
        Sentry.captureMessage(message, level);
      });
    } else {
      Sentry.captureMessage(message, level);
    }
  }

  /**
   * Start performance transaction
   */
  startTransaction(name: string, operation: string): any {
    // Return a mock transaction object for compatibility
    return {
      setData: (key: string, value: any) => {
        // In a real implementation, this would set span data
        console.debug(`Transaction ${name}: ${key} = ${value}`);
      },
      setStatus: (status: string) => {
        // In a real implementation, this would set span status
        console.debug(`Transaction ${name}: status = ${status}`);
      },
      finish: () => {
        // In a real implementation, this would finish the span
        console.debug(`Transaction ${name}: finished`);
      },
    };
  }

  /**
   * Record performance metrics
   */
  recordPerformanceMetrics(metrics: PerformanceMetrics): void {
    Sentry.withScope((scope) => {
      scope.setContext('performance', {
        ...metrics,
        platform: Platform.OS,
        timestamp: Date.now(),
      });
      
      // Set tags for filtering
      if (metrics.batteryLevel !== undefined) {
        scope.setTag('battery_level', this.getBatteryLevelCategory(metrics.batteryLevel));
      }
      
      if (metrics.gpsAccuracy !== undefined) {
        scope.setTag('gps_accuracy', this.getGpsAccuracyCategory(metrics.gpsAccuracy));
      }

      Sentry.captureMessage('Performance metrics recorded', 'info');
    });
  }

  /**
   * Submit user feedback
   */
  submitUserFeedback(feedback: UserFeedback): void {
    // Use the newer feedback API
    Sentry.captureFeedback({
      name: feedback.name || 'Anonymous',
      email: feedback.email || 'no-email@example.com',
      message: feedback.message,
    });

    // Also capture as message for analytics
    Sentry.withScope((scope) => {
      if (feedback.tags) {
        Object.entries(feedback.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }
      scope.setTag('feedback_type', 'user_report');
      Sentry.captureMessage(`User feedback: ${feedback.message}`, 'info');
    });
  }

  /**
   * Track GPS tracking session
   */
  trackGpsSession(sessionId: string, duration: number, accuracy: number, batteryUsed: number): void {
    const transaction = this.startTransaction('gps_tracking_session', 'tracking');
    
    transaction.setData('session_id', sessionId);
    transaction.setData('duration_minutes', Math.round(duration / 60));
    transaction.setData('avg_accuracy_meters', accuracy);
    transaction.setData('battery_used_percent', batteryUsed);
    
    transaction.finish();

    this.addBreadcrumb(
      `GPS session completed: ${Math.round(duration / 60)}min, ${accuracy}m accuracy`,
      'tracking',
      'info',
      { sessionId, duration, accuracy, batteryUsed }
    );
  }

  /**
   * Track photo capture performance
   */
  trackPhotoCapture(captureTime: number, processingTime: number, fileSize: number): void {
    const transaction = this.startTransaction('photo_capture', 'camera');
    
    transaction.setData('capture_time_ms', captureTime);
    transaction.setData('processing_time_ms', processingTime);
    transaction.setData('file_size_kb', Math.round(fileSize / 1024));
    
    transaction.finish();
  }

  /**
   * Track sync operation performance
   */
  trackSyncOperation(operation: string, duration: number, itemCount: number, success: boolean): void {
    const transaction = this.startTransaction(`sync_${operation}`, 'sync');
    
    transaction.setData('duration_ms', duration);
    transaction.setData('item_count', itemCount);
    transaction.setData('success', success);
    
    if (!success) {
      transaction.setStatus('internal_error');
    }
    
    transaction.finish();
  }

  /**
   * Set custom tags for filtering
   */
  setTags(tags: Record<string, string>): void {
    Sentry.withScope((scope) => {
      Object.entries(tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    });
  }

  /**
   * Set custom context
   */
  setContext(key: string, context: Record<string, any>): void {
    Sentry.setContext(key, context);
  }

  private getBatteryLevelCategory(level: number): string {
    if (level >= 80) return 'high';
    if (level >= 50) return 'medium';
    if (level >= 20) return 'low';
    return 'critical';
  }

  private getGpsAccuracyCategory(accuracy: number): string {
    if (accuracy <= 5) return 'excellent';
    if (accuracy <= 10) return 'good';
    if (accuracy <= 20) return 'fair';
    return 'poor';
  }
}

export const sentryService = new SentryService();