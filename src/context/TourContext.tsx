import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { AppState, Animated, Easing } from 'react-native';
import { AuthContext } from './AuthContext';
import { useRevenueCat } from './RevenueCatContext';
import { OFFERING_IDS } from '../services/revenueCatService';
import storageService from '../services/storageService';
import { posthog } from '../config/posthog';
import TourOverlay from '../components/TourOverlay';
import { HOME_TOUR, CREATE_TOUR, PROFILE_TOUR } from '../data/tourSteps';

export type Rect = { x: number; y: number; w: number; h: number };

export type TourStep = {
  id: string;
  /** Id of a registered highlight target. Omit to show a centered card. */
  target?: string;
  /** If set, the tour navigates to this tab before showing the step. */
  tab?: string;
  /** If set, the coordinator scrolls this registered ScrollView so `target` is visible. */
  scrollTarget?: string;
  title: string;
  description: string;
  condition?: (ctx: { isPro: boolean }) => boolean;
};

export type TourName = 'home' | 'create' | 'profile';

type TourContextType = {
  active: boolean;
  tourName: TourName | null;
  step: TourStep | null;
  stepIndex: number;
  totalSteps: number;
  /** Target rect (window coords). Null until measured or for centered steps. */
  rect: Rect | null;
  /** True once the current step's target has been located (or step needs no target). */
  ready: boolean;
  /** True while the tour is switching tabs (used to smooth the overlay transition). */
  switching: boolean;
  registerTarget: (id: string, ref: any) => void;
  setNav: (nav: any) => void;
  startTour: (name: TourName) => void;
  nextStep: () => void;
  finishTour: (completed: boolean) => void;
  hasHomeTourCompleted: (userId?: string) => Promise<boolean>;
  hasCreateTourCompleted: (userId?: string) => Promise<boolean>;
  hasProfileTourCompleted: (userId?: string) => Promise<boolean>;
};

const TourContext = createContext<TourContextType>({} as TourContextType);
export const useTour = () => useContext(TourContext);

