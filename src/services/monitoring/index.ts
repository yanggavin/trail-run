export { sentryService } from './SentryService';
export { performanceMonitoringService } from './PerformanceMonitoringService';
export { userFeedbackService } from './UserFeedbackService';
export { analyticsService } from './AnalyticsService';
export { abTestingService, EXPERIMENTS } from './ABTestingService';
export { privacyAnalyticsService } from './PrivacyAnalyticsService';
export { performanceDashboardService } from './PerformanceDashboardService';

export type { PerformanceMetrics, UserFeedback } from './SentryService';
export type { BatteryInfo, MemoryInfo, GpsMetrics } from './PerformanceMonitoringService';
export type { BugReport, FeatureRequest, DeviceInfo } from './UserFeedbackService';
export type { UserProperties, EventProperties, TrackingEvent, ABTestVariant } from './AnalyticsService';
export type { ABTestConfig, ABTestAssignment, ABTestResult } from './ABTestingService';
export type { PrivacyAnalyticsConfig, ConsentStatus } from './PrivacyAnalyticsService';
export type { 
  PerformanceDashboardData, 
  GPSAccuracyMetrics, 
  BatteryUsageMetrics, 
  AppPerformanceMetrics, 
  UserEngagementMetrics, 
  ErrorRateMetrics, 
  PerformanceAlert 
} from './PerformanceDashboardService';