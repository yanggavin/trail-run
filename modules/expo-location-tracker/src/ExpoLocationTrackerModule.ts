import { NativeModulesProxy } from 'expo-modules-core';
import { LocationConfig, Location, PermissionStatus, TrackingStatus } from './index';

// This will be resolved to the actual native module implementation
const ExpoLocationTrackerModule = NativeModulesProxy.ExpoLocationTracker;

export interface ExpoLocationTrackerModuleType {
  startLocationUpdates(config: LocationConfig): Promise<void>;
  stopLocationUpdates(): Promise<void>;
  pauseLocationUpdates(): Promise<void>;
  resumeLocationUpdates(): Promise<void>;
  getCurrentLocation(): Promise<Location>;
  requestPermissions(): Promise<PermissionStatus>;
  getTrackingStatus(): Promise<TrackingStatus>;
  addListener: (eventName: string) => any;
  removeListeners: (count: number) => void;
}

export default ExpoLocationTrackerModule as ExpoLocationTrackerModuleType;