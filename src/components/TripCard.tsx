import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trip } from '../types';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, shadows, spacing } from '../theme/theme';
import { Icon } from './Icon';

type Props = {
  trip: Trip;
  variant?: 'featured' | 'compact' | 'wide';
};

const TripCard: React.FC<Props> = ({ trip, variant = 'featured' }) => {
  const nav = useNavigation();
  const isWide = variant === 'wide';
  const isCompact = variant === 'compact';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.card, isWide && styles.wideCard, isCompact && styles.compactCard]}
      onPress={() => nav.navigate('TripDetail' as any, { id: trip.id })}
    >
      <Image source={{ uri: trip.image }} style={[styles.image, isWide && styles.wideImage, isCompact && styles.compactImage]} />
      {!isCompact && (
        <LinearGradient colors={['transparent', 'rgba(8,15,30,0.6)']} style={styles.imageOverlay} />
      )}
      <View style={[styles.body, isWide && styles.wideBody, isCompact && styles.compactBody]}>
        <Text style={[styles.title, (isWide || isCompact) && styles.titleSmall]} numberOfLines={2}>
          {trip.title}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Icon name="location" size={12} color={isWide || isCompact ? colors.primary : colors.white} />
            <Text style={[styles.meta, (isWide || isCompact) && styles.metaDark]}>{trip.country}</Text>
          </View>
          {!isCompact && (
            <>
              <View style={[styles.dot, (isWide || isCompact) && { backgroundColor: isWide ? colors.border : 'rgba(255,255,255,0.4)' }]} />
              <Text style={[styles.meta, (isWide || isCompact) && styles.metaDark]}>{trip.season}</Text>
            </>
          )}
        </View>
        {!isCompact && (
          <View style={styles.footer}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>${trip.budget}</Text>
            </View>
            <View style={[styles.chip, styles.chipSoft]}>
              <Text style={styles.chipSoftText}>{trip.days?.length || 0} days</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 240,
    marginRight: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.card,
    ...shadows.card,
  },
  wideCard: {
    width: '100%',
    marginRight: 0,
    marginBottom: spacing.md,
  },
  compactCard: {
    width: 160,
  },
  image: {
    width: '100%',
    height: 160,
  },
  wideImage: {
    height: 170,
  },
  compactImage: {
    height: 100,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  body: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
  },
  wideBody: {
    position: 'relative',
    padding: spacing.lg,
  },
  compactBody: {
    position: 'relative',
    padding: spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  titleSmall: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  metaDark: {
    color: colors.muted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  chipText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  chipSoft: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipSoftText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default TripCard;
