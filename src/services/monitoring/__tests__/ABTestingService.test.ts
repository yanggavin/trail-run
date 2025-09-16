import { abTestingService } from '../ABTestingService';
import { analyticsService } from '../AnalyticsService';

// Mock AnalyticsService
jest.mock('../AnalyticsService', () => ({
  analyticsService: {
    trackABTestAssignment: jest.fn(),
    trackABTestConversion: jest.fn(),
    trackEvent: jest.fn(),
  },
}));

describe('ABTestingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    abTestingService.clearAssignments();
  });

  describe('registerExperiment', () => {
    it('should register a valid experiment', () => {
      const config = {
        experimentName: 'test_experiment',
        variants: [
          { name: 'control', weight: 50, config: { feature: false } },
          { name: 'treatment', weight: 50, config: { feature: true } },
        ],
        trafficAllocation: 100,
        isActive: true,
      };

      expect(() => abTestingService.registerExperiment(config)).not.toThrow();
      
      const experiment = abTestingService.getExperiment('test_experiment');
      expect(experiment).toEqual(config);
    });

    it('should throw error for invalid variant weights', () => {
      const config = {
        experimentName: 'invalid_experiment',
        variants: [
          { name: 'control', weight: 60, config: { feature: false } },
          { name: 'treatment', weight: 50, config: { feature: true } },
        ],
        trafficAllocation: 100,
        isActive: true,
      };

      expect(() => abTestingService.registerExperiment(config)).toThrow(
        'Variant weights must sum to 100'
      );
    });
  });

  describe('getVariant', () => {
    beforeEach(() => {
      const config = {
        experimentName: 'test_experiment',
        variants: [
          { name: 'control', weight: 50, config: { feature: false } },
          { name: 'treatment', weight: 50, config: { feature: true } },
        ],
        trafficAllocation: 100,
        isActive: true,
      };
      abTestingService.registerExperiment(config);
    });

    it('should return null for non-existent experiment', () => {
      const assignment = abTestingService.getVariant('non_existent', 'user123');
      expect(assignment).toBeNull();
    });

    it('should return null for inactive experiment', () => {
      abTestingService.setExperimentActive('test_experiment', false);
      
      const assignment = abTestingService.getVariant('test_experiment', 'user123');
      expect(assignment).toBeNull();
    });

    it('should assign variant and track assignment', () => {
      const assignment = abTestingService.getVariant('test_experiment', 'user123');
      
      expect(assignment).not.toBeNull();
      expect(assignment!.experimentName).toBe('test_experiment');
      expect(['control', 'treatment']).toContain(assignment!.variantName);
      expect(assignment!.config).toBeDefined();
      expect(assignment!.assignedAt).toBeDefined();

      expect(analyticsService.trackABTestAssignment).toHaveBeenCalledWith(
        'test_experiment',
        assignment!.variantName
      );
    });

    it('should return same assignment for same user', () => {
      const assignment1 = abTestingService.getVariant('test_experiment', 'user123');
      const assignment2 = abTestingService.getVariant('test_experiment', 'user123');
      
      expect(assignment1).toEqual(assignment2);
      expect(analyticsService.trackABTestAssignment).toHaveBeenCalledTimes(1);
    });

    it('should respect traffic allocation', () => {
      // Register experiment with 0% traffic allocation
      const config = {
        experimentName: 'no_traffic_experiment',
        variants: [
          { name: 'control', weight: 100, config: { feature: false } },
        ],
        trafficAllocation: 0,
        isActive: true,
      };
      abTestingService.registerExperiment(config);

      const assignment = abTestingService.getVariant('no_traffic_experiment', 'user123');
      expect(assignment).toBeNull();
    });
  });

  describe('trackConversion', () => {
    beforeEach(() => {
      abTestingService.clearAssignments();
      const config = {
        experimentName: 'conversion_test_experiment',
        variants: [
          { name: 'control', weight: 50, config: { feature: false } },
          { name: 'treatment', weight: 50, config: { feature: true } },
        ],
        trafficAllocation: 100,
        isActive: true,
      };
      abTestingService.registerExperiment(config);
    });

    it('should track conversion for assigned user', () => {
      const assignment = abTestingService.getVariant('conversion_test_experiment', 'user123');
      expect(assignment).not.toBeNull();

      abTestingService.trackConversion(
        'conversion_test_experiment',
        'user123',
        'button_click',
        1.5,
        { page: 'home' }
      );

      expect(analyticsService.trackABTestConversion).toHaveBeenCalledWith(
        'conversion_test_experiment',
        assignment!.variantName,
        'button_click'
      );

      expect(analyticsService.trackEvent).toHaveBeenCalledWith(
        'AB Test Conversion',
        expect.objectContaining({
          experiment_name: 'conversion_test_experiment',
          variant_name: assignment!.variantName,
          conversion_type: 'button_click',
          conversion_value: 1.5,
          page: 'home',
        })
      );
    });

    it('should not track conversion for unassigned user', () => {
      abTestingService.trackConversion(
        'conversion_test_experiment',
        'unassigned_user',
        'button_click'
      );

      // Should not have been called for this specific conversion
      const calls = (analyticsService.trackABTestConversion as jest.Mock).mock.calls;
      const relevantCalls = calls.filter(call => 
        call[0] === 'conversion_test_experiment' && 
        call[2] === 'button_click'
      );
      expect(relevantCalls).toHaveLength(0);
    });
  });

  describe('isFeatureEnabled', () => {
    beforeEach(() => {
      const config = {
        experimentName: 'feature_flag',
        variants: [
          { name: 'disabled', weight: 50, config: { enabled: false } },
          { name: 'enabled', weight: 50, config: { enabled: true } },
        ],
        trafficAllocation: 100,
        isActive: true,
      };
      abTestingService.registerExperiment(config);
    });

    it('should return feature status based on assignment', () => {
      const isEnabled = abTestingService.isFeatureEnabled('feature_flag', 'user123');
      expect(typeof isEnabled).toBe('boolean');
    });

    it('should return default value for unassigned user', () => {
      const isEnabled = abTestingService.isFeatureEnabled('non_existent', 'user123', true);
      expect(isEnabled).toBe(true);
    });
  });

  describe('getConfigValue', () => {
    beforeEach(() => {
      const config = {
        experimentName: 'config_experiment',
        variants: [
          { name: 'low', weight: 50, config: { threshold: 10 } },
          { name: 'high', weight: 50, config: { threshold: 20 } },
        ],
        trafficAllocation: 100,
        isActive: true,
      };
      abTestingService.registerExperiment(config);
    });

    it('should return config value based on assignment', () => {
      const threshold = abTestingService.getConfigValue(
        'config_experiment',
        'user123',
        'threshold',
        15
      );
      expect([10, 20]).toContain(threshold);
    });

    it('should return default value for missing config', () => {
      const value = abTestingService.getConfigValue(
        'config_experiment',
        'user123',
        'missing_key',
        'default'
      );
      expect(value).toBe('default');
    });
  });

  describe('forceAssignment', () => {
    beforeEach(() => {
      const config = {
        experimentName: 'test_experiment',
        variants: [
          { name: 'control', weight: 50, config: { feature: false } },
          { name: 'treatment', weight: 50, config: { feature: true } },
        ],
        trafficAllocation: 100,
        isActive: true,
      };
      abTestingService.registerExperiment(config);
    });

    it('should force assign user to specific variant', () => {
      abTestingService.forceAssignment('test_experiment', 'user123', 'treatment');
      
      const assignment = abTestingService.getVariant('test_experiment', 'user123');
      expect(assignment!.variantName).toBe('treatment');

      expect(analyticsService.trackEvent).toHaveBeenCalledWith(
        'AB Test Force Assignment',
        expect.objectContaining({
          experiment_name: 'test_experiment',
          variant_name: 'treatment',
          forced: true,
        })
      );
    });

    it('should throw error for invalid experiment', () => {
      expect(() => {
        abTestingService.forceAssignment('invalid', 'user123', 'treatment');
      }).toThrow('Experiment invalid not found');
    });

    it('should throw error for invalid variant', () => {
      expect(() => {
        abTestingService.forceAssignment('test_experiment', 'user123', 'invalid');
      }).toThrow('Variant invalid not found');
    });
  });

  describe('getUserAssignments', () => {
    beforeEach(() => {
      const config1 = {
        experimentName: 'experiment_1',
        variants: [
          { name: 'control', weight: 100, config: { feature: false } },
        ],
        trafficAllocation: 100,
        isActive: true,
      };

      const config2 = {
        experimentName: 'experiment_2',
        variants: [
          { name: 'treatment', weight: 100, config: { feature: true } },
        ],
        trafficAllocation: 100,
        isActive: true,
      };

      abTestingService.registerExperiment(config1);
      abTestingService.registerExperiment(config2);
    });

    it('should return all assignments for a user', () => {
      abTestingService.getVariant('experiment_1', 'user123');
      abTestingService.getVariant('experiment_2', 'user123');

      const assignments = abTestingService.getUserAssignments('user123');
      expect(assignments).toHaveLength(2);
      expect(assignments.map(a => a.experimentName)).toContain('experiment_1');
      expect(assignments.map(a => a.experimentName)).toContain('experiment_2');
    });

    it('should return empty array for user with no assignments', () => {
      const assignments = abTestingService.getUserAssignments('unassigned_user');
      expect(assignments).toHaveLength(0);
    });
  });

  describe('clearAssignments', () => {
    beforeEach(() => {
      const config = {
        experimentName: 'test_experiment',
        variants: [
          { name: 'control', weight: 100, config: { feature: false } },
        ],
        trafficAllocation: 100,
        isActive: true,
      };
      abTestingService.registerExperiment(config);
      abTestingService.getVariant('test_experiment', 'user123');
    });

    it('should clear assignments for specific user', () => {
      let assignments = abTestingService.getUserAssignments('user123');
      expect(assignments).toHaveLength(1);

      abTestingService.clearAssignments('user123');

      assignments = abTestingService.getUserAssignments('user123');
      expect(assignments).toHaveLength(0);
    });

    it('should clear all assignments', () => {
      abTestingService.getVariant('test_experiment', 'user456');
      
      abTestingService.clearAssignments();

      expect(abTestingService.getUserAssignments('user123')).toHaveLength(0);
      expect(abTestingService.getUserAssignments('user456')).toHaveLength(0);
    });
  });

  describe('listExperiments', () => {
    it('should return all registered experiments', () => {
      // Clear existing experiments first
      const existingCount = abTestingService.listExperiments().length;
      
      const config1 = {
        experimentName: 'list_experiment_1',
        variants: [{ name: 'control', weight: 100, config: {} }],
        trafficAllocation: 100,
        isActive: true,
      };

      const config2 = {
        experimentName: 'list_experiment_2',
        variants: [{ name: 'treatment', weight: 100, config: {} }],
        trafficAllocation: 50,
        isActive: false,
      };

      abTestingService.registerExperiment(config1);
      abTestingService.registerExperiment(config2);

      const experiments = abTestingService.listExperiments();
      expect(experiments.length).toBeGreaterThanOrEqual(2);
      expect(experiments.map(e => e.experimentName)).toContain('list_experiment_1');
      expect(experiments.map(e => e.experimentName)).toContain('list_experiment_2');
    });
  });
});