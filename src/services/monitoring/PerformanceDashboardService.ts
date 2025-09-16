import { analyticsService } from './AnalyticsService';
import { performanceMonitoringService } from './PerformanceMonitoringService';

export interface PerformanceDashboardData {
  gpsAccuracy: GPSAccuracyMetrics;
  batteryUsage: BatteryUsageMetrics;
  appPerformance: AppPerformanceMetrics;
  userEngagement: UserEngagementMetrics;
  errorRates: ErrorRateMetrics;
}

export interface GPSAccuracyMetrics {
  averageAccuracy: number;
  accuracyDistribution: {
    excellent: number; // ≤5m
    good: number;      // 5-10m
    fair: number;      // 10-20m
    poor: number;      // >20m
  };
  timeToFirstFix: number;
  signalLossEvents: number;
  lastUpdated: string;
}

export interface BatteryUsageMetrics {
  averageUsageRate: number; // %/hour
  usageDistribution: {
    low: number;       // ≤3%/hr
    normal: number;    // 3-6%/hr
    high: number;      // 6-10%/hr
    excessive: number; // >10%/hr
  };
  trackingDuration: number; // average minutes per session
  batteryOptimizationScore: number; // 0-100
  lastUpdated: string;
}

export interface AppPerformanceMetrics {
  averageLaunchTime: number;
  crashRate: number;
  memoryUsage: {
    average: number;
    peak: number;
  };
  screenNavigationTimes: {
    [screenName: string]: number;
  };
  databasePerformance: {
    averageQueryTime: number;
    slowQueries: number;
  };
  lastUpdated: string;
}

export interface UserEngagementMetrics {
  dailyActiveUsers: number;
  averageSessionDuration: number;
  featureUsage: {
    [featureName: string]: number;
  };
  retentionRate: {
    day1: number;
    day7: number;
    day30: number;
  };
  lastUpdated: string;
}

export interface ErrorRateMetrics {
  totalErrors: number;
  errorsByType: {
    [errorType: string]: number;
  };
  errorsByScreen: {
    [screenName: string]: number;
  };
  criticalErrors: number;
  lastUpdated: string;
}

export interface PerformanceAlert {
  id: string;
  type: 'gps' | 'battery' | 'performance' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: string;
  acknowledged: boolean;
}

class PerformanceDashboardService {
  private metricsCache: PerformanceDashboardData | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private alerts: PerformanceAlert[] = [];

  /**
   * Get comprehensive performance dashboard data
   */
  async getDashboardData(forceRefresh: boolean = false): Promise<PerformanceDashboardData> {
    const now = Date.now();
    
    if (!forceRefresh && this.metricsCache && now < this.cacheExpiry) {
      return this.metricsCache;
    }

    const dashboardData: PerformanceDashboardData = {
      gpsAccuracy: await this.getGPSAccuracyMetrics(),
      batteryUsage: await this.getBatteryUsageMetrics(),
      appPerformance: await this.getAppPerformanceMetrics(),
      userEngagement: await this.getUserEngagementMetrics(),
      errorRates: await this.getErrorRateMetrics(),
    };

    // Cache the data
    this.metricsCache = dashboardData;
    this.cacheExpiry = now + this.CACHE_DURATION;

    // Check for performance alerts
    this.checkPerformanceAlerts(dashboardData);

    return dashboardData;
  }

