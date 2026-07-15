import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { communityService } from '../services/communityService';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';

export const CommunityScreen = () => {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  React.useEffect(() => {
    communityService.getUsers().then(setUsers).catch(console.warn);
    setLoading(false);
  }, []);

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

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120 }}
          ListHeaderComponent={
            <Text style={styles.memberCount}>
              {users.length} {users.length === 1 ? 'member' : 'members'}
            </Text>
          }
          renderItem={({ item }: any) => (
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
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.emptyIcon}>
                <Icon name="globe" size={28} color={colors.primary} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>No community members yet</Text>
              <Text style={styles.emptyText}>
                Members will appear here as they join
              </Text>
            </View>
          }
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
    paddingBottom: spacing.lg,
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
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  memberCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: spacing.md,
  },
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
  userInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  email: { fontSize: 13, marginTop: 2 },
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
});

export default CommunityScreen;
