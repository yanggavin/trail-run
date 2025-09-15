import { create } from 'zustand';
import { Activity, TrackingStatus } from '../types';

interface AppState {
  // Tracking state
  trackingStatus: TrackingStatus;
  currentActivity: Activity | null;

  // Actions
  setTrackingStatus: (status: TrackingStatus) => void;
  setCurrentActivity: (activity: Activity | null) => void;
}

export const useAppStore = create<AppState>(set => ({
  // Initial state
  trackingStatus: 'inactive',
  currentActivity: null,

  // Actions
  setTrackingStatus: status => set({ trackingStatus: status }),
  setCurrentActivity: activity => set({ currentActivity: activity }),
}));
