import { AutoPauseService } from '../AutoPauseService';
import { createTrackPoint } from '../../../types/models';

describe('AutoPauseService', () => {
  let service: AutoPauseService;

  beforeEach(() => {
    service = new AutoPauseService();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    service.cleanup();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = service.getConfig();
      expect(config.speedThreshold).toBe(0.5);
      expect(config.timeThreshold).toBe(20);
      expect(config.enabled).toBe(true);
    });

    it('should initialize with custom config', () => {
      const customService = new AutoPauseService({
        speedThreshold: 1.0,
        timeThreshold: 30,
        enabled: false,
      });

      const config = customService.getConfig();
      expect(config.speedThreshold).toBe(1.0);
      expect(config.timeThreshold).toBe(30);
      expect(config.enabled).toBe(false);

      customService.cleanup();
    });

    it('should initialize with correct state', () => {
      const state = service.getState();
      expect(state.isMonitoring).toBe(false);
      expect(state.belowThresholdSince).toBeNull();
      expect(state.consecutiveLowSpeedCount).toBe(0);
      expect(state.lastSpeed).toBe(0);
    });
  });

  describe('monitoring control', () => {
    it('should start monitoring', () => {
      const startSpy = jest.fn();
      service.on('monitoringStarted', startSpy);

      service.startMonitoring();

      expect(service.getState().isMonitoring).toBe(true);
      expect(startSpy).toHaveBeenCalled();
    });

    it('should stop monitoring', () => {
      const stopSpy = jest.fn();
      service.on('monitoringStopped', stopSpy);

      service.startMonitoring();
      service.stopMonitoring();

      expect(service.getState().isMonitoring).toBe(false);
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should not start monitoring if disabled', () => {
      service.updateConfig({ enabled: false });
      service.startMonitoring();

      expect(service.getState().isMonitoring).toBe(false);
    });

    it('should reset state when starting monitoring', () => {
      // Set some state
      service.startMonitoring();
      const trackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 0.3, // Below threshold
      });
      service.processTrackPoint(trackPoint);

      expect(service.getState().belowThresholdSince).not.toBeNull();

      // Stop and restart
      service.stopMonitoring();
      service.startMonitoring();

      expect(service.getState().belowThresholdSince).toBeNull();
    });
  });

  describe('track point processing', () => {
    beforeEach(() => {
      service.startMonitoring();
    });

    it('should process track point with speed above threshold', () => {
      const processSpy = jest.fn();
      service.on('trackPointProcessed', processSpy);

      const trackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 2.5, // Above threshold
      });

      service.processTrackPoint(trackPoint);

      const state = service.getState();
      expect(state.lastSpeed).toBe(2.5);
      expect(state.belowThresholdSince).toBeNull();
      expect(state.consecutiveLowSpeedCount).toBe(0);
      expect(processSpy).toHaveBeenCalledWith({
        speed: 2.5,
        belowThreshold: false,
        timeBelow: 0,
      });
    });

    it('should process track point with speed below threshold', () => {
      const processSpy = jest.fn();
      service.on('trackPointProcessed', processSpy);

      const trackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 0.3, // Below threshold
      });

      service.processTrackPoint(trackPoint);

      const state = service.getState();
      expect(state.lastSpeed).toBe(0.3);
      expect(state.belowThresholdSince).not.toBeNull();
      expect(state.consecutiveLowSpeedCount).toBe(1);
      expect(processSpy).toHaveBeenCalledWith({
        speed: 0.3,
        belowThreshold: true,
        timeBelow: 0,
      });
    });

    it('should reset auto-pause state when speed goes above threshold', () => {
      // First, go below threshold
      const lowSpeedPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 0.3,
      });
      service.processTrackPoint(lowSpeedPoint);

      expect(service.getState().belowThresholdSince).not.toBeNull();

      // Then, go above threshold
      const highSpeedPoint = createTrackPoint({
        latitude: 37.7750,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 2.5,
        timestamp: new Date(Date.now() + 1000),
      });
      service.processTrackPoint(highSpeedPoint);

      const state = service.getState();
      expect(state.belowThresholdSince).toBeNull();
      expect(state.consecutiveLowSpeedCount).toBe(0);
    });

    it('should not process track points when not monitoring', () => {
      service.stopMonitoring();

      const trackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 0.3,
      });

      service.processTrackPoint(trackPoint);

      const state = service.getState();
      expect(state.lastSpeed).toBe(0); // Should not be updated
    });

    it('should handle track points without speed', () => {
      const trackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        // No speed property
      });

      service.processTrackPoint(trackPoint);

      const state = service.getState();
      expect(state.lastSpeed).toBe(0);
      expect(state.belowThresholdSince).not.toBeNull(); // 0 speed is below threshold
    });
  });

  describe('auto-pause triggering', () => {
    beforeEach(() => {
      service.startMonitoring();
    });

    it('should trigger auto-pause after time threshold', () => {
      const autoPauseSpy = jest.fn();
      service.on('autoPauseTriggered', autoPauseSpy);

      // Create track point with low speed
      const trackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 0.3,
      });

      service.processTrackPoint(trackPoint);

      // Fast-forward time to trigger auto-pause (20 seconds)
      jest.advanceTimersByTime(21000);

      expect(autoPauseSpy).toHaveBeenCalledWith({
        reason: 'speed_threshold',
        speed: 0.3,
        timeBelow: expect.any(Number),
      });

      // State should be reset after auto-pause
      const state = service.getState();
      expect(state.belowThresholdSince).toBeNull();
    });

    it('should not trigger auto-pause before time threshold', () => {
      const autoPauseSpy = jest.fn();
      service.on('autoPauseTriggered', autoPauseSpy);

      const trackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 0.3,
      });

      service.processTrackPoint(trackPoint);

      // Fast-forward time but not enough to trigger auto-pause
      jest.advanceTimersByTime(15000);

      expect(autoPauseSpy).not.toHaveBeenCalled();
    });

    it('should manually trigger auto-pause', () => {
      const autoPauseSpy = jest.fn();
      service.on('autoPauseTriggered', autoPauseSpy);

      service.triggerAutoPause();

      expect(autoPauseSpy).toHaveBeenCalledWith({
        reason: 'manual',
        speed: 0,
        timeBelow: 0,
      });
    });

    it('should manually trigger auto-resume', () => {
      const autoResumeSpy = jest.fn();
      service.on('autoResumeTriggered', autoResumeSpy);

      service.triggerAutoResume();

      expect(autoResumeSpy).toHaveBeenCalledWith({
        reason: 'manual',
        speed: 0,
      });
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const configSpy = jest.fn();
      service.on('configUpdated', configSpy);

      const newConfig = {
        speedThreshold: 1.0,
        timeThreshold: 30,
      };

      service.updateConfig(newConfig);

      const config = service.getConfig();
      expect(config.speedThreshold).toBe(1.0);
      expect(config.timeThreshold).toBe(30);
      expect(config.enabled).toBe(true); // Should keep existing value
      expect(configSpy).toHaveBeenCalledWith(config);
    });

    it('should stop monitoring when disabled via config', () => {
      service.startMonitoring();
      expect(service.getState().isMonitoring).toBe(true);

      service.updateConfig({ enabled: false });

      expect(service.getState().isMonitoring).toBe(false);
    });

    it('should use updated thresholds for auto-pause detection', () => {
      const autoPauseSpy = jest.fn();
      service.on('autoPauseTriggered', autoPauseSpy);

      // Update config to have lower time threshold
      service.updateConfig({ timeThreshold: 5 });
      service.startMonitoring();

      const trackPoint = createTrackPoint({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        source: 'gps',
        speed: 0.3,
      });

      service.processTrackPoint(trackPoint);

      // Fast-forward by new threshold (5 seconds)
      jest.advanceTimersByTime(6000);

      expect(autoPauseSpy).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple consecutive low-speed points', () => {
      service.startMonitoring();

      const baseTime = Date.now();
      for (let i = 0; i < 5; i++) {
        const trackPoint = createTrackPoint({
          latitude: 37.7749 + i * 0.0001,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          speed: 0.2,
          timestamp: new Date(baseTime + i * 1000),
        });
        service.processTrackPoint(trackPoint);
      }

      const state = service.getState();
      expect(state.consecutiveLowSpeedCount).toBe(5);
      expect(state.belowThresholdSince).not.toBeNull();
    });

    it('should handle rapid speed changes', () => {
      service.startMonitoring();

      const speeds = [0.2, 2.5, 0.3, 1.8, 0.1];
      const baseTime = Date.now();

      speeds.forEach((speed, i) => {
        const trackPoint = createTrackPoint({
          latitude: 37.7749 + i * 0.0001,
          longitude: -122.4194,
          accuracy: 5,
          source: 'gps',
          speed,
          timestamp: new Date(baseTime + i * 1000),
        });
        service.processTrackPoint(trackPoint);
      });

      const state = service.getState();
      expect(state.lastSpeed).toBe(0.1);
      // Should have reset and restarted counting due to speed changes
      expect(state.consecutiveLowSpeedCount).toBe(1);
    });

    it('should cleanup properly', () => {
      service.startMonitoring();
      expect(service.getState().isMonitoring).toBe(true);

      service.cleanup();

      expect(service.getState().isMonitoring).toBe(false);
      expect(service.listenerCount('autoPauseTriggered')).toBe(0);
    });
  });
});