import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { colors, spacing, radii } from '../../ui/tokens';
import { useQuestStore } from './questStore';
import type { FilterType, Quest } from './types';
import FeaturedCarousel from './components/FeaturedCarousel';
import FilterTabs from './components/FilterTabs';
import InProgressCard from './components/InProgressCard';
import QuestCard from './components/QuestCard';
import { InProgressSkeleton, QuestGridSkeleton } from './components/QuestSkeleton';

export default function QuestScreen() {
  const {
    featured,
    isFeaturedLoading,
    inProgress,
    isInProgressLoading,
    recommended,
    isRecommendedLoading,
    isLoadingMore,
    hasMore,
    fetchFeatured,
    fetchInProgress,
    fetchRecommended,
    clearRecommended,
  } = useQuestStore(
    useShallow((s) => ({
      featured: s.featured,
      isFeaturedLoading: s.isFeaturedLoading,
      inProgress: s.inProgress,
      isInProgressLoading: s.isInProgressLoading,
      recommended: s.recommended,
      isRecommendedLoading: s.isRecommendedLoading,
      isLoadingMore: s.isLoadingMore,
      hasMore: s.hasMore,
      fetchFeatured: s.fetchFeatured,
      fetchInProgress: s.fetchInProgress,
      fetchRecommended: s.fetchRecommended,
      clearRecommended: s.clearRecommended,
    })),
  );

  const [filter, setFilter] = useState<FilterType>('Live');
  const [refreshing, setRefreshing] = useState(false);
  const isInitialized = useRef(false);

  const loadAll = useCallback(
    (fil: FilterType) => {
      fetchFeatured('AI');
      fetchInProgress('AI');
      fetchRecommended({ category: 'AI', filter: fil });
    },
    [fetchFeatured, fetchInProgress, fetchRecommended],
  );

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      loadAll(filter);
    }
  }, [filter, loadAll]);

  const onFilterChange = useCallback(
    (fil: FilterType) => {
      setFilter(fil);
      clearRecommended();
      fetchRecommended({ category: 'AI', filter: fil });
    },
    [clearRecommended, fetchRecommended],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearRecommended();
    await Promise.allSettled([
      fetchFeatured('AI'),
      fetchInProgress('AI'),
      fetchRecommended({ category: 'AI', filter }),
    ]);
    setRefreshing(false);
  }, [filter, clearRecommended, fetchFeatured, fetchInProgress, fetchRecommended]);

  const onEndReached = useCallback(() => {
    if (!hasMore || isLoadingMore || isRecommendedLoading) return;
    fetchRecommended({ category: 'AI', filter });
  }, [filter, hasMore, isLoadingMore, isRecommendedLoading, fetchRecommended]);

  const onQuestPress = useCallback((slug: string) => {
    console.log('[Quest] navigate to:', slug);
    // navigation.navigate('QuestDetails', { questId: slug });
  }, []);

  // ─── Sub-renders ────────────────────────────────────────────────────────

  const InProgressSection = useMemo(() => {
    if (!isInProgressLoading && inProgress.length === 0) return null;
    return (
      <View style={styles.inProgressSection}>
        <View style={styles.sectionHeader}>
          <Text variant="eyebrow" tone="tertiary">
            IN PROGRESS
          </Text>
          {isInProgressLoading && <ActivityIndicator size="small" color={colors.accent} />}
        </View>
        {isInProgressLoading ? (
          <InProgressSkeleton />
        ) : (
          <FlatList
            data={inProgress}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.questId}
            contentContainerStyle={styles.inProgressList}
            ItemSeparatorComponent={() => <View style={{ width: spacing.ms }} />}
            renderItem={({ item }: ListRenderItemInfo<Quest>) => (
              <InProgressCard data={item} onPress={onQuestPress} />
            )}
          />
        )}
      </View>
    );
  }, [inProgress, isInProgressLoading, onQuestPress]);

  const RecommendedHeader = useMemo(
    () => (
      <View style={styles.recommendedHeader}>
        <Text variant="eyebrow" tone="tertiary">
          QUESTS — AI TRAINING
        </Text>
        <FilterTabs selected={filter} onChange={onFilterChange} disabled={isRecommendedLoading} />
      </View>
    ),
    [filter, onFilterChange, isRecommendedLoading],
  );

  const ListHeader = useCallback(
    () => (
      <>
        <FeaturedCarousel quests={featured} loading={isFeaturedLoading} onPress={onQuestPress} />
        {InProgressSection}
        {RecommendedHeader}
      </>
    ),
    [featured, isFeaturedLoading, onQuestPress, InProgressSection, RecommendedHeader],
  );

  const ListEmpty = useCallback(
    () =>
      isRecommendedLoading ? (
        <View style={styles.skeletonWrapper}>
          <QuestGridSkeleton />
        </View>
      ) : (
        <View style={styles.emptyWrapper}>
          <View style={styles.emptyBox}>
            <Text variant="taskCardName" style={{ color: colors.text }}>
              No quests match this filter.
            </Text>
            <Text variant="taskCardDesc" tone="secondary" style={{ marginTop: spacing.xs }}>
              Try a different category or filter.
            </Text>
          </View>
        </View>
      ),
    [isRecommendedLoading],
  );

  const ListFooter = useCallback(
    () => (
      <View style={styles.footer}>
        {isLoadingMore && <ActivityIndicator color={colors.accent} size="small" />}
      </View>
    ),
    [isLoadingMore],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Quest>) => (
      <QuestCard
        data={item}
        onPress={onQuestPress}
        style={{
          marginLeft: index % 2 === 0 ? spacing.l : spacing.s,
          marginRight: index % 2 !== 0 ? spacing.l : spacing.s,
        }}
      />
    ),
    [onQuestPress],
  );

  return (
    <ScreenContainer padding={0}>
      {/* Screen header */}
      <View style={styles.header}>
        <Text variant="sheetTitle" style={{ color: colors.text }}>
          Quests
        </Text>
      </View>

      <FlatList
        data={recommended}
        numColumns={2}
        keyExtractor={(item) => item.questId}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },

  // In-progress
  inProgressSection: {
    marginTop: spacing.h,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  inProgressList: {
    paddingHorizontal: spacing.l,
  },

  // Recommended
  recommendedHeader: {
    marginHorizontal: spacing.l,
    marginTop: spacing.xl + spacing.xs,
    marginBottom: spacing.xs,
  },

  // Empty state
  skeletonWrapper: { paddingHorizontal: spacing.xs },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.l,
  },
  emptyBox: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.l,
  },

  // Footer
  footer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