const homeKey = (id?: string) => `WB_TOUR_HOME_DONE${id ? '_' + id : ''}`;
const createKey = (id?: string) => `WB_TOUR_CREATE_DONE${id ? '_' + id : ''}`;
const profileKey = (id?: string) => `WB_TOUR_PROFILE_DONE${id ? '_' + id : ''}`;
const INTRO_PENDING_KEY = 'WB_INTRO_PAYWALL_PENDING';
const RANDOM_PAYWALL_KEY = 'WB_RANDOM_PAYWALL_NEXT';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANDOM_SHOWUP_WINDOW = 5 * DAY_MS;
const randomShowupDelay = () =>
  (3 + Math.floor(Math.random() * 3)) * DAY_MS; // 3-5 days → ~1-2x per week

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useContext(AuthContext);
  const { isPro, presentPaywall } = useRevenueCat();

  const [tourName, setTourName] = useState<TourName | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const [switching, setSwitching] = useState(false);

  const targetsRef = useRef<Record<string, any>>({});
  const navRef = useRef<any>(null);
  const activeTourRef = useRef<TourName | null>(null);
  const activeStepIdRef = useRef<string | null>(null);
  // Track the last scroll offset the tour applied so step-to-step scrolling can
  // animate smoothly from where we actually are instead of jumping from the top.
  const lastScrollYRef = useRef(0);
  // Active eased scroll animation so it can be stopped if the step changes mid-scroll.
  const scrollAnimRef = useRef<{ anim: Animated.Value; id: string } | null>(null);
  const homeGateRef = useRef(false);
  const isProRef = useRef(isPro);
  const userIdRef = useRef(user?.id);
  // Admins never get onboarding tours or queued intro paywalls.
  const isAdminRef = useRef(user?.isAdmin === true);

  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    isAdminRef.current = user?.isAdmin === true;
  }, [user?.isAdmin]);

  const measureTarget = useCallback((id: string) => {
    // Resolves once the target rect has been measured (or is known to be
    // missing), so callers can wait for a stable position before showing UI.
    // Retries briefly when the first measurement comes back empty (the element
    // may still be laying out) instead of flashing the centered-card fallback.
    return new Promise<void>((resolve) => {
      const ref = targetsRef.current[id];
      if (!ref || typeof ref.measureInWindow !== 'function') {
        setRect(null);
        resolve();
        return;
      }
      let attempts = 0;
      const doMeasure = () => {
        if (activeStepIdRef.current !== id) {
          resolve();
          return;
        }
        try {
          ref.measureInWindow((x: number, y: number, w: number, h: number) => {
            if (activeStepIdRef.current !== id) {
              resolve();
              return;
            }
            if (x !== null && y !== null && w > 0 && h > 0) {
              setRect({ x, y, w, h });
              resolve();
            } else if (attempts < 3) {
              attempts += 1;
              setTimeout(doMeasure, 30);
            } else {
              setRect(null);
              resolve();
            }
          });
        } catch (e) {
          setRect(null);
          resolve();
        }
      };
      doMeasure();
    });
  }, []);

  const registerTarget = useCallback(
    (id: string, ref: any) => {
      if (ref) {
        targetsRef.current[id] = ref;
        // If the active step is waiting on this exact target, refresh its rect.
        if (activeStepIdRef.current === id) {
          setTimeout(() => measureTarget(id), 30);
        }
      } else {
        delete targetsRef.current[id];
      }
    },
    [measureTarget]
  );

  const setNav = useCallback((nav: any) => {
    navRef.current = nav;
  }, []);

  const hasHomeTourCompleted = useCallback(async (userId?: string) => {
    // Honor the legacy tutorial key too, so users who finished the old tour
    // don't get a brand new one forced on them. Also honor the device-level
    // guest flag so a tour seen before signing in never plays again.
    const keys = userId
      ? [homeKey(userId), homeKey(), `WB_TUTORIAL_DONE_${userId}`, 'WB_TUTORIAL_DONE']
      : [homeKey(), 'WB_TUTORIAL_DONE'];
    for (const k of keys) {
      try {
        if (await storageService.load(k)) return true;
      } catch {}
    }
    return false;
  }, []);

  const hasCreateTourCompleted = useCallback(async (userId?: string) => {
    // Honor the legacy tutorial keys and the device-level guest flag, same as
    // the home tour.
    const keys = userId
      ? [createKey(userId), createKey(), `WB_TUTORIAL_DONE_${userId}`, 'WB_TUTORIAL_DONE']
      : [createKey(), 'WB_TUTORIAL_DONE'];
    for (const k of keys) {
      try {
        if (await storageService.load(k)) return true;
      } catch {}
    }
    return false;
  }, []);

  const hasProfileTourCompleted = useCallback(async (userId?: string) => {
    // Same rules as the other tours: user-level flag plus the device-level
    // guest flag, so a tour seen before signing in never plays again.
    const keys = userId
      ? [profileKey(userId), profileKey(), `WB_TUTORIAL_DONE_${userId}`, 'WB_TUTORIAL_DONE']
      : [profileKey(), 'WB_TUTORIAL_DONE'];
    for (const k of keys) {
      try {
        if (await storageService.load(k)) return true;
      } catch {}
    }
    return false;
  }, []);

  // Measure the scroll view's live offset so the very first tour scroll can
  // glide from wherever the user left the screen instead of snapping to the top.
  // Both measureInWindow calls run in parallel to avoid a double frame wait.
  const measureLiveScrollOffset = useCallback(
    (scrollRef: any, targetRef: any, contentY: number) =>
      new Promise<number>((resolve) => {
        try {
          if (
            typeof scrollRef.measureInWindow !== 'function' ||
            typeof targetRef.measureInWindow !== 'function'
          ) {
            resolve(0);
            return;
          }
          const measure = (r: any) =>
            new Promise<{ x: number; y: number } | null>((res) => {
              try {
                r.measureInWindow((mx: number, my: number) => res({ x: mx, y: my }));
              } catch {
                res(null);
              }
            });
          Promise.all([measure(scrollRef), measure(targetRef)]).then(([sv, tv]) => {
            if (!sv || !tv) {
              resolve(0);
              return;
            }
            // contentY is where the target sits in content coords; (ty - sy)
            // is where it sits on screen inside the scroll viewport.
            resolve(Math.max(0, contentY - (tv.y - sv.y)));
          });
        } catch {
          resolve(0);
        }
      }),
    []
  );

  // Smooth, eased programmatic scroll so tutorial targets glide into view on
  // both platforms (plain scrollTo(animated:true) is often an abrupt jump on
  // Android). Content coordinates come from measureLayout, so this works no
  // matter where the view is currently scrolled to.
  const smoothScrollTo = useCallback(
    (scrollRef: any, targetRef: any, contentY: number) =>
      new Promise<void>((resolve) => {
        const target = Math.max(0, contentY - 140);
        (async () => {
          let from = lastScrollYRef.current;
          if (from <= 0) {
            from = await measureLiveScrollOffset(scrollRef, targetRef, contentY);
          }
          lastScrollYRef.current = target;
          if (Math.abs(from - target) < 2) {
            resolve();
            return;
          }
          try {
            const anim = new Animated.Value(from);
            const id = anim.addListener(({ value }) => {
              scrollRef.scrollTo({ y: value, animated: false });
            });
            scrollAnimRef.current = { anim, id };
            Animated.timing(anim, {
              toValue: target,
              duration: 320,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }).start(() => {
              anim.removeListener(id);
              if (scrollAnimRef.current?.anim === anim) scrollAnimRef.current = null;
              resolve();
            });
          } catch {
            resolve();
          }
        })();
      }),
    [measureLiveScrollOffset]
  );

  const maybeShowPendingIntro = useCallback(async () => {
    try {
      if (isAdminRef.current) return; // Admins never see the intro paywall.
      const pending = await storageService.load(INTRO_PENDING_KEY);
      if (!pending) return;
      await storageService.save(INTRO_PENDING_KEY, false);
      if (!isProRef.current) {
        // Small delay so the app content is visible behind the paywall.
        setTimeout(() => presentPaywall(OFFERING_IDS.intro), 600);
      }
    } catch (e) {
      console.warn('[Tour] Failed to present intro paywall:', e);
    }
  }, [presentPaywall]);

  /**
   * "Random showup" paywall: presents OFFERING_IDS.randomShowup roughly once or
   * twice a week (every 3-5 days) while the app is opened/foregrounded, for
   * signed-in free users.
   */
  const maybeShowRandomPaywall = useCallback(async () => {
    if (isProRef.current || isAdminRef.current) return; // Never for admins.
    // Never interrupt a tour or the queued intro paywall.
    if (activeTourRef.current) return;
    try {
      const pendingIntro = await storageService.load(INTRO_PENDING_KEY);
      if (pendingIntro) return;
      const user = await storageService.load(storageService.STORAGE_KEYS.USER);
      if (!user?.id) return;

      const now = Date.now();
      let next = await storageService.load(RANDOM_PAYWALL_KEY);
      if (!next || typeof next !== 'number') {
        // First check: schedule the first random paywall 3-5 days out.
        await storageService.save(RANDOM_PAYWALL_KEY, now + randomShowupDelay());
        return;
      }
      // Values scheduled under the old (7-14 day) cadence may still be far out;
      // re-roll anything beyond the new window so existing installs adopt the
      // new ~1-2x per week cadence.
      if (next - now > MAX_RANDOM_SHOWUP_WINDOW) {
        await storageService.save(RANDOM_PAYWALL_KEY, now + randomShowupDelay());
        return;
      }
      if (now >= next) {
        // Schedule the next one first so dismissing can't re-trigger it.
        await storageService.save(RANDOM_PAYWALL_KEY, now + randomShowupDelay());
        posthog?.capture('random_paywall_presented');
        setTimeout(() => presentPaywall(OFFERING_IDS.randomShowup), 800);
      }
    } catch (e) {
      console.warn('[Tour] Random paywall check failed:', e);
    }
  }, [presentPaywall]);

  const finishTour = useCallback(
    async (completed: boolean) => {
      const name = activeTourRef.current;
      if (!name) return;
      const key =
        name === 'home'
          ? homeKey(user?.id)
          : name === 'create'
          ? createKey(user?.id)
          : profileKey(user?.id);
      try {
        await storageService.save(key, true);
      } catch (e) {
        console.warn('[Tour] Failed to persist tour state:', e);
      }
      activeTourRef.current = null;
      activeStepIdRef.current = null;
      setTourName(null);
      setStepIndex(0);
      setSteps([]);
      setRect(null);
      setReady(false);
      // The intro paywall waits for the home tour to finish (or be skipped).
      if (name === 'home') {
        await maybeShowPendingIntro();
      }
    },
    [user?.id, maybeShowPendingIntro]
  );

  const startTour = useCallback((name: TourName) => {
    if (activeTourRef.current) return;
    // Admins never get onboarding tours.
    if (isAdminRef.current) return;
    // Home tour should always start from the Home tab.
    if (name === 'home') {
      navRef.current?.navigate?.('Home');
    }
    const all =
      name === 'home' ? HOME_TOUR : name === 'create' ? CREATE_TOUR : PROFILE_TOUR;
    const filtered = all.filter((s) => !s.condition || s.condition({ isPro: isProRef.current }));
    if (filtered.length === 0) return;
    activeTourRef.current = name;
    lastScrollYRef.current = 0;
    if (scrollAnimRef.current) {
      try {
        scrollAnimRef.current.anim.stopAnimation();
        scrollAnimRef.current.anim.removeAllListeners();
      } catch {}
      scrollAnimRef.current = null;
    }
    setSwitching(false);
    setTourName(name);
    setSteps(filtered);
    setStepIndex(0);
    // Guarantee each tour only ever shows ONCE per user: remember it the moment
    // it starts, so even a mid-tour app restart can't bring it back.
    const key =
      name === 'home'
        ? homeKey(userIdRef.current)
        : name === 'create'
        ? createKey(userIdRef.current)
        : profileKey(userIdRef.current);
    storageService
      .save(key, true)
      .catch((e) => console.warn('[Tour] Failed to mark tour as seen:', e));
  }, []);

  const nextStep = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      finishTour(true);
    } else {
      setStepIndex(stepIndex + 1);
    }
  }, [stepIndex, steps.length, finishTour]);

  // Activate the current step: navigate (if requested), locate the target, measure it.
  useEffect(() => {
    if (!tourName) return;
    const step = steps[stepIndex];
    if (!step) {
      // Safety: never leave the app stuck behind the dim overlay.
      finishTour(true);
      return;
    }
    let cancelled = false;
    activeStepIdRef.current = step.target || null;
    setRect(null);
    setReady(false);
    // Smoothly fade the overlay while a tab change is in flight.
    setSwitching(!!step.tab);

    const run = async () => {
      if (step.tab) {
        try {
          navRef.current?.navigate?.(step.tab);
        } catch (e) {
          console.warn('[Tour] Navigation failed:', e);
        }
        // A freshly focused tab starts at the top of its scroll content.
        lastScrollYRef.current = 0;
        await delay(80);
      }
      if (cancelled) return;

      if (!step.target) {
        if (!cancelled) {
          setSwitching(false);
          setReady(true);
        }
        return;
      }

      // Wait for the target to be registered (a screen may still be mounting).
      const deadline = Date.now() + 1500;
      while (Date.now() < deadline) {
        const ref = targetsRef.current[step.target];
        if (ref && typeof ref.measureInWindow === 'function') break;
        await delay(20);
        if (cancelled) return;
      }

      // Scroll the target into view if the step asks for it (below-the-fold elements).
      if (step.scrollTarget) {
        const scrollRef = targetsRef.current[step.scrollTarget];
        const targetRef = targetsRef.current[step.target];
        if (
          scrollRef &&
          targetRef &&
          typeof targetRef.measureLayout === 'function' &&
          typeof scrollRef.scrollTo === 'function'
        ) {
          await new Promise<void>((resolve) => {
            try {
              targetRef.measureLayout(
                scrollRef,
                (x: number, y: number) => {
                  smoothScrollTo(scrollRef, targetRef, y).then(resolve);
                },
                () => resolve()
              );
            } catch {
              resolve();
            }
          });
          await delay(60);
          if (cancelled) return;
        }
      }

      await delay(20);
      if (cancelled) return;
      // Wait for the measured rect so the tooltip renders in its final position
      // (no flash-then-jump between steps).
      await measureTarget(step.target);
      if (cancelled) return;
      setSwitching(false);
      setReady(true);
    };

    run();
    return () => {
      cancelled = true;
      // If the step changes (or the tour ends) mid-scroll, stop the eased
      // scroll so it never calls scrollTo on a view that may have unmounted.
      if (scrollAnimRef.current) {
        try {
          scrollAnimRef.current.anim.stopAnimation();
          scrollAnimRef.current.anim.removeAllListeners();
        } catch {}
        scrollAnimRef.current = null;
      }
    };
  }, [tourName, stepIndex, steps, measureTarget, finishTour, smoothScrollTo]);

  // Auto-start the home tour once per session, before the intro paywall.
  useEffect(() => {
    if (homeGateRef.current) return;
    homeGateRef.current = true;
    let cancelled = false;
    (async () => {
      await delay(900);
      if (cancelled) return;
      // Admins skip all onboarding tours and the intro paywall.
      if (isAdminRef.current) return;
      const done = await hasHomeTourCompleted(user?.id);
      if (cancelled) return;
      if (!done) {
        startTour('home');
      } else {
        // Already toured before, but maybe an intro paywall is queued (fresh signup).
        await maybeShowPendingIntro();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // "Random showup" paywall: check when the app opens and whenever it comes
  // back to the foreground (at most once per 7-14 day window).
  useEffect(() => {
    let mounted = true;
    const t = setTimeout(() => {
      if (mounted) maybeShowRandomPaywall();
    }, 10000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && mounted) maybeShowRandomPaywall();
    });
    return () => {
      mounted = false;
      clearTimeout(t);
      sub.remove();
    };
  }, [maybeShowRandomPaywall]);

  return (
    <TourContext.Provider
      value={{
        active: !!tourName,
        tourName,
        step: tourName ? steps[stepIndex] || null : null,
        stepIndex,
        totalSteps: steps.length,
        rect,
        ready,
        switching,
        registerTarget,
        setNav,
        startTour,
        nextStep,
        finishTour,
        hasHomeTourCompleted,
        hasCreateTourCompleted,
        hasProfileTourCompleted,
      }}
    >
      {children}
      <TourOverlay />
    </TourContext.Provider>
  );
};


