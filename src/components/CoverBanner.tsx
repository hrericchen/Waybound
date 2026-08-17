import React from 'react';
import { View, Text, Image, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/theme';

type Props = {
  scrollY: Animated.Value;
  /** Full banner height (below the status bar). */
  expandedHeight: number;
  /** Slim bar height it collapses into while scrolling. */
  collapsedHeight: number;
  /** Cover image to display (user-chosen or city fallback). */
  coverUri?: string | null;
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Buttons rendered top-right in both the banner and the collapsed bar. */
  actions?: React.ReactNode;
};

/** How far the concave bottom arch cuts up into the banner (px). */
const ARCH_DEPTH = 18;

/**
 * Collapsible cover banner shared by the Travel Guide editor and the Create
 * Itinerary screen. At the top of the scroll it shows the full banner (cover
 * image over a purple gradient) with a curved concave-down bottom edge.
 * Scrolling down collapses it into a slim always-visible bar with the title.
 */
const CoverBanner: React.FC<Props> = ({
  scrollY,
  expandedHeight,
  collapsedHeight,
  coverUri,
  kicker,
  title,
  subtitle,
  actions,
}) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const totalExpanded = expandedHeight + insets.top;
  const totalCollapsed = collapsedHeight + insets.top;
  const collapseDist = totalExpanded - totalCollapsed;

  const height = scrollY.interpolate({
    inputRange: [0, collapseDist],
    outputRange: [totalExpanded, totalCollapsed],
    extrapolate: 'clamp',
  });
  // The concave arch slides down out of view as the banner collapses.
  const archSlide = scrollY.interpolate({
    inputRange: [0, collapseDist],
    outputRange: [0, ARCH_DEPTH],
    extrapolate: 'clamp',
  });
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, collapseDist * 0.45, collapseDist],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });
  const barOpacity = scrollY.interpolate({
    inputRange: [0, collapseDist * 0.65, collapseDist],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });
  const shift = scrollY.interpolate({
    inputRange: [0, collapseDist],
    outputRange: [0, -10],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.wrap, { height }]}>
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}
      <LinearGradient
        colors={
          coverUri
            ? ['rgba(15,23,42,0.30)', 'rgba(91,103,245,0.62)']
            : ['#5B67F5', '#7985FF']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Concave-down (arch) bottom edge */}
      <Animated.View
        pointerEvents="none"
        style={[styles.archWrap, { width, transform: [{ translateY: archSlide }] }]}
      >
        <Svg width={width} height={ARCH_DEPTH}>
          <Path
            d={`M0,${ARCH_DEPTH} Q ${width / 2},-${ARCH_DEPTH} ${width},${ARCH_DEPTH} L ${width},${ARCH_DEPTH} L 0,${ARCH_DEPTH} Z`}
            fill={colors.background}
          />
        </Svg>
      </Animated.View>

      {/* Full banner title block (fades out on collapse) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, opacity: titleOpacity, transform: [{ translateY: shift }] },
        ]}
      >
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>

      {/* Always-visible action buttons */}
      {actions ? <View style={[styles.actions, { top: insets.top + 8 }]}>{actions}</View> : null}

      {/* Compact bar title (fades in on collapse) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.bar, { paddingTop: insets.top + 6, opacity: barOpacity }]}
      >
        <Text style={styles.barTitle} numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: 'hidden',
  },
  archWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingRight: 130,
  },
  kicker: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  actions: {
    position: 'absolute',
    right: spacing.xl,
    flexDirection: 'row',
    gap: 10,
  },
  bar: {
    paddingHorizontal: spacing.xl,
    paddingRight: 130,
  },
  barTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});

export default CoverBanner;

