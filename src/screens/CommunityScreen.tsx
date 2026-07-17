import React, { useEffect, useState, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { communityService } from '../services/communityService';
import { AuthContext } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';

type TabType = 'users' | 'itineraries';

const CommunityScreen = () => {
  const { getFeaturedItineraries } = useContext(AuthContext);
  const [users, setUsers] = useState<any[]>([]);
  const [itineraries, setItineraries] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [selectedTag, setSelectedTag] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');
  const [showSort, setShowSort] = useState(false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  useEffect(() => {
    Promise.all([
      communityService.getUsers(),
      communityService.getItineraries('newest'),
      communityService.getAllTags(),
      getFeaturedItineraries(),
    ])
      .then(([u, i, t, f]) => {
        setUsers(u);
        setItineraries(i);
        setAvailableTags(t);
        setFeatured(f || []);
        setFilteredData(u);
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      if (query.trim() === '') {
        setFilteredData(users);
      } else {
        communityService.searchUsers(query).then(setFilteredData);
      }
    } else {
      let result: any[] = itineraries;
      if (query.trim() !== '') {
        communityService.searchItineraries(query).then((r: any) => {
          let final = r;
          if (selectedTag) {
            final = r.filter((i: any) => (i.tags || []).includes(selectedTag));
          }
          setFilteredData(final);
        });
        return;
      }
      if (selectedTag) {
        result = result.filter((i: any) => (i.tags || []).includes(selectedTag));
      }
      setFilteredData(result);
    }
  }, [query, activeTab, users, itineraries, selectedTag]);

  const renderUserItem = ({ item }: any) => (
    <TouchableOpacity
      style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.85}
      onPress={() => (navigation as any).navigate('UserProfile', { userId: item.id })}
    >
      <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.name || 'U').charAt(0).toUpperCase()}
        </Text>
      </LinearGradient>
      <View style={styles.userInfo}>
        <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.email, { color: colors.muted }]}>{item.email}</Text>
      </View>
      <Icon name="chevronRight" size={18} color={colors.muted} />
    </TouchableOpacity>
  );

  const renderItineraryItem = ({ item }: any) => (
    <TouchableOpacity
      style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.85}
      onPress={() => (navigation as any).navigate('TripDetail', { id: item.id })}
    >
      <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.itinAvatar}>
        <Icon name="itinerary" size={22} color={colors.primary} />
      </LinearGradient>
      <View style={styles.userInfo}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.email, { color: colors.muted }]} numberOfLines={1}>
          {item.destinations?.join(', ') || 'Custom trip'} · {item.authorName || 'Unknown'}
        </Text>
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagRow}>
            {item.tags.slice(0, 3).map((tag: string, i: number) => (
              <View key={i} style={styles.miniTag}>
                <Text style={styles.miniTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Icon name="chevronRight" size={18} color={colors.muted} />
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.emptyIcon}>
        <Icon name={activeTab === 'users' ? 'globe' : 'itinerary'} size={28} color={colors.primary} />
      </LinearGradient>
      <Text style={styles.emptyTitle}>
        {activeTab === 'users' ? 'No users found' : 'No itineraries found'}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'users'
          ? 'Try a different search'
          : selectedTag
          ? 'No itineraries with this tag'
          : 'Try a different search'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>EXPLORE</Text>
          <Text style={styles.title}>Community</Text>
        </View>
        <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.headerIcon}>
          <Icon name="globe" size={20} color={colors.primary} />
        </LinearGradient>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="search" size={20} color={colors.muted} />
        <TextInput
          placeholder={activeTab === 'users' ? 'Search users...' : 'Search itineraries...'}
          placeholderTextColor={colors.muted}
          style={[styles.searchInput, { color: colors.text }]}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Icon name="close" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'users' && styles.tabBtnActive]}
          onPress={() => { setActiveTab('users'); setSelectedTag(''); setQuery(''); }}
        >
          <Icon name="user" size={16} color={activeTab === 'users' ? colors.white : colors.muted} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'itineraries' && styles.tabBtnActive]}
          onPress={() => { setActiveTab('itineraries'); setSelectedTag(''); setQuery(''); }}
        >
          <Icon name="itinerary" size={16} color={activeTab === 'itineraries' ? colors.white : colors.muted} />
          <Text style={[styles.tabText, activeTab === 'itineraries' && styles.tabTextActive]}>Itineraries</Text>
        </TouchableOpacity>
      </View>

      {/* Sort & Tag Filter (only for itineraries) */}
      {activeTab === 'itineraries' && (
        <View>
          <View style={styles.sortRow}>
            <TouchableOpacity
              style={[styles.sortBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowSort(!showSort)}
            >
              <Icon name="time" size={14} color={colors.muted} />
              <Text style={styles.sortBtnText}>
                {sortBy === 'newest' ? 'Newest' : sortBy === 'oldest' ? 'Oldest' : sortBy === 'days_asc' ? 'Days ↑' : sortBy === 'days_desc' ? 'Days ↓' : sortBy === 'budget_asc' ? 'Budget ↑' : sortBy === 'budget_desc' ? 'Budget ↓' : 'Sort'}
              </Text>
              <Icon name="chevronDown" size={14} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {showSort && (
            <View style={[styles.sortDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { key: 'newest', label: 'Newest First' },
                { key: 'oldest', label: 'Oldest First' },
                { key: 'days_asc', label: 'Days (Low to High)' },
                { key: 'days_desc', label: 'Days (High to Low)' },
                { key: 'budget_asc', label: 'Budget (Low to High)' },
                { key: 'budget_desc', label: 'Budget (High to Low)' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortOption, sortBy === opt.key && styles.sortOptionActive]}
                  onPress={() => {
                    setSortBy(opt.key);
                    setShowSort(false);
                  }}
                >
                  <Text style={[styles.sortOptionText, { color: sortBy === opt.key ? colors.primary : colors.text }]}>
                    {opt.label}
                  </Text>
                  {sortBy === opt.key && <Icon name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {availableTags.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagFilterRow}
            >
              <TouchableOpacity
                style={[styles.tagFilterChip, !selectedTag && styles.tagFilterActive]}
                onPress={() => setSelectedTag('')}
              >
                <Text style={[styles.tagFilterText, !selectedTag && styles.tagFilterTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              {availableTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagFilterChip, selectedTag === tag && styles.tagFilterActive]}
                  onPress={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                >
                  <Text style={[styles.tagFilterText, selectedTag === tag && styles.tagFilterTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120 }}
          renderItem={activeTab === 'users' ? renderUserItem : renderItineraryItem}
          ListHeaderComponent={
            activeTab === 'itineraries' && featured.length > 0 && !query && !selectedTag ? (
              <View style={styles.featuredSection}>
                <LinearGradient colors={['#FFF7ED', '#FFE4CC']} style={styles.featuredBanner}>
                  <Icon name="bookmark" size={16} color="#9A3412" />
                  <Text style={styles.featuredBannerText}>Featured Itineraries</Text>
                </LinearGradient>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.featuredRow}
                >
                  {featured.map((item: any) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.featuredCard}
                      activeOpacity={0.9}
                      onPress={() => (navigation as any).navigate('TripDetail', { id: item.id })}
                    >
                      {item.coverImage ? (
                        <Image source={{ uri: item.coverImage }} style={styles.featuredImage} />
                      ) : (
                        <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.featuredImageFallback}>
                          <Icon name="map" size={24} color={colors.white} />
                        </LinearGradient>
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(8,15,30,0.7)']}
                        style={styles.featuredOverlay}
                      />
                      <View style={styles.featuredContent}>
                        <Text style={styles.featuredTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={styles.featuredAuthor}>
                          {item.authorName || 'Waybound'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmpty}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  kicker: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  searchWrap: {
    marginHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontWeight: '700',
    fontSize: 13,
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.white,
  },
  tagFilterRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  tagFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  tagFilterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  tagFilterTextActive: {
    color: colors.white,
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: 10,
    borderWidth: 1,
    ...shadows.soft,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: colors.white },
  itinAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  userInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  email: { fontSize: 13, marginTop: 2 },
  tagRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  miniTag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  emptyText: { marginTop: 8, textAlign: 'center', lineHeight: 20, color: colors.muted },
  featuredSection: {
    marginBottom: spacing.lg,
  },
  featuredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  featuredBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9A3412',
  },
  featuredRow: {
    gap: 12,
  },
  featuredCard: {
    width: 180,
    height: 150,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  featuredImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  featuredTitle: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  featuredAuthor: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  sortRow: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    flexDirection: 'row',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  sortDropdown: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  sortOptionActive: {
    backgroundColor: colors.primarySoft,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CommunityScreen;