import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import AuthService from './src/services/auth/AuthService';
import { authConfig, validateAuthConfig } from './src/config/auth';
import AppNavigator from './src/navigation/AppNavigator';
import { useAppLifecycle } from './src/hooks/useAppLifecycle';
import { CrashRecoveryModal } from './src/components/recovery/CrashRecoveryModal';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { sentryService, performanceMonitoringService } from './src/services/monitoring';

// Validate auth configuration on app start
validateAuthConfig(authConfig);

// Create auth service instance
const authService = new AuthService(authConfig);

// Initialize Sentry for crash reporting and performance monitoring
// In production, you would get this DSN from your environment variables
const SENTRY_DSN = __DEV__ 
  ? '' // Leave empty for development
  : 'YOUR_SENTRY_DSN_HERE'; // Replace with actual Sentry DSN

if (SENTRY_DSN) {
  sentryService.init(SENTRY_DSN, __DEV__ ? 'development' : 'production');
}

function AppContent() {
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [appLaunchTime] = useState(Date.now());
  const { 
    isInitialized, 
    hasRecoveredFromCrash, 
    attemptRecovery,
    getAppStateInfo 
  } = useAppLifecycle({
    enableAutoRecovery: true,
    recoveryTimeoutMs: 30000, // 30 seconds
    maxRecoveryAttempts: 3,
  });

  // Initialize performance monitoring
  useEffect(() => {
    if (SENTRY_DSN) {
      performanceMonitoringService.startMonitoring(60000); // Monitor every minute
      
      // Record app launch time
      const launchDuration = Date.now() - appLaunchTime;
      performanceMonitoringService.recordAppLaunchTime(launchDuration);
      
      sentryService.addBreadcrumb('App launched', 'navigation', 'info', {
        launch_time_ms: launchDuration,
      });
    }

    return () => {
      if (SENTRY_DSN) {
        performanceMonitoringService.stopMonitoring();
      }
    };
  }, [appLaunchTime]);

  // Check for potential crash recovery on app start
  useEffect(() => {
    if (!isInitialized) return;

    const checkForRecovery = async () => {
      try {
        const appState = getAppStateInfo();
        
        // If we detect potential crash recovery scenario, show modal
        // This is a simplified check - in a real app you might have more sophisticated detection
        if (appState.isTrackingActive && !hasRecoveredFromCrash) {
          const recovered = await attemptRecovery();
          
          if (!recovered) {
            // Show manual recovery option
            setShowRecoveryModal(true);
          }
        }
      } catch (error) {
        console.error('Error checking for recovery:', error);
      }
    };

    // Delay the check to allow the app to fully initialize
    const timeoutId = setTimeout(checkForRecovery, 1000);

    return () => clearTimeout(timeoutId);
  }, [isInitialized, hasRecoveredFromCrash, attemptRecovery, getAppStateInfo]);

  const handleRecoveryComplete = (recovered: boolean) => {
    setShowRecoveryModal(false);
    
    if (recovered) {
      console.log('Recovery completed successfully');
    } else {
      console.log('Recovery was skipped or failed');
    }
  };

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log error details for debugging
        console.error('App Error Boundary caught error:', error);
        console.error('Error Info:', errorInfo);
        
        // Set context for crash recovery
        sentryService.setContext('error_boundary', {
          component_stack: errorInfo.componentStack,
          error_boundary: 'main_app',
        });
      }}
    >
      <AppNavigator />
      <StatusBar style="auto" />
      
      <CrashRecoveryModal
        visible={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        onRecoveryComplete={handleRecoveryComplete}
      />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Root Error Boundary caught error:', error);
        sentryService.captureException(error, {
          error_boundary: 'root',
          component_stack: errorInfo.componentStack,
        });
      }}
    >
      <AuthProvider authService={authService}>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
