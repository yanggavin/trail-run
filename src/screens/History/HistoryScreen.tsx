import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { ActivityCard, SearchBar, FilterModal } from '../../components/history';
import { HistoryService, ActivityWithCoverPhoto, PaginationParams, HistoryFilters } from '../../services/history';
import { ActivityRepository } from '../../services/repositories/ActivityRepository';
import { PhotoRepository } from '../../services/repositories/PhotoRepository';
import { DatabaseService } from '../../services/database/DatabaseService';

type HistoryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'History'>;

const ITEMS_PER_PAGE = 20;
const MOCK_USER_ID = 'user_123'; // In a real app, this would come from authentication

const HistoryScreen: React.FC = () => {
  const navigation = useNavigation<HistoryScreenNavigationProp>();
  
  // Services
  const [historyService] = useState(() => {
    const db = new DatabaseService();
    const activityRepo = new ActivityRepository(db);
    const photoRepo = new PhotoRepository(db);
    return new HistoryService(activityRepo, photoRepo);
  });

  // State
  const [activities, setActivities] = useState<ActivityWithCoverPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Search and filtering
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Pagination
  const [pagination, setPagination] = useState<PaginationParams>({
    limit: ITEMS_PER_PAGE,
    offset: 0,
  });

  // Load initial activities
  const loadActivities = useCallback(async (reset: boolean = false) => {
    try {
      setError(null);
      
      const currentPagination = reset 
        ? { limit: ITEMS_PER_PAGE, offset: 0 }
        : pagination;

      // Combine search text with filters
      const combinedFilters: HistoryFilters = {
        ...filters,
        searchText: searchText.trim() || undefined,
      };

      const result = await historyService.getActivities(
        MOCK_USER_ID,
        combinedFilters,
        currentPagination
      );

      if (reset) {
        setActivities(result.activities);
        setPagination({ limit: ITEMS_PER_PAGE, offset: result.activities.length });
      } else {
        setActivities(prev => [...prev, ...result.activities]);
        setPagination(prev => ({ ...prev, offset: prev.offset + result.activities.length }));
      }

      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error('Error loading activities:', err);
      setError('Failed to load activities. Please try again.');
    }
  }, [historyService, pagination, filters, searchText]);

  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await loadActivities(true);
      setLoading(false);
    };

    loadInitialData();
  }, []);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await historyService.refreshActivities(MOCK_USER_ID);
      await loadActivities(true);
    } catch (err) {
      console.error('Error refreshing activities:', err);
      setError('Failed to refresh activities.');
    } finally {
      setRefreshing(false);
    }
  }, [historyService, loadActivities]);

  // Load more activities
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    await loadActivities(false);
    setLoadingMore(false);
  }, [loadingMore, hasMore, loadActivities]);

  // Search functionality
  const handleSearchTextChange = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchText('');
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadActivities(true);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  // Filter functionality
  const handleApplyFilters = useCallback((newFilters: HistoryFilters) => {
    setFilters(newFilters);
    
    // Count active filters
    const count = Object.keys(newFilters).filter(key => {
      const value = newFilters[key as keyof HistoryFilters];
      return value !== undefined && value !== null && value !== '';
    }).length;
    setActiveFiltersCount(count);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({});
    setActiveFiltersCount(0);
  }, []);

  // Apply filters effect
  useEffect(() => {
    loadActivities(true);
  }, [filters]);

  // Navigate to activity detail
  const handleActivityPress = useCallback((activity: ActivityWithCoverPhoto) => {
    navigation.navigate('ActivityDetail', { activityId: activity.activity.activityId });
  }, [navigation]);

  // Render activity item
  const renderActivityItem = useCallback(({ item }: { item: ActivityWithCoverPhoto }) => (
    <ActivityCard
      activity={item.activity}
      coverPhotoUri={item.coverPhotoUri}
      onPress={() => handleActivityPress(item)}
    />
  ), [handleActivityPress]);

  // Render footer
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#2E7D32" />
        <Text style={styles.footerText}>Loading more activities...</Text>
      </View>
    );
  }, [loadingMore]);

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Activities Yet</Text>
        <Text style={styles.emptySubtitle}>
          Start your first trail run to see your activity history here.
        </Text>
      </View>
    );
  }, [loading]);

  // Show error alert
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: () => setError(null) }
      ]);
    }
  }, [error]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading your activities...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <SearchBar
        value={searchText}
        onChangeText={handleSearchTextChange}
        onClear={handleSearchClear}
      />

      {/* Header with count and filter button */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {totalCount > 0 
            ? `${totalCount} ${totalCount === 1 ? 'Activity' : 'Activities'}`
            : 'Activities'
          }
        </Text>
        <TouchableOpacity
          style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={[styles.filterButtonText, activeFiltersCount > 0 && styles.filterButtonTextActive]}>
            Filter {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={activities}
        renderItem={renderActivityItem}
        keyExtractor={(item) => item.activity.activityId}
        contentContainerStyle={activities.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2E7D32']}
            tintColor="#2E7D32"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        filters={filters}
        onApply={handleApplyFilters}
        onClose={() => setShowFilterModal(false)}
        onReset={handleResetFilters}
      />
    </View>
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
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  filterButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  list: {
    paddingVertical: 8,
  },
  emptyList: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
});

export default HistoryScreen;
