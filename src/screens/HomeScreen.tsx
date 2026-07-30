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
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import tripService from '../services/tripService';
import exchangeRateService, { ExchangeRates } from '../services/exchangeRateService';
import notificationService from '../services/notificationService';
import { Trip, Itinerary } from '../types';
import TripCard from '../components/TripCard';
import { Icon } from '../components/Icon';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';

const HomeScreen: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [query, setQuery] = useState('');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [notificationCount, setNotificationCount] = useState({ saved: 0, liked: 0, followed: 0 });
  const [stats, setStats] = useState({ countries: 0, cities: 0, itineraries: 0 });
  
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const theme = useContext(ThemeContext);

  useEffect(() => {
    loadData();
    fetchExchangeRates();
    loadNotifications();
    calculateStats();
  }, [user]);

  // Auto-update when screen comes into focus (e.g., returning from creating itinerary)
  useFocusEffect(
    React.useCallback(() => {
      loadData();
      calculateStats();
    }, [])
  );

  const loadData = async () => {
    const tripsData = await tripService.getTrips();
    setTrips(tripsData);
    
    // Load only the current user's itineraries
    const itinerariesData = user ? await tripService.getItineraries(user.id) : [];
    setItineraries(itinerariesData);
  };

  const fetchExchangeRates = async () => {
    const rates = await exchangeRateService.getCachedRates();
    setExchangeRates(rates);
  };

  const loadNotifications = async () => {
    // New users have no notifications - only load real notifications if user exists
    if (!user) {
      setNotificationCount({
        saved: 0,
        liked: 0,
        followed: 0,
      });
      return;
    }

    try {
      const notifs = await notificationService.getNotifications(user.id);
      const counts = {
        saved: notifs.filter(n => n.type === 'save').length,
        liked: notifs.filter(n => n.type === 'like').length,
        followed: notifs.filter(n => n.type === 'follow').length,
      };
      setNotificationCount(counts);
    } catch (e) {
      console.warn('Failed to load notifications:', e);
      setNotificationCount({
        saved: 0,
        liked: 0,
        followed: 0,
      });
    }
  };

  const calculateStats = async () => {
    const itinerariesData = await tripService.getItineraries();
    const countries = new Set(itinerariesData.flatMap((i: any) => i.destinations || [])).size;
    const cities = Math.floor(countries * 2.5); // Estimate cities based on countries
    
    setStats({
      countries,
      cities,
      itineraries: itinerariesData.length,
    });
  };

  const filtered = trips.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.country.toLowerCase().includes(query.toLowerCase())
  );

  const featured = filtered.slice(0, 6);
  const popular = filtered.slice(0, 8);
  const firstName = user?.name?.split(' ')[0] || 'Traveler';
  const greeting = exchangeRateService.getGreeting();
  const totalNotifications = notificationCount.saved + notificationCount.liked + notificationCount.followed;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
         {/* Header with Greeting and Notifications */}
         <View style={styles.header}>
           <TouchableOpacity onPress={() => (navigation as any).navigate('Main')}>
             <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.headerLogoBadge}>
               <Icon name="compass" size={20} color={colors.white} />
             </LinearGradient>
           </TouchableOpacity>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.muted }]}>{greeting},</Text>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {firstName} 👋
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.bellBtn, { backgroundColor: theme.colors.card }]}
            onPress={() => (navigation as any).navigate('Notifications')}
          >
            <Icon name="bell" size={22} color={theme.colors.text} />
            {totalNotifications > 0 && <View style={styles.bellDot} />}
          </TouchableOpacity>
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

        {/* Your Itinerary Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Your Itinerary</Text>
          <TouchableOpacity onPress={() => (navigation as any).navigate('Library')}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        {itineraries && itineraries.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.95}
            style={styles.heroCard}
            onPress={() => (navigation as any).navigate('TripDetail', { id: itineraries[0].id })}
          >
            <Image 
              source={{ 
                uri: itineraries[0].coverImage || undefined
              }} 
              style={styles.heroImage}
              defaultSource={require('../../assets/icon.png')}
            />
            <LinearGradient
              colors={['transparent', 'rgba(8,15,30,0.7)']}
              style={styles.heroOverlay}
            />
            <View style={styles.heroContent}>
              <View style={styles.heroTag}>
                <Icon name="location" size={12} color={colors.white} />
                <Text style={styles.heroTagText}>{itineraries[0].destinations?.[0] || 'Your Trip'}</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {itineraries[0].title}
              </Text>
              <View style={styles.heroMeta}>
                <Text style={styles.heroMetaText}>{itineraries[0].startDate ? 'Upcoming' : 'Draft'}</Text>
                <View style={styles.heroDot} />
                <Text style={styles.heroMetaText}>{itineraries[0].activities?.length || 0} activities</Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          /* Where To Next - Quick Start Card */
          <TouchableOpacity
            style={[styles.quickStartCard, { backgroundColor: theme.colors.card }]}
            onPress={() => (navigation as any).navigate('Create')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[colors.primary + '20', '#7985FF20']}
              style={styles.quickStartGradient}
            >
              <View style={styles.quickStartIcon}>
                <Icon name="compass" size={32} color={colors.primary} />
              </View>
              <View style={styles.quickStartContent}>
                <Text style={[styles.quickStartTitle, { color: theme.colors.text }]}>
                  Where to next?
                </Text>
                <Text style={[styles.quickStartSubtitle, { color: theme.colors.muted }]}>
                  Create your first itinerary
                </Text>
              </View>
              <Icon name="chevronRight" size={24} color={colors.primary} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Travel Toolbox Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Travel Toolbox</Text>
        </View>

        <View style={styles.toolboxGrid}>
          {/* Packing Checklist */}
          <TouchableOpacity
            style={[styles.toolboxCard, { backgroundColor: theme.colors.card }]}
            onPress={() => (navigation as any).navigate('PackingChecklist')}
          >
            <View style={[styles.toolboxIcon, { backgroundColor: '#FF6B6B20' }]}>
              <Icon name="checklist" size={24} color="#FF6B6B" />
            </View>
            <Text style={[styles.toolboxTitle, { color: theme.colors.text }]}>Packing List</Text>
            <Text style={[styles.toolboxSubtitle, { color: theme.colors.muted }]}>Check items off</Text>
          </TouchableOpacity>

          {/* Documents Vault */}
          <TouchableOpacity
            style={[styles.toolboxCard, { backgroundColor: theme.colors.card }]}
            onPress={() => (navigation as any).navigate('DocumentsVault')}
          >
            <View style={[styles.toolboxIcon, { backgroundColor: '#4ECDC420' }]}>
              <Icon name="document" size={24} color="#4ECDC4" />
            </View>
            <Text style={[styles.toolboxTitle, { color: theme.colors.text }]}>Documents</Text>
            <Text style={[styles.toolboxSubtitle, { color: theme.colors.muted }]}>Tickets & vouchers</Text>
          </TouchableOpacity>

          {/* Exchange Rates */}
          <TouchableOpacity
            style={[styles.toolboxCard, { backgroundColor: theme.colors.card }]}
            onPress={() => (navigation as any).navigate('ExchangeRates')}
          >
            <View style={[styles.toolboxIcon, { backgroundColor: '#FFD93D20' }]}>
              <Icon name="currency" size={24} color="#FFD93D" />
            </View>
            <Text style={[styles.toolboxTitle, { color: theme.colors.text }]}>Exchange Rates</Text>
            <Text style={[styles.toolboxSubtitle, { color: theme.colors.muted }]}>
              {exchangeRates ? `1 USD = ${exchangeRates.rates.EUR?.toFixed(2) || '0.92'} EUR` : 'Loading...'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Featured Trips (right after Travel Stats) */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Featured Trips</Text>
          <TouchableOpacity onPress={() => (navigation as any).navigate('Browse')}>
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

        {/* Browse Section */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Browse</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>
              View all our curated trips and adventures
            </Text>
          </View>
          <TouchableOpacity onPress={() => (navigation as any).navigate('Browse')}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        {/* Community Trips Banner */}
        <TouchableOpacity
          style={[styles.communityBanner, { backgroundColor: theme.colors.card }]}
          onPress={() => (navigation as any).navigate('Community')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[colors.primary + '30', '#7985FF30']}
            style={styles.communityBannerGradient}
          >
            <View style={styles.communityBannerContent}>
              <View style={styles.communityIcon}>
                <Icon name="globe" size={28} color={colors.primary} />
              </View>
              <View style={styles.communityText}>
                <Text style={[styles.communityTitle, { color: theme.colors.text }]}>
                  🌍 Explore Community Trips
                </Text>
                <Text style={[styles.communitySubtitle, { color: theme.colors.muted }]}>
                  Waybound is the only app with a built-in community of travelers sharing real itineraries. Browse trips created by fellow adventurers!
                </Text>
              </View>
              <Icon name="chevronRight" size={24} color={colors.primary} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
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
  headerLogoBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: 28,
    height: 28,
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
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
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
  quickStartCard: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.soft,
  },
  quickStartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  quickStartIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartContent: {
    flex: 1,
  },
  quickStartTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  quickStartSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  toolboxGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  toolboxCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.soft,
  },
  toolboxIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  toolboxTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  toolboxSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  statsContainer: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...shadows.soft,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 40,
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
  communityBanner: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.soft,
  },
  communityBannerGradient: {
    padding: spacing.lg,
  },
  communityBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  communityIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityText: {
    flex: 1,
  },
  communityTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  communitySubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default HomeScreen;