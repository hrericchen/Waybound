import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { communityService } from '../services/communityService';
import { Icon } from '../components/Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';

export const UserProfileScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userId } = route.params || {};
  const [profile, setProfile] = React.useState<any>(null);
  const [itineraries, setItineraries] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    Promise.all([
      communityService.getUsers().then((users: any[]) => {
        const p = users.find((u: any) => u.id === userId);
        setProfile(p);
      }),
      communityService.getItinerariesByAuthor(userId).then(setItineraries),
    ]).finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Icon name="back" size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.name || 'U').charAt(0).toUpperCase()}
          </Text>
        </LinearGradient>
        <Text style={[styles.name, { color: colors.text }]}>{profile?.name || 'Unknown'}</Text>
        <Text style={[styles.email, { color: colors.muted }]}>{profile?.email || ''}</Text>
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
          <View style={[styles.itinCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.itinCover}>
              <Icon name="itinerary" size={24} color={colors.primary} />
            </LinearGradient>
            <View style={{ padding: spacing.sm }}>
              <Text style={[styles.itinTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.itinMeta, { color: colors.muted }]} numberOfLines={1}>
                {(item.destinations || []).slice(0, 2).join(', ')}
              </Text>
            </View>
          </View>
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
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xl,
    ...shadows.soft,
  },
  header: { alignItems: 'center', padding: spacing.xxl, paddingTop: spacing.lg },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.fab,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: colors.white },
  name: { fontSize: 24, fontWeight: '800' },
  email: { fontSize: 14, marginTop: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  itinCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  itinCover: { width: '100%', height: 84, alignItems: 'center', justifyContent: 'center' },
  itinTitle: { fontSize: 13, fontWeight: '700' },
  itinMeta: { fontSize: 11, marginTop: 2 },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 40,
  },
});

export default UserProfileScreen;
