import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { HistoryFilters } from '../../services/history';

interface FilterModalProps {
  visible: boolean;
  filters: HistoryFilters;
  onApply: (filters: HistoryFilters) => void;
  onClose: () => void;
  onReset: () => void;
}

const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  filters,
  onApply,
  onClose,
  onReset,
}) => {
  const [localFilters, setLocalFilters] = useState<HistoryFilters>(filters);

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: HistoryFilters = {};
    setLocalFilters(resetFilters);
    onReset();
    onClose();
  };

  const updateFilter = (key: keyof HistoryFilters, value: any) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const formatDate = (date?: Date): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  const parseDate = (dateString: string): Date | undefined => {
    if (!dateString) return undefined;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Filter Activities</Text>
          <TouchableOpacity onPress={handleApply}>
            <Text style={styles.applyButton}>Apply</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Date Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date Range</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Start Date</Text>
              <TextInput
                style={styles.input}
                value={formatDate(localFilters.startDate)}
                onChangeText={(text) => updateFilter('startDate', parseDate(text))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>End Date</Text>
              <TextInput
                style={styles.input}
                value={formatDate(localFilters.endDate)}
                onChangeText={(text) => updateFilter('endDate', parseDate(text))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Distance Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Distance (km)</Text>
            
            <View style={styles.rangeContainer}>
              <View style={styles.rangeInput}>
                <Text style={styles.label}>Min</Text>
                <TextInput
                  style={styles.input}
                  value={localFilters.minDistance?.toString() || ''}
                  onChangeText={(text) => updateFilter('minDistance', text ? parseFloat(text) : undefined)}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
              
              <View style={styles.rangeInput}>
                <Text style={styles.label}>Max</Text>
                <TextInput
                  style={styles.input}
                  value={localFilters.maxDistance?.toString() || ''}
                  onChangeText={(text) => updateFilter('maxDistance', text ? parseFloat(text) : undefined)}
                  placeholder="∞"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          </View>

          {/* Duration Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duration (minutes)</Text>
            
            <View style={styles.rangeContainer}>
              <View style={styles.rangeInput}>
                <Text style={styles.label}>Min</Text>
                <TextInput
                  style={styles.input}
                  value={localFilters.minDuration?.toString() || ''}
                  onChangeText={(text) => updateFilter('minDuration', text ? parseFloat(text) : undefined)}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
              
              <View style={styles.rangeInput}>
                <Text style={styles.label}>Max</Text>
                <TextInput
                  style={styles.input}
                  value={localFilters.maxDuration?.toString() || ''}
                  onChangeText={(text) => updateFilter('maxDuration', text ? parseFloat(text) : undefined)}
                  placeholder="∞"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          </View>

          {/* Sorting */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sort By</Text>
            
            <View style={styles.sortContainer}>
              {(['date', 'distance', 'duration'] as const).map((sortOption) => (
                <TouchableOpacity
                  key={sortOption}
                  style={[
                    styles.sortOption,
                    localFilters.sortBy === sortOption && styles.sortOptionActive,
                  ]}
                  onPress={() => updateFilter('sortBy', sortOption)}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      localFilters.sortBy === sortOption && styles.sortOptionTextActive,
                    ]}
                  >
                    {sortOption.charAt(0).toUpperCase() + sortOption.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sortOrderContainer}>
              <Text style={styles.label}>Sort Order</Text>
              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Ascending</Text>
                <Switch
                  value={localFilters.sortOrder === 'desc'}
                  onValueChange={(value) => updateFilter('sortOrder', value ? 'desc' : 'asc')}
                  trackColor={{ false: '#767577', true: '#2E7D32' }}
                  thumbColor="#fff"
                />
                <Text style={styles.switchLabel}>Descending</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  applyButton: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  sortContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  sortOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  sortOptionActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#666',
  },
  sortOptionTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  sortOrderContainer: {
    marginTop: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  footer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  resetButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 16,
    color: '#666',
  },
});

export default FilterModal;