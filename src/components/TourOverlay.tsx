import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, spacing, shadows } from '../theme/theme';
import { Icon } from './Icon';
import { useTour, TourStep, Rect } from '../context/TourContext';

const { width: W, height: H } = Dimensions.get('window');

const GAP = 16; // gap between highlighted element and the tooltip
const SIDE = 16; // min horizontal margin of the tooltip
const TIP_W = Math.min(W - SIDE * 2, 340);
const EST_TIP_H = 190; // tooltip height estimate before onLayout measures it
const TIP_EDGE = 26; // how far the triangle can sit from the tooltip's edge
const SPOT_RADIUS = 16; // corner radius of the spotlight cutout

/**
 * Build an SVG even-odd path: a full-screen rect with a rounded-rect "hole"
 * over the highlighted element, so the dim follows curved/capsule shapes
 * instead of leaving sharp rectangular corners behind them.
 */
function spotlightMask(r: { x: number; y: number; w: number; h: number }): string {
  const rad = Math.max(4, Math.min(SPOT_RADIUS, r.w / 2, r.h / 2));
  const { x, y, w, h } = r;
  return [
    `M0 0 H${W} V${H} H0 Z`,
    `M${x + rad} ${y}`,
    `H${x + w - rad}`,
    `A${rad} ${rad} 0 0 1 ${x + w} ${y + rad}`,
    `V${y + h - rad}`,
    `A${rad} ${rad} 0 0 1 ${x + w - rad} ${y + h}`,
    `H${x + rad}`,
    `A${rad} ${rad} 0 0 1 ${x} ${y + h - rad}`,
    `V${y + rad}`,
    `A${rad} ${rad} 0 0 1 ${x + rad} ${y}`,
    'Z',
  ].join(' ');
}

/**
 * The spotlight layer: extra darkness with a rounded "hole" around the target.
 * During a crossfade the hole glides from the previous target to the new one.
 * Owns the per-frame hole interpolation locally so the rest of the overlay
 * (tooltips, dim) never re-renders on every animation frame.
 */
const SpotlightDim = React.memo(function SpotlightDim({
  fromRect,
  toRect,
  crossAnim,
  opacity,
}: {
  fromRect: Rect | null;
  toRect: Rect | null;
  crossAnim: Animated.Value;
  opacity: number | Animated.AnimatedInterpolation<number>;
}) {
  const [holeRect, setHoleRect] = useState<Rect | null>(toRect);
  const fromRef = useRef(fromRect);
  const toRef = useRef(toRect);
  fromRef.current = fromRect;
  toRef.current = toRect;

  // When the target set changes, snap the hole to the relevant rect.
  useEffect(() => {
    setHoleRect(toRect || fromRect || null);
  }, [fromRect, toRect]);

  // Glide the hole while crossAnim runs 0→1.
  useEffect(() => {
    const id = crossAnim.addListener(({ value }) => {
      const from = fromRef.current;
      const to = toRef.current;
      if (from && to) {
        setHoleRect({
          x: from.x + (to.x - from.x) * value,
          y: from.y + (to.y - from.y) * value,
          w: from.w + (to.w - from.w) * value,
          h: from.h + (to.h - from.h) * value,
        });
      } else if (to) {
        setHoleRect(to);
      } else if (from) {
        setHoleRect(from);
      }
    });
    return () => crossAnim.removeListener(id);
  }, [crossAnim]);

  if (!holeRect) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d={spotlightMask(holeRect)} fill="rgba(8,15,30,0.55)" fillRule="evenodd" />
      </Svg>

      {/* Single clean highlight border around the element */}
      <View
        pointerEvents="none"
        style={[
          styles.highlight,
          {
            left: holeRect.x - 2,
            top: holeRect.y - 2,
            width: holeRect.w + 4,
            height: holeRect.h + 4,
          },
        ]}
      />
    </Animated.View>
  );
});

