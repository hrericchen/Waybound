import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext, colors, radius, spacing, shadows } from '../theme/theme';
import { Icon } from '../components/Icon';
import { AuthContext } from '../context/AuthContext';

type Props = {
  /** True when the account was permanently closed by a moderator. */
  deleted?: boolean;
  /** Timestamp until which the account is suspended (undefined when deleted). */
  until?: number;
};

/**
 * Full-screen gate shown instead of the app when a signed-in account has been
 * suspended by a moderator or permanently closed. The user can still sign out.
 */
const AccountBlockedScreen: React.FC<Props> = ({ deleted = false, until }) => {
  const theme = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const { signOut } = useContext(AuthContext);

  const suspended = !deleted;
  const untilDate = until ? new Date(until).toLocaleDateString() : '';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: deleted ? '#FEE2E2' : '#FEF3C7' }]}>
        <Icon name={deleted ? 'trash' : 'lock'} size={40} color={deleted ? '#EF4444' : '#D97706'} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {deleted ? 'Account closed' : 'Account suspended'}
      </Text>
      <Text style={[styles.desc, { color: theme.colors.muted }]}>
        {deleted
          ? 'This account has been permanently closed by the Waybound team for violating our community guidelines.'
          : `Your account has been temporarily suspended for violating our community guidelines.${untilDate ? `\n\nYou'll be able to sign back in on ${untilDate}.` : ''}`}
      </Text>
      <TouchableOpacity
        style={[styles.signOutBtn, { backgroundColor: colors.primary }]}
        onPress={async () => {
          try {
            await signOut();
          } catch (e) {
            console.warn('Sign out from blocked screen failed:', e);
          }
        }}
        activeOpacity={0.85}
      >
        <Icon name="logout" size={18} color={colors.white} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  desc: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: radius.full,
    ...shadows.fab,
  },
  signOutText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});

export default AccountBlockedScreen;
