import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tripService from '../services/tripService';
import tripsData from '../data/trips.json';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';

const DemoScreen: React.FC = () => {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();

  const runDemo = async () => {
    const sample = tripsData[0];
    const itinerary = {
      id: `demo-${Date.now()}`,
      title: `Demo - ${sample.title}`,
      destinations: [sample.country],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
      color: colors.primary,
      coverImage: sample.image,
      activities: [
        {
          id: 'a1',
          day: 1,
          title: `Arrive ${sample.country}`,
          lat: sample.coords?.lat,
          lng: sample.coords?.lng,
        },
        {
          id: 'a2',
          day: 2,
          title: sample.days?.[0]?.title || 'Explore',
          notes: '',
        },
      ],
    };
    await tripService.saveTrip(itinerary);
    nav.navigate('Main' as any, { screen: 'Library' });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="dark-content" />
      <TouchableOpacity style={styles.backBtn} onPress={() => nav.goBack()}>
        <Icon name="back" size={22} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.card}>
        <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.iconWrap}>
          <Icon name="demo" size={28} color={colors.primary} />
        </LinearGradient>
        <Text style={styles.kicker}>TEST DRIVE</Text>
        <Text style={styles.title}>End-to-end Demo</Text>
        <Text style={styles.copy}>
          This demo will create a sample itinerary, save it, and open your library — so you can see exactly how the app works.
        </Text>
        <TouchableOpacity style={styles.button} onPress={runDemo} activeOpacity={0.9}>
          <LinearGradient
            colors={[colors.primary, '#7985FF']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Icon name="demo" size={18} color={colors.white} />
          <Text style={styles.buttonText}>Run Demo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  card: {
    marginTop: spacing.huge,
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    ...shadows.deep,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  kicker: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  copy: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    ...shadows.fab,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});

export default DemoScreen;
