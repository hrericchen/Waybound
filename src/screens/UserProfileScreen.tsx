import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Image, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import { communityService } from '../services/communityService';
import { Icon } from '../components/Icon';
import Avatar from '../components/Avatar';
import { colors, radius, shadows, spacing } from '../theme/theme';
import { getTagById } from '../config/tags';
import notificationService from '../services/notificationService';

export const UserProfileScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userId } = (route.params as any) || {};
  const { user } = React.useContext(AuthContext);

  const [profile, setProfile] = React.useState<any>(null);
  const [itineraries, setItineraries] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState({ itineraries: 0, followers: 0, likes: 0 });
  const [isFollowing, setIsFollowing] = React.useState(false);

  React.useEffect(() => {
    if (!userId) return;
    Promise.all([
      communityService.getUsers().then((users: any[]) => {
        const p = users.find((u: any) => u.id === userId);
        setProfile(p);
      }),
      communityService.getItinerariesByAuthor(userId).then(setItineraries),
    ]).finally(() => setLoading(false));

    (async () => {
      const itinCount = (await communityService.getItinerariesByAuthor(userId)).length;
      const followerCount = await communityService.getFollowersCount(userId);
      const userItins = await communityService.getItinerariesByAuthor(userId);
      const likeCount = userItins.reduce((sum: number, i: any) => sum + (i.likes?.length || 0), 0);
      setStats({ itineraries: itinCount, followers: followerCount, likes: likeCount });

      if (user?.id) {
        const followed = await communityService.getFollowedUsers(user.id);
        setIsFollowing(followed.includes(userId));
      }
    })();
  }, [userId, user]);

  const submitReport = async (reason: string) => {
    try {
      const ok = await communityService.reportUser(user?.id || 'unknown', userId, reason);
      if (ok) {
        Alert.alert('Thanks', 'Your report has been submitted. We’ll review it shortly.');
      } else {
        Alert.alert('Error', 'Could not submit the report. Please try again.');
      }
    } catch (e) {
      console.warn('Failed to report user:', e);
      Alert.alert('Error', 'Could not submit the report. Please try again.');
    }
  };

  const handleReport = () => {
    Alert.alert('Report Profile', 'Why are you reporting this user?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Spam / Fake account', onPress: () => submitReport('Spam / Fake account') },
      { text: 'Harassment or bullying', onPress: () => submitReport('Harassment or bullying') },
      { text: 'Offensive content', onPress: () => submitReport('Offensive content') },
      { text: 'Something else', onPress: () => submitReport('Something else') },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // If profile exists but is private and not the current user, show private notice
  if (profile && profile.isPublic === false && user?.id !== userId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Icon name="lock" size={48} color={colors.muted} />
        <Text style={[styles.empty, { marginTop: 16 }]}>This profile is private</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.empty}>User not found</Text>
      </View>
    );
  }

  // A permanently closed account is shown as gone rather than as a normal profile.
  if ((profile as any)?.deleted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Icon name="trash" size={48} color={colors.muted} />
        <Text style={[styles.empty, { marginTop: 16 }]}>Account deleted</Text>
      </View>
    );
  }

  const handleToggleFollow = async () => {
    if (!user?.id) return;
    try {
      if (isFollowing) {
        await communityService.unfollowUser(user.id, userId);
        setIsFollowing(false);
        setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      } else {
        await communityService.followUser(user.id, userId);
        setIsFollowing(true);
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
        // Send follow notification
        try {
          await notificationService.notifyFollow(userId, user.id, user.name || 'A traveler');
        } catch (_) {}
      }
    } catch (e) {
      console.warn('Failed to toggle follow:', e);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="back" size={22} color={colors.text} />
        </TouchableOpacity>
        {/* Report icon — only on other users' profiles, never your own. */}
        {user?.id !== userId && (
          <TouchableOpacity style={styles.reportBtn} onPress={handleReport} activeOpacity={0.85}>
            <Icon name="flag" size={20} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.header}>
        <Avatar uri={(profile as any)?.avatarUrl} name={profile?.name || 'U'} size={88} radius={28} style={styles.avatarImg} />
        <Text style={[styles.name, { color: colors.text }]}>{profile?.name || 'Unknown'}</Text>
        {(() => {
          const userTag = profile?.tag ? getTagById(profile.tag) : getTagById('explorer');
          return (
            <View style={[styles.tagChip, { backgroundColor: userTag!.bgColor, borderColor: userTag!.color }]}>
              <Text style={styles.tagEmoji}>{userTag!.emoji}</Text>
              <Text style={[styles.tagText, { color: userTag!.color }]}>{userTag!.name}</Text>
            </View>
          );
        })()}
        {(profile as any)?.suspendedUntil && (profile as any).suspendedUntil > Date.now() && (
          <View style={[styles.suspendedBanner, { backgroundColor: '#FEF3C7' }]}>
            <Icon name="lock" size={16} color="#D97706" />
            <Text style={[styles.suspendedText, { color: '#92400E' }]}>
              This account is suspended until {(profile as any).suspendedUntil ? new Date((profile as any).suspendedUntil).toLocaleDateString() : ''}
            </Text>
          </View>
        )}
        <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.itineraries}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Itineraries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.followers}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.likes}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Likes</Text>
          </View>
        </View>
        {user?.id !== userId && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && { backgroundColor: colors.success }]}
            onPress={handleToggleFollow}
          >
            <Icon name={isFollowing ? 'check' : 'plus'} size={16} color={colors.white} />
            <Text style={styles.followBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Published Itineraries ({itineraries.length})
      </Text>
      <FlatList
        data={itineraries}
        keyExtractor={(item: any) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120 }}
        renderItem={({ item }: any) => (
          <TouchableOpacity
            style={[styles.itinCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.85}
            onPress={() => (navigation as any).navigate('TripDetail', { id: item.id })}
          >
            {item.coverImage ? (
              <Image source={{ uri: item.coverImage }} style={styles.itinCoverImg} />
            ) : (
              <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.itinCover}>
                <Icon name="itinerary" size={24} color={colors.primary} />
              </LinearGradient>
            )}
            <View style={{ padding: spacing.sm }}>
              <Text style={[styles.itinTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.itinMeta, { color: colors.muted }]} numberOfLines={1}>
                {(item.destinations || []).slice(0, 2).join(', ')}
              </Text>
              {item.likes?.length > 0 && (
                <View style={styles.likeRow}>
                  <Icon name="heart" size={12} color={colors.danger} />
                  <Text style={[styles.likeCount, { color: colors.muted }]}>{item.likes.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No published itineraries yet</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', gap: 10 },
  reportBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.xl, ...shadows.soft,
  },
  header: { alignItems: 'center', padding: spacing.xxl, paddingTop: spacing.lg },
  avatar: {
    width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md, ...shadows.fab,
  },
  avatarImg: {
    width: 88, height: 88, borderRadius: 28, marginBottom: spacing.md,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: colors.white },
  name: { fontSize: 24, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginHorizontal: spacing.xl, marginBottom: spacing.md },
  itinCard: { flex: 1, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.md, ...shadows.soft },
  itinCover: { width: '100%', height: 84, alignItems: 'center', justifyContent: 'center' },
  itinCoverImg: { width: '100%', height: 84 },
  itinTitle: { fontSize: 13, fontWeight: '700' },
  itinMeta: { fontSize: 11, marginTop: 2 },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  likeCount: { fontSize: 11, fontWeight: '600' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  statsRow: { marginTop: spacing.md, marginBottom: spacing.md, borderRadius: radius.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', ...shadows.soft },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { marginTop: 4, fontSize: 11, fontWeight: '600' },
  statDivider: { width: 1, height: 24, backgroundColor: colors.border },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.primary, marginTop: spacing.md },
  followBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
  tagEmoji: { fontSize: 12 },
  tagText: { fontSize: 12, fontWeight: '700' },
  suspendedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    alignSelf: 'stretch',
    marginHorizontal: spacing.xl,
  },
  suspendedText: { fontSize: 13, fontWeight: '700', flex: 1 },
});

export default UserProfileScreen;