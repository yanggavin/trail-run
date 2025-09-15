import { EventEmitter } from 'events';
import { TrackPoint } from '../../types';

export interface AutoPauseConfig {
  speedThreshold: number; // m/s - speed below which to trigger auto-pause
  timeThreshold: number; // seconds - time below speed threshold before auto-pause
  enabled: boolean;
}

export interface AutoPauseState {
  isMonitoring: boolean;
  belowThresholdSince: number | null; // timestamp when speed first dropped below threshold
  consecutiveLowSpeedCount: number;
  lastSpeed: number;
}

/**
 * Service that monitors GPS track points and automatically triggers pause/resume
 * based on movement patterns (speed-based auto-pause detection)
 */
export class AutoPauseService extends EventEmitter {
  private config: AutoPauseConfig;
  private state: AutoPauseState;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<AutoPauseConfig> = {}) {
    super();
    
    this.config = {
      speedThreshold: 0.5, // 0.5 m/s as per requirements
      timeThreshold: 20, // 20 seconds as per requirements
      enabled: true,
      ...config,
    };

    this.state = {
      isMonitoring: false,
      belowThresholdSince: null,
      consecutiveLowSpeedCount: 0,
      lastSpeed: 0,
    };
  }

  /**
   * Start monitoring for auto-pause conditions
   */
  public startMonitoring(): void {
    if (this.state.isMonitoring || !this.config.enabled) {
      return;
    }

    this.state.isMonitoring = true;
    this.resetState();

    // Check auto-pause conditions every second
    this.checkInterval = setInterval(() => {
      this.checkAutoPauseConditions();
    }, 1000);

    this.emit('monitoringStarted');
  }

  /**
   * Stop monitoring for auto-pause conditions
   */
  public stopMonitoring(): void {
    if (!this.state.isMonitoring) {
      return;
    }

    this.state.isMonitoring = false;
    this.resetState();

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.emit('monitoringStopped');
  }

  /**
   * Process a new track point for auto-pause detection
   */
  public processTrackPoint(trackPoint: TrackPoint): void {
    if (!this.state.isMonitoring || !this.config.enabled) {
      return;
    }

    const speed = trackPoint.speed || 0;
    this.state.lastSpeed = speed;

    if (speed < this.config.speedThreshold) {
      // Speed is below threshold
      if (this.state.belowThresholdSince === null) {
        // First time below threshold
        this.state.belowThresholdSince = trackPoint.timestamp.getTime();
        this.state.consecutiveLowSpeedCount = 1;
      } else {
        // Still below threshold
        this.state.consecutiveLowSpeedCount++;
      }
    } else {
      // Speed is above threshold - reset auto-pause detection
      this.resetAutoPauseState();
    }

    this.emit('trackPointProcessed', {
      speed,
      belowThreshold: speed < this.config.speedThreshold,
      timeBelow: this.getTimeBelowThreshold(),
    });
  }

  /**
   * Manually trigger auto-pause (for testing or external triggers)
   */
  public triggerAutoPause(): void {
    if (!this.state.isMonitoring) {
      return;
    }

    this.emit('autoPauseTriggered', {
      reason: 'manual',
      speed: this.state.lastSpeed,
      timeBelow: this.getTimeBelowThreshold(),
    });

    this.resetAutoPauseState();
  }

  /**
   * Manually trigger auto-resume (for testing or external triggers)
   */
  public triggerAutoResume(): void {
    if (!this.state.isMonitoring) {
      return;
    }

    this.emit('autoResumeTriggered', {
      reason: 'manual',
      speed: this.state.lastSpeed,
    });
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<AutoPauseConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (!this.config.enabled && this.state.isMonitoring) {
      this.stopMonitoring();
    }

    this.emit('configUpdated', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): AutoPauseConfig {
    return { ...this.config };
  }

  /**
   * Get current state
   */
  public getState(): AutoPauseState {
    return { ...this.state };
  }

  /**
   * Check if auto-pause should be triggered based on current conditions
   */
  private checkAutoPauseConditions(): void {
    if (!this.state.isMonitoring || this.state.belowThresholdSince === null) {
      return;
    }

    const timeBelowThreshold = this.getTimeBelowThreshold();
    
    if (timeBelowThreshold >= this.config.timeThreshold) {
      // Auto-pause conditions met
      this.emit('autoPauseTriggered', {
        reason: 'speed_threshold',
        speed: this.state.lastSpeed,
        timeBelow: timeBelowThreshold,
      });

      this.resetAutoPauseState();
    }
  }

  /**
   * Get time in seconds that speed has been below threshold
   */
  private getTimeBelowThreshold(): number {
    if (this.state.belowThresholdSince === null) {
      return 0;
    }

    return (Date.now() - this.state.belowThresholdSince) / 1000;
  }

  /**
   * Reset auto-pause detection state
   */
  private resetAutoPauseState(): void {
    this.state.belowThresholdSince = null;
    this.state.consecutiveLowSpeedCount = 0;
  }

  /**
   * Reset all state
   */
  private resetState(): void {
    this.resetAutoPauseState();
    this.state.lastSpeed = 0;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const autoPauseService = new AutoPauseService();