import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import AuthService from './src/services/auth/AuthService';
import { authConfig, validateAuthConfig } from './src/config/auth';
import AppNavigator from './src/navigation/AppNavigator';
import { useAppLifecycle } from './src/hooks/useAppLifecycle';
import { CrashRecoveryModal } from './src/components/recovery/CrashRecoveryModal';

// Validate auth configuration on app start
validateAuthConfig(authConfig);

// Create auth service instance
const authService = new AuthService(authConfig);

function AppContent() {
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
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
    <>
      <AppNavigator />
      <StatusBar style="auto" />
      
      <CrashRecoveryModal
        visible={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        onRecoveryComplete={handleRecoveryComplete}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider authService={authService}>
      <AppContent />
    </AuthProvider>
  );
}
