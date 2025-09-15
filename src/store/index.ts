import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Activity, TrackPoint, TrackingStatus } from '../types';
import { createActivity, generateActivityId } from '../types/models';
import { autoPauseService, AutoPauseConfig } from '../services/tracking/AutoPauseService';

// Real-time statistics interface
export interface TrackingStatistics {
  elapsedTime: number; // seconds
  distance: number; // meters
  currentPace: number; // seconds per km (0 if no movement)
  avgPace: number; // seconds per km
  currentSpeed: number; // m/s
  elevationGain: number; // meters
  elevationLoss: number; // meters
  lastKmSplit?: number; // seconds for last completed km
}

// Tracking state interface
export interface TrackingState {
  status: TrackingStatus;
  activity: Activity | null;
  statistics: TrackingStatistics;
  trackPoints: TrackPoint[];
  startTime: number | null; // timestamp
  pausedTime: number; // total paused duration in seconds
  lastPauseTime: number | null; // timestamp when paused
  isAutoPaused: boolean;
  lastLocation: TrackPoint | null;
}

// Store interface
interface AppState {
  // Tracking state
  tracking: TrackingState;

  // Actions
  startTracking: (userId: string, autoPauseConfig?: Partial<AutoPauseConfig>) => Promise<void>;
  pauseTracking: (isAuto?: boolean) => void;
  resumeTracking: () => void;
  stopTracking: () => Promise<Activity>;
  addTrackPoint: (trackPoint: TrackPoint) => void;
  updateStatistics: () => void;
  resetTracking: () => void;

  // Auto-pause actions
  enableAutoPause: (config?: Partial<AutoPauseConfig>) => void;
  disableAutoPause: () => void;
  updateAutoPauseConfig: (config: Partial<AutoPauseConfig>) => void;

  // Persistence actions
  saveTrackingState: () => Promise<void>;
  restoreTrackingState: () => Promise<void>;

  // Utility actions
  setTrackingStatus: (status: TrackingStatus) => void;
  getCurrentActivity: () => Activity | null;
  getTrackingStatistics: () => TrackingStatistics;
}

