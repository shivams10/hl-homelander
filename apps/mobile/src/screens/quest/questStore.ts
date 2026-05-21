import { create } from 'zustand';
import questClient from '../../api/questClient';
import type { CategoryType, FeaturedQuest, FilterType, Quest } from './types';

// kgen API constants — matches community-app pattern
const GEO = 'Other'; // No country detection at MVP; kgen treats 'Other' as global
const PLATFORM = 'APP';
const LIMIT = 10;

// Maps the screen's FilterType to kgen's questState param value.
const FILTER_STATE: Record<FilterType, string | null> = {
  All: null,
  Live: 'LIVE',
  Upcoming: 'PUBLISHED',
  Ended: 'ENDED',
};

function featuredUrl(category: CategoryType): string {
  // questCategories=FEATURED tells kgen to return priority-ranked featured quests only.
  return (
    `/userquest/v2/questlist?questState=LIVE&questCategories=FEATURED` +
    `&applicablePlatform=${PLATFORM}&geoGraphy=${GEO}&applicableCategory=${category}`
  );
}

function listUrl(category: CategoryType, page: number, filter: FilterType): string {
  const state = FILTER_STATE[filter];
  let url =
    `/userquest/v2/questlist?geoGraphy=${GEO}&page=${page}&limit=${LIMIT}` +
    `&applicablePlatform=${PLATFORM}&applicableCategory=${category}`;
  if (state) url += `&questState=${state}`;
  return url;
}

function inProgressUrl(category: CategoryType): string {
  return `userquest/in-progress?geoGraphy=${GEO}&applicableCategory=${category}`;
}

interface QuestStoreState {
  featured: FeaturedQuest[];
  inProgress: Quest[];
  recommended: Quest[];
  isFeaturedLoading: boolean;
  isInProgressLoading: boolean;
  isRecommendedLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  // Internal pagination — not subscribed to by QuestScreen, so won't cause re-renders.
  _page: number;
  fetchFeatured: (category: CategoryType) => Promise<void>;
  fetchInProgress: (category: CategoryType) => Promise<void>;
  // No `page` param — store reads _page via get() to prevent the onEndReached re-render loop.
  fetchRecommended: (opts: { category: CategoryType; filter: FilterType }) => Promise<void>;
  clearRecommended: () => void;
}

export const useQuestStore = create<QuestStoreState>((set, get) => ({
  featured: [],
  inProgress: [],
  recommended: [],
  isFeaturedLoading: false,
  isInProgressLoading: false,
  isRecommendedLoading: false,
  isLoadingMore: false,
  hasMore: true,
  _page: 1,

  fetchFeatured: async (category) => {
    set({ isFeaturedLoading: true });
    try {
      const { data } = await questClient.get<{ data: { quests: FeaturedQuest[] } }>(
        featuredUrl(category),
      );
      const quests = data?.data?.quests ?? [];
      // Sort by priority, keep top 5 — matches community-app featureQuestModal.
      const sorted = [...quests].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)).slice(0, 5);
      set({ featured: sorted });
    } catch {
      set({ featured: [] });
    } finally {
      set({ isFeaturedLoading: false });
    }
  },

  fetchInProgress: async (category) => {
    set({ isInProgressLoading: true });
    try {
      const { data } = await questClient.get<{ data: { quests: Quest[] } }>(
        inProgressUrl(category),
      );
      set({ inProgress: data?.data?.quests ?? [] });
    } catch {
      set({ inProgress: [] });
    } finally {
      set({ isInProgressLoading: false });
    }
  },

  fetchRecommended: async ({ category, filter }) => {
    const { isRecommendedLoading, isLoadingMore, hasMore, _page, recommended } = get();

    // Concurrent-call guard — prevents the onEndReached re-render loop.
    if (isRecommendedLoading || isLoadingMore) return;

    const isFirstPage = recommended.length === 0 && _page === 1;
    if (!isFirstPage && !hasMore) return;

    if (isFirstPage) {
      set({ isRecommendedLoading: true });
    } else {
      set({ isLoadingMore: true });
    }

    try {
      const { data } = await questClient.get<{ data: { quests: Quest[] } }>(
        listUrl(category, _page, filter),
      );
      const quests = data?.data?.quests ?? [];
      set((state) => ({
        recommended: isFirstPage ? quests : [...state.recommended, ...quests],
        // If we got a full page, assume there's more; less than LIMIT means last page.
        hasMore: quests.length === LIMIT,
        _page: _page + 1,
      }));
    } catch {
      // On error keep existing list; hasMore stays, user can retry via pull-to-refresh.
    } finally {
      set({ isRecommendedLoading: false, isLoadingMore: false });
    }
  },

  clearRecommended: () => {
    set({ recommended: [], hasMore: true, _page: 1 });
  },
}));
