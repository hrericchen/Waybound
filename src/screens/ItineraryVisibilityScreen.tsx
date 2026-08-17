import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import { AuthContext } from '../context/AuthContext';
import tripService from '../services/tripService';
import { communityService } from '../services/communityService';

const ItineraryVisibilityScreen: React.FC = () => {
  const route = useRoute();
  const id = (route.params as any)?.id;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useContext(ThemeContext);
  const { user } = useContext(AuthContext);
  const [trip, setTrip] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await tripService.getTripById(id);
        setTrip(t);
      } catch (e) {
        console.warn('Failed to load trip for visibility:', e);
      }
    })();
  }, [id]);

  const goToLibrary = () => (navigation as any).navigate('Main', { screen: 'Library' });

  const choose = async (vis: 'private' | 'public') => {
    if (saving) return;
    setSaving(true);
    try {
      if (vis === 'public') {
        // Make sure the trip (and its stable id) is loaded before publishing so
        // re-publishing updates the existing post instead of creating a duplicate.
        let t = trip;
        if (!t) {
          try { t = await tripService.getTripById(id); } catch (_) {}
        }
        await communityService.publishItinerary({
          ...(t || {}),
          authorName: user?.name || 'Anonymous',
          authorId: user?.id,
          authorAvatar: (user as any)?.avatarUrl,
        });
      }
      await tripService.updateItinerary(id, { visibility: vis });
      goToLibrary();
    } catch (e) {
      console.warn('Failed to set visibility:', e);
      Alert.alert('Error', 'Could not update visibility. Please try again.');
      setSaving(false);
    }
  };

  const options = [
    { key: 'private' as const, icon: 'lock', color: '#F59E0B', title: 'Private', sub: 'Only you can see and edit this trip.' },
    { key: 'public' as const, icon: 'share', color: '#22C55E', title: 'Public', sub: 'Publish it to the community for others to explore.' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Icon name="chevronLeft" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Who can see this trip?</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          Choose who can view and edit your itinerary.
        </Text>

        {options.map((o) => (
          <TouchableOpacity
            key={o.key}
            style={[styles.option, { backgroundColor: theme.colors.card }]}
            activeOpacity={0.85}
            onPress={() => choose(o.key)}
          >
            <View style={[styles.optionIcon, { backgroundColor: o.color + '20' }]}>
              <Icon name={o.icon} size={22} color={o.color} />
            </View>
            <View style={styles.optionBody}>
              <View style={styles.optionTitleRow}>
                <Text style={[styles.optionTitle, { color: theme.colors.text }]}>{o.title}</Text>
              </View>
              <Text style={[styles.optionSub, { color: theme.colors.muted }]}>{o.sub}</Text>
            </View>
            <Icon name="chevronRight" size={20} color={theme.colors.muted} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.skipBtn} activeOpacity={0.8} onPress={() => navigation.goBack()}>
          <Text style={[styles.skipText, { color: theme.colors.muted }]}>Decide later</Text>
        </TouchableOpacity>
      </ScrollView>

      {saving ? (
        <View style={styles.savingOverlay}>
          <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.savingCard}>
            <Text style={styles.savingText}>Saving...</Text>
          </LinearGradient>
        </View>
      ) : null}
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.soft,
  },
  optionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  optionBody: { flex: 1 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionTitle: { fontSize: 17, fontWeight: '800' },
  optionSub: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.lg },
  skipText: { fontSize: 15, fontWeight: '600' },
  savingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,15,30,0.35)' },
  savingCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 16, borderRadius: radius.full, ...shadows.fab },
  savingText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});

export default ItineraryVisibilityScreen;

