import { sentryService, UserFeedback } from './SentryService';

export interface BugReport {
  title: string;
  description: string;
  steps: string[];
  expectedBehavior: string;
  actualBehavior: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'gps' | 'camera' | 'sync' | 'ui' | 'performance' | 'other';
  userEmail?: string;
  userName?: string;
  deviceInfo?: DeviceInfo;
  appVersion?: string;
}

export interface FeatureRequest {
  title: string;
  description: string;
  useCase: string;
  priority: 'low' | 'medium' | 'high';
  category: 'tracking' | 'photos' | 'sharing' | 'ui' | 'other';
  userEmail?: string;
  userName?: string;
}

export interface DeviceInfo {
  platform: string;
  version: string;
  model?: string;
  manufacturer?: string;
  totalMemory?: number;
  freeMemory?: number;
}

class UserFeedbackService {
  /**
   * Submit a bug report
   */
  submitBugReport(report: BugReport): void {
    const feedback: UserFeedback = {
      message: this.formatBugReport(report),
      email: report.userEmail,
      name: report.userName,
      tags: {
        type: 'bug_report',
        severity: report.severity,
        category: report.category,
        app_version: report.appVersion || 'unknown',
      },
    };

    sentryService.submitUserFeedback(feedback);

    // Also capture as a structured event for analytics
    sentryService.captureMessage(
      `Bug report: ${report.title}`,
      this.getSeverityLevel(report.severity),
      {
        bug_report: {
          title: report.title,
          category: report.category,
          severity: report.severity,
          steps_count: report.steps.length,
        },
        device_info: report.deviceInfo,
      }
    );
  }

  /**
   * Submit a feature request
   */
  submitFeatureRequest(request: FeatureRequest): void {
    const feedback: UserFeedback = {
      message: this.formatFeatureRequest(request),
      email: request.userEmail,
      name: request.userName,
      tags: {
        type: 'feature_request',
        priority: request.priority,
        category: request.category,
      },
    };

    sentryService.submitUserFeedback(feedback);

    // Capture for product analytics
    sentryService.captureMessage(
      `Feature request: ${request.title}`,
      'info',
      {
        feature_request: {
          title: request.title,
          category: request.category,
          priority: request.priority,
        },
      }
    );
  }

  /**
   * Submit general feedback
   */
  submitGeneralFeedback(
    message: string,
    rating?: number,
    userEmail?: string,
    userName?: string
  ): void {
    const feedback: UserFeedback = {
      message: `General feedback${rating ? ` (Rating: ${rating}/5)` : ''}: ${message}`,
      email: userEmail,
      name: userName,
      tags: {
        type: 'general_feedback',
        ...(rating && { rating: rating.toString() }),
      },
    };

    sentryService.submitUserFeedback(feedback);

    sentryService.captureMessage(
      'General feedback received',
      'info',
      {
        feedback: {
          rating,
          message_length: message.length,
        },
      }
    );
  }

  /**
   * Report a performance issue
   */
  reportPerformanceIssue(
    issue: string,
    context: {
      screen?: string;
      action?: string;
      duration?: number;
      batteryLevel?: number;
      memoryUsage?: number;
    },
    userEmail?: string
  ): void {
    const feedback: UserFeedback = {
      message: `Performance issue: ${issue}`,
      email: userEmail,
      tags: {
        type: 'performance_issue',
        screen: context.screen || 'unknown',
        action: context.action || 'unknown',
      },
    };

    sentryService.submitUserFeedback(feedback);

    sentryService.captureMessage(
      `Performance issue reported: ${issue}`,
      'warning',
      {
        performance_context: context,
      }
    );
  }

  /**
   * Report a crash with user context
   */
  reportCrash(
    error: Error,
    userDescription?: string,
    userEmail?: string,
    userName?: string
  ): void {
    if (userDescription) {
      const feedback: UserFeedback = {
        message: `Crash report: ${userDescription}`,
        email: userEmail,
        name: userName,
        tags: {
          type: 'crash_report',
          error_name: error.name,
        },
      };

      sentryService.submitUserFeedback(feedback);
    }

    // Capture the actual error
    sentryService.captureException(error, {
      user_reported: true,
      user_description: userDescription,
    });
  }

  /**
   * Submit feedback about GPS accuracy issues
   */
  reportGpsIssue(
    accuracy: number,
    description: string,
    location?: { latitude: number; longitude: number },
    userEmail?: string
  ): void {
    const feedback: UserFeedback = {
      message: `GPS accuracy issue (${accuracy}m): ${description}`,
      email: userEmail,
      tags: {
        type: 'gps_issue',
        accuracy_category: this.getAccuracyCategory(accuracy),
      },
    };

    sentryService.submitUserFeedback(feedback);

    sentryService.captureMessage(
      'GPS accuracy issue reported',
      'warning',
      {
        gps_issue: {
          accuracy,
          description,
          location: location ? `${location.latitude},${location.longitude}` : undefined,
        },
      }
    );
  }

  /**
   * Submit feedback about battery usage
   */
  reportBatteryIssue(
    batteryUsageRate: number,
    duration: number,
    description: string,
    userEmail?: string
  ): void {
    const feedback: UserFeedback = {
      message: `Battery usage issue (${batteryUsageRate.toFixed(1)}%/hr over ${duration}min): ${description}`,
      email: userEmail,
      tags: {
        type: 'battery_issue',
        usage_category: this.getBatteryUsageCategory(batteryUsageRate),
      },
    };

    sentryService.submitUserFeedback(feedback);

    sentryService.captureMessage(
      'Battery usage issue reported',
      'warning',
      {
        battery_issue: {
          usage_rate: batteryUsageRate,
          duration,
          description,
        },
      }
    );
  }

  /**
   * Get current device information
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    // This would typically use react-native-device-info
    // For now, return mock data
    return {
      platform: 'ios', // or 'android'
      version: '17.0',
      model: 'iPhone 14',
      manufacturer: 'Apple',
      totalMemory: 6 * 1024 * 1024 * 1024, // 6GB
      freeMemory: 2 * 1024 * 1024 * 1024, // 2GB
    };
  }

  private formatBugReport(report: BugReport): string {
    return `
Bug Report: ${report.title}

Description:
${report.description}

Steps to Reproduce:
${report.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Expected Behavior:
${report.expectedBehavior}

Actual Behavior:
${report.actualBehavior}

Severity: ${report.severity}
Category: ${report.category}

${report.deviceInfo ? `Device Info:
Platform: ${report.deviceInfo.platform} ${report.deviceInfo.version}
Model: ${report.deviceInfo.model || 'Unknown'}
Memory: ${report.deviceInfo.freeMemory ? Math.round(report.deviceInfo.freeMemory / (1024 * 1024 * 1024)) : 'Unknown'}GB free` : ''}
    `.trim();
  }

  private formatFeatureRequest(request: FeatureRequest): string {
    return `
Feature Request: ${request.title}

Description:
${request.description}

Use Case:
${request.useCase}

Priority: ${request.priority}
Category: ${request.category}
    `.trim();
  }

  private getSeverityLevel(severity: string): 'error' | 'warning' | 'info' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  }

  private getAccuracyCategory(accuracy: number): string {
    if (accuracy <= 5) return 'excellent';
    if (accuracy <= 10) return 'good';
    if (accuracy <= 20) return 'fair';
    return 'poor';
  }

  private getBatteryUsageCategory(usageRate: number): string {
    if (usageRate <= 3) return 'low';
    if (usageRate <= 6) return 'normal';
    if (usageRate <= 10) return 'high';
    return 'excessive';
  }
}

export const userFeedbackService = new UserFeedbackService();