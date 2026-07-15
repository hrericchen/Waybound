import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';

const ProfileScreen: React.FC = () => {
  const { user, signOut } = useContext(AuthContext);
  const theme = useContext(ThemeContext);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const menuItems = [
    {
      key: 'edit',
      label: 'Edit Profile',
      icon: 'edit',
      onPress: () => {},
    },
    {
      key: 'theme',
      label: theme.mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode',
      icon: 'theme',
      onPress: () => theme.toggle(),
    },
    {
      key: 'demo',
      label: 'Run Demo',
      icon: 'demo',
      onPress: () => navigation.navigate('Demo' as any),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Profile</Text>
        </View>

        <View style={[styles.profileCard, { backgroundColor: theme.colors.card }]}>
          <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
          </LinearGradient>
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: theme.colors.text }]}>{user?.name || 'Guest'}</Text>
            <Text style={[styles.email, { color: theme.colors.muted }]}>{user?.email || 'Not signed in'}</Text>
            <View style={styles.badge}>
              <Icon name="plane" size={12} color={colors.primary} />
              <Text style={styles.badgeText}>Explorer</Text>
            </View>
          </View>
        </View>

        <View style={[styles.statsRow, { backgroundColor: theme.colors.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>12</Text>
            <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Trips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>48</Text>
            <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Spots</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>7</Text>
            <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Countries</Text>
          </View>
        </View>

        <View style={styles.menu}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.menuItem, { backgroundColor: theme.colors.card }]}
              onPress={item.onPress}
              activeOpacity={0.85}
            >
              <View style={styles.menuLeft}>
                <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.menuIcon}>
                  <Icon name={item.icon} size={18} color={colors.primary} />
                </LinearGradient>
                <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{item.label}</Text>
              </View>
              <Icon name="chevronRight" size={20} color={theme.colors.muted} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.menuItem, styles.signOut]}
            onPress={signOut}
            activeOpacity={0.85}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, styles.signOutIcon]}>
                <Icon name="logout" size={18} color={colors.danger} />
              </View>
              <Text style={[styles.menuLabel, { color: colors.danger }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
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
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  profileCard: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.card,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
  avatarText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
  },
  profileInfo: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
  },
  email: {
    marginTop: 4,
    fontSize: 13,
  },
  badge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    borderRadius: radius.xxl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.soft,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  menu: {
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: 10,
  },
  menuItem: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.soft,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  signOut: {
    marginTop: 8,
    backgroundColor: colors.dangerLight,
  },
  signOutIcon: {
    backgroundColor: '#FFE0E0',
  },
});

export default ProfileScreen;
