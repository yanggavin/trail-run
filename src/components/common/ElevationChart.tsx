import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { TrackPoint } from '../../types';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 40;
const CHART_HEIGHT = 120;

interface ElevationChartProps {
  trackPoints: TrackPoint[];
}

const ElevationChart: React.FC<ElevationChartProps> = ({ trackPoints }) => {
  // Filter track points that have elevation data
  const elevationPoints = trackPoints.filter(point => point.altitude !== undefined);
  
  if (elevationPoints.length < 2) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Elevation Profile</Text>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No elevation data available</Text>
        </View>
      </View>
    );
  }

  // Calculate elevation range
  const elevations = elevationPoints.map(point => point.altitude!);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const elevationRange = maxElevation - minElevation;
  
  // If elevation range is too small, add some padding
  const paddedRange = Math.max(elevationRange, 10);
  const paddedMin = minElevation - (paddedRange - elevationRange) / 2;
  const paddedMax = maxElevation + (paddedRange - elevationRange) / 2;

  // Create path points for the elevation profile
  const pathPoints = elevationPoints.map((point, index) => {
    const x = (index / (elevationPoints.length - 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - ((point.altitude! - paddedMin) / (paddedMax - paddedMin)) * CHART_HEIGHT;
    return { x, y };
  });

  // Create SVG path string
  const pathData = pathPoints.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    return `${path} L ${point.x} ${point.y}`;
  }, '');

  // Create area fill path (add bottom line)
  const areaData = `${pathData} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Elevation Profile</Text>
      <View style={styles.chartContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          <Text style={styles.axisLabel}>{Math.round(paddedMax)}m</Text>
          <Text style={styles.axisLabel}>{Math.round((paddedMax + paddedMin) / 2)}m</Text>
          <Text style={styles.axisLabel}>{Math.round(paddedMin)}m</Text>
        </View>
        
        {/* Chart area */}
        <View style={styles.chartArea}>
          {/* Grid lines */}
          <View style={styles.gridContainer}>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
              <View
                key={index}
                style={[
                  styles.gridLine,
                  { top: ratio * CHART_HEIGHT }
                ]}
              />
            ))}
          </View>
          
          {/* Simple line chart using Views (since we don't have SVG) */}
          <View style={styles.lineContainer}>
            {pathPoints.map((point, index) => {
              if (index === 0) return null;
              
              const prevPoint = pathPoints[index - 1];
              const lineWidth = Math.sqrt(
                Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.y - prevPoint.y, 2)
              );
              const angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * 180 / Math.PI;
              
              return (
                <View
                  key={index}
                  style={[
                    styles.lineSegment,
                    {
                      left: prevPoint.x,
                      top: prevPoint.y,
                      width: lineWidth,
                      transform: [{ rotate: `${angle}deg` }],
                    }
                  ]}
                />
              );
            })}
            
            {/* Data points */}
            {pathPoints.map((point, index) => (
              <View
                key={`point-${index}`}
                style={[
                  styles.dataPoint,
                  {
                    left: point.x - 2,
                    top: point.y - 2,
                  }
                ]}
              />
            ))}
          </View>
        </View>
      </View>
      
      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Min</Text>
          <Text style={styles.statValue}>{Math.round(minElevation)}m</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={styles.statValue}>{Math.round(maxElevation)}m</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Range</Text>
          <Text style={styles.statValue}>{Math.round(elevationRange)}m</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  noDataContainer: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    color: '#999',
    fontSize: 14,
  },
  chartContainer: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
  },
  yAxisLabels: {
    width: 40,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  axisLabel: {
    fontSize: 10,
    color: '#666',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  lineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  lineSegment: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#2E7D32',
    transformOrigin: '0 50%',
  },
  dataPoint: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2E7D32',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});

export default ElevationChart;