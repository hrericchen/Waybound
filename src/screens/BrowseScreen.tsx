import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import tripService from '../services/tripService';
import { Trip } from '../types';
import TripCard from '../components/TripCard';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';

const BrowseScreen: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const theme = useContext(ThemeContext);

  const categories = ['All', 'Beach', 'Mountain', 'City', 'Adventure', 'Cultural'];

  useEffect(() => {
    loadTrips();
  }, []);

  useEffect(() => {
    filterTrips();
  }, [query, selectedCategory, trips]);

  const loadTrips = async () => {
    const data = await tripService.getTrips();
    setTrips(data);
    setFilteredTrips(data);
  };

  const filterTrips = () => {
    let filtered = trips;

    if (query) {
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.country.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((t) => t.tags?.includes(selectedCategory.toLowerCase()));
    }

    setFilteredTrips(filtered);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Browse</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          Discover your next adventure
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Icon name="search" size={20} color={theme.colors.muted} />
        <TextInput
          placeholder="Search destinations..."
          placeholderTextColor={theme.colors.muted}
          style={[styles.search, { color: theme.colors.text }]}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                selectedCategory === item && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  { color: theme.colors.muted },
                  selectedCategory === item && { color: colors.white },
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Results */}
      <FlatList
        data={filteredTrips}
        keyExtractor={(t) => `browse-${t.id}`}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.9}
            onPress={() => (navigation as any).navigate('TripDetail', { id: item.id })}
          >
            <View style={styles.gridImageContainer}>
              <Image source={{ uri: item.image }} style={styles.gridImage} />
              <LinearGradient
                colors={['transparent', 'rgba(8,15,30,0.8)']}
                style={styles.gridOverlay}
              />
              <View style={styles.gridContent}>
                <Text style={styles.gridCountry}>{item.country}</Text>
                <Text style={styles.gridTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.gridBudget}>${item.budget}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="search" size={48} color={theme.colors.muted} />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
              No destinations found
            </Text>
          </View>
        }
      />
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
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
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
    ...shadows.soft,
  },
  search: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  categoriesContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  gridImageContainer: {
    height: 220,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  gridCountry: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  gridTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  gridBudget: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default BrowseScreen;