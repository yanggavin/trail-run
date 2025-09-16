import { sentryService } from '../SentryService';
import * as Sentry from '@sentry/react-native';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  captureFeedback: jest.fn(),
  startSpan: jest.fn((config, callback) => {
    const mockSpan = {
      setData: jest.fn(),
      setStatus: jest.fn(),
    };
    return callback(mockSpan);
  }),
  withScope: jest.fn((callback) => {
    const scope = {
      setContext: jest.fn(),
      setTag: jest.fn(),
      getUser: jest.fn(() => ({ id: 'test-user' })),
    };
    callback(scope);
  }),
  getCurrentHub: jest.fn(() => ({
    getScope: jest.fn(() => ({
      getUser: jest.fn(() => ({ id: 'test-user', username: 'testuser' })),
    })),
  })),
  lastEventId: jest.fn(() => 'test-event-id'),
  ReactNativeTracing: jest.fn(),
  ReactNavigationInstrumentation: jest.fn(),
  SeverityLevel: {
    Info: 'info',
    Warning: 'warning',
    Error: 'error',
  },
}));

describe('SentryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize Sentry with correct configuration', () => {
      const dsn = 'https://test@sentry.io/123';
      const environment = 'test';

      sentryService.init(dsn, environment);

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn,
          environment,
          debug: expect.any(Boolean),
          enableAutoSessionTracking: true,
          sessionTrackingIntervalMillis: 30000,
          enableNativeCrashHandling: true,
          enableAutoPerformanceTracing: true,
          tracesSampleRate: expect.any(Number),
          beforeSend: expect.any(Function),
          integrations: expect.any(Array),
        })
      );
    });

    it('should not reinitialize if already initialized', () => {
      const dsn = 'https://test@sentry.io/123';
      
      sentryService.init(dsn);
      sentryService.init(dsn);

      expect(Sentry.init).toHaveBeenCalledTimes(1);
    });
  });

  describe('setUser', () => {
    it('should set user context', () => {
      const userId = 'user123';
      const additionalData = { email: 'test@example.com' };

      sentryService.setUser(userId, additionalData);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: userId,
        ...additionalData,
      });
    });
  });

  describe('clearUser', () => {
    it('should clear user context', () => {
      sentryService.clearUser();

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe('addBreadcrumb', () => {
    it('should add breadcrumb with correct parameters', () => {
      const message = 'Test breadcrumb';
      const category = 'test';
      const level = 'info' as const;
      const data = { key: 'value' };

      sentryService.addBreadcrumb(message, category, level, data);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message,
        category,
        level,
        data,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('captureException', () => {
    it('should capture exception without context', () => {
      const error = new Error('Test error');

      sentryService.captureException(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should capture exception with context', () => {
      const error = new Error('Test error');
      const context = { screen: 'HomeScreen' };

      sentryService.captureException(error, context);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
  });

  describe('recordPerformanceMetrics', () => {
    it('should record performance metrics with context', () => {
      const metrics = {
        batteryLevel: 75,
        gpsAccuracy: 5,
        memoryUsage: 0.6,
      };

      sentryService.recordPerformanceMetrics(metrics);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Performance metrics recorded',
        'info'
      );
    });
  });

  describe('submitUserFeedback', () => {
    it('should submit user feedback', () => {
      const feedback = {
        message: 'Great app!',
        email: 'user@example.com',
        name: 'Test User',
      };

      sentryService.submitUserFeedback(feedback);

      expect(Sentry.captureFeedback).toHaveBeenCalledWith({
        name: feedback.name,
        email: feedback.email,
        message: feedback.message,
      });
    });
  });

  describe('trackGpsSession', () => {
    it('should track GPS session with span', () => {
      const sessionId = 'session123';
      const duration = 3600; // 1 hour
      const accuracy = 5;
      const batteryUsed = 10;

      sentryService.trackGpsSession(sessionId, duration, accuracy, batteryUsed);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'gps_tracking_session',
          op: 'tracking',
        }),
        expect.any(Function)
      );
    });
  });

  describe('trackPhotoCapture', () => {
    it('should track photo capture performance', () => {
      const captureTime = 500;
      const processingTime = 1000;
      const fileSize = 2048000; // 2MB

      sentryService.trackPhotoCapture(captureTime, processingTime, fileSize);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'photo_capture',
          op: 'camera',
        }),
        expect.any(Function)
      );
    });
  });

  describe('trackSyncOperation', () => {
    it('should track successful sync operation', () => {
      const operation = 'upload_photos';
      const duration = 2000;
      const itemCount = 5;
      const success = true;

      sentryService.trackSyncOperation(operation, duration, itemCount, success);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'sync_upload_photos',
          op: 'sync',
        }),
        expect.any(Function)
      );
    });

    it('should track failed sync operation', () => {
      const operation = 'upload_photos';
      const duration = 2000;
      const itemCount = 5;
      const success = false;

      sentryService.trackSyncOperation(operation, duration, itemCount, success);

      expect(Sentry.startSpan).toHaveBeenCalled();
    });
  });
});