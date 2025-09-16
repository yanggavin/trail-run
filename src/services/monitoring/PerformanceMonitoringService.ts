import { Platform } from 'react-native';
import { sentryService, PerformanceMetrics } from './SentryService';

export interface BatteryInfo {
  level: number;
  isCharging: boolean;
  chargingTime?: number;
  dischargingTime?: number;
}

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface GpsMetrics {
  accuracy: number;
  signalStrength: number;
  satelliteCount?: number;
  timeToFirstFix?: number;
}

class PerformanceMonitoringService {
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private startTime = 0;
  private lastBatteryLevel = 0;

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.startTime = Date.now();
    this.lastBatteryLevel = 0;

    this.metricsCollectionInterval = setInterval(() => {
      this.collectAndReportMetrics();
    }, intervalMs);

    sentryService.addBreadcrumb('Performance monitoring started', 'monitoring', 'info');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }

    sentryService.addBreadcrumb('Performance monitoring stopped', 'monitoring', 'info');
  }

  /**
   * Collect and report current performance metrics
   */
  async collectAndReportMetrics(): Promise<void> {
    try {
      const metrics: PerformanceMetrics = {};

      // Collect battery info
      const batteryInfo = await this.getBatteryInfo();
      if (batteryInfo) {
        metrics.batteryLevel = batteryInfo.level;
      }

      // Collect memory info
      const memoryInfo = this.getMemoryInfo();
      if (memoryInfo) {
        metrics.memoryUsage = memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
      }

      // Report metrics to Sentry
      sentryService.recordPerformanceMetrics(metrics);

      // Check for performance issues
      this.checkPerformanceThresholds(metrics);

    } catch (error) {
      sentryService.captureException(error as Error, { context: 'performance_monitoring' });
    }
  }

  /**
   * Record GPS performance metrics
   */
  recordGpsMetrics(metrics: GpsMetrics): void {
    const performanceMetrics: PerformanceMetrics = {
      gpsAccuracy: metrics.accuracy,
    };

    sentryService.recordPerformanceMetrics(performanceMetrics);

    // Track GPS quality issues
    if (metrics.accuracy > 20) {
      sentryService.captureMessage(
        'Poor GPS accuracy detected',
        'warning',
        {
          gps_metrics: metrics,
          platform: Platform.OS,
        }
      );
    }

    sentryService.addBreadcrumb(
      `GPS metrics: ${metrics.accuracy}m accuracy`,
      'gps',
      'info',
      metrics
    );
  }

  /**
   * Record battery usage during tracking
   */
  recordBatteryUsage(startLevel: number, endLevel: number, durationMinutes: number): void {
    const batteryUsed = startLevel - endLevel;
    const batteryUsageRate = batteryUsed / (durationMinutes / 60); // per hour

    sentryService.recordPerformanceMetrics({
      batteryLevel: endLevel,
    });

    sentryService.addBreadcrumb(
      `Battery usage: ${batteryUsed.toFixed(1)}% over ${durationMinutes}min (${batteryUsageRate.toFixed(1)}%/hr)`,
      'battery',
      batteryUsageRate > 6 ? 'warning' : 'info',
      {
        startLevel,
        endLevel,
        batteryUsed,
        durationMinutes,
        batteryUsageRate,
      }
    );

    // Alert on excessive battery usage
    if (batteryUsageRate > 8) {
      sentryService.captureMessage(
        'High battery usage detected during tracking',
        'warning',
        {
          battery_usage_rate: batteryUsageRate,
          duration_minutes: durationMinutes,
          platform: Platform.OS,
        }
      );
    }
  }

  /**
   * Record app launch performance
   */
  recordAppLaunchTime(launchTime: number): void {
    const transaction = sentryService.startTransaction('app_launch', 'navigation');
    transaction.setData('launch_time_ms', launchTime);
    
    if (launchTime > 3000) {
      transaction.setStatus('deadline_exceeded');
      sentryService.captureMessage(
        'Slow app launch detected',
        'warning',
        { launch_time_ms: launchTime }
      );
    }
    
    transaction.finish();
  }

  /**
   * Record screen navigation performance
   */
  recordScreenNavigation(screenName: string, navigationTime: number): void {
    const transaction = sentryService.startTransaction(`screen_${screenName}`, 'navigation');
    transaction.setData('navigation_time_ms', navigationTime);
    
    if (navigationTime > 1000) {
      transaction.setStatus('deadline_exceeded');
    }
    
    transaction.finish();
  }

  /**
   * Record database operation performance
   */
  recordDatabaseOperation(operation: string, duration: number, recordCount?: number): void {
    const transaction = sentryService.startTransaction(`db_${operation}`, 'db');
    transaction.setData('duration_ms', duration);
    
    if (recordCount !== undefined) {
      transaction.setData('record_count', recordCount);
    }
    
    if (duration > 1000) {
      transaction.setStatus('deadline_exceeded');
      sentryService.captureMessage(
        `Slow database operation: ${operation}`,
        'warning',
        { operation, duration_ms: duration, record_count: recordCount }
      );
    }
    
    transaction.finish();
  }

  /**
   * Get battery information (mock implementation)
   */
  private async getBatteryInfo(): Promise<BatteryInfo | null> {
    try {
      // In a real implementation, this would use a native module
      // For now, return mock data
      return {
        level: Math.random() * 100,
        isCharging: Math.random() > 0.7,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get memory information
   */
  private getMemoryInfo(): MemoryInfo | null {
    try {
      // In React Native, memory info is limited
      // This is a mock implementation
      const mockMemory = {
        usedJSHeapSize: Math.random() * 100 * 1024 * 1024, // Random MB
        totalJSHeapSize: 200 * 1024 * 1024, // 200MB
        jsHeapSizeLimit: 500 * 1024 * 1024, // 500MB
      };
      
      return mockMemory;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check performance thresholds and alert on issues
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    // Check battery level
    if (metrics.batteryLevel !== undefined && metrics.batteryLevel < 15) {
      sentryService.captureMessage(
        'Low battery level detected',
        'warning',
        { battery_level: metrics.batteryLevel }
      );
    }

    // Check memory usage
    if (metrics.memoryUsage !== undefined && metrics.memoryUsage > 0.8) {
      sentryService.captureMessage(
        'High memory usage detected',
        'warning',
        { memory_usage: metrics.memoryUsage }
      );
    }

    // Check GPS accuracy
    if (metrics.gpsAccuracy !== undefined && metrics.gpsAccuracy > 50) {
      sentryService.captureMessage(
        'Very poor GPS accuracy detected',
        'error',
        { gps_accuracy: metrics.gpsAccuracy }
      );
    }
  }
}

export const performanceMonitoringService = new PerformanceMonitoringService();