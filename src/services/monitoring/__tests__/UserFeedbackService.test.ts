import { userFeedbackService } from '../UserFeedbackService';
import { sentryService } from '../SentryService';

// Mock SentryService
jest.mock('../SentryService', () => ({
  sentryService: {
    submitUserFeedback: jest.fn(),
    captureMessage: jest.fn(),
    captureException: jest.fn(),
  },
}));

describe('UserFeedbackService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitBugReport', () => {
    it('should submit a bug report with all details', () => {
      const bugReport = {
        title: 'GPS not working',
        description: 'GPS tracking stops after 5 minutes',
        steps: ['Open app', 'Start tracking', 'Wait 5 minutes'],
        expectedBehavior: 'GPS should continue tracking',
        actualBehavior: 'GPS stops tracking',
        severity: 'high' as const,
        category: 'gps' as const,
        userEmail: 'user@example.com',
        userName: 'Test User',
        appVersion: '1.0.0',
      };

      userFeedbackService.submitBugReport(bugReport);

      expect(sentryService.submitUserFeedback).toHaveBeenCalledWith({
        message: expect.stringContaining('Bug Report: GPS not working'),
        email: 'user@example.com',
        name: 'Test User',
        tags: {
          type: 'bug_report',
          severity: 'high',
          category: 'gps',
          app_version: '1.0.0',
        },
      });

      expect(sentryService.captureMessage).toHaveBeenCalledWith(
        'Bug report: GPS not working',
        'error',
        expect.objectContaining({
          bug_report: {
            title: 'GPS not working',
            category: 'gps',
            severity: 'high',
            steps_count: 3,
          },
        })
      );
    });

    it('should format bug report message correctly', () => {
      const bugReport = {
        title: 'Camera crash',
        description: 'App crashes when taking photo',
        steps: ['Open camera', 'Tap capture button'],
        expectedBehavior: 'Photo should be taken',
        actualBehavior: 'App crashes',
        severity: 'critical' as const,
        category: 'camera' as const,
      };

      userFeedbackService.submitBugReport(bugReport);

      const feedbackCall = (sentryService.submitUserFeedback as jest.Mock).mock.calls[0][0];
      expect(feedbackCall.message).toContain('Bug Report: Camera crash');
      expect(feedbackCall.message).toContain('Description:\nApp crashes when taking photo');
      expect(feedbackCall.message).toContain('Steps to Reproduce:\n1. Open camera\n2. Tap capture button');
      expect(feedbackCall.message).toContain('Expected Behavior:\nPhoto should be taken');
      expect(feedbackCall.message).toContain('Actual Behavior:\nApp crashes');
    });
  });

  describe('submitFeatureRequest', () => {
    it('should submit a feature request with all details', () => {
      const featureRequest = {
        title: 'Dark mode support',
        description: 'Add dark mode theme to the app',
        useCase: 'Better visibility in low light conditions',
        priority: 'medium' as const,
        category: 'ui' as const,
        userEmail: 'user@example.com',
        userName: 'Test User',
      };

      userFeedbackService.submitFeatureRequest(featureRequest);

      expect(sentryService.submitUserFeedback).toHaveBeenCalledWith({
        message: expect.stringContaining('Feature Request: Dark mode support'),
        email: 'user@example.com',
        name: 'Test User',
        tags: {
          type: 'feature_request',
          priority: 'medium',
          category: 'ui',
        },
      });

      expect(sentryService.captureMessage).toHaveBeenCalledWith(
        'Feature request: Dark mode support',
        'info',
        expect.objectContaining({
          feature_request: {
            title: 'Dark mode support',
            category: 'ui',
            priority: 'medium',
          },
        })
      );
    });

    it('should format feature request message correctly', () => {
      const featureRequest = {
        title: 'Export to GPX',
        description: 'Allow exporting activities to GPX format',
        useCase: 'Share activities with other apps',
        priority: 'high' as const,
        category: 'sharing' as const,
      };

      userFeedbackService.submitFeatureRequest(featureRequest);

      const feedbackCall = (sentryService.submitUserFeedback as jest.Mock).mock.calls[0][0];
      expect(feedbackCall.message).toContain('Feature Request: Export to GPX');
      expect(feedbackCall.message).toContain('Description:\nAllow exporting activities to GPX format');
      expect(feedbackCall.message).toContain('Use Case:\nShare activities with other apps');
    });
  });

  describe('submitGeneralFeedback', () => {
    it('should submit general feedback with rating', () => {
      const message = 'Great app, love the GPS tracking!';
      const rating = 5;
      const userEmail = 'user@example.com';
      const userName = 'Test User';

      userFeedbackService.submitGeneralFeedback(message, rating, userEmail, userName);

      expect(sentryService.submitUserFeedback).toHaveBeenCalledWith({
        message: 'General feedback (Rating: 5/5): Great app, love the GPS tracking!',
        email: userEmail,
        name: userName,
        tags: {
          type: 'general_feedback',
          rating: '5',
        },
      });

      expect(sentryService.captureMessage).toHaveBeenCalledWith(
        'General feedback received',
        'info',
        expect.objectContaining({
          feedback: {
            rating: 5,
            message_length: message.length,
          },
        })
      );
    });

    it('should submit general feedback without rating', () => {
      const message = 'Could use some improvements';

      userFeedbackService.submitGeneralFeedback(message);

      expect(sentryService.submitUserFeedback).toHaveBeenCalledWith({
        message: 'General feedback: Could use some improvements',
        email: undefined,
        name: undefined,
        tags: {
          type: 'general_feedback',
        },
      });
    });
  });

  describe('reportPerformanceIssue', () => {
    it('should report performance issue with context', () => {
      const issue = 'App is very slow when loading activities';
      const context = {
        screen: 'HistoryScreen',
        action: 'load_activities',
        duration: 5000,
        batteryLevel: 30,
        memoryUsage: 0.8,
      };
      const userEmail = 'user@example.com';

      userFeedbackService.reportPerformanceIssue(issue, context, userEmail);

      expect(sentryService.submitUserFeedback).toHaveBeenCalledWith({
        message: 'Performance issue: App is very slow when loading activities',
        email: userEmail,
        tags: {
          type: 'performance_issue',
          screen: 'HistoryScreen',
          action: 'load_activities',
        },
      });

      expect(sentryService.captureMessage).toHaveBeenCalledWith(
        'Performance issue reported: App is very slow when loading activities',
        'warning',
        {
          performance_context: context,
        }
      );
    });
  });

  describe('reportCrash', () => {
    it('should report crash with user description', () => {
      const error = new Error('Null pointer exception');
      const userDescription = 'App crashed when I tried to save a photo';
      const userEmail = 'user@example.com';
      const userName = 'Test User';

      userFeedbackService.reportCrash(error, userDescription, userEmail, userName);

      expect(sentryService.submitUserFeedback).toHaveBeenCalledWith({
        message: 'Crash report: App crashed when I tried to save a photo',
        email: userEmail,
        name: userName,
        tags: {
          type: 'crash_report',
          error_name: 'Error',
        },
      });
    });

    it('should report crash without user description', () => {
      const error = new Error('Network error');

      userFeedbackService.reportCrash(error);

      expect(sentryService.submitUserFeedback).not.toHaveBeenCalled();
    });
  });

  describe('reportGpsIssue', () => {
    it('should report GPS accuracy issue', () => {
      const accuracy = 50;
      const description = 'GPS is very inaccurate in this area';
      const location = { latitude: 37.7749, longitude: -122.4194 };
      const userEmail = 'user@example.com';

      userFeedbackService.reportGpsIssue(accuracy, description, location, userEmail);

      expect(sentryService.submitUserFeedback).toHaveBeenCalledWith({
        message: 'GPS accuracy issue (50m): GPS is very inaccurate in this area',
        email: userEmail,
        tags: {
          type: 'gps_issue',
          accuracy_category: 'poor',
        },
      });

      expect(sentryService.captureMessage).toHaveBeenCalledWith(
        'GPS accuracy issue reported',
        'warning',
        expect.objectContaining({
          gps_issue: {
            accuracy: 50,
            description,
            location: '37.7749,-122.4194',
          },
        })
      );
    });
  });

  describe('reportBatteryIssue', () => {
    it('should report battery usage issue', () => {
      const batteryUsageRate = 12;
      const duration = 60;
      const description = 'Battery drains too fast during tracking';
      const userEmail = 'user@example.com';

      userFeedbackService.reportBatteryIssue(batteryUsageRate, duration, description, userEmail);

      expect(sentryService.submitUserFeedback).toHaveBeenCalledWith({
        message: 'Battery usage issue (12.0%/hr over 60min): Battery drains too fast during tracking',
        email: userEmail,
        tags: {
          type: 'battery_issue',
          usage_category: 'excessive',
        },
      });

      expect(sentryService.captureMessage).toHaveBeenCalledWith(
        'Battery usage issue reported',
        'warning',
        expect.objectContaining({
          battery_issue: {
            usage_rate: batteryUsageRate,
            duration,
            description,
          },
        })
      );
    });
  });

  describe('getDeviceInfo', () => {
    it('should return device information', async () => {
      const deviceInfo = await userFeedbackService.getDeviceInfo();

      expect(deviceInfo).toEqual({
        platform: expect.any(String),
        version: expect.any(String),
        model: expect.any(String),
        manufacturer: expect.any(String),
        totalMemory: expect.any(Number),
        freeMemory: expect.any(Number),
      });
    });
  });
});