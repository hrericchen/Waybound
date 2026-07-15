import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import tripService from '../services/tripService';
import { Icon } from '../components/Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';

const { width } = Dimensions.get('window');

const TripDetailScreen: React.FC<any> = ({ route, navigation }) => {
  const { id } = route.params || {};
  const [trip, setTrip] = useState<any>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    tripService.getTripById(id).then((t: any) => setTrip(t));
  }, [id]);

  if (!trip) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading trip...</Text>
      </View>
    );
  }

  const dayCount = trip.days?.length || 0;
  const spotCount = trip.highlights?.length || trip.days?.length || 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: trip.image }} style={styles.hero} />
          <LinearGradient
            colors={['rgba(8,15,30,0.45)', 'transparent', 'rgba(8,15,30,0.75)']}
            style={styles.heroGradient}
          />
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => navigation.goBack()}
          >
            <View style={styles.backBtnInner}>
              <Icon name="back" size={22} color={colors.white} />
            </View>
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <View style={styles.heroTag}>
              <Icon name="location" size={12} color={colors.white} />
              <Text style={styles.heroTagText}>{trip.country}</Text>
            </View>
            <Text style={styles.heroTitle}>{trip.title}</Text>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.chipsRow}>
            <LinearGradient colors={['#FFE0E0', '#FFF0F0']} style={styles.chip}>
              <Icon name="calendar" size={14} color="#EF4444" />
              <Text style={[styles.chipText, { color: '#B91C1C' }]}>
                {dayCount || 4} Days
              </Text>
            </LinearGradient>
            <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.chip}>
              <Icon name="location" size={14} color={colors.primary} />
              <Text style={[styles.chipText, { color: colors.primary }]}>
                {spotCount} Spots
              </Text>
            </LinearGradient>
            <LinearGradient colors={['#DCFCE7', '#E8FCEF']} style={styles.chip}>
              <Icon name="restaurant" size={14} color="#16A34A" />
              <Text style={[styles.chipText, { color: '#15803D' }]}>
                {trip.highlights?.length || 3} Highlights
              </Text>
            </LinearGradient>
          </View>

          <Text style={styles.sectionLabel}>About</Text>
          <Text style={styles.desc}>{trip.description}</Text>

          <View style={styles.metaCard}>
            <View style={styles.metaItem}>
              <Icon name="calendar" size={16} color={colors.primary} />
              <Text style={styles.metaLabel}>Season</Text>
              <Text style={styles.metaValue}>{trip.season}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Icon name="information" size={16} color={colors.primary} />
              <Text style={styles.metaLabel}>Budget</Text>
              <Text style={styles.metaValue}>${trip.budget}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Highlights</Text>
          <View style={styles.highlights}>
            {(trip.highlights || []).map((h: string, i: number) => (
              <View key={i} style={styles.highlightItem}>
                <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.bullet}>
                  <Icon name="check" size={12} color={colors.white} />
                </LinearGradient>
                <Text style={styles.highlightText}>{h}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Timeline</Text>
          <View style={styles.timeline}>
            {(trip.days || []).length === 0 ? (
              <Text style={styles.emptyTimeline}>Timeline coming soon for this trip.</Text>
            ) : (
              trip.days.map((d: any, i: number) => (
                <View key={i} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <LinearGradient
                      colors={i === 0 ? [colors.primary, '#7985FF'] : [colors.border, colors.border]}
                      style={[styles.timelineDot]}
                    />
                    {i < trip.days.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineCard}>
                    <View style={styles.dayBadgeWrap}>
                      <Text style={styles.dayBadge}>Day {d.day}</Text>
                    </View>
                    <Text style={styles.dayTitle}>{d.title}</Text>
                    {Array.isArray(d.activities) && d.activities.length > 0 && (
                      <Text style={styles.dayActivities}>{d.activities.join(' · ')}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            style={styles.save}
            activeOpacity={0.9}
            onPress={async () => {
              const itinerary = {
                id: `saved-${trip.id}`,
                title: trip.title,
                destinations: [trip.country],
                coverImage: trip.image,
                activities: (trip.days || []).map((d: any) => ({
                  id: `${trip.id}-${d.day}`,
                  day: d.day,
                  title: d.title,
                  notes: '',
                })),
              };
              await tripService.saveTrip(itinerary);
              navigation.navigate('Main' as any, { screen: 'Library' });
            }}
          >
            <LinearGradient
              colors={[colors.primary, '#7985FF']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Icon name="save" size={18} color={colors.white} />
            <Text style={styles.saveText}>Save Inspiration</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '600',
  },
  heroWrap: {
    width,
    height: 340,
  },
  hero: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
  },
  backBtnInner: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: 'rgba(15,23,42,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  
  },
  heroContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
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
    marginBottom: 10,
  },
  heroTagText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 2,
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sheet: {
    marginTop: -24,
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.xl,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  desc: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: spacing.lg,
  },
  metaCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    marginBottom: spacing.xl,
    ...shadows.soft,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  metaValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  metaDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  highlights: {
    gap: 10,
    marginBottom: spacing.xl,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.soft,
  },
  bullet: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  timeline: {
    marginBottom: spacing.xl,
  },
  emptyTimeline: {
    color: colors.muted,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 84,
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 18,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginLeft: 10,
    marginBottom: 12,
    ...shadows.soft,
  },
  dayBadgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginBottom: 6,
  },
  dayBadge: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 11,
  },
  dayTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  dayActivities: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  save: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    ...shadows.fab,
  },
  saveText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});

export default TripDetailScreen;
