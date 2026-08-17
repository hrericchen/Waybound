import React, { useEffect, useState, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Alert,
  TextInput,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import tripService from '../services/tripService';
import { exportPDF, exportICS, exportCSV, exportPNGCard } from '../services/exportService';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import { AuthContext } from '../context/AuthContext';
import { useRevenueCat } from '../context/RevenueCatContext';
import { useTour } from '../context/TourContext';

const LibraryScreen: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Covers that failed to load render as a gradient placeholder, never a white square.
  const [failedCovers, setFailedCovers] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();
  const theme = useContext(ThemeContext);
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const { isPro, presentPaywall } = useRevenueCat();
  const { registerTarget } = useTour();

  const loadList = async () => {
    const itineraries = await tripService.getItineraries(user?.id);
    setList(itineraries);
  };


  const filteredList = list.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(query) ||
      item.destinations?.some((d: string) => d.toLowerCase().includes(query))
    );
  });

  useEffect(() => {
    loadList();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadList();
    }, [])
  );

  const handleExport = (item: any) => {
    if (!isPro && !user?.isPro) {
      Alert.alert('Pro Feature', 'Exporting is exclusive to Waybound Pro. Upgrade to export in all formats!', [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Upgrade', onPress: () => presentPaywall() },
      ]);
      return;
    }
    const formatOptions = [
      { text: 'Export as PDF', onPress: () => exportPDF(item) },
      { text: 'Export as ICS (Calendar)', onPress: () => exportICS(item) },
      { text: 'Export as CSV', onPress: () => exportCSV(item) },
      { text: 'Export as PNG Card', onPress: () => exportPNGCard(item) },
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert('Export Itinerary', 'Choose an export format:', formatOptions);
  };

  const handleLongPress = (item: any) => {
    setSelectedId(item.id);
    const isActive = item.isActive;
    Alert.alert(
      item.title,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setSelectedId(null) },
        {
          text: 'Export',
          onPress: () => {
            setSelectedId(null);
            handleExport(item);
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await tripService.deleteItinerary(item.id);
            loadList();
            setSelectedId(null);
          },
        },
        {
          text: isActive ? 'Set as Inactive' : 'Set as Active',
          onPress: async () => {
            await tripService.updateItinerary(item.id, { isActive: !isActive });
            loadList();
            setSelectedId(null);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View ref={(r) => registerTarget('library-header', r)} collapsable={false} style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: theme.colors.muted }]}>Saved plans</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Your Itinerary</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Icon name="search" size={18} color={theme.colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search itineraries..."
            placeholderTextColor={theme.colors.muted}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close" size={18} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {list.length === 0 ? (
        <View style={styles.empty}>
          <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.emptyIcon}>
            <Icon name="itinerary" size={28} color={colors.primary} />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No itineraries yet</Text>
          <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
            Create a trip or save inspiration to see it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(i) => i.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}
          columnWrapperStyle={{ gap: spacing.md }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.card, { backgroundColor: theme.colors.card }, selectedId === item.id && styles.cardSelected]} 
              activeOpacity={0.9}
              onPress={() => (item.kind === 'guide' ? (navigation as any).navigate('TravelGuide', { editId: item.id }) : (navigation as any).navigate('TripDetail', { id: item.id }))}
              onLongPress={() => handleLongPress(item)}
            >
              <View style={styles.coverWrap}>
                {item.coverImage && !failedCovers.has(item.id) ? (
                  <Image
                    source={{ uri: item.coverImage }}
                    style={styles.cover}
                    onError={() => setFailedCovers((prev) => new Set(prev).add(item.id))}
                  />
                ) : (
                  <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.coverPlaceholder}>
                    <Icon name="map" size={28} color={colors.primary} />
                  </LinearGradient>
                )}
                <View
                  style={[
                    styles.guideBadge,
                    { backgroundColor: item.kind === 'guide' ? '#EC4899' : '#8B5CF6' },
                  ]}
                >
                  <Icon name={item.kind === 'guide' ? 'map' : 'itinerary'} size={10} color={colors.white} />
                  <Text style={styles.guideBadgeText}>{item.kind === 'guide' ? 'GUIDE' : 'ITINERARY'}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.metaRow}>
                  <Icon name="location" size={12} color={colors.primary} />
                  <Text style={[styles.meta, { color: theme.colors.muted }]} numberOfLines={1}>
                    {item.destinations?.join(', ') || 'Custom trip'}
                  </Text>
                </View>
                {item.createdAt ? (
                  <Text style={[styles.dateMeta, { color: theme.colors.muted }]}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                ) : null}
                <View style={styles.statsRow}>
                  {item.isActive && (
                    <View style={[styles.statChip, styles.activeChip]}>
                      <Icon name="check" size={11} color={colors.white} />
                      <Text style={[styles.statText, styles.activeText]}>Active</Text>
                    </View>
                  )}
                  <View style={styles.statChip}>
                    <Icon name="calendar" size={11} color={colors.primary} />
                    <Text style={styles.statText}>{item.kind === 'guide' ? 'City guide' : `${item.activities?.length || 0} stops`}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.xs,
  },
  card: {
    flex: 1,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cover: {
    width: '100%',
    height: 110,
  },
  coverWrap: {
    position: 'relative',
  },
  guideBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  guideBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  exportBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
  coverPlaceholder: {
    width: '100%',
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: spacing.md,
  },
  name: {
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  meta: {
    fontSize: 12,
    flex: 1,
  },
  dateMeta: {
    fontSize: 11,
    marginTop: 4,
  },
  statsRow: {
    marginTop: 10,
  },
  statChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  activeChip: {
    backgroundColor: colors.success,
  },
  activeText: {
    color: colors.white,
  },
  statText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginBottom: 80,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default LibraryScreen;
