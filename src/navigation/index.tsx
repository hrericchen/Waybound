import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
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
import ExchangeRatesScreen from '../screens/ExchangeRatesScreen';
import BrowseScreen from '../screens/BrowseScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import TripRecapsScreen from '../screens/TripRecapsScreen';
import { Icon } from '../components/Icon';
import { AuthContext } from '../context/AuthContext';
import { colors, radius, shadows, spacing } from '../theme/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.98)']}
        style={styles.tabBar}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
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
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                style={styles.fabWrap}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[colors.primary, '#7985FF']}
                  style={styles.fab}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Icon name="plus" size={26} color={colors.white} />
                </LinearGradient>
              </TouchableOpacity>
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
              activeOpacity={0.8}
            >
              <View style={[styles.tabIconWrap, isFocused && styles.tabIconActive]}>
                <Icon
                  name={iconName}
                  size={20}
                  color={isFocused ? colors.white : colors.muted}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </LinearGradient>
    </View>
  );
}

function MainTabs() {
  return (
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
    <Stack.Screen name="ExchangeRates" component={ExchangeRatesScreen} />
    <Stack.Screen name="Browse" component={BrowseScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="TripRecaps" component={TripRecapsScreen} />
  </Stack.Navigator>
);

export function RootNavigator() {
  const { loading, user } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.loading}>
        <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.logoBadge}>
          <Icon name="plane" size={28} color={colors.white} />
        </LinearGradient>
        <Text style={styles.loadingBrand}>Waybound</Text>
        <Text style={styles.loadingSub}>Plan your next adventure</Text>
      </View>
    );
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
  },
  tabBar: {
    marginHorizontal: 16,
    marginBottom: Platform.OS === 'ios' ? 0 : 8,
    borderRadius: radius.xxl,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
    borderRadius: radius.md,
    marginHorizontal: 2,
  },
  tabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.primary,
    ...shadows.soft,
  },
  tabLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  fabWrap: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
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