// Initial state
const initialTrackingState: TrackingState = {
  status: 'inactive',
  activity: null,
  statistics: {
    elapsedTime: 0,
    distance: 0,
    currentPace: 0,
    avgPace: 0,
    currentSpeed: 0,
    elevationGain: 0,
    elevationLoss: 0,
  },
  trackPoints: [],
  startTime: null,
  pausedTime: 0,
  lastPauseTime: null,
  isAutoPaused: false,
  lastLocation: null,
};

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => {
    // Set up auto-pause event listeners
    autoPauseService.on('autoPauseTriggered', () => {
      get().pauseTracking(true);
    });

    autoPauseService.on('autoResumeTriggered', () => {
      get().resumeTracking();
    });

    return {
      // Initial state
      tracking: initialTrackingState,

      // Start tracking action
      startTracking: async (userId: string, autoPauseConfig?: Partial<AutoPauseConfig>) => {
        const now = Date.now();
        const activity = createActivity({
          activityId: generateActivityId(),
          userId,
          startedAt: new Date(now),
        });

        set(state => ({
          tracking: {
            ...state.tracking,
            status: 'active',
            activity,
            startTime: now,
            pausedTime: 0,
            lastPauseTime: null,
            isAutoPaused: false,
            trackPoints: [],
            statistics: {
              elapsedTime: 0,
              distance: 0,
              currentPace: 0,
              avgPace: 0,
              currentSpeed: 0,
              elevationGain: 0,
              elevationLoss: 0,
            },
          },
        }));

        // Start auto-pause monitoring
        if (autoPauseConfig) {
          autoPauseService.updateConfig(autoPauseConfig);
        }
        autoPauseService.startMonitoring();

        // Save state for persistence
        await get().saveTrackingState();
      },

    // Pause tracking action
    pauseTracking: (isAuto = false) => {
      const now = Date.now();
      
      set(state => {
        if (state.tracking.status !== 'active') {
          return state;
        }

        return {
          tracking: {
            ...state.tracking,
            status: 'paused',
            lastPauseTime: now,
            isAutoPaused: isAuto,
            activity: state.tracking.activity ? {
              ...state.tracking.activity,
              status: 'paused',
              updatedAt: new Date(now),
            } : null,
          },
        };
      });
    },

    // Resume tracking action
    resumeTracking: () => {
      const now = Date.now();
      
      set(state => {
        if (state.tracking.status !== 'paused' || !state.tracking.lastPauseTime) {
          return state;
        }

        const pauseDuration = (now - state.tracking.lastPauseTime) / 1000;

        return {
          tracking: {
            ...state.tracking,
            status: 'active',
            pausedTime: state.tracking.pausedTime + pauseDuration,
            lastPauseTime: null,
            isAutoPaused: false,
            activity: state.tracking.activity ? {
              ...state.tracking.activity,
              status: 'active',
              updatedAt: new Date(now),
            } : null,
          },
        };
      });
    },

    // Stop tracking action
    stopTracking: async (): Promise<Activity> => {
      const state = get();
      const now = Date.now();
      
      if (!state.tracking.activity || !state.tracking.startTime) {
        throw new Error('No active tracking session to stop');
      }

      // Stop auto-pause monitoring
      autoPauseService.stopMonitoring();

      // Calculate final statistics
      const finalStats = calculateFinalStatistics(
        state.tracking.trackPoints,
        state.tracking.startTime,
        now,
        state.tracking.pausedTime
      );

      const completedActivity: Activity = {
        ...state.tracking.activity,
        status: 'completed',
        endedAt: new Date(now),
        durationSec: finalStats.elapsedTime,
        distanceM: finalStats.distance,
        avgPaceSecPerKm: finalStats.avgPace,
        elevGainM: finalStats.elevationGain,
        elevLossM: finalStats.elevationLoss,
        splitKm: calculateKmSplits(state.tracking.trackPoints),
        updatedAt: new Date(now),
      };

      // Reset tracking state
      set(state => ({
        tracking: initialTrackingState,
      }));

      // Clear persisted state
      await get().saveTrackingState();

      return completedActivity;
    },

    // Add track point action
    addTrackPoint: (trackPoint: TrackPoint) => {
      set(state => {
        if (state.tracking.status !== 'active') {
          return state;
        }

        const newTrackPoints = [...state.tracking.trackPoints, trackPoint];
        
        return {
          tracking: {
            ...state.tracking,
            trackPoints: newTrackPoints,
            lastLocation: trackPoint,
          },
        };
      });

      // Process track point for auto-pause detection
      autoPauseService.processTrackPoint(trackPoint);

      // Update statistics after adding track point
      get().updateStatistics();
    },

    // Update statistics action
    updateStatistics: () => {
      set(state => {
        if (state.tracking.status === 'inactive' || !state.tracking.startTime) {
          return state;
        }

        const now = Date.now();
        const stats = calculateRealTimeStatistics(
          state.tracking.trackPoints,
          state.tracking.startTime,
          now,
          state.tracking.pausedTime,
          state.tracking.status === 'paused' ? state.tracking.lastPauseTime : null
        );

        return {
          tracking: {
            ...state.tracking,
            statistics: stats,
          },
        };
      });
    },

    // Reset tracking action
    resetTracking: () => {
      autoPauseService.stopMonitoring();
      set({ tracking: initialTrackingState });
    },

    // Auto-pause actions
    enableAutoPause: (config?: Partial<AutoPauseConfig>) => {
      if (config) {
        autoPauseService.updateConfig(config);
      }
      autoPauseService.updateConfig({ enabled: true });
      
      const state = get();
      if (state.tracking.status === 'active') {
        autoPauseService.startMonitoring();
      }
    },

    disableAutoPause: () => {
      autoPauseService.updateConfig({ enabled: false });
      autoPauseService.stopMonitoring();
    },

    updateAutoPauseConfig: (config: Partial<AutoPauseConfig>) => {
      autoPauseService.updateConfig(config);
    },

    // Persistence actions
    saveTrackingState: async () => {
      try {
        const state = get().tracking;
        const persistedState = {
          ...state,
          // Convert dates to ISO strings for storage
          activity: state.activity ? {
            ...state.activity,
            startedAt: state.activity.startedAt.toISOString(),
            endedAt: state.activity.endedAt?.toISOString(),
            createdAt: state.activity.createdAt.toISOString(),
            updatedAt: state.activity.updatedAt.toISOString(),
          } : null,
          trackPoints: state.trackPoints.map(point => ({
            ...point,
            timestamp: point.timestamp.toISOString(),
          })),
          lastLocation: state.lastLocation ? {
            ...state.lastLocation,
            timestamp: state.lastLocation.timestamp.toISOString(),
          } : null,
        };

        // In a real app, this would use AsyncStorage or similar
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('trailrun_tracking_state', JSON.stringify(persistedState));
        }
      } catch (error) {
        console.error('Failed to save tracking state:', error);
      }
    },

    restoreTrackingState: async () => {
      try {
        // In a real app, this would use AsyncStorage or similar
        if (typeof window !== 'undefined' && window.localStorage) {
          const savedState = window.localStorage.getItem('trailrun_tracking_state');
          
          if (savedState) {
            const parsedState = JSON.parse(savedState);
            
            // Convert ISO strings back to dates
            const restoredState: TrackingState = {
              ...parsedState,
              activity: parsedState.activity ? {
                ...parsedState.activity,
                startedAt: new Date(parsedState.activity.startedAt),
                endedAt: parsedState.activity.endedAt ? new Date(parsedState.activity.endedAt) : undefined,
                createdAt: new Date(parsedState.activity.createdAt),
                updatedAt: new Date(parsedState.activity.updatedAt),
              } : null,
              trackPoints: parsedState.trackPoints.map((point: any) => ({
                ...point,
                timestamp: new Date(point.timestamp),
              })),
              lastLocation: parsedState.lastLocation ? {
                ...parsedState.lastLocation,
                timestamp: new Date(parsedState.lastLocation.timestamp),
              } : null,
            };

            set({ tracking: restoredState });

            // Resume auto-pause monitoring if tracking was active
            if (restoredState.status === 'active') {
              autoPauseService.startMonitoring();
            }
          }
        }
      } catch (error) {
        console.error('Failed to restore tracking state:', error);
      }
    },

    // Utility actions
    setTrackingStatus: (status: TrackingStatus) => {
      set(state => ({
        tracking: {
          ...state.tracking,
          status,
        },
      }));
    },

    getCurrentActivity: () => {
      return get().tracking.activity;
    },

    getTrackingStatistics: () => {
      return get().tracking.statistics;
    },
  };
  })
);

// Helper functions for statistics calculation

/**
 * Calculate real-time statistics during tracking
 */
function calculateRealTimeStatistics(
  trackPoints: TrackPoint[],
  startTime: number,
  currentTime: number,
  pausedTime: number,
  lastPauseTime: number | null
): TrackingStatistics {
  // Calculate elapsed time (excluding paused time)
  let elapsedTime = (currentTime - startTime) / 1000 - pausedTime;
  
  // If currently paused, subtract current pause duration
  if (lastPauseTime) {
    elapsedTime -= (currentTime - lastPauseTime) / 1000;
  }

  elapsedTime = Math.max(0, elapsedTime);

  // Calculate distance
  const distance = calculateTotalDistance(trackPoints);

  // Calculate current speed and pace
  let currentSpeed = 0;
  let currentPace = 0;
  
  if (trackPoints.length >= 2) {
    const lastPoint = trackPoints[trackPoints.length - 1];
    const secondLastPoint = trackPoints[trackPoints.length - 2];
    
    if (lastPoint.speed !== undefined) {
      currentSpeed = lastPoint.speed;
    } else {
      // Calculate speed from distance and time
      const pointDistance = calculateDistance(secondLastPoint, lastPoint);
      const timeDiff = (lastPoint.timestamp.getTime() - secondLastPoint.timestamp.getTime()) / 1000;
      currentSpeed = timeDiff > 0 ? pointDistance / timeDiff : 0;
    }
    
    // Convert speed to pace (seconds per km)
    currentPace = currentSpeed > 0 ? 1000 / currentSpeed : 0;
  }

  // Calculate average pace
  const avgPace = distance > 0 && elapsedTime > 0 ? (elapsedTime / distance) * 1000 : 0;

  // Calculate elevation gain/loss
  const { elevationGain, elevationLoss } = calculateElevationChanges(trackPoints);

  // Calculate last km split
  const lastKmSplit = calculateLastKmSplit(trackPoints);

  return {
    elapsedTime,
    distance,
    currentPace,
    avgPace,
    currentSpeed,
    elevationGain,
    elevationLoss,
    lastKmSplit,
  };
}

/**
 * Calculate final statistics when stopping tracking
 */
function calculateFinalStatistics(
  trackPoints: TrackPoint[],
  startTime: number,
  endTime: number,
  pausedTime: number
): TrackingStatistics {
  const elapsedTime = Math.max(0, (endTime - startTime) / 1000 - pausedTime);
  const distance = calculateTotalDistance(trackPoints);
  const avgPace = distance > 0 && elapsedTime > 0 ? (elapsedTime / distance) * 1000 : 0;
  const { elevationGain, elevationLoss } = calculateElevationChanges(trackPoints);

  return {
    elapsedTime,
    distance,
    currentPace: 0,
    avgPace,
    currentSpeed: 0,
    elevationGain,
    elevationLoss,
  };
}

/**
 * Calculate total distance using Haversine formula
 */
function calculateTotalDistance(trackPoints: TrackPoint[]): number {
  if (trackPoints.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < trackPoints.length; i++) {
    totalDistance += calculateDistance(trackPoints[i - 1], trackPoints[i]);
  }

  return totalDistance;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(point1: TrackPoint, point2: TrackPoint): number {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = (point1.latitude * Math.PI) / 180;
  const lat2Rad = (point2.latitude * Math.PI) / 180;
  const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const deltaLonRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Calculate elevation gain and loss
 */
function calculateElevationChanges(trackPoints: TrackPoint[]): { elevationGain: number; elevationLoss: number } {
  if (trackPoints.length < 2) {
    return { elevationGain: 0, elevationLoss: 0 };
  }

  let elevationGain = 0;
  let elevationLoss = 0;
  const threshold = 3; // 3 meter threshold as per requirements

  for (let i = 1; i < trackPoints.length; i++) {
    const prevAltitude = trackPoints[i - 1].altitude;
    const currentAltitude = trackPoints[i].altitude;

    if (prevAltitude !== undefined && currentAltitude !== undefined) {
      const elevationChange = currentAltitude - prevAltitude;
      
      if (Math.abs(elevationChange) >= threshold) {
        if (elevationChange > 0) {
          elevationGain += elevationChange;
        } else {
          elevationLoss += Math.abs(elevationChange);
        }
      }
    }
  }

  return { elevationGain, elevationLoss };
}

/**
 * Calculate per-kilometer splits
 */
function calculateKmSplits(trackPoints: TrackPoint[]): Array<{ kmIndex: number; durationSec: number; paceSecPerKm: number }> {
  if (trackPoints.length < 2) return [];

  const splits: Array<{ kmIndex: number; durationSec: number; paceSecPerKm: number }> = [];
  let currentDistance = 0;
  let kmIndex = 1;
  let lastKmTime = trackPoints[0].timestamp.getTime();

  for (let i = 1; i < trackPoints.length; i++) {
    const segmentDistance = calculateDistance(trackPoints[i - 1], trackPoints[i]);
    currentDistance += segmentDistance;

    // Check if we've completed a kilometer
    if (currentDistance >= kmIndex * 1000) {
      const currentTime = trackPoints[i].timestamp.getTime();
      const splitDuration = (currentTime - lastKmTime) / 1000;
      
      splits.push({
        kmIndex,
        durationSec: splitDuration,
        paceSecPerKm: splitDuration, // For 1km, duration equals pace
      });

      lastKmTime = currentTime;
      kmIndex++;
    }
  }

  return splits;
}

/**
 * Calculate the time for the last completed kilometer
 */
function calculateLastKmSplit(trackPoints: TrackPoint[]): number | undefined {
  const splits = calculateKmSplits(trackPoints);
  return splits.length > 0 ? splits[splits.length - 1].durationSec : undefined;
}
