import React from 'react';
import { render } from '@testing-library/react-native';
import ElevationChart from '../ElevationChart';
import { TrackPoint } from '../../../types';

// Mock Dimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
    },
  };
});

describe('ElevationChart', () => {
  const createTrackPoint = (altitude?: number, timestamp?: Date): TrackPoint => ({
    timestamp: timestamp || new Date(),
    latitude: 37.7749,
    longitude: -122.4194,
    altitude,
    accuracy: 5,
    speed: 2.5,
    heading: 180,
    source: 'gps',
  });

  describe('rendering', () => {
    it('should render elevation chart with valid data', () => {
      const trackPoints = [
        createTrackPoint(100),
        createTrackPoint(110),
        createTrackPoint(105),
        createTrackPoint(120),
        createTrackPoint(115),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      expect(getByText('Elevation Profile')).toBeTruthy();
      expect(getByText('Min')).toBeTruthy();
      expect(getByText('Max')).toBeTruthy();
      expect(getByText('Range')).toBeTruthy();
    });

    it('should display no data message when insufficient elevation data', () => {
      const trackPoints = [
        createTrackPoint(100),
        // Only one point with elevation data
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      expect(getByText('Elevation Profile')).toBeTruthy();
      expect(getByText('No elevation data available')).toBeTruthy();
    });

    it('should display no data message when no elevation data', () => {
      const trackPoints = [
        createTrackPoint(), // No altitude
        createTrackPoint(), // No altitude
        createTrackPoint(), // No altitude
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      expect(getByText('No elevation data available')).toBeTruthy();
    });

    it('should display no data message for empty track points', () => {
      const { getByText } = render(<ElevationChart trackPoints={[]} />);

      expect(getByText('No elevation data available')).toBeTruthy();
    });
  });

  describe('elevation calculations', () => {
    it('should calculate correct min, max, and range values', () => {
      const trackPoints = [
        createTrackPoint(100),
        createTrackPoint(150),
        createTrackPoint(75),
        createTrackPoint(125),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      // Min should be 75m
      expect(getByText('75m')).toBeTruthy();
      // Max should be 150m
      expect(getByText('150m')).toBeTruthy();
      // Range should be 75m (150 - 75)
      expect(getByText('75m')).toBeTruthy();
    });

    it('should handle identical elevation values', () => {
      const trackPoints = [
        createTrackPoint(100),
        createTrackPoint(100),
        createTrackPoint(100),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      // Min and max should both be 100m
      expect(getByText('100m')).toBeTruthy();
      // Range should be 0m
      expect(getByText('0m')).toBeTruthy();
    });

    it('should round elevation values to nearest meter', () => {
      const trackPoints = [
        createTrackPoint(100.7),
        createTrackPoint(150.3),
        createTrackPoint(75.9),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      // Values should be rounded
      expect(getByText('76m')).toBeTruthy(); // 75.9 rounded
      expect(getByText('150m')).toBeTruthy(); // 150.3 rounded
      expect(getByText('74m')).toBeTruthy(); // Range: 150 - 76 = 74
    });
  });

  describe('data filtering', () => {
    it('should filter out track points without elevation data', () => {
      const trackPoints = [
        createTrackPoint(100),
        createTrackPoint(), // No altitude
        createTrackPoint(110),
        createTrackPoint(), // No altitude
        createTrackPoint(105),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      // Should only consider points with elevation data (100, 110, 105)
      expect(getByText('100m')).toBeTruthy(); // Min
      expect(getByText('110m')).toBeTruthy(); // Max
      expect(getByText('10m')).toBeTruthy(); // Range
    });

    it('should handle mixed valid and invalid elevation values', () => {
      const trackPoints = [
        createTrackPoint(100),
        createTrackPoint(0), // Valid but zero elevation
        createTrackPoint(110),
        createTrackPoint(undefined), // Invalid
        createTrackPoint(105),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      // Should include zero elevation as valid
      expect(getByText('0m')).toBeTruthy(); // Min (0)
      expect(getByText('110m')).toBeTruthy(); // Max
      expect(getByText('110m')).toBeTruthy(); // Range (110 - 0)
    });
  });

  describe('edge cases', () => {
    it('should handle very small elevation ranges', () => {
      const trackPoints = [
        createTrackPoint(100.1),
        createTrackPoint(100.2),
        createTrackPoint(100.0),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      // Should still render chart even with tiny range
      expect(getByText('Elevation Profile')).toBeTruthy();
      expect(getByText('Min')).toBeTruthy();
      expect(getByText('Max')).toBeTruthy();
    });

    it('should handle negative elevation values', () => {
      const trackPoints = [
        createTrackPoint(-10),
        createTrackPoint(50),
        createTrackPoint(-5),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      expect(getByText('-10m')).toBeTruthy(); // Min
      expect(getByText('50m')).toBeTruthy(); // Max
      expect(getByText('60m')).toBeTruthy(); // Range (50 - (-10))
    });

    it('should handle very large elevation values', () => {
      const trackPoints = [
        createTrackPoint(8000),
        createTrackPoint(8500),
        createTrackPoint(7800),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      expect(getByText('7800m')).toBeTruthy(); // Min
      expect(getByText('8500m')).toBeTruthy(); // Max
      expect(getByText('700m')).toBeTruthy(); // Range
    });
  });

  describe('component structure', () => {
    it('should render all required UI elements with elevation data', () => {
      const trackPoints = [
        createTrackPoint(100),
        createTrackPoint(110),
        createTrackPoint(105),
      ];

      const { getByText, getByTestId } = render(<ElevationChart trackPoints={trackPoints} />);

      // Title
      expect(getByText('Elevation Profile')).toBeTruthy();
      
      // Statistics labels
      expect(getByText('Min')).toBeTruthy();
      expect(getByText('Max')).toBeTruthy();
      expect(getByText('Range')).toBeTruthy();
      
      // Statistics values
      expect(getByText('100m')).toBeTruthy();
      expect(getByText('110m')).toBeTruthy();
      expect(getByText('10m')).toBeTruthy();
    });

    it('should have proper accessibility structure', () => {
      const trackPoints = [
        createTrackPoint(100),
        createTrackPoint(110),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      // Check that text elements are rendered (accessible by screen readers)
      expect(getByText('Elevation Profile')).toBeTruthy();
      expect(getByText('Min')).toBeTruthy();
      expect(getByText('Max')).toBeTruthy();
      expect(getByText('Range')).toBeTruthy();
    });
  });

  describe('performance considerations', () => {
    it('should handle large datasets efficiently', () => {
      // Create a large dataset
      const trackPoints = Array.from({ length: 1000 }, (_, index) => 
        createTrackPoint(100 + Math.sin(index / 10) * 50)
      );

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      // Should still render without issues
      expect(getByText('Elevation Profile')).toBeTruthy();
      expect(getByText('Min')).toBeTruthy();
      expect(getByText('Max')).toBeTruthy();
    });

    it('should handle single elevation point gracefully', () => {
      const trackPoints = [
        createTrackPoint(), // No elevation
        createTrackPoint(100), // Only one with elevation
        createTrackPoint(), // No elevation
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      // Should show no data message since we need at least 2 points
      expect(getByText('No elevation data available')).toBeTruthy();
    });
  });

  describe('data validation', () => {
    it('should handle null and undefined values gracefully', () => {
      const trackPoints = [
        createTrackPoint(null as any),
        createTrackPoint(undefined),
        createTrackPoint(100),
        createTrackPoint(110),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      // Should only consider valid elevation values
      expect(getByText('100m')).toBeTruthy();
      expect(getByText('110m')).toBeTruthy();
      expect(getByText('10m')).toBeTruthy();
    });

    it('should handle NaN elevation values', () => {
      const trackPoints = [
        createTrackPoint(NaN),
        createTrackPoint(100),
        createTrackPoint(110),
      ];

      const { getByText } = render(<ElevationChart trackPoints={trackPoints} />);

      // Should filter out NaN values
      expect(getByText('100m')).toBeTruthy();
      expect(getByText('110m')).toBeTruthy();
    });
  });
});