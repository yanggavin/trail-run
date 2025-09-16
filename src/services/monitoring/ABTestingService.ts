import { analyticsService } from './AnalyticsService';

export interface ABTestConfig {
  experimentName: string;
  variants: ABTestVariant[];
  trafficAllocation: number; // Percentage of users to include (0-100)
  isActive: boolean;
}

export interface ABTestVariant {
  name: string;
  weight: number; // Percentage allocation for this variant (0-100)
  config: Record<string, any>;
}

export interface ABTestAssignment {
  experimentName: string;
  variantName: string;
  config: Record<string, any>;
  assignedAt: string;
}

export interface ABTestResult {
  experimentName: string;
  variantName: string;
  conversionType: string;
  value?: number;
  metadata?: Record<string, any>;
}

class ABTestingService {
  private assignments: Map<string, ABTestAssignment> = new Map();
  private experiments: Map<string, ABTestConfig> = new Map();

  /**
   * Register an A/B test experiment
   */
  registerExperiment(config: ABTestConfig): void {
    // Validate variant weights sum to 100
    const totalWeight = config.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error(`Variant weights must sum to 100, got ${totalWeight}`);
    }

    this.experiments.set(config.experimentName, config);
  }

  /**
   * Get variant assignment for a user and experiment
   */
  getVariant(experimentName: string, userId: string): ABTestAssignment | null {
    const experiment = this.experiments.get(experimentName);
    if (!experiment || !experiment.isActive) {
      return null;
    }

    // Check if user already has an assignment
    const assignmentKey = `${experimentName}_${userId}`;
    if (this.assignments.has(assignmentKey)) {
      return this.assignments.get(assignmentKey)!;
    }

    // Check if user should be included in the experiment
    if (!this.shouldIncludeUser(userId, experiment.trafficAllocation)) {
      return null;
    }

    // Assign variant based on deterministic hash
    const variant = this.assignVariant(userId, experiment.variants);
    const assignment: ABTestAssignment = {
      experimentName,
      variantName: variant.name,
      config: variant.config,
      assignedAt: new Date().toISOString(),
    };

    // Store assignment
    this.assignments.set(assignmentKey, assignment);

    // Track assignment
    analyticsService.trackABTestAssignment(experimentName, variant.name);

    return assignment;
  }

  /**
   * Track a conversion for an A/B test
   */
  trackConversion(
    experimentName: string,
    userId: string,
    conversionType: string,
    value?: number,
    metadata?: Record<string, any>
  ): void {
    const assignment = this.getVariant(experimentName, userId);
    if (!assignment) {
      return;
    }

    // Track conversion event
    analyticsService.trackABTestConversion(
      experimentName,
      assignment.variantName,
      conversionType
    );

    // Also track as a regular event with more details
    analyticsService.trackEvent('AB Test Conversion', {
      experiment_name: experimentName,
      variant_name: assignment.variantName,
      conversion_type: conversionType,
      conversion_value: value,
      ...metadata,
    });
  }

  /**
   * Get all active assignments for a user
   */
  getUserAssignments(userId: string): ABTestAssignment[] {
    const userAssignments: ABTestAssignment[] = [];
    
    for (const [key, assignment] of this.assignments.entries()) {
      if (key.endsWith(`_${userId}`)) {
        userAssignments.push(assignment);
      }
    }

    return userAssignments;
  }

  /**
   * Check if a feature flag is enabled for a user
   */
  isFeatureEnabled(featureName: string, userId: string, defaultValue: boolean = false): boolean {
    const assignment = this.getVariant(featureName, userId);
    if (!assignment) {
      return defaultValue;
    }

    return assignment.config.enabled === true;
  }

  /**
   * Get configuration value for a user in an experiment
   */
  getConfigValue<T>(
    experimentName: string,
    userId: string,
    configKey: string,
    defaultValue: T
  ): T {
    const assignment = this.getVariant(experimentName, userId);
    if (!assignment || !(configKey in assignment.config)) {
      return defaultValue;
    }

    return assignment.config[configKey] as T;
  }

  /**
   * Force assign a user to a specific variant (for testing)
   */
  forceAssignment(experimentName: string, userId: string, variantName: string): void {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      throw new Error(`Experiment ${experimentName} not found`);
    }

    const variant = experiment.variants.find(v => v.name === variantName);
    if (!variant) {
      throw new Error(`Variant ${variantName} not found in experiment ${experimentName}`);
    }

    const assignment: ABTestAssignment = {
      experimentName,
      variantName: variant.name,
      config: variant.config,
      assignedAt: new Date().toISOString(),
    };

    const assignmentKey = `${experimentName}_${userId}`;
    this.assignments.set(assignmentKey, assignment);

    // Track forced assignment
    analyticsService.trackEvent('AB Test Force Assignment', {
      experiment_name: experimentName,
      variant_name: variantName,
      forced: true,
    });
  }

  /**
   * Clear all assignments (for testing or user reset)
   */
  clearAssignments(userId?: string): void {
    if (userId) {
      // Clear assignments for specific user
      const keysToDelete: string[] = [];
      for (const key of this.assignments.keys()) {
        if (key.endsWith(`_${userId}`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.assignments.delete(key));
    } else {
      // Clear all assignments
      this.assignments.clear();
    }
  }

  /**
   * Get experiment configuration
   */
  getExperiment(experimentName: string): ABTestConfig | null {
    return this.experiments.get(experimentName) || null;
  }

  /**
   * List all registered experiments
   */
  listExperiments(): ABTestConfig[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Activate or deactivate an experiment
   */
  setExperimentActive(experimentName: string, isActive: boolean): void {
    const experiment = this.experiments.get(experimentName);
    if (experiment) {
      experiment.isActive = isActive;
      this.experiments.set(experimentName, experiment);
    }
  }

  /**
   * Determine if user should be included in experiment based on traffic allocation
   */
  private shouldIncludeUser(userId: string, trafficAllocation: number): boolean {
    if (trafficAllocation >= 100) {
      return true;
    }
    if (trafficAllocation <= 0) {
      return false;
    }

    // Use deterministic hash to decide inclusion
    const hash = this.hashUserId(userId);
    const percentage = (hash % 100) + 1; // 1-100
    return percentage <= trafficAllocation;
  }

  /**
   * Assign variant based on deterministic hash
   */
  private assignVariant(userId: string, variants: ABTestVariant[]): ABTestVariant {
    const hash = this.hashUserId(userId);
    const percentage = hash % 100; // 0-99

    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (percentage < cumulativeWeight) {
        return variant;
      }
    }

    // Fallback to first variant (shouldn't happen if weights sum to 100)
    return variants[0];
  }

  /**
   * Simple hash function for user ID
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

export const abTestingService = new ABTestingService();

// Example experiment configurations
export const EXPERIMENTS = {
  PHOTO_QUALITY_OPTIMIZATION: {
    experimentName: 'photo_quality_optimization',
    variants: [
      {
        name: 'control',
        weight: 50,
        config: { compressionQuality: 0.8, maxResolution: 1920 },
      },
      {
        name: 'high_quality',
        weight: 50,
        config: { compressionQuality: 0.9, maxResolution: 2560 },
      },
    ],
    trafficAllocation: 100,
    isActive: true,
  },
  
  GPS_ACCURACY_THRESHOLD: {
    experimentName: 'gps_accuracy_threshold',
    variants: [
      {
        name: 'standard',
        weight: 50,
        config: { accuracyThreshold: 20 },
      },
      {
        name: 'strict',
        weight: 50,
        config: { accuracyThreshold: 10 },
      },
    ],
    trafficAllocation: 50, // Only 50% of users
    isActive: true,
  },

  BATTERY_OPTIMIZATION: {
    experimentName: 'battery_optimization',
    variants: [
      {
        name: 'control',
        weight: 33,
        config: { 
          locationUpdateInterval: 5000,
          backgroundLocationEnabled: true,
        },
      },
      {
        name: 'power_saver',
        weight: 33,
        config: { 
          locationUpdateInterval: 10000,
          backgroundLocationEnabled: false,
        },
      },
      {
        name: 'adaptive',
        weight: 34,
        config: { 
          locationUpdateInterval: 'adaptive',
          backgroundLocationEnabled: 'adaptive',
        },
      },
    ],
    trafficAllocation: 75,
    isActive: true,
  },
} as const;