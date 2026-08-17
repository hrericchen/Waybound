import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';

const { height } = Dimensions.get('window');

const SplashScreen: React.FC = () => {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = React.useContext(ThemeContext);

  // Looping, muted background video (assets/video.mp4).
  const player = useVideoPlayer(require('../../assets/video.mp4'), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.bg}>
        {/* Static fallback image, visible while the video loads */}
        <ImageBackground
          source={require('../../assets/backdrop.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        {/* Background video layer */}
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
        <LinearGradient
          colors={['rgba(8,15,30,0.1)', 'rgba(8,15,30,0.3)', 'rgba(8,15,30,0.88)']}
          style={styles.gradient}
        >
          <View style={[styles.top, { paddingTop: insets.top + 16 }]}>
            <View style={styles.brandRow}>
              <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
              <Text style={styles.brand}>Waybound</Text>
            </View>
            <View style={styles.locationPill}>
              <Icon name="location" size={14} color={colors.white} />
              <Text style={styles.locationText}>Broken Beach, Nusa Penida</Text>
            </View>
          </View>

          <View style={[styles.bottomCard, { marginBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.kicker}>DISCOVER THE WORLD</Text>
            <Text style={styles.headline}>
              Plan smarter,{'\n'}travel{' '}
              <Text style={styles.headlineAccent}>better</Text>.
            </Text>
            <Text style={styles.subcopy}>
              Intelligent trip planning that helps you explore more with less stress
            </Text>
            <TouchableOpacity
              style={styles.button}
              activeOpacity={0.9}
              onPress={() => (nav as any).navigate('SignIn')}
            >
              <LinearGradient
                colors={[colors.primary, '#7985FF']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Text style={styles.buttonText}>Get Started</Text>
              <Icon name="chevronRight" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  bg: {
    flex: 1,
    width: '100%',
    height,
  },
  gradient: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  top: {
    gap: spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImage: {
    width: 46,
    height: 46,
    borderRadius: 12,
  },
  brand: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  locationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.13)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  locationText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  bottomCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    ...shadows.deep,
  },
  kicker: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  headlineAccent: {
    color: colors.accent,
  },
  subcopy: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    marginTop: spacing.xxl,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
    ...shadows.fab,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SplashScreen;
