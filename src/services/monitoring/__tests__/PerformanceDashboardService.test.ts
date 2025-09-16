import { performanceDashboardService, PerformanceDashboardData, PerformanceAlert } from '../PerformanceDashboardService';
import { analyticsService } from '../AnalyticsService';

// Mock the analytics service
jest.mock('../AnalyticsService', () => ({
  analyticsService: {
    trackEvent: jest.fn(),
  },
}));

describe('PerformanceDashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any cached data
    (performanceDashboardService as any).metricsCache = null;
    (performanceDashboardService as any).cacheExpiry = 0;
    (performanceDashboardService as any).alerts = [];
  });

  describe('getDashboardData', () => {
    it('should return comprehensive dashboard data', async () => {
      const data = await performanceDashboardService.getDashboardData();

      expect(data).toHaveProperty('gpsAccuracy');
      expect(data).toHaveProperty('batteryUsage');
      expect(data).toHaveProperty('appPerformance');
      expect(data).toHaveProperty('userEngagement');
      expect(data).toHaveProperty('errorRates');

      // Verify GPS accuracy structure
      expect(data.gpsAccuracy).toHaveProperty('averageAccuracy');
      expect(data.gpsAccuracy).toHaveProperty('accuracyDistribution');
      expect(data.gpsAccuracy.accuracyDistribution).toHaveProperty('excellent');
      expect(data.gpsAccuracy.accuracyDistribution).toHaveProperty('good');
      expect(data.gpsAccuracy.accuracyDistribution).toHaveProperty('fair');
      expect(data.gpsAccuracy.accuracyDistribution).toHaveProperty('poor');

      // Verify battery usage structure
      expect(data.batteryUsage).toHaveProperty('averageUsageRate');
      expect(data.batteryUsage).toHaveProperty('usageDistribution');
      expect(data.batteryUsage).toHaveProperty('batteryOptimizationScore');

      // Verify app performance structure
      expect(data.appPerformance).toHaveProperty('averageLaunchTime');
      expect(data.appPerformance).toHaveProperty('crashRate');
      expect(data.appPerformance).toHaveProperty('memoryUsage');
      expect(data.appPerformance.memoryUsage).toHaveProperty('average');
      expect(data.appPerformance.memoryUsage).toHaveProperty('peak');
    });

    it('should cache dashboard data for 5 minutes', async () => {
      const firstCall = await performanceDashboardService.getDashboardData();
      const secondCall = await performanceDashboardService.getDashboardData();

      // Should return the same cached object
      expect(firstCall).toBe(secondCall);
    });

    it('should refresh cache when forceRefresh is true', async () => {
      const firstCall = await performanceDashboardService.getDashboardData();
      const secondCall = await performanceDashboardService.getDashboardData(true);

      // Should return different objects (new data fetched)
      expect(firstCall).not.toBe(secondCall);
      expect(firstCall.gpsAccuracy.lastUpdated).not.toBe(secondCall.gpsAccuracy.lastUpdated);
    });

    it('should refresh cache after expiry time', async () => {
      const firstCall = await performanceDashboardService.getDashboardData();
      
      // Manually expire the cache
      (performanceDashboardService as any).cacheExpiry = Date.now() - 1000;
      
      const secondCall = await performanceDashboardService.getDashboardData();

      // Should return different objects (cache expired)
      expect(firstCall).not.toBe(secondCall);
    });
  });

  describe('performance alerts', () => {
    it('should generate GPS accuracy alert when accuracy is poor', async () => {
      // Mock poor GPS accuracy
      jest.spyOn(performanceDashboardService as any, 'getGPSAccuracyMetrics').mockResolvedValue({
        averageAccuracy: 20, // Above 15m threshold
        accuracyDistribution: { excellent: 10, good: 20, fair: 30, poor: 40 },
        timeToFirstFix: 15,
        signalLossEvents: 5,
        lastUpdated: new Date().toISOString(),
      });

      await performanceDashboardService.getDashboardData(true);
      const alerts = performanceDashboardService.getPerformanceAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('gps');
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[0].message).toContain('GPS accuracy degraded');
      expect(analyticsService.trackEvent).toHaveBeenCalledWith('Performance Alert Generated', expect.any(Object));
    });

    it('should generate high severity GPS alert for very poor accuracy', async () => {
      jest.spyOn(performanceDashboardService as any, 'getGPSAccuracyMetrics').mockResolvedValue({
        averageAccuracy: 30, // Above 25m threshold
        accuracyDistribution: { excellent: 5, good: 10, fair: 25, poor: 60 },
        timeToFirstFix: 20,
        signalLossEvents: 10,
        lastUpdated: new Date().toISOString(),
      });

      await performanceDashboardService.getDashboardData(true);
      const alerts = performanceDashboardService.getPerformanceAlerts();

      expect(alerts[0].severity).toBe('high');
    });

    it('should generate battery usage alert when usage is high', async () => {
      jest.spyOn(performanceDashboardService as any, 'getBatteryUsageMetrics').mockResolvedValue({
        averageUsageRate: 10, // Above 8%/hr threshold
        usageDistribution: { low: 10, normal: 20, high: 40, excessive: 30 },
        trackingDuration: 60,
        batteryOptimizationScore: 45,
        lastUpdated: new Date().toISOString(),
      });

      await performanceDashboardService.getDashboardData(true);
      const alerts = performanceDashboardService.getPerformanceAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('battery');
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].message).toContain('High battery usage');
    });

    it('should generate critical battery alert for excessive usage', async () => {
      jest.spyOn(performanceDashboardService as any, 'getBatteryUsageMetrics').mockResolvedValue({
        averageUsageRate: 15, // Above 12%/hr threshold
        usageDistribution: { low: 5, normal: 10, high: 25, excessive: 60 },
        trackingDuration: 30,
        batteryOptimizationScore: 25,
        lastUpdated: new Date().toISOString(),
      });

      await performanceDashboardService.getDashboardData(true);
      const alerts = performanceDashboardService.getPerformanceAlerts();

      expect(alerts[0].severity).toBe('critical');
    });

    it('should generate crash rate alert when crashes are high', async () => {
      jest.spyOn(performanceDashboardService as any, 'getAppPerformanceMetrics').mockResolvedValue({
        averageLaunchTime: 2.5,
        crashRate: 0.08, // Above 5% threshold
        memoryUsage: { average: 90, peak: 150 },
        screenNavigationTimes: {},
        databasePerformance: { averageQueryTime: 50, slowQueries: 5 },
        lastUpdated: new Date().toISOString(),
      });

      await performanceDashboardService.getDashboardData(true);
      const alerts = performanceDashboardService.getPerformanceAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('error');
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].message).toContain('High crash rate');
    });

    it('should generate memory usage alert when memory is high', async () => {
      jest.spyOn(performanceDashboardService as any, 'getAppPerformanceMetrics').mockResolvedValue({
        averageLaunchTime: 2.5,
        crashRate: 0.02,
        memoryUsage: { average: 130, peak: 180 }, // Above 120MB threshold
        screenNavigationTimes: {},
        databasePerformance: { averageQueryTime: 50, slowQueries: 5 },
        lastUpdated: new Date().toISOString(),
      });

      await performanceDashboardService.getDashboardData(true);
      const alerts = performanceDashboardService.getPerformanceAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('performance');
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[0].message).toContain('High memory usage');
    });
  });

  describe('alert management', () => {
    beforeEach(async () => {
      // Generate some alerts
      jest.spyOn(performanceDashboardService as any, 'getGPSAccuracyMetrics').mockResolvedValue({
        averageAccuracy: 20,
        accuracyDistribution: { excellent: 10, good: 20, fair: 30, poor: 40 },
        timeToFirstFix: 15,
        signalLossEvents: 5,
        lastUpdated: new Date().toISOString(),
      });

      await performanceDashboardService.getDashboardData(true);
    });

    it('should acknowledge alerts', () => {
      const alerts = performanceDashboardService.getPerformanceAlerts();
      const alertId = alerts[0].id;

      performanceDashboardService.acknowledgeAlert(alertId);

      const updatedAlerts = performanceDashboardService.getPerformanceAlerts();
      const acknowledgedAlert = updatedAlerts.find(a => a.id === alertId);

      expect(acknowledgedAlert?.acknowledged).toBe(true);
      expect(analyticsService.trackEvent).toHaveBeenCalledWith('Performance Alert Acknowledged', {
        alert_id: alertId,
        alert_type: 'gps',
        alert_severity: 'medium',
      });
    });

    it('should clear acknowledged alerts', () => {
      const alerts = performanceDashboardService.getPerformanceAlerts();
      const alertId = alerts[0].id;

      performanceDashboardService.acknowledgeAlert(alertId);
      performanceDashboardService.clearAcknowledgedAlerts();

      const remainingAlerts = performanceDashboardService.getPerformanceAlerts();
      expect(remainingAlerts).toHaveLength(0);
      expect(analyticsService.trackEvent).toHaveBeenCalledWith('Performance Alerts Cleared', {
        cleared_count: 1,
      });
    });

    it('should not clear unacknowledged alerts', () => {
      const initialAlerts = performanceDashboardService.getPerformanceAlerts();
      
      performanceDashboardService.clearAcknowledgedAlerts();

      const remainingAlerts = performanceDashboardService.getPerformanceAlerts();
      expect(remainingAlerts).toHaveLength(initialAlerts.length);
    });

    it('should remove old alerts after 24 hours', async () => {
      // Manually add an old alert
      const oldAlert: PerformanceAlert = {
        id: 'old_alert',
        type: 'gps',
        severity: 'medium',
        message: 'Old alert',
        threshold: 15,
        currentValue: 20,
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        acknowledged: false,
      };

      (performanceDashboardService as any).alerts.push(oldAlert);

      // Trigger alert cleanup by getting dashboard data
      await performanceDashboardService.getDashboardData(true);

      const alerts = performanceDashboardService.getPerformanceAlerts();
      const oldAlertExists = alerts.some(a => a.id === 'old_alert');
      expect(oldAlertExists).toBe(false);
    });
  });

  describe('data export', () => {
    it('should export performance data as JSON', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const exportData = await performanceDashboardService.exportPerformanceData(startDate, endDate, 'json');
      const parsedData = JSON.parse(exportData);

      expect(parsedData).toHaveProperty('exportDate');
      expect(parsedData).toHaveProperty('dateRange');
      expect(parsedData.dateRange.startDate).toBe(startDate);
      expect(parsedData.dateRange.endDate).toBe(endDate);
      expect(parsedData).toHaveProperty('data');
      expect(parsedData.data).toHaveProperty('gpsAccuracy');
    });

    it('should export performance data as CSV', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const exportData = await performanceDashboardService.exportPerformanceData(startDate, endDate, 'csv');

      expect(typeof exportData).toBe('string');
      expect(exportData).toContain('Metric,Value,Unit,Last Updated');
      expect(exportData).toContain('GPS Average Accuracy');
      expect(exportData).toContain('Battery Usage Rate');
      expect(exportData).toContain('App Launch Time');
    });
  });

  describe('performance trends', () => {
    it('should return performance trends for specified days', async () => {
      const trends = await performanceDashboardService.getPerformanceTrends(7);

      expect(trends).toHaveProperty('gpsAccuracy');
      expect(trends).toHaveProperty('batteryUsage');
      expect(trends).toHaveProperty('crashRate');
      expect(trends).toHaveProperty('userEngagement');

      expect(trends.gpsAccuracy).toHaveLength(8); // 7 days + today
      expect(trends.batteryUsage).toHaveLength(8);
      expect(trends.crashRate).toHaveLength(8);
      expect(trends.userEngagement).toHaveLength(8);

      // Verify data structure
      expect(trends.gpsAccuracy[0]).toHaveProperty('date');
      expect(trends.gpsAccuracy[0]).toHaveProperty('value');
      expect(typeof trends.gpsAccuracy[0].value).toBe('number');
    });

    it('should return default 30 days of trends', async () => {
      const trends = await performanceDashboardService.getPerformanceTrends();

      expect(trends.gpsAccuracy).toHaveLength(31); // 30 days + today
    });

    it('should return trends with reasonable value ranges', async () => {
      const trends = await performanceDashboardService.getPerformanceTrends(5);

      // GPS accuracy should be between 8-12m
      trends.gpsAccuracy.forEach(point => {
        expect(point.value).toBeGreaterThanOrEqual(8);
        expect(point.value).toBeLessThanOrEqual(12);
      });

      // Battery usage should be between 4-7%/hr
      trends.batteryUsage.forEach(point => {
        expect(point.value).toBeGreaterThanOrEqual(4);
        expect(point.value).toBeLessThanOrEqual(7);
      });

      // Crash rate should be between 0-5%
      trends.crashRate.forEach(point => {
        expect(point.value).toBeGreaterThanOrEqual(0);
        expect(point.value).toBeLessThanOrEqual(0.05);
      });

      // User engagement should be between 15-25 minutes
      trends.userEngagement.forEach(point => {
        expect(point.value).toBeGreaterThanOrEqual(15);
        expect(point.value).toBeLessThanOrEqual(25);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle multiple alerts of same type', async () => {
      // Mock multiple issues
      jest.spyOn(performanceDashboardService as any, 'getGPSAccuracyMetrics').mockResolvedValue({
        averageAccuracy: 20,
        accuracyDistribution: { excellent: 10, good: 20, fair: 30, poor: 40 },
        timeToFirstFix: 15,
        signalLossEvents: 5,
        lastUpdated: new Date().toISOString(),
      });

      jest.spyOn(performanceDashboardService as any, 'getBatteryUsageMetrics').mockResolvedValue({
        averageUsageRate: 10,
        usageDistribution: { low: 10, normal: 20, high: 40, excessive: 30 },
        trackingDuration: 60,
        batteryOptimizationScore: 45,
        lastUpdated: new Date().toISOString(),
      });

      await performanceDashboardService.getDashboardData(true);
      const alerts = performanceDashboardService.getPerformanceAlerts();

      expect(alerts).toHaveLength(2);
      expect(alerts.some(a => a.type === 'gps')).toBe(true);
      expect(alerts.some(a => a.type === 'battery')).toBe(true);
    });

    it('should handle acknowledging non-existent alert', () => {
      performanceDashboardService.acknowledgeAlert('non-existent-id');
      
      // Should not throw error and not track event
      expect(analyticsService.trackEvent).not.toHaveBeenCalledWith('Performance Alert Acknowledged', expect.any(Object));
    });

    it('should handle clearing alerts when none are acknowledged', () => {
      performanceDashboardService.clearAcknowledgedAlerts();
      
      // Should not track event when no alerts are cleared
      expect(analyticsService.trackEvent).not.toHaveBeenCalledWith('Performance Alerts Cleared', expect.any(Object));
    });
  });
});