  /**
   * Get GPS accuracy metrics
   */
  private async getGPSAccuracyMetrics(): Promise<GPSAccuracyMetrics> {
    // In a real implementation, this would query stored metrics
    // For now, return mock data
    return {
      averageAccuracy: 8.5,
      accuracyDistribution: {
        excellent: 35, // 35% of readings ≤5m
        good: 40,      // 40% of readings 5-10m
        fair: 20,      // 20% of readings 10-20m
        poor: 5,       // 5% of readings >20m
      },
      timeToFirstFix: 12.3, // seconds
      signalLossEvents: 3,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get battery usage metrics
   */
  private async getBatteryUsageMetrics(): Promise<BatteryUsageMetrics> {
    return {
      averageUsageRate: 5.2, // %/hour
      usageDistribution: {
        low: 25,       // 25% of sessions ≤3%/hr
        normal: 50,    // 50% of sessions 3-6%/hr
        high: 20,      // 20% of sessions 6-10%/hr
        excessive: 5,  // 5% of sessions >10%/hr
      },
      trackingDuration: 45.7, // average minutes per session
      batteryOptimizationScore: 78, // 0-100 score
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get app performance metrics
   */
  private async getAppPerformanceMetrics(): Promise<AppPerformanceMetrics> {
    return {
      averageLaunchTime: 2.1, // seconds
      crashRate: 0.02, // 2% crash rate
      memoryUsage: {
        average: 85.5, // MB
        peak: 142.3,   // MB
      },
      screenNavigationTimes: {
        HomeScreen: 0.3,
        CameraScreen: 0.8,
        HistoryScreen: 0.5,
        SettingsScreen: 0.2,
      },
      databasePerformance: {
        averageQueryTime: 45.2, // ms
        slowQueries: 12, // queries >1000ms
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get user engagement metrics
   */
  private async getUserEngagementMetrics(): Promise<UserEngagementMetrics> {
    return {
      dailyActiveUsers: 1250,
      averageSessionDuration: 18.5, // minutes
      featureUsage: {
        gps_tracking: 85,
        photo_capture: 72,
        activity_sharing: 34,
        history_view: 91,
        settings: 23,
      },
      retentionRate: {
        day1: 0.78,  // 78% return after 1 day
        day7: 0.45,  // 45% return after 7 days
        day30: 0.23, // 23% return after 30 days
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get error rate metrics
   */
  private async getErrorRateMetrics(): Promise<ErrorRateMetrics> {
    return {
      totalErrors: 156,
      errorsByType: {
        gps_error: 45,
        camera_error: 23,
        network_error: 34,
        database_error: 12,
        ui_error: 42,
      },
      errorsByScreen: {
        HomeScreen: 23,
        CameraScreen: 67,
        TrackingScreen: 34,
        HistoryScreen: 18,
        SettingsScreen: 14,
      },
      criticalErrors: 8,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get performance alerts
   */
  getPerformanceAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Acknowledge a performance alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      
      analyticsService.trackEvent('Performance Alert Acknowledged', {
        alert_id: alertId,
        alert_type: alert.type,
        alert_severity: alert.severity,
      });
    }
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledgedAlerts(): void {
    const clearedCount = this.alerts.filter(a => a.acknowledged).length;
    this.alerts = this.alerts.filter(a => !a.acknowledged);
    
    if (clearedCount > 0) {
      analyticsService.trackEvent('Performance Alerts Cleared', {
        cleared_count: clearedCount,
      });
    }
  }

  /**
   * Export performance data for analysis
   */
  async exportPerformanceData(
    startDate: string,
    endDate: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const data = await this.getDashboardData(true);
    
    if (format === 'json') {
      return JSON.stringify({
        exportDate: new Date().toISOString(),
        dateRange: { startDate, endDate },
        data,
      }, null, 2);
    } else {
      // Convert to CSV format
      return this.convertToCSV(data);
    }
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(days: number = 30): Promise<{
    gpsAccuracy: Array<{ date: string; value: number }>;
    batteryUsage: Array<{ date: string; value: number }>;
    crashRate: Array<{ date: string; value: number }>;
    userEngagement: Array<{ date: string; value: number }>;
  }> {
    // In a real implementation, this would query historical data
    // For now, generate mock trend data
    const trends = {
      gpsAccuracy: [],
      batteryUsage: [],
      crashRate: [],
      userEngagement: [],
    } as any;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      trends.gpsAccuracy.push({
        date: dateStr,
        value: 8 + Math.random() * 4, // 8-12m accuracy
      });

      trends.batteryUsage.push({
        date: dateStr,
        value: 4 + Math.random() * 3, // 4-7%/hr usage
      });

      trends.crashRate.push({
        date: dateStr,
        value: Math.random() * 0.05, // 0-5% crash rate
      });

      trends.userEngagement.push({
        date: dateStr,
        value: 15 + Math.random() * 10, // 15-25 min sessions
      });
    }

    return trends;
  }

  /**
   * Check for performance alerts based on current metrics
   */
  private checkPerformanceAlerts(data: PerformanceDashboardData): void {
    const newAlerts: PerformanceAlert[] = [];

    // GPS accuracy alerts
    if (data.gpsAccuracy.averageAccuracy > 15) {
      newAlerts.push({
        id: `gps_accuracy_${Date.now()}`,
        type: 'gps',
        severity: data.gpsAccuracy.averageAccuracy > 25 ? 'high' : 'medium',
        message: `GPS accuracy degraded to ${data.gpsAccuracy.averageAccuracy.toFixed(1)}m`,
        threshold: 15,
        currentValue: data.gpsAccuracy.averageAccuracy,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }

    // Battery usage alerts
    if (data.batteryUsage.averageUsageRate > 8) {
      newAlerts.push({
        id: `battery_usage_${Date.now()}`,
        type: 'battery',
        severity: data.batteryUsage.averageUsageRate > 12 ? 'critical' : 'high',
        message: `High battery usage: ${data.batteryUsage.averageUsageRate.toFixed(1)}%/hr`,
        threshold: 8,
        currentValue: data.batteryUsage.averageUsageRate,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }

    // App performance alerts
    if (data.appPerformance.crashRate > 0.05) {
      newAlerts.push({
        id: `crash_rate_${Date.now()}`,
        type: 'error',
        severity: data.appPerformance.crashRate > 0.1 ? 'critical' : 'high',
        message: `High crash rate: ${(data.appPerformance.crashRate * 100).toFixed(1)}%`,
        threshold: 0.05,
        currentValue: data.appPerformance.crashRate,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }

    // Memory usage alerts
    if (data.appPerformance.memoryUsage.average > 120) {
      newAlerts.push({
        id: `memory_usage_${Date.now()}`,
        type: 'performance',
        severity: data.appPerformance.memoryUsage.average > 150 ? 'high' : 'medium',
        message: `High memory usage: ${data.appPerformance.memoryUsage.average.toFixed(1)}MB`,
        threshold: 120,
        currentValue: data.appPerformance.memoryUsage.average,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }

    // Add new alerts and track them
    newAlerts.forEach(alert => {
      this.alerts.push(alert);
      
      analyticsService.trackEvent('Performance Alert Generated', {
        alert_type: alert.type,
        alert_severity: alert.severity,
        threshold: alert.threshold,
        current_value: alert.currentValue,
      });
    });

    // Keep only recent alerts (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.alerts = this.alerts.filter(alert => 
      new Date(alert.timestamp).getTime() > oneDayAgo
    );
  }

  /**
   * Convert performance data to CSV format
   */
  private convertToCSV(data: PerformanceDashboardData): string {
    const rows = [
      ['Metric', 'Value', 'Unit', 'Last Updated'],
      ['GPS Average Accuracy', data.gpsAccuracy.averageAccuracy.toString(), 'meters', data.gpsAccuracy.lastUpdated],
      ['Battery Usage Rate', data.batteryUsage.averageUsageRate.toString(), '%/hour', data.batteryUsage.lastUpdated],
      ['App Launch Time', data.appPerformance.averageLaunchTime.toString(), 'seconds', data.appPerformance.lastUpdated],
      ['Crash Rate', (data.appPerformance.crashRate * 100).toString(), '%', data.appPerformance.lastUpdated],
      ['Memory Usage', data.appPerformance.memoryUsage.average.toString(), 'MB', data.appPerformance.lastUpdated],
      ['Daily Active Users', data.userEngagement.dailyActiveUsers.toString(), 'users', data.userEngagement.lastUpdated],
      ['Session Duration', data.userEngagement.averageSessionDuration.toString(), 'minutes', data.userEngagement.lastUpdated],
      ['Total Errors', data.errorRates.totalErrors.toString(), 'count', data.errorRates.lastUpdated],
    ];

    return rows.map(row => row.join(',')).join('\n');
  }
}

export const performanceDashboardService = new PerformanceDashboardService();