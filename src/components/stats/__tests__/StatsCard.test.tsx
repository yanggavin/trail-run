import React from 'react';
import { render } from '@testing-library/react-native';
import StatsCard from '../StatsCard';

describe('StatsCard', () => {
  const defaultProps = {
    title: 'Distance',
    value: '5.2',
    unit: 'km',
  };

  describe('rendering', () => {
    it('should render with required props', () => {
      const { getByText } = render(
        <StatsCard title="Distance" value="5.2" />
      );

      expect(getByText('Distance')).toBeTruthy();
      expect(getByText('5.2')).toBeTruthy();
    });

    it('should render with all props', () => {
      const { getByText } = render(
        <StatsCard
          title="Distance"
          value="5.2"
          unit="km"
          subtitle="Personal best"
          color="#FF5722"
        />
      );

      expect(getByText('Distance')).toBeTruthy();
      expect(getByText('5.2')).toBeTruthy();
      expect(getByText('km')).toBeTruthy();
      expect(getByText('Personal best')).toBeTruthy();
    });

    it('should render without optional props', () => {
      const { getByText, queryByText } = render(
        <StatsCard title="Distance" value="5.2" />
      );

      expect(getByText('Distance')).toBeTruthy();
      expect(getByText('5.2')).toBeTruthy();
      expect(queryByText('km')).toBeNull();
      expect(queryByText('Personal best')).toBeNull();
    });
  });

  describe('title formatting', () => {
    it('should display title in uppercase', () => {
      const { getByText } = render(
        <StatsCard title="distance" value="5.2" />
      );

      const titleElement = getByText('distance');
      expect(titleElement).toBeTruthy();
      expect(titleElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            textTransform: 'uppercase',
          }),
        ])
      );
    });

    it('should handle long titles', () => {
      const longTitle = 'Very Long Statistics Title';
      const { getByText } = render(
        <StatsCard title={longTitle} value="123" />
      );

      expect(getByText(longTitle)).toBeTruthy();
    });

    it('should handle empty title', () => {
      const { getByText } = render(
        <StatsCard title="" value="5.2" />
      );

      expect(getByText('')).toBeTruthy();
    });
  });

  describe('value display', () => {
    it('should display numeric values', () => {
      const { getByText } = render(
        <StatsCard title="Distance" value="5.2" />
      );

      expect(getByText('5.2')).toBeTruthy();
    });

    it('should display string values', () => {
      const { getByText } = render(
        <StatsCard title="Status" value="Active" />
      );

      expect(getByText('Active')).toBeTruthy();
    });

    it('should display formatted time values', () => {
      const { getByText } = render(
        <StatsCard title="Duration" value="1:23:45" />
      );

      expect(getByText('1:23:45')).toBeTruthy();
    });

    it('should handle zero values', () => {
      const { getByText } = render(
        <StatsCard title="Distance" value="0" />
      );

      expect(getByText('0')).toBeTruthy();
    });

    it('should handle negative values', () => {
      const { getByText } = render(
        <StatsCard title="Elevation Change" value="-50" />
      );

      expect(getByText('-50')).toBeTruthy();
    });

    it('should handle very large values', () => {
      const { getByText } = render(
        <StatsCard title="Steps" value="1,234,567" />
      );

      expect(getByText('1,234,567')).toBeTruthy();
    });
  });

  describe('unit display', () => {
    it('should display unit when provided', () => {
      const { getByText } = render(
        <StatsCard title="Distance" value="5.2" unit="km" />
      );

      expect(getByText('km')).toBeTruthy();
    });

    it('should not display unit when not provided', () => {
      const { queryByText } = render(
        <StatsCard title="Distance" value="5.2" />
      );

      expect(queryByText('km')).toBeNull();
    });

    it('should handle different unit types', () => {
      const units = ['km', 'm', 'min', 'sec', '%', '°C'];
      
      units.forEach(unit => {
        const { getByText } = render(
          <StatsCard title="Test" value="100" unit={unit} />
        );
        expect(getByText(unit)).toBeTruthy();
      });
    });

    it('should handle empty unit string', () => {
      const { queryByText } = render(
        <StatsCard title="Distance" value="5.2" unit="" />
      );

      expect(queryByText('')).toBeNull();
    });
  });

  describe('subtitle display', () => {
    it('should display subtitle when provided', () => {
      const { getByText } = render(
        <StatsCard
          title="Distance"
          value="5.2"
          subtitle="Personal best"
        />
      );

      expect(getByText('Personal best')).toBeTruthy();
    });

    it('should not display subtitle when not provided', () => {
      const { queryByText } = render(
        <StatsCard title="Distance" value="5.2" />
      );

      expect(queryByText('Personal best')).toBeNull();
    });

    it('should handle long subtitles', () => {
      const longSubtitle = 'This is a very long subtitle that might wrap to multiple lines';
      const { getByText } = render(
        <StatsCard
          title="Distance"
          value="5.2"
          subtitle={longSubtitle}
        />
      );

      expect(getByText(longSubtitle)).toBeTruthy();
    });

    it('should handle empty subtitle string', () => {
      const { queryByText } = render(
        <StatsCard title="Distance" value="5.2" subtitle="" />
      );

      expect(queryByText('')).toBeNull();
    });
  });

  describe('color customization', () => {
    it('should use default color when not provided', () => {
      const { getByText } = render(
        <StatsCard title="Distance" value="5.2" />
      );

      const valueElement = getByText('5.2');
      expect(valueElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            color: '#2E7D32', // Default green color
          }),
        ])
      );
    });

    it('should use custom color when provided', () => {
      const customColor = '#FF5722';
      const { getByText } = render(
        <StatsCard title="Distance" value="5.2" color={customColor} />
      );

      const valueElement = getByText('5.2');
      expect(valueElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            color: customColor,
          }),
        ])
      );
    });

    it('should handle hex color codes', () => {
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000'];
      
      colors.forEach(color => {
        const { getByText } = render(
          <StatsCard title="Test" value="100" color={color} />
        );
        
        const valueElement = getByText('100');
        expect(valueElement.props.style).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              color: color,
            }),
          ])
        );
      });
    });

    it('should handle named colors', () => {
      const { getByText } = render(
        <StatsCard title="Distance" value="5.2" color="red" />
      );

      const valueElement = getByText('5.2');
      expect(valueElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            color: 'red',
          }),
        ])
      );
    });
  });

  describe('layout and styling', () => {
    it('should have proper container styling', () => {
      const { getByTestId } = render(
        <StatsCard title="Distance" value="5.2" testID="stats-card" />
      );

      const container = getByTestId('stats-card');
      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 16,
            borderLeftWidth: 4,
          }),
        ])
      );
    });

    it('should apply border color based on provided color', () => {
      const customColor = '#FF5722';
      const { getByTestId } = render(
        <StatsCard
          title="Distance"
          value="5.2"
          color={customColor}
          testID="stats-card"
        />
      );

      const container = getByTestId('stats-card');
      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            borderLeftColor: customColor,
          }),
        ])
      );
    });

    it('should have proper value container layout', () => {
      const { getByText } = render(
        <StatsCard title="Distance" value="5.2" unit="km" />
      );

      // Both value and unit should be present and aligned
      expect(getByText('5.2')).toBeTruthy();
      expect(getByText('km')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should be accessible to screen readers', () => {
      const { getByText } = render(
        <StatsCard
          title="Distance"
          value="5.2"
          unit="km"
          subtitle="Personal best"
        />
      );

      // All text elements should be accessible
      expect(getByText('Distance')).toBeTruthy();
      expect(getByText('5.2')).toBeTruthy();
      expect(getByText('km')).toBeTruthy();
      expect(getByText('Personal best')).toBeTruthy();
    });

    it('should handle special characters in text', () => {
      const { getByText } = render(
        <StatsCard
          title="Pace (min/km)"
          value="4'30\""
          unit="min/km"
          subtitle="Average pace"
        />
      );

      expect(getByText('Pace (min/km)')).toBeTruthy();
      expect(getByText('4\'30"')).toBeTruthy();
      expect(getByText('min/km')).toBeTruthy();
      expect(getByText('Average pace')).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined props gracefully', () => {
      const { getByText } = render(
        <StatsCard
          title="Distance"
          value="5.2"
          unit={undefined}
          subtitle={undefined}
          color={undefined}
        />
      );

      expect(getByText('Distance')).toBeTruthy();
      expect(getByText('5.2')).toBeTruthy();
    });

    it('should handle null props gracefully', () => {
      const { getByText } = render(
        <StatsCard
          title="Distance"
          value="5.2"
          unit={null as any}
          subtitle={null as any}
          color={null as any}
        />
      );

      expect(getByText('Distance')).toBeTruthy();
      expect(getByText('5.2')).toBeTruthy();
    });

    it('should handle very long values', () => {
      const longValue = '1234567890123456789';
      const { getByText } = render(
        <StatsCard title="Distance" value={longValue} />
      );

      expect(getByText(longValue)).toBeTruthy();
    });

    it('should handle special characters in values', () => {
      const specialValue = '∞';
      const { getByText } = render(
        <StatsCard title="Limit" value={specialValue} />
      );

      expect(getByText(specialValue)).toBeTruthy();
    });
  });
});