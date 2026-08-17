import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';
import storageService from '../services/storageService';

const { width, height } = Dimensions.get('window');

const TUTORIAL_KEY = 'WB_TUTORIAL_COMPLETED';

const steps = [
  {
    icon: 'compass',
    title: 'Welcome to Waybound!',
    description: 'Your all-in-one travel planning companion. Plan smarter, travel better.\n\nThis quick guide will show you around.',
  },
  {
    icon: 'itinerary',
    title: 'Creating Itineraries',
    description: 'Tap the + button on the bottom tab to create your first itinerary.\n\nAdd a title, destinations, and build out your day-by-day plan with activities, notes, links, and photos.',
    highlight: 'tab-create',
  },
  {
    icon: 'bookmark',
    title: 'Your Library',
    description: 'All your saved itineraries live in the Library tab.\n\n• Long-press an itinerary to set it as Active\n• Active itineraries appear on your Home screen\n• Tap to view details or edit',
    highlight: 'tab-library',
  },
  {
    icon: 'camera',
    title: 'Trip Recaps',
    description: 'Tap the camera button on any activity to add photos from your library or right from the camera.\n\nAccess Trip Recaps from your Profile → Trip Recaps.',
    highlight: 'profile-trip-recaps',
  },
  {
    icon: 'globe',
    title: 'Community',
    description: 'Explore itineraries shared by other travelers in the Community tab.\n\n• Like and save itineraries you love\n• Publish your own to get feedback\n• Follow other travelers',
    highlight: 'tab-community',
  },
  {
    icon: 'star',
    title: 'Pro Tips',
    description: '• Export your trips as PDF, ICS, CSV, or PNG cards\n• Get access to 170+ currencies in Exchange Rates\n• Add collaborators to plan together\n\nUpgrade anytime in Profile for full access.',
    highlight: 'upgrade',
  },
];

export function hasCompletedTutorial(userId?: string): Promise<boolean> {
  const key = userId ? `WB_TUTORIAL_DONE_${userId}` : TUTORIAL_KEY;
  return storageService.load(key).then(v => !!v);
}

export async function markTutorialCompleted(userId?: string) {
  const key = userId ? `WB_TUTORIAL_DONE_${userId}` : TUTORIAL_KEY;
  await storageService.save(key, true);
}

interface Props {
  visible: boolean;
  onClose: () => void;
  userId?: string;
}

const TutorialOverlay: React.FC<Props> = ({ visible, onClose, userId }) => {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const handleNext = async () => {
    if (isLast) {
      await markTutorialCompleted(userId);
      onClose();
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = async () => {
    await markTutorialCompleted(userId);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>

          {/* Progress Dots */}
          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step && styles.dotActive,
                  i < step && styles.dotCompleted,
                ]}
              />
            ))}
          </View>

          {/* Icon */}
          <LinearGradient
            colors={[colors.primary, '#7985FF']}
            style={styles.iconCircle}
          >
            <Icon name={current.icon as any || 'compass'} size={36} color={colors.white} />
          </LinearGradient>

          {/* Title */}
          <Text style={styles.title}>{current.title}</Text>

          {/* Description */}
          <ScrollView style={styles.descScroll} contentContainerStyle={{ alignItems: 'center' }}>
            <Text style={styles.description}>{current.description}</Text>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.9}>
              <LinearGradient
                colors={[colors.primary, '#7985FF']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Text style={styles.nextText}>{isLast ? 'Get Started' : 'Next'}</Text>
              <Icon name="chevronRight" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>

          {/* Step Counter */}
          <Text style={styles.counter}>
            {step + 1} of {steps.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8,15,30,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    alignItems: 'center',
    ...shadows.deep,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.fab,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  dotCompleted: {
    backgroundColor: colors.primary,
    opacity: 0.5,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.fab,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  descScroll: {
    maxHeight: height * 0.25,
    marginBottom: spacing.xl,
  },
  description: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 15,
  },
  nextBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: radius.full,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    ...shadows.fab,
  },
  nextText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  counter: {
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
});

export default TutorialOverlay;