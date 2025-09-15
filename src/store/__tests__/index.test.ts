import { useAppStore } from '../index';
import { createTrackPoint } from '../../types/models';
import { TrackPoint } from '../../types';

// Mock zustand store for testing
const mockStore = useAppStore;

describe('Activity Tracking State Management', () => {
  beforeEach(() => {
    // Reset store before each test
    mockStore.getState().resetTracking();
  });

  describe('startTracking', () => {
    it('should initialize tracking state correctly', async () => {
      const userId = 'test-user-123';
      const initialState = mockStore.getState();
      
      expect(initialState.tracking.status).toBe('inactive');
      expect(initialState.tracking.activity).toBeNull();

      await mockStore.getState().startTracking(userId);
      
      const state = mockStore.getState();
      expect(state.tracking.status).toBe('active');
      expect(state.tracking.activity).not.toBeNull();
      expect(state.tracking.activity?.userId).toBe(userId);
      expect(state.tracking.activity?.status).toBe('active');
      expect(state.tracking.startTime).toBeTruthy();
      expect(state.tracking.pausedTime).toBe(0);
      expect(state.tracking.trackPoints).toEqual([]);
      expect(state.tracking.statistics.elapsedTime).toBe(0);
      expect(state.tracking.statistics.distance).toBe(0);
    });

    it('should create activity with correct initial values', async () => {
      const userId = 'test-user-456';
      
      await mockStore.getState().startTracking(userId);
      
      const activity = mockStore.getState().tracking.activity;
      expect(activity).not.toBeNull();
      expect(activity!.activityId).toMatch(/^activity_/);
      expect(activity!.userId).toBe(userId);
      expect(activity!.durationSec).toBe(0);
      expect(activity!.distanceM).toBe(0);
      expect(activity!.avgPaceSecPerKm).toBe(0);
      expect(activity!.elevGainM).toBe(0);
      expect(activity!.elevLossM).toBe(0);
      expect(activity!.splitKm).toEqual([]);
      expect(activity!.syncStatus).toBe('local');
    });
  });

  describe('pauseTracking', () => {
    beforeEach(async () => {
      await mockStore.getState().startTracking('test-user');
    });

    it('should pause active tracking', () => {
      const beforePause = mockStore.getState();
      expect(beforePause.tracking.status).toBe('active');

      mockStore.getState().pauseTracking();
      
      const afterPause = mockStore.getState();
      expect(afterPause.tracking.status).toBe('paused');
      expect(afterPause.tracking.lastPauseTime).toBeTruthy();
      expect(afterPause.tracking.isAutoPaused).toBe(false);
      expect(afterPause.tracking.activity?.status).toBe('paused');
    });

    it('should handle auto-pause correctly', () => {
      mockStore.getState().pauseTracking(true);
      
      const state = mockStore.getState();
      expect(state.tracking.status).toBe('paused');
      expect(state.tracking.isAutoPaused).toBe(true);
    });

    it('should not pause if not active', () => {
      mockStore.getState().resetTracking();
      
      mockStore.getState().pauseTracking();
      
      const state = mockStore.getState();
      expect(state.tracking.status).toBe('inactive');
    });
  });

  describe('resumeTracking', () => {
    beforeEach(async () => {
      await mockStore.getState().startTracking('test-user');
      mockStore.getState().pauseTracking();
    });

    it('should resume paused tracking', async () => {
      const beforeResume = mockStore.getState();
      expect(beforeResume.tracking.status).toBe('paused');
      expect(beforeResume.tracking.lastPauseTime).toBeTruthy();

      // Wait a bit to simulate pause duration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      mockStore.getState().resumeTracking();
      
      const afterResume = mockStore.getState();
      expect(afterResume.tracking.status).toBe('active');
      expect(afterResume.tracking.lastPauseTime).toBeNull();
      expect(afterResume.tracking.isAutoPaused).toBe(false);
      expect(afterResume.tracking.pausedTime).toBeGreaterThan(0);
      expect(afterResume.tracking.activity?.status).toBe('active');
    });

    it('should not resume if not paused', () => {
      mockStore.getState().resetTracking();
      
      mockStore.getState().resumeTracking();
      
      const state = mockStore.getState();
      expect(state.tracking.status).toBe('inactive');
    });
  });

  describe('stopTracking', () => {
    beforeEach(async () => {
      await mockStore.getState().startTracking('test-user');
    });

    it('should stop tracking and return completed activity', async () => {
      // Add some track points
      const trackPoint1 = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 2.5,
      });
      
      const trackPoint2 = createTrackPoint({
        latitude: 37.7750,
        longitude: -122.4195,
        accuracy: 5,
        source: 'gps',
        speed: 2.8,
        timestamp: new Date(Date.now() + 1000),
      });

      mockStore.getState().addTrackPoint(trackPoint1);
      mockStore.getState().addTrackPoint(trackPoint2);

      const completedActivity = await mockStore.getState().stopTracking();
      
      expect(completedActivity.status).toBe('completed');
      expect(completedActivity.endedAt).toBeTruthy();
      expect(completedActivity.durationSec).toBeGreaterThan(0);
      expect(completedActivity.distanceM).toBeGreaterThan(0);
      
      // Check that tracking state is reset
      const state = mockStore.getState();
      expect(state.tracking.status).toBe('inactive');
      expect(state.tracking.activity).toBeNull();
      expect(state.tracking.trackPoints).toEqual([]);
    });

    it('should throw error if no active tracking', async () => {
      mockStore.getState().resetTracking();
      
      await expect(mockStore.getState().stopTracking()).rejects.toThrow(
        'No active tracking session to stop'
      );
    });
  });

  describe('addTrackPoint', () => {
    beforeEach(async () => {
      await mockStore.getState().startTracking('test-user');
    });

    it('should add track point to active tracking', () => {
      const trackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 2.5,
      });

      mockStore.getState().addTrackPoint(trackPoint);
      
      const state = mockStore.getState();
      expect(state.tracking.trackPoints).toHaveLength(1);
      expect(state.tracking.trackPoints[0]).toEqual(trackPoint);
      expect(state.tracking.lastLocation).toEqual(trackPoint);
    });

    it('should not add track point if not active', () => {
      mockStore.getState().pauseTracking();
      
      const trackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
      });

      mockStore.getState().addTrackPoint(trackPoint);
      
      const state = mockStore.getState();
      expect(state.tracking.trackPoints).toHaveLength(0);
    });

    it('should update statistics after adding track point', () => {
      const trackPoint1 = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 2.5,
      });
      
      const trackPoint2 = createTrackPoint({
        latitude: 37.7750,
        longitude: -122.4195,
        accuracy: 5,
        source: 'gps',
        speed: 2.8,
        timestamp: new Date(Date.now() + 1000),
      });

      mockStore.getState().addTrackPoint(trackPoint1);
      let stats = mockStore.getState().tracking.statistics;
      expect(stats.distance).toBe(0); // No distance with single point
      
      mockStore.getState().addTrackPoint(trackPoint2);
      stats = mockStore.getState().tracking.statistics;
      expect(stats.distance).toBeGreaterThan(0);
      expect(stats.currentSpeed).toBe(2.8);
    });
  });

  describe('updateStatistics', () => {
    beforeEach(async () => {
      await mockStore.getState().startTracking('test-user');
    });

    it('should calculate correct statistics with track points', () => {
      const startTime = Date.now();
      
      // Add track points with known positions
      const trackPoint1 = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        altitude: 100,
        timestamp: new Date(startTime),
      });
      
      const trackPoint2 = createTrackPoint({
        latitude: 37.7750,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        altitude: 110,
        speed: 2.5,
        timestamp: new Date(startTime + 1000),
      });

      mockStore.getState().addTrackPoint(trackPoint1);
      mockStore.getState().addTrackPoint(trackPoint2);
      
      const stats = mockStore.getState().tracking.statistics;
      expect(stats.distance).toBeGreaterThan(0);
      expect(stats.currentSpeed).toBe(2.5);
      expect(stats.currentPace).toBeGreaterThan(0);
      expect(stats.elevationGain).toBe(10); // 110 - 100 = 10m
    });

    it('should handle empty track points', () => {
      mockStore.getState().updateStatistics();
      
      const stats = mockStore.getState().tracking.statistics;
      expect(stats.distance).toBe(0);
      expect(stats.currentSpeed).toBe(0);
      expect(stats.currentPace).toBe(0);
      expect(stats.avgPace).toBe(0);
    });
  });

  describe('statistics calculations', () => {
    beforeEach(async () => {
      await mockStore.getState().startTracking('test-user');
    });

    it('should calculate distance correctly using Haversine formula', () => {
      // Add two points approximately 111m apart (0.001 degrees latitude ≈ 111m)
      const trackPoint1 = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
      });
      
      const trackPoint2 = createTrackPoint({
        latitude: 37.7750,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        timestamp: new Date(Date.now() + 1000),
      });

      mockStore.getState().addTrackPoint(trackPoint1);
      mockStore.getState().addTrackPoint(trackPoint2);
      
      const stats = mockStore.getState().tracking.statistics;
      expect(stats.distance).toBeCloseTo(11.1, 1); // Within 0.1 meter
    });

    it('should calculate elevation changes with threshold', () => {
      const trackPoints: TrackPoint[] = [
        createTrackPoint({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 100,
        }),
        createTrackPoint({
          latitude: 37.7750,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 102, // +2m (below 3m threshold)
          timestamp: new Date(Date.now() + 1000),
        }),
        createTrackPoint({
          latitude: 37.7751,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 105, // +3m (meets threshold)
          timestamp: new Date(Date.now() + 2000),
        }),
        createTrackPoint({
          latitude: 37.7752,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          altitude: 101, // -4m (meets threshold)
          timestamp: new Date(Date.now() + 3000),
        }),
      ];

      trackPoints.forEach(point => mockStore.getState().addTrackPoint(point));
      
      const stats = mockStore.getState().tracking.statistics;
      expect(stats.elevationGain).toBe(3); // Only the 3m gain counts
      expect(stats.elevationLoss).toBe(4); // The 4m loss counts
    });

    it('should calculate pace correctly', () => {
      const trackPoint1 = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 2.5, // 2.5 m/s
      });
      
      const trackPoint2 = createTrackPoint({
        latitude: 37.7750,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 2.5, // 2.5 m/s
        timestamp: new Date(Date.now() + 1000),
      });

      mockStore.getState().addTrackPoint(trackPoint1);
      mockStore.getState().addTrackPoint(trackPoint2);
      
      const stats = mockStore.getState().tracking.statistics;
      // 2.5 m/s = 1000/2.5 = 400 seconds per km
      expect(stats.currentPace).toBe(400);
    });
  });

  describe('utility functions', () => {
    it('should set tracking status', () => {
      mockStore.getState().setTrackingStatus('paused');
      expect(mockStore.getState().tracking.status).toBe('paused');
    });

    it('should get current activity', async () => {
      expect(mockStore.getState().getCurrentActivity()).toBeNull();
      
      await mockStore.getState().startTracking('test-user');
      const activity = mockStore.getState().getCurrentActivity();
      expect(activity).not.toBeNull();
      expect(activity?.userId).toBe('test-user');
    });

    it('should get tracking statistics', async () => {
      const stats = mockStore.getState().getTrackingStatistics();
      expect(stats.elapsedTime).toBe(0);
      expect(stats.distance).toBe(0);
    });

    it('should reset tracking', async () => {
      await mockStore.getState().startTracking('test-user');
      expect(mockStore.getState().tracking.status).toBe('active');
      
      mockStore.getState().resetTracking();
      expect(mockStore.getState().tracking.status).toBe('inactive');
      expect(mockStore.getState().tracking.activity).toBeNull();
    });
  });
});