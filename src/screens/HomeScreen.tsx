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
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import tripService from '../services/tripService';
import storageService from '../services/storageService';
import { communityService } from '../services/communityService';
import { getFirebaseAuth } from '../services/firebase';
import { updateProfile } from 'firebase/auth';
import exchangeRateService, { ExchangeRates } from '../services/exchangeRateService';
import notificationService from '../services/notificationService';
import { Trip, Itinerary } from '../types';
import TripCard from '../components/TripCard';
import { Icon } from '../components/Icon';
import Avatar from '../components/Avatar';
import BannerAdComponent from '../components/BannerAd';
import { AuthContext } from '../context/AuthContext';
import { useRevenueCat } from '../context/RevenueCatContext';
import { useTour } from '../context/TourContext';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import { getTagById } from '../config/tags';
import { useResponsive, fs } from '../utils/responsive';
import { sanitizeDisplayName } from '../utils/displayName';

const HomeScreen: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [communityItins, setCommunityItins] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [notificationCount, setNotificationCount] = useState({ saved: 0, liked: 0, followed: 0 });
  const [stats, setStats] = useState({ countries: 0, cities: 0, itineraries: 0 });
  // One-time display-name picker (shown after the first Google sign-in).
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { scale, compact } = useResponsive();
  const { user, updateUser } = useContext(AuthContext);
  const { isPro, presentPaywall } = useRevenueCat();
  const { registerTarget } = useTour();
  const theme = useContext(ThemeContext);

  useEffect(() => {
    loadData();
    fetchExchangeRates();
    loadNotifications();
    calculateStats();
  }, [user]);

  // Auto-update when screen comes into focus (e.g., returning from creating itinerary or changing profile)
  useFocusEffect(
    React.useCallback(() => {
      loadData();
      calculateStats();
      // Reload user tag from storage to pick up changes from ProfileScreen
      storageService.load('WB_USER').then((u: any) => {
        if (u?.tag) setStoredTag(u.tag);
        else setStoredTag('explorer');
      });
    }, [])
  );

  const loadData = async () => {
    const tripsData = await tripService.getTrips();
    setTrips(tripsData);
    
    // Load only the current user's itineraries
    const itinerariesData = user ? await tripService.getItineraries(user.id) : [];
    setItineraries(itinerariesData);

    // Community itineraries for the search bar (falls back to local storage).
    try {
      const comm = await communityService.getItineraries('newest');
      setCommunityItins(comm || []);
    } catch (e) {
      console.warn('Failed to load community itineraries:', e);
      setCommunityItins([]);
    }
  };

  // One-time display-name picker, shown after the first Google sign-in.
  useEffect(() => {
    if (!user?.id || user?.isAdmin) return;
    (async () => {
      try {
        const chosen = await storageService.load(`WB_DISPLAY_NAME_SET_${user.id}`);
        if (!chosen) {
          setDisplayName(sanitizeDisplayName(user?.name || '').value);
          setNameModalVisible(true);
        }
      } catch (e) {
        console.warn('Failed to check display-name flag', e);
      }
    })();
  }, [user?.id]);

  const saveDisplayName = async () => {
    const safe = sanitizeDisplayName(displayName);
    const name = safe.value;
    if (!name) return;
    // If the typed name was flagged, show the generated safe name in the field.
    if (safe.changed) setDisplayName(name);
    setSavingName(true);
    try {
      await updateUser({ name });
      try {
        const firebaseAuth = getFirebaseAuth();
        if (firebaseAuth.currentUser) {
          await updateProfile(firebaseAuth.currentUser, { displayName: name });
        }
      } catch (e) {
        console.warn('Failed to update Firebase display name:', e);
      }
      try {
        await communityService.updateUserStatus(user?.id || '', { name });
      } catch (e) {
        console.warn('Failed to update community display name:', e);
      }
      try {
        await storageService.save(`WB_DISPLAY_NAME_SET_${user?.id}`, true);
      } catch (e) {}
      setNameModalVisible(false);
    } catch (e: any) {
      console.warn('Failed to save display name:', e);
    } finally {
      setSavingName(false);
    }
  };

  const skipDisplayName = async () => {
    try {
      await storageService.save(`WB_DISPLAY_NAME_SET_${user?.id}`, true);
    } catch (e) {}
    setNameModalVisible(false);
  };

  const fetchExchangeRates = async () => {
    const rates = await exchangeRateService.getCachedRates();
    setExchangeRates(rates);
  };

  const loadNotifications = async () => {
    if (!user) {
      setNotificationCount({ saved: 0, liked: 0, followed: 0 });
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
      setNotificationCount({ saved: 0, liked: 0, followed: 0 });
    }
  };

  const calculateStats = async () => {
    const itinerariesData = await tripService.getItineraries();
    const countries = new Set(itinerariesData.flatMap((i: any) => i.destinations || [])).size;
    const cities = Math.floor(countries * 2.5);
    
    setStats({ countries, cities, itineraries: itinerariesData.length });
  };

  const filtered = trips.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.country.toLowerCase().includes(query.toLowerCase())
  );

  const commFiltered = communityItins.filter((i: any) =>
    i.title?.toLowerCase().includes(query.toLowerCase()) ||
    (i.destinations || []).some((d: string) => d.toLowerCase().includes(query.toLowerCase()))
  );

  // When searching, surface matching official + community itineraries.
  const searchResults = query.trim()
    ? Array.from(new Map([...filtered, ...commFiltered].map((x) => [x.id, x])).values()).slice(0, 8)
    : [];

  const featured = filtered.slice(0, 6);
  const firstName = user?.name?.split(' ')[0] || 'Traveler';
  const greeting = exchangeRateService.getGreeting();
  const totalNotifications = notificationCount.saved + notificationCount.liked + notificationCount.followed;

  // Get user's tag data - default to Explorer
  const [storedTag, setStoredTag] = useState<string | undefined>(user?.tag);

  const userTag = storedTag ? getTagById(storedTag) : getTagById('explorer');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header: Profile picture (left), Upgrade/Bell (right) */}
        <View style={styles.header}>
          {/* Left: User profile picture — opens profile settings */}
          <View collapsable={false} ref={(r) => registerTarget('home-profile', r)}>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => (navigation as any).navigate('Main', { screen: 'Profile' })}
            >
              <Avatar uri={user?.avatarUrl} name={user?.name || 'W'} size={44} style={styles.profilePic} />
            </TouchableOpacity>
          </View>

          {/* Right: Tag, Upgrade button, Bell */}
          <View style={styles.headerRight}>
            {/* Always show user tag */}
            <View style={[styles.tagChip, { backgroundColor: userTag!.bgColor, borderColor: userTag!.color }]}>
              <Text style={styles.tagEmoji}>{userTag!.emoji}</Text>
              <Text style={[styles.tagText, { color: userTag!.color }]}>{userTag!.name}</Text>
            </View>
            {!isPro && (
              <View collapsable={false} ref={(r) => registerTarget('home-upgrade', r)}>
                <TouchableOpacity 
                  style={styles.upgradeBtn}
                  onPress={() => presentPaywall()}
                >
                  <Text style={styles.upgradeBtnText}>Upgrade</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity 
              style={[styles.bellBtn, { backgroundColor: theme.colors.card }]}
              onPress={() => (navigation as any).navigate('Notifications')}
            >
              <Icon name="bell" size={22} color={theme.colors.text} />
              {totalNotifications > 0 && <View style={styles.bellDot} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Centered Greeting */}
        <View style={styles.greetingCenter}>
          <Text style={[styles.greetingText, { color: theme.colors.muted }]}>{greeting},</Text>
          <Text style={[styles.greetingName, { color: theme.colors.text }]}>
            {firstName} 👋
          </Text>
        </View>

        {/* Search Bar */}
        <View
          collapsable={false}
          ref={(r) => registerTarget('home-search', r)}
          style={[styles.searchWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <Icon name="search" size={20} color={theme.colors.muted} />
          <TextInput
            placeholder="Search destinations..."
            placeholderTextColor={theme.colors.muted}
            style={[styles.search, { color: theme.colors.text }]}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {/* Search results: matching official + community itineraries */}
        {query.trim() ? (
          <View style={[styles.searchResults, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.searchResultsHeader}>
              <Text style={[styles.searchResultsTitle, { color: theme.colors.text }]}>Search results</Text>
              <Text style={[styles.searchResultsCount, { color: theme.colors.muted }]}>
                {searchResults.length} {searchResults.length === 1 ? 'trip' : 'trips'}
              </Text>
            </View>
            {searchResults.length === 0 ? (
              <View style={styles.searchEmptyWrap}>
                <View style={[styles.searchEmptyIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="search" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.searchEmpty, { color: theme.colors.muted }]}>
                  No trips match “{query.trim()}”. Try another destination.
                </Text>
              </View>
            ) : (
              <View style={styles.searchResultList}>
                {searchResults.map((item: any, idx: number) => {
                  const cover = item.coverImageBase64
                    ? `data:image/jpeg;base64,${item.coverImageBase64}`
                    : item.coverImage || item.image;
                  return (
                    <TouchableOpacity
                      key={`${item.id}-${idx}`}
                      style={[styles.searchResultRow, { backgroundColor: theme.colors.background }]}
                      activeOpacity={0.85}
                      onPress={() => (navigation as any).navigate('TripDetail', { id: item.id })}
                    >
                      {cover ? (
                        <Image source={{ uri: cover }} style={styles.searchResultImg} />
                      ) : (
                        <View style={[styles.searchResultImg, { backgroundColor: colors.primary + '20' }]}>
                          <Icon name="image" size={18} color={colors.primary} />
                        </View>
                      )}
                      <View style={styles.searchResultBody}>
                        <Text style={[styles.searchResultTitle, { color: theme.colors.text }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.searchResultSub, { color: theme.colors.muted }]} numberOfLines={1}>
                          {item.country || item.destinations?.slice(0, 2).join(', ') || 'Custom trip'}
                        </Text>
                      </View>
                      <View style={[styles.searchResultChevron, { backgroundColor: colors.primary + '18' }]}>
                        <Icon name="chevronRight" size={16} color={colors.primary} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* Your Itinerary Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Your Itinerary</Text>
          <TouchableOpacity onPress={() => (navigation as any).navigate('Library')}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        {(() => {
          const activeItin = itineraries?.find((i: any) => i.isActive) || itineraries?.[0];
          if (activeItin) {
            return (
              <TouchableOpacity
                activeOpacity={0.95}
                style={styles.heroCard}
                ref={(r) => registerTarget('home-create-card', r)}
                onPress={() => (navigation as any).navigate('TripDetail', { id: activeItin.id })}
              >
                {activeItin.coverImage ? (
                  <Image source={{ uri: activeItin.coverImage }} style={styles.heroImage} />
                ) : (
                  <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.heroImage} />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(8,15,30,0.7)']}
                  style={styles.heroOverlay}
                />
                <View style={styles.heroContent}>
                  <View style={styles.heroTag}>
                    <Icon name="location" size={12} color={colors.white} />
                    <Text style={styles.heroTagText}>{activeItin.destinations?.[0] || 'Your Trip'}</Text>
                  </View>
                  <Text style={styles.heroTitle} numberOfLines={1}>
                    {activeItin.title}
                  </Text>
                  <View style={styles.heroMeta}>
                    {activeItin.isActive && (
                      <View style={styles.heroActiveChip}>
                        <Icon name="check" size={10} color={colors.white} />
                        <Text style={styles.heroActiveText}>Active</Text>
                      </View>
                    )}
                    {activeItin.isActive && <View style={styles.heroDot} />}
                    <Text style={styles.heroMetaText}>{activeItin.activities?.length || 0} activities</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              style={[styles.quickStartCard, { backgroundColor: theme.colors.card }]}
              ref={(r) => registerTarget('home-create-card', r)}
              onPress={() => (navigation as any).navigate('Create')}
              activeOpacity={0.9}
            >
              <LinearGradient colors={[colors.primary + '20', '#7985FF20']} style={styles.quickStartGradient}>
                <View style={styles.quickStartIcon}>
                  <Icon name="compass" size={32} color={colors.primary} />
                </View>
                <View style={styles.quickStartContent}>
                  <Text style={[styles.quickStartTitle, { color: theme.colors.text }]}>Where to next?</Text>
                  <Text style={[styles.quickStartSubtitle, { color: theme.colors.muted }]}>Create your first itinerary</Text>
                </View>
                <Icon name="chevronRight" size={24} color={colors.primary} />
              </LinearGradient>
            </TouchableOpacity>
          );
        })()}

        {/* Travel Toolbox Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Travel Toolbox</Text>
        </View>

        <View style={[styles.toolboxGrid, { paddingHorizontal: compact ? spacing.lg : spacing.xl, gap: compact ? spacing.sm : spacing.md }]}>
          {/* Packing Checklist */}
          <TouchableOpacity
            style={[styles.toolboxCard, { backgroundColor: theme.colors.card }]}
            onPress={() => (navigation as any).navigate('PackingChecklist')}
          >
            <View style={[styles.toolboxIcon, compact && styles.toolboxIconCompact, { backgroundColor: '#22C55E20' }]}>
              <Icon name="checklist" size={compact ? 20 : 24} color="#22C55E" />
            </View>
            <Text
              style={[styles.toolboxTitle, { fontSize: fs(14, scale) }, { color: theme.colors.text }]}
            >
              Packing List
            </Text>
            <Text
              style={[styles.toolboxSubtitle, { fontSize: fs(12, scale) }, { color: theme.colors.muted }]}
            >
              Check items off
            </Text>
          </TouchableOpacity>

                    {/* Emergency Numbers */}
          <TouchableOpacity
            style={[styles.toolboxCard, { backgroundColor: theme.colors.card }]}
            onPress={() => (navigation as any).navigate('EmergencyNumbers')}
          >
            <View style={[styles.toolboxIcon, compact && styles.toolboxIconCompact, { backgroundColor: '#FF6B6B20' }]}>
              <Icon name="warning" size={compact ? 20 : 24} color="#FF6B6B" />
            </View>
            <Text
              style={[styles.toolboxTitle, { fontSize: fs(14, scale) }, { color: theme.colors.text }]}
            >
              Emergency Numbers
            </Text>
            <Text
              style={[styles.toolboxSubtitle, { fontSize: fs(12, scale) }, { color: theme.colors.muted }]}
            >
              30 popular countries
            </Text>
          </TouchableOpacity>

          {/* Exchange Rates */}
          <TouchableOpacity
            style={[styles.toolboxCard, { backgroundColor: theme.colors.card }]}
            onPress={() => (navigation as any).navigate('ExchangeRates')}
          >
            <View style={[styles.toolboxIcon, compact && styles.toolboxIconCompact, { backgroundColor: '#FFD93D20' }]}>
              <Icon name="currency" size={compact ? 20 : 24} color="#FFD93D" />
            </View>
            <Text
              style={[styles.toolboxTitle, { fontSize: fs(14, scale) }, { color: theme.colors.text }]}
            >
              Exchange Rates
            </Text>
            <Text
              style={[styles.toolboxSubtitle, { fontSize: fs(12, scale) }, { color: theme.colors.muted }]}
            >
              {exchangeRates ? `1 USD = ${exchangeRates.rates.EUR?.toFixed(2) || '0.92'} EUR` : 'Loading...'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Featured Trips */}
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

        {/* Community Trips Explore Banner */}
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

        {/* Banner Ad below Community Banner */}
        <View style={{ marginTop: spacing.md }}>
          <BannerAdComponent />
        </View>
      </ScrollView>

      {/* One-time display-name picker after Google sign-in */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={skipDisplayName}
      >
        <View style={styles.nameModalOverlay}>
          <View style={[styles.nameModalCard, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.nameModalIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="user" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.nameModalTitle, { color: theme.colors.text }]}>Choose your display name</Text>
            <Text style={[styles.nameModalDesc, { color: theme.colors.muted }]}>
              This is how you'll appear to other travelers in the community. Your Google name is filled in — change it anytime.
            </Text>
            <View style={[styles.inputWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
              <Icon name="user" size={18} color={colors.muted} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Display name"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
                maxLength={30}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.nameModalSave, { opacity: savingName || !displayName.trim() ? 0.6 : 1 }]}
              onPress={saveDisplayName}
              disabled={savingName || !displayName.trim()}
              activeOpacity={0.9}
            >
              <Text style={styles.nameModalSaveText}>{savingName ? 'Saving...' : 'Save name'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nameModalSkip} onPress={skipDisplayName} activeOpacity={0.8}>
              <Text style={[styles.nameModalSkipText, { color: theme.colors.muted }]}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Profile picture on the left
  profileBtn: {
    ...shadows.soft,
  },
  profilePic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primary + '40',
  },
  profilePicPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary + '40',
  },
  profilePicText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  // Tag chip next to the profile
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tagEmoji: {
    fontSize: 12,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // Centered greeting below the header
  greetingCenter: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  greetingText: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  greetingName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upgradeBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    ...shadows.fab,
  },
  upgradeBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
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
  searchResults: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    ...shadows.soft,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  searchResultsTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  searchResultsCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchResultList: {
    gap: 8,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.lg,
  },
  searchResultImg: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultBody: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  searchResultSub: {
    fontSize: 12,
    marginTop: 2,
  },
  searchResultChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  searchEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchEmpty: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  nameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,15,30,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  nameModalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    alignItems: 'center',
    ...shadows.deep,
  },
  nameModalIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  nameModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  nameModalDesc: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  nameModalSave: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  nameModalSaveText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  nameModalSkip: {
    marginTop: spacing.md,
    paddingVertical: 8,
  },
  nameModalSkipText: {
    fontSize: 14,
    fontWeight: '600',
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
    ...(StyleSheet.absoluteFill as object),
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
  toolboxIconCompact: {
    width: 40,
    height: 40,
    marginBottom: spacing.xs,
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
  heroActiveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  heroActiveText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
});

export default HomeScreen;