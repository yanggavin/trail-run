import { performanceMonitoringService } from '../PerformanceMonitoringService';
import { sentryService } from '../SentryService';

// Mock SentryService
jest.mock('../SentryService', () => ({
  sentryService: {
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    recordPerformanceMetrics: jest.fn(),
    startTransaction: jest.fn(() => ({
      setData: jest.fn(),
      setStatus: jest.fn(),
      finish: jest.fn(),
    })),
  },
}));

// Mock timers
jest.useFakeTimers();

describe('PerformanceMonitoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    performanceMonitoringService.stopMonitoring();
  });

  afterEach(() => {
    performanceMonitoringService.stopMonitoring();
  });

  describe('startMonitoring', () => {
    it('should start performance monitoring with default interval', () => {
      performanceMonitoringService.startMonitoring();

      expect(sentryService.addBreadcrumb).toHaveBeenCalledWith(
        'Performance monitoring started',
        'monitoring',
        'info'
      );
    });

    it('should start performance monitoring with custom interval', () => {
      const customInterval = 30000;
      performanceMonitoringService.startMonitoring(customInterval);

      expect(sentryService.addBreadcrumb).toHaveBeenCalledWith(
        'Performance monitoring started',
        'monitoring',
        'info'
      );
    });

    it('should not start monitoring if already monitoring', () => {
      performanceMonitoringService.startMonitoring();
      jest.clearAllMocks();
      
      performanceMonitoringService.startMonitoring();

      expect(sentryService.addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe('stopMonitoring', () => {
    it('should stop performance monitoring', () => {
      performanceMonitoringService.startMonitoring();
      jest.clearAllMocks();

      performanceMonitoringService.stopMonitoring();

      expect(sentryService.addBreadcrumb).toHaveBeenCalledWith(
        'Performance monitoring stopped',
        'monitoring',
        'info'
      );
    });

    it('should not stop monitoring if not monitoring', () => {
      performanceMonitoringService.stopMonitoring();

      expect(sentryService.addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe('recordGpsMetrics', () => {
    it('should record GPS metrics with good accuracy', () => {
      const metrics = {
        accuracy: 5,
        signalStrength: 80,
        satelliteCount: 8,
      };

      performanceMonitoringService.recordGpsMetrics(metrics);

      expect(sentryService.recordPerformanceMetrics).toHaveBeenCalledWith({
        gpsAccuracy: metrics.accuracy,
      });
      expect(sentryService.addBreadcrumb).toHaveBeenCalledWith(
        'GPS metrics: 5m accuracy',
        'gps',
        'info',
        metrics
      );
      expect(sentryService.captureMessage).not.toHaveBeenCalled();
    });

    it('should capture warning for poor GPS accuracy', () => {
      const metrics = {
        accuracy: 25,
        signalStrength: 30,
      };

      performanceMonitoringService.recordGpsMetrics(metrics);

      expect(sentryService.captureMessage).toHaveBeenCalledWith(
        'Poor GPS accuracy detected',
        'warning',
        expect.objectContaining({
          gps_metrics: metrics,
        })
      );
    });
  });

  describe('recordBatteryUsage', () => {
    it('should record normal battery usage', () => {
      const startLevel = 80;
      const endLevel = 75;
      const durationMinutes = 60;

      performanceMonitoringService.recordBatteryUsage(startLevel, endLevel, durationMinutes);

      expect(sentryService.recordPerformanceMetrics).toHaveBeenCalledWith({
        batteryLevel: endLevel,
      });
      expect(sentryService.addBreadcrumb).toHaveBeenCalledWith(
        expect.stringContaining('Battery usage: 5.0% over 60min'),
        'battery',
        'info',
        expect.any(Object)
      );
    });

    it('should capture warning for high battery usage', () => {
      const startLevel = 80;
      const endLevel = 65;
      const durationMinutes = 60;

      performanceMonitoringService.recordBatteryUsage(startLevel, endLevel, durationMinutes);

      expect(sentryService.captureMessage).toHaveBeenCalledWith(
        'High battery usage detected during tracking',
        'warning',
        expect.objectContaining({
          battery_usage_rate: 15,
          duration_minutes: durationMinutes,
        })
      );
    });
  });

  describe('recordAppLaunchTime', () => {
    it('should record normal app launch time', () => {
      const launchTime = 2000;
      performanceMonitoringService.recordAppLaunchTime(launchTime);

      expect(sentryService.startTransaction).toHaveBeenCalledWith('app_launch', 'navigation');
    });

    it('should capture warning for slow app launch', () => {
      const launchTime = 4000;
      performanceMonitoringService.recordAppLaunchTime(launchTime);

      expect(sentryService.captureMessage).toHaveBeenCalledWith(
        'Slow app launch detected',
        'warning',
        { launch_time_ms: launchTime }
      );
    });
  });

  describe('recordScreenNavigation', () => {
    it('should record normal screen navigation', () => {
      const screenName = 'HomeScreen';
      const navigationTime = 500;

      performanceMonitoringService.recordScreenNavigation(screenName, navigationTime);

      expect(sentryService.startTransaction).toHaveBeenCalledWith('screen_HomeScreen', 'navigation');
    });

    it('should mark slow navigation as deadline exceeded', () => {
      const screenName = 'CameraScreen';
      const navigationTime = 1500;

      performanceMonitoringService.recordScreenNavigation(screenName, navigationTime);

      expect(sentryService.startTransaction).toHaveBeenCalled();
    });
  });

  describe('recordDatabaseOperation', () => {
    it('should record normal database operation', () => {
      const operation = 'select_activities';
      const duration = 500;
      const recordCount = 10;

      performanceMonitoringService.recordDatabaseOperation(operation, duration, recordCount);

      expect(sentryService.startTransaction).toHaveBeenCalledWith('db_select_activities', 'db');
    });

    it('should capture warning for slow database operation', () => {
      const operation = 'insert_trackpoints';
      const duration = 2000;
      const recordCount = 100;

      performanceMonitoringService.recordDatabaseOperation(operation, duration, recordCount);

      expect(sentryService.captureMessage).toHaveBeenCalledWith(
        'Slow database operation: insert_trackpoints',
        'warning',
        {
          operation,
          duration_ms: duration,
          record_count: recordCount,
        }
      );
    });
  });
});