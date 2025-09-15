import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatsCardProps {
  title: string;
  value: string;
  unit?: string;
  subtitle?: string;
  color?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  color = '#2E7D32',
}) => {
  return (
    <View style={[styles.container, { borderLeftColor: color }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  unit: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});

export default StatsCard;