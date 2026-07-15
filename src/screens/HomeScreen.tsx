import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import tripService from '../services/tripService';
import { Trip } from '../types';
import TripCard from '../components/TripCard';
import { Icon } from '../components/Icon';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';

const quickFilters = ['Now', 'Tomorrow', 'Next Week'];

const HomeScreen: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Now');
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const theme = useContext(ThemeContext);

  useEffect(() => {
    tripService.getTrips().then((t: any) => setTrips(t));
  }, []);

  const filtered = trips.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.country.toLowerCase().includes(query.toLowerCase())
  );

  const featured = filtered.slice(0, 6);
  const popular = filtered.slice(0, 8);
  const firstName = user?.name?.split(' ')[0] || 'Traveler';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.muted }]}>Good morning,</Text>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {firstName} 👋
            </Text>
          </View>
          <TouchableOpacity style={[styles.bellBtn, { backgroundColor: theme.colors.card }]}>
            <Icon name="bell" size={22} color={theme.colors.text} />
            <View style={styles.bellDot} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Icon name="search" size={20} color={theme.colors.muted} />
          <TextInput
            placeholder="Search destinations..."
            placeholderTextColor={theme.colors.muted}
            style={[styles.search, { color: theme.colors.text }]}
            value={query}
            onChangeText={setQuery}
          />
          <LinearGradient
            colors={[colors.primary, '#7985FF']}
            style={styles.micBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name="mic" size={16} color={colors.white} />
          </LinearGradient>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {quickFilters.map((filter) => {
            const active = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  active && styles.filterChipActive,
                  { backgroundColor: active ? colors.primary : theme.colors.card, borderColor: active ? colors.primary : theme.colors.border },
                ]}
                onPress={() => setActiveFilter(filter)}
              >
                {filter === 'Now' && (
                  <Icon name="time" size={14} color={active ? colors.white : theme.colors.muted} />
                )}
                {filter === 'Tomorrow' && (
                  <Icon name="calendar" size={14} color={active ? colors.white : theme.colors.muted} />
                )}
                {filter === 'Next Week' && (
                  <Icon name="calendar" size={14} color={active ? colors.white : theme.colors.muted} />
                )}
                <Text style={[styles.filterText, { color: active ? colors.white : theme.colors.muted }, active && styles.filterTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Your Itinerary</Text>
          <TouchableOpacity onPress={() => (navigation as any).navigate('Library')}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        {featured[0] ? (
          <TouchableOpacity
            activeOpacity={0.95}
            style={styles.heroCard}
            onPress={() => (navigation as any).navigate('TripDetail', { id: featured[0].id })}
          >
            <Image source={{ uri: featured[0].image }} style={styles.heroImage} />
            <LinearGradient
              colors={['transparent', 'rgba(8,15,30,0.7)']}
              style={styles.heroOverlay}
            />
            <View style={styles.heroContent}>
              <View style={styles.heroTag}>
                <Icon name="location" size={12} color={colors.white} />
                <Text style={styles.heroTagText}>{featured[0].country}</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {featured[0].title}
              </Text>
              <View style={styles.heroMeta}>
                <Text style={styles.heroMetaText}>{featured[0].season}</Text>
                <View style={styles.heroDot} />
                <Text style={styles.heroMetaText}>{featured[0].days?.length || 0} days</Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Popular Destinations</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={popular}
          keyExtractor={(t) => `popular-${t.id}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.destinationCard}
              activeOpacity={0.9}
              onPress={() => (navigation as any).navigate('TripDetail', { id: item.id })}
            >
              <Image source={{ uri: item.image }} style={styles.destinationImage} />
              <LinearGradient
                colors={['transparent', 'rgba(8,15,30,0.75)']}
                style={styles.destinationOverlay}
              />
              <View style={styles.destinationContent}>
                <Text style={styles.destinationName}>{item.country}</Text>
                <Text style={styles.destinationPrice}>${item.budget}</Text>
              </View>
            </TouchableOpacity>
          )}
        />

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Featured Trips</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={featured}
          keyExtractor={(t) => `featured-${t.id}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 4 }}
          renderItem={({ item }) => <TripCard trip={item} />}
        />

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>All Trips</Text>
        </View>

        <View style={{ paddingHorizontal: spacing.xl }}>
          {filtered.map((item) => (
            <TripCard key={item.id} trip={item} variant="wide" />
          ))}
        </View>
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: 15,
    fontWeight: '500',
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
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
  micBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
    marginRight: 10,
  },
  filterChipActive: {},
  filterText: {
    fontWeight: '700',
    fontSize: 13,
  },
  filterTextActive: {
    color: colors.white,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  seeAll: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  heroCard: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    height: 220,
    ...shadows.deep,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: 8,
  },
  heroTagText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  destinationCard: {
    width: 140,
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginRight: 12,
    ...shadows.card,
  },
  destinationImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  destinationOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  destinationContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  destinationName: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  destinationPrice: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});

export default HomeScreen;
