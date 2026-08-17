import React, { useContext, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, Animated, Easing, Modal, Alert, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import HomeScreen from '../screens/HomeScreen';
import SplashScreen from '../screens/SplashScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import TripDetailScreen from '../screens/TripDetailScreen';
import CreateItineraryScreen from '../screens/CreateItineraryScreen';
import LibraryScreen from '../screens/LibraryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DemoScreen from '../screens/DemoScreen';
import CommunityScreen from '../screens/CommunityScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import PackingChecklistScreen from '../screens/PackingChecklistScreen';
import DocumentsVaultScreen from '../screens/DocumentsVaultScreen';
import EmergencyNumbersScreen from '../screens/EmergencyNumbersScreen';
import ExchangeRatesScreen from '../screens/ExchangeRatesScreen';
import BrowseScreen from '../screens/BrowseScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import TripRecapsScreen from '../screens/TripRecapsScreen';
import TravelGuideScreen from '../screens/TravelGuideScreen';
import ItineraryVisibilityScreen from '../screens/ItineraryVisibilityScreen';
import AccountBlockedScreen from '../screens/AccountBlockedScreen';
import { Icon } from '../components/Icon';
import { AuthContext } from '../context/AuthContext';
import { TourProvider, useTour } from '../context/TourContext';
import { colors, radius, shadows, spacing } from '../theme/theme';
import { useResponsive, fs } from '../utils/responsive';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ICON_SIZE = 40; // icon badge size — the sliding highlight matches it exactly
// The icon badges are pinned at this fixed vertical line inside the bar
// (tabBar paddingTop 4 + tabItemContent paddingTop 3) so the highlight always lands on them.
const ICON_TOP = 7;
// Tiny optical nudge left so the highlight sits dead-center over the icon glyph.
const HIGHLIGHT_NUDGE = -2;
// Floating create button — sits in FRONT of the bar, straddling its top edge.
const FAB_SIZE = 60;
const FAB_RAISE = -2; // how far the FAB pokes above the bar's top edge (negative = sits below)

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { scale, compact } = useResponsive();
  const [itemRects, setItemRects] = useState<{ x: number; w: number }[]>([]);
  const [tabBarH, setTabBarH] = useState(68);
  const slideX = useRef(new Animated.Value(0)).current;
  const highlightReady = itemRects.length >= state.routes.length;
  // The Create tab is a raised FAB — fade the sliding highlight when it's focused
  const createIndex = state.routes.findIndex((r: any) => r.name === 'Create');
  const [createMenuVisible, setCreateMenuVisible] = useState(false);

  // Create menu "swish + pop" animation.
  const menuAnim = useRef(new Animated.Value(0)).current;
  const fabSpin = useRef(new Animated.Value(0)).current;

  // Give the onboarding tour access to this tab navigator and the tab bar items.
  const { setNav, registerTarget } = useTour();
  useEffect(() => {
    setNav(navigation);
  }, [navigation, setNav]);

  // Spring the create sheet open: it swishes up from the bottom and pops into place.
  useEffect(() => {
    if (createMenuVisible) {
      menuAnim.setValue(0);
      Animated.spring(menuAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [createMenuVisible, menuAnim]);

  const openCreateMenu = () => {
    setCreateMenuVisible(true);
    Animated.timing(fabSpin, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  };

  const closeCreateMenu = () => {
    setCreateMenuVisible(false);
    Animated.timing(fabSpin, { toValue: 0, duration: 180, useNativeDriver: true }).start();
  };

  // Capture each slot's horizontal span via onLayout (reliable on every device).
  // The icon is centered in its slot, so the slot center is the icon center.
  const onLayoutItem = (index: number) => (e: any) => {
    const { x, width } = e.nativeEvent.layout;
    setItemRects((prev) => {
      const next = [...prev];
      next[index] = { x, w: width };
      return next;
    });
  };

  // Slide the purple highlight onto the focused icon (snappy timing-based slide).
  // The highlight is exactly icon-sized and sits on the pinned ICON_TOP line.
  useEffect(() => {
    if (itemRects.length > 0) {
      const rect = itemRects[state.index];
      if (rect) {
        Animated.timing(slideX, {
          toValue: rect.x + rect.w / 2 - ICON_SIZE / 2 + HIGHLIGHT_NUDGE,
          duration: 170,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    }
  }, [state.index, itemRects]);

  // The Create slot's rect (kept as an invisible spacer in the row) centers the floating FAB.
  const createSlotRect = itemRects[createIndex];
  const fabBottom =
    Math.max(insets.bottom, 8) + (Platform.OS === 'ios' ? 0 : 8) + tabBarH + FAB_RAISE - FAB_SIZE;

  return (
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <LinearGradient
        onLayout={(e) => setTabBarH(e.nativeEvent.layout.height)}
        colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.98)']}
        style={[styles.tabBar, compact && styles.tabBarCompact]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {highlightReady && (
          <Animated.View
            style={[
              styles.tabHighlight,
              {
                top: ICON_TOP,
                width: ICON_SIZE,
                height: ICON_SIZE,
                transform: [{ translateX: slideX }],
                opacity: state.index === createIndex ? 0 : 1,
              },
            ]}
          />
        )}
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;
          const isCreate = route.name === 'Create';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (isCreate) {
            // Invisible spacer that keeps the 5-slot layout even AND reports the
            // slot's rect so the floating FAB (rendered on top of the bar) centers on it.
            return (
              <View
                key={route.key}
                collapsable={false}
                onLayout={onLayoutItem(index)}
                style={styles.fabSlot}
              />
            );
          }

           const iconName =
             route.name === 'Home'
               ? 'home'
               : route.name === 'Community'
               ? 'globe'
               : route.name === 'Library'
               ? 'itinerary'
               : 'profile';

           return (
             <TouchableOpacity
               key={route.key}
               accessibilityRole="button"
               accessibilityState={isFocused ? { selected: true } : {}}
               onPress={onPress}
               style={styles.tabItem}
               onLayout={onLayoutItem(index)}
               activeOpacity={0.8}
             >
               <View
                 collapsable={false}
                 ref={(r) => registerTarget(`tab-${route.name}`, r)}
                 style={styles.tabItemContent}
               >
                 <View style={styles.tabIconWrap}>
                   <Icon
                     name={iconName}
                     size={20}
                     color={isFocused && highlightReady ? colors.white : colors.muted}
                   />
                 </View>
                 <Text
                   numberOfLines={1}
                   adjustsFontSizeToFit
                   minimumFontScale={0.7}
                   style={[styles.tabLabel, { fontSize: fs(11, scale) }, isFocused && styles.tabLabelActive]}
                 >
                   {label}
                 </Text>
               </View>
             </TouchableOpacity>
           );
        })}
      </LinearGradient>
      {/* Floating create button — rendered AFTER the bar so it's always in FRONT,
          centered on the Create slot and straddling the bar's top edge. */}
      {createSlotRect && (
        <TouchableOpacity
          ref={(r) => registerTarget('tab-Create', r)}
          accessibilityRole="button"
          accessibilityState={state.index === createIndex ? { selected: true } : {}}
          onPress={openCreateMenu}
          activeOpacity={0.9}
          style={[
            styles.fabFloat,
            {
              left: (compact ? 12 : 16) + createSlotRect.x + createSlotRect.w / 2 - FAB_SIZE / 2,
              bottom: fabBottom,
            },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, '#7985FF']}
            style={styles.fab}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Animated.View
              style={{
                width: FAB_SIZE,
                height: FAB_SIZE,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [
                  { rotate: fabSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) },
                ],
              }}
            >
              <Icon name="plus" size={compact ? 22 : 26} color={colors.white} />
            </Animated.View>
          </LinearGradient>
        </TouchableOpacity>
      )}
      <Modal visible={createMenuVisible} transparent animationType="none" onRequestClose={closeCreateMenu}>
        <Animated.View style={[styles.menuOverlay, { opacity: menuAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCreateMenu} />
          <Animated.View
            style={[
              styles.menuSheet,
              {
                transform: [
                  { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) },
                  { scale: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                ],
              },
            ]}
          >
            <Text style={styles.menuTitle}>What would you like to create?</Text>
            <TouchableOpacity style={styles.menuOption} activeOpacity={0.85} onPress={() => { closeCreateMenu(); navigation.navigate('TravelGuide'); }}>
              <View style={[styles.menuIcon, { backgroundColor: '#3B82F620' }]}>
                <Icon name="map" size={20} color="#3B82F6" />
              </View>
              <View style={styles.menuOptionBody}>
                <Text style={styles.menuOptionTitle}>Travel Guide</Text>
                <Text style={styles.menuOptionSub}>Write a guide about a city you love</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOption} activeOpacity={0.85} onPress={() => { closeCreateMenu(); navigation.navigate('Create', { fresh: Date.now() }); }}>
              <View style={[styles.menuIcon, { backgroundColor: '#22C55E20' }]}>
                <Icon name="itinerary" size={20} color="#22C55E" />
              </View>
              <View style={styles.menuOptionBody}>
                <Text style={styles.menuOptionTitle}>Plan Your Trip</Text>
                <Text style={styles.menuOptionSub}>Build a day-by-day itinerary</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOption} activeOpacity={0.85} onPress={() => { closeCreateMenu(); Alert.alert('Import', 'Import is coming soon - use Plan Your Trip for now.'); }}>
              <View style={[styles.menuIcon, { backgroundColor: '#F59E0B20' }]}>
                <Icon name="download" size={20} color="#F59E0B" />
              </View>
              <View style={styles.menuOptionBody}>
                <Text style={styles.menuOptionTitle}>Import</Text>
                <Text style={styles.menuOptionSub}>Bring in an existing plan</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCancel} activeOpacity={0.8} onPress={closeCreateMenu}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

function MainTabs() {
  return (
    <TourProvider>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
        <Tab.Screen name="Library" component={LibraryScreen} options={{ title: 'Itinerary' }} />
        <Tab.Screen name="Create" component={CreateItineraryScreen} options={{ title: 'Create' }} />
        <Tab.Screen name="Community" component={CommunityScreen} options={{ title: 'Community' }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      </Tab.Navigator>
    </TourProvider>
  );
}

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="SignIn" component={SignInScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

const AppStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <Stack.Screen name="Main" component={MainTabs} />
    <Stack.Screen name="Demo" component={DemoScreen} />
    <Stack.Screen name="TripDetail" component={TripDetailScreen} />
    <Stack.Screen name="UserProfile" component={UserProfileScreen} />
    <Stack.Screen name="PackingChecklist" component={PackingChecklistScreen} />
    <Stack.Screen name="DocumentsVault" component={DocumentsVaultScreen} />
    <Stack.Screen name="EmergencyNumbers" component={EmergencyNumbersScreen} />
    <Stack.Screen name="ExchangeRates" component={ExchangeRatesScreen} />
    <Stack.Screen name="Browse" component={BrowseScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="TripRecaps" component={TripRecapsScreen} />
    <Stack.Screen name="TravelGuide" component={TravelGuideScreen} />
    <Stack.Screen name="ItineraryVisibility" component={ItineraryVisibilityScreen} />
  </Stack.Navigator>
);

export function RootNavigator() {
  const { loading, user } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.loading}>
        <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.logoBadge}>
          <Image source={require('../../assets/logo.png')} style={{ width: 36, height: 36 }} resizeMode="cover" />
        </LinearGradient>
        <Text style={styles.loadingBrand}>Waybound</Text>
        <Text style={styles.loadingSub}>Plan your next adventure</Text>
      </View>
    );
  }

  // Dev-only safety net: when a deleted account was tombstoned client-side
  // (server not configured), block it from the app. With the server configured,
  // deleted accounts can no longer sign in at all (their Firebase Auth account
  // is gone), and active sessions are kicked by the AuthContext status check.
  if (user?.deleted) {
    return <AccountBlockedScreen deleted />;
  }

  return user ? <AppStack /> : <AuthStack />;
}

const styles = StyleSheet.create({
  tabBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
    zIndex: 30,
    elevation: 30,
  },
  tabBar: {
    marginHorizontal: 16,
    marginBottom: Platform.OS === 'ios' ? 0 : 8,
    borderRadius: radius.xxl,
    minHeight: 68,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  tabBarCompact: {
    marginHorizontal: 12,
    paddingHorizontal: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    marginHorizontal: 2,
  },
  tabItemContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    paddingTop: 3,
    width: '100%',
  },
  fabSlot: {
    flex: 1,
  },
  fabFloat: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 999,
    elevation: 50,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.primary,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.35)',
    ...shadows.fab,
  },
  tabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabHighlight: {
    position: 'absolute',
    top: 14,
    left: 0,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    ...shadows.soft,
  },
  tabIconActive: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    ...shadows.soft,
  },
  tabIconCircle: {
    borderRadius: radius.full,
  },
  tabLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  tabIconInactive: {
    color: colors.muted,
  },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(8,15,30,0.5)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xl, paddingBottom: 40, gap: 12 },
  menuTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 6 },
  menuOption: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.md, ...shadows.soft },
  menuIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  menuOptionBody: { flex: 1 },
  menuOptionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  menuOptionSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  menuCancel: { alignItems: 'center', paddingVertical: 14, borderRadius: radius.full, backgroundColor: colors.background },
  menuCancelText: { fontSize: 15, fontWeight: '700', color: colors.muted },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...shadows.fab,
  },
  loadingBrand: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  loadingSub: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 15,
  },
});

export default RootNavigator;