export const TourOverlay: React.FC = () => {
  const { active, step, stepIndex, totalSteps, rect, ready, switching, nextStep, finishTour } =
    useTour();
  const [tipSize, setTipSize] = useState<{ w: number; h: number } | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);

  type Content = {
    step: TourStep;
    stepIndex: number;
    rect: Rect | null;
    isLast: boolean;
  };

  // Currently displayed step, plus the one it's crossfading away from. The old
  // content stays on screen while the next step measures its target, so the dim
  // never flickers and there's no gray gap between cards.
  const [current, setCurrent] = useState<Content | null>(null);
  const [previous, setPrevious] = useState<Content | null>(null);

  // crossAnim: 0 = previous shown, 1 = current shown. Drives the tooltip
  // crossfade and slides the spotlight hole between targets.
  const crossAnim = useRef(new Animated.Value(1)).current;
  // fadeAnim: whole-overlay fade during tab switches (never changes on Next).
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Spotlight hole, smoothly interpolated between the old and new targets.
  const [holeRect, setHoleRect] = useState<Rect | null>(null);
  const prevRectRef = useRef<Rect | null>(null);
  const currRectRef = useRef<Rect | null>(null);
  const prevReadyRef = useRef<boolean | null>(null);

  // Reset everything when the tour ends.
  useEffect(() => {
    if (active) return;
    setCurrent(null);
    setPrevious(null);
    setHoleRect(null);
    setTipSize(null);
    setConfirmSkip(false);
    prevReadyRef.current = null;
    crossAnim.setValue(1);
    fadeAnim.setValue(1);
  }, [active, crossAnim, fadeAnim]);

  // Smoothly fade the overlay in when the tour starts (no instant pop).
  const prevActiveRef = useRef(false);
  useEffect(() => {
    if (active && !prevActiveRef.current) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    prevActiveRef.current = active;
  }, [active, fadeAnim]);

  useEffect(() => {
    if (previous) prevRectRef.current = previous.rect;
  }, [previous]);
  useEffect(() => {
    if (current) currRectRef.current = current.rect;
  }, [current]);

  // If the current target is re-measured in place, keep the hole on it.
  useEffect(() => {
    if (!active || !rect || !current) return;
    if (current.step.id === step?.id) {
      currRectRef.current = rect;
      setHoleRect(rect);
    }
  }, [active, rect, step, current]);

  // Slide the spotlight hole from the previous target to the new one.
  useEffect(() => {
    if (!active) return;
    const id = crossAnim.addListener(({ value }) => {
      const from = prevRectRef.current;
      const to = currRectRef.current;
      if (from && to) {
        setHoleRect({
          x: from.x + (to.x - from.x) * value,
          y: from.y + (to.y - from.y) * value,
          w: from.w + (to.w - from.w) * value,
          h: from.h + (to.h - from.h) * value,
        });
      } else if (to) {
        setHoleRect(to);
      } else if (from) {
        setHoleRect(from);
      } else {
        setHoleRect(null);
      }
    });
    return () => crossAnim.removeListener(id);
  }, [active, crossAnim]);

  // Crossfade to the next step. Only accept a step once its target is ready
  // (false→true), so a stale frame with the old rect is never shown.
  useEffect(() => {
    const wasReady = prevReadyRef.current;
    prevReadyRef.current = ready;
    if (!active || !step || !ready || wasReady) return;
    const nextContent: Content = {
      step,
      stepIndex,
      rect,
      isLast: stepIndex === totalSteps - 1,
    };
    if (!current || current.step.id === step.id) {
      setCurrent(nextContent);
      setPrevious(null);
      crossAnim.setValue(1);
      return;
    }
    // The step we're arriving at switched tabs, so the overlay was already
    // faded out for the tab change — swap instantly instead of replaying the
    // hidden crossfade of old content on the new tab.
    if (step.tab) {
      setCurrent(nextContent);
      setPrevious(null);
      crossAnim.setValue(1);
      return;
    }
    setPrevious(current);
    setCurrent(nextContent);
    crossAnim.setValue(0);
    Animated.timing(crossAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // JS driver so the hole listener fires reliably
    }).start(() => setPrevious(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready, step, stepIndex, current, crossAnim]);

  // Tab changes: fade the overlay out first, then back in once the new tab's
  // target is located. Masks the abrupt swap of the underlying screen.
  useEffect(() => {
    if (!active) return;
    if (switching) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 170,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else if (ready) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [active, switching, ready, fadeAnim]);

  if (!active) return null;

  // Waiting for the very first step to be measured — block input with a dim.
  if (!current) {
    return <Animated.View style={[styles.rootDim, { opacity: fadeAnim }]} />;
  }

  const tipH = tipSize?.h || EST_TIP_H;
  // Tooltip geometry for a given step content.
  const layoutFor = (c: Content) => {
    const isCenter = !c.rect;
    const placeBelow =
      !isCenter && !!c.rect && c.rect.y + c.rect.h + GAP + tipH < H - 24;
    let tipX = SIDE;
    let arrowX = TIP_EDGE;
    if (isCenter) {
      // Welcome / completion steps have no target — center the card on screen.
      tipX = Math.max(SIDE, (W - TIP_W) / 2);
      arrowX = TIP_W / 2;
    } else if (c.rect) {
      const cx = c.rect.x + c.rect.w / 2;
      tipX = Math.min(Math.max(cx - TIP_W / 2, SIDE), Math.max(SIDE, W - TIP_W - SIDE));
      arrowX = Math.min(Math.max(cx - tipX, TIP_EDGE), TIP_W - TIP_EDGE);
    }
    let tipTop = isCenter
      ? H / 2 - tipH / 2
      : placeBelow && c.rect
      ? c.rect.y + c.rect.h + GAP
      : (c.rect ? c.rect.y : H / 2) - GAP - tipH;
    // Never let the tooltip run off-screen.
    tipTop = Math.max(8, Math.min(tipTop, H - tipH - 8));
    return { isCenter, placeBelow, tipX, arrowX, tipTop };
  };

  const curLayout = layoutFor(current);
  const prevLayout = previous ? layoutFor(previous) : null;

  // Spotlight: when moving between two targets keep it at full opacity and
  // slide the hole; when entering/leaving a centered step, fade it in/out.
  const bothTargeted = !!current.rect && !!previous?.rect;
  const spotlightOpacity = bothTargeted
    ? 1
    : crossAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: current.rect ? [0, 0, 1] : [1, 0, 0],
      });
  const spotlightRect = (bothTargeted ? holeRect : current.rect || previous?.rect) || null;

  const renderTooltipBody = (
    c: Content,
    layout: { isCenter: boolean; placeBelow: boolean; arrowX: number },
    interactive: boolean
  ) => (
    <>
      {!layout.isCenter && (
        <View
          style={[
            styles.triangle,
            layout.placeBelow ? styles.triangleBelow : styles.triangleAbove,
            { left: layout.arrowX - 7 },
          ]}
        />
      )}
      <View style={styles.tipHeader}>
        <View style={styles.tipTitleWrap}>
          <View style={styles.tipIconWrap}>
            <Icon name={c.isLast ? 'star' : 'compass'} size={14} color={colors.primary} />
          </View>
          <Text style={styles.tipTitle}>{c.step.title}</Text>
        </View>
        <Text style={styles.counter}>
          {c.stepIndex + 1}/{totalSteps}
        </Text>
      </View>
      <Text style={styles.tipDesc}>{c.step.description}</Text>
      <View style={styles.tipFooter}>
        <TouchableOpacity
          onPress={interactive ? () => setConfirmSkip(true) : undefined}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
          disabled={!interactive}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
        <View style={styles.dots}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View key={i} style={[styles.dot, i === c.stepIndex && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={interactive ? nextStep : undefined}
          activeOpacity={0.85}
          disabled={!interactive}
        >
          <Text style={styles.nextText}>{c.isLast ? 'Got it' : 'Next'}</Text>
          <Icon name="chevronRight" size={15} color={colors.white} />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]} pointerEvents="auto">
      {/* ---- Base dim: constant gray that never flickers between steps ---- */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.baseDim, { opacity: fadeAnim }]}
      />

      {/* ---- Spotlight: extra darkness with a smoothly-moving hole ---- */}
      {!!spotlightRect && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: spotlightOpacity }]}
        >
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path d={spotlightMask(spotlightRect)} fill="rgba(8,15,30,0.55)" fillRule="evenodd" />
          </Svg>

          {/* Single clean highlight border around the element */}
          <View
            pointerEvents="none"
            style={[
              styles.highlight,
              {
                left: spotlightRect.x - 2,
                top: spotlightRect.y - 2,
                width: spotlightRect.w + 4,
                height: spotlightRect.h + 4,
              },
            ]}
          />
        </Animated.View>
      )}

      {/* ---- Outgoing tooltip (crossfading out) ---- */}
      {previous && prevLayout && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tip,
            {
              left: prevLayout.tipX,
              top: prevLayout.tipTop,
              width: TIP_W,
              opacity: crossAnim.interpolate({
                inputRange: [0, 0.55, 1],
                outputRange: [1, 0, 0],
              }),
              transform: [
                {
                  translateY: crossAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -10],
                  }),
                },
              ],
            },
          ]}
        >
          {renderTooltipBody(previous, prevLayout, false)}
        </Animated.View>
      )}

      {/* ---- Incoming tooltip ---- */}
      <Animated.View
        onLayout={(e) =>
          setTipSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
        style={[
          styles.tip,
          {
            left: curLayout.tipX,
            top: curLayout.tipTop,
            width: TIP_W,
            opacity: crossAnim,
            transform: [
              {
                translateY: crossAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
              },
            ],
          },
        ]}
      >
        {renderTooltipBody(current, curLayout, ready)}
      </Animated.View>

      {/* ---- Skip confirmation ---- */}
      {confirmSkip && (
        <View style={styles.confirmWrap}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Icon name="compass" size={24} color={colors.primary} />
            </View>
            <Text style={styles.confirmTitle}>Skip tutorial?</Text>
            <Text style={styles.confirmDesc}>Are you sure you want to skip the tutorial?</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setConfirmSkip(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelText}>Keep Learning</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmYes}
                onPress={() => finishTour(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmYesText}>Yes, Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

export default TourOverlay;
const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  rootDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,15,30,0.72)',
    zIndex: 9999,
    elevation: 9999,
  },
  baseDim: {
    backgroundColor: 'rgba(8,15,30,0.6)',
  },
  highlight: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: radius.lg,
  },
  tip: {
    position: 'absolute',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.deep,
  },
  triangle: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: colors.card,
    transform: [{ rotate: '45deg' }],
  },
  triangleBelow: {
    top: -7,
  },
  triangleAbove: {
    bottom: -7,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tipTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  tipIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  counter: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  tipDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  tipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.full,
    ...shadows.fab,
  },
  nextText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  confirmWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,15,30,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    alignItems: 'center',
    ...shadows.deep,
  },
  confirmIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  confirmDesc: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.full,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  confirmYes: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.full,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  confirmYesText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
});


