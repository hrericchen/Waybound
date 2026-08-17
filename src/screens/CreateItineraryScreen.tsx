import React, { useEffect, useState, useContext, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ScrollView,
  FlatList,
  Share,
  Pressable,
  PanResponder,
  Animated,
  Keyboard,
  LayoutAnimation,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import tripService from '../services/tripService';
import { communityService } from '../services/communityService';
import { searchPlacesResilient, resolvePlaceInfo, PlaceResult } from '../services/placesService';
import PlaceSearch from '../components/PlaceSearch';
import CityPicker from '../components/CityPicker';
import TripMap from '../components/TripMap';
import ExpensesModal from '../components/ExpensesModal';
import CoverBanner from '../components/CoverBanner';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import { Activity, ActivityLink, ActivityPhoto, Expense } from '../types';
import { AuthContext } from '../context/AuthContext';
import { useRevenueCat } from '../context/RevenueCatContext';
import { useTour } from '../context/TourContext';
import { adService } from '../services/adService';
import { posthog } from '../config/posthog';
import { useResponsive, fs } from '../utils/responsive';

// One color per day — Day 1 = green, Day 2 = blue, etc.
const DAY_COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];
const getDayColor = (day: number) => DAY_COLORS[(day - 1) % DAY_COLORS.length];

// Cover banner collapse dimensions (below the status bar).
const BANNER_EXPANDED = 190;
const BANNER_COLLAPSED = 54;

// Unique id generator (avoids Date.now() collisions that caused duplicate React keys)
let idCounter = 0;
const genId = (prefix = 'id') => `${prefix}-${Date.now()}-${idCounter++}`;

type OverviewNote = { id: string; type: 'note'; text: string; bullets: boolean };
type OverviewMedia = { id: string; type: 'media'; uri: string; base64?: string };
type OverviewPlace = { id: string; type: 'place'; name: string; lat: number; lng: number; address?: string; photoUrl?: string; description?: string; number?: number };
type OverviewPacking = { id: string; type: 'packing'; title: string; items: { id: string; text: string; checked: boolean }[] };
type OverviewItem = OverviewNote | OverviewMedia | OverviewPlace | OverviewPacking;
type OverviewSection = { id: string; title: string; items: OverviewItem[] };

/** Simple Levenshtein distance — used to detect typo'd place names. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

const normName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Derive a qualified city label (e.g. "Vienna, VA") from a place's name +
 * address so recommendation searches don't resolve to a different place with
 * the same name (e.g. Vienna VA vs Vienna Austria). Falls back to the name.
 */
function citySearchLabel(city: { name?: string; address?: string }): string {
  const name = (city.name || '').trim();
  if (!name) return '';
  const addr = (city.address || '').trim();
  // US style "...Vienna, VA 22180" → capture the "VA" state abbreviation.
  const usMatch = addr.match(/(?:^|,\s*)([A-Z]{2})\s+\d{5}/);
  if (usMatch) return `${name}, ${usMatch[1].toUpperCase()}`;
  const parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // Last two meaningful parts (e.g. "VA, USA" or "State, Country").
    const region = parts.slice(-2).join(', ');
    if (region.toLowerCase() !== name.toLowerCase()) return `${name}, ${region}`;
  }
  return name;
}

/** Shorten a possibly long description to a single sentence for compact cards. */
function firstSentence(desc?: string): string {
  if (!desc) return '';
  const trimmed = desc.trim().replace(/\s+/g, ' ');
  const end = trimmed.indexOf('. ');
  const sentence = end > 0 ? trimmed.slice(0, end + 1) : trimmed;
  return sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence;
}

/** True when a typed activity title is clearly the same place as the result. */
function isStrongPlaceMatch(text: string, placeName: string): boolean {
  const t = normName(text);
  const n = normName(placeName);
  if (!t || !n) return false;
  const tTokens = t.split(' ').filter(Boolean);
  const nTokens = n.split(' ').filter(Boolean);
  // If the user typed MORE words than the place name ("central park picnic"),
  // they're describing an activity — don't clobber their text.
  if (tTokens.length > nTokens.length) return false;
  if (n === t || n.startsWith(t) || t.startsWith(n)) return true;
  if (tTokens.length > 1 && tTokens.every((tok) => n.includes(tok))) return true;
  const d = levenshtein(t, n);
  return d <= Math.max(2, Math.floor(Math.min(t.length, n.length) * 0.35));
}

/**
 * Words/phrases that mark the input as an activity description, not a place
 * ("check in hotel", "go to the beach", "grab lunch"…). These should never be
 * auto-corrected into a place — the user typed a special noun / plan item.
 */
const ACTIVITY_STARTERS = new Set([
  'check', 'checkin', 'go', 'visit', 'take', 'walk', 'explore', 'relax',
  'enjoy', 'try', 'shop', 'eat', 'lunch', 'dinner', 'breakfast', 'brunch',
  'coffee', 'drink', 'arrive', 'depart', 'leave', 'return', 'have', 'get',
  'meet', 'see', 'book', 'buy', 'find', 'head', 'stop', 'grab', 'do',
  'reserve', 'rest', 'sleep', 'wake', 'pack', 'watch', 'stroll', 'wander',
  'ride', 'drive', 'fly', 'call', 'swim', 'hike', 'snorkel', 'relax',
]);

function isActivityPhrase(text: string): boolean {
  const first = (text || '').trim().toLowerCase().split(/\s+/)[0];
  if (first && ACTIVITY_STARTERS.has(first)) return true;
  const t = (text || '').toLowerCase();
  return /\b(check\s+in|check\s+into|check-in|pick\s+up|drop\s+off|go\s+to|head\s+to|leave\s+for)\b/.test(t);
}

const CreateItineraryScreen: React.FC = () => {
  const route = useRoute();
  const editId = (route.params as any)?.editId;
  const [title, setTitle] = useState('');
  const [destinations, setDestinations] = useState('');
  const [cities, setCities] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'itinerary'>('overview');
  const [overview, setOverview] = useState<OverviewSection[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [season, setSeason] = useState('');
  const [budget, setBudget] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageBase64, setCoverImageBase64] = useState('');

  // Scroll position driving the collapsible cover banner.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [activities, setActivities] = useState<Activity[]>([
    { id: 'a1', day: 1, title: '', notes: '', links: [], photos: [], completed: false },
  ]);
  const [days, setDays] = useState<number[]>([1]);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [draftId, setDraftId] = useState(() => `it-${Date.now()}`);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabQuery, setCollabQuery] = useState('');
  const [collabRole, setCollabRole] = useState<'editor' | 'admin'>('editor');
  const [collabResults, setCollabResults] = useState<any[]>([]);
  const [dayNotes, setDayNotes] = useState<Record<number, string>>({});
  const [expensesVisible, setExpensesVisible] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgetCurrency, setBudgetCurrency] = useState('USD');

  // Drag-to-reorder state
  const CARD_HEIGHT = 88;
  const dragY = useRef(new Animated.Value(0)).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const draggingIdRef = useRef<string | null>(null);
  const dragStartIndexRef = useRef(0);
  const dragMovedRef = useRef(false);
  const autoFormatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightsBuiltRef = useRef(false);
  const recLoadedRef = useRef<Set<string>>(new Set());
  const [recData, setRecData] = useState<Record<string, { places: PlaceResult[]; food: PlaceResult[]; hidden: PlaceResult[]; loading: boolean }>>({});
  const [recCityId, setRecCityId] = useState<string | null>(null);
  const [recTab, setRecTab] = useState<'places' | 'food' | 'hidden'>('places');
  const [recExpanded, setRecExpanded] = useState(true);
  const [recDropdownVisible, setRecDropdownVisible] = useState(false);
  const addDayAnim = useRef(new Animated.Value(0)).current;
  const lastAddedDayRef = useRef<number | null>(null);
  const activitiesRef = useRef<Activity[]>(activities);
  const selectedDayRef = useRef(selectedDay);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  useEffect(() => { activitiesRef.current = activities; }, [activities]);
  useEffect(() => { selectedDayRef.current = selectedDay; }, [selectedDay]);

  const endDrag = () => {
    Animated.spring(dragY, { toValue: 0, useNativeDriver: true, speed: 25, bounciness: 4 } as any).start();
    Animated.spring(dragScale, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 4 } as any).start();
    draggingIdRef.current = null;
    dragMovedRef.current = false;
    setDraggingId(null);
  };

  const startDragPickup = (id: string) => {
    Keyboard.dismiss();
    const dayActs = activities.filter((a) => a.day === selectedDay);
    dragStartIndexRef.current = dayActs.findIndex((a) => a.id === id);
    draggingIdRef.current = id;
    dragMovedRef.current = false;
    setDraggingId(id);
    Animated.spring(dragScale, { toValue: 1.06, useNativeDriver: true, speed: 20, bounciness: 7 } as any).start();
  };
  const theme = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);
  const { isPro, presentPaywall } = useRevenueCat();
  const { registerTarget, startTour, hasCreateTourCompleted } = useTour();
  const { scale, compact } = useResponsive();

  // First time opening a fresh create page: run the guided tour around the app.
  // Guards (all three must pass) so it can never fire twice in a session:
  //  - only once per screen mount (this effect), only when creating (not editing),
  //  - only once per user ever (persisted "seen"/"done" flag checked before start).
  const createTourTriggeredRef = useRef(false);
  useEffect(() => {
    if (editId) return;
    if (createTourTriggeredRef.current) return;
    createTourTriggeredRef.current = true;
    let mounted = true;
    (async () => {
      const done = await hasCreateTourCompleted(user?.id);
      if (!done && mounted) {
        setTimeout(() => {
          if (mounted) startTour('create');
        }, 750);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-create the Overview "Highlights" section template (filled from the day
  // activities when there are any) and load city recommendations so the user
  // can tap "+" to add more numbered highlights.
  useEffect(() => {
    if (activeTab !== 'overview') return;
    setOverview((prev) =>
      prev.some((s) => s.id === 'highlights')
        ? prev
        : [{ id: 'highlights', title: 'Highlights', items: [] }, ...prev]
    );
    if (!highlightsBuiltRef.current) {
      highlightsBuiltRef.current = true;
      const candidates = activitiesRef.current.filter(
        (a) => a.title.trim() && a.title.trim().toLowerCase() !== 'new activity'
      );
      if (candidates.length > 0) buildHighlights();
    }
    // Load researched recommendations for the currently selected rec city.
    const city = cities.find((c) => (c.id || c.name) === recCityId) || cities[0];
    if (city) loadRecommendationsFor(city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Reset recommendations whenever the destination cities change.
  useEffect(() => {
    setRecData({});
    recLoadedRef.current = new Set();
    if (cities.length > 0) {
      const first = cities[0];
      setRecCityId(first.id || first.name);
      loadRecommendationsFor(first);
    } else {
      setRecCityId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities.length]);

  const getCoverImageValue = () =>
    coverImageBase64
      ? `data:image/jpeg;base64,${coverImageBase64}`
      : coverImageUrl || cities[0]?.photoUrl || undefined;

  // Load existing itinerary for editing
  useEffect(() => {
    const loadItinerary = async () => {
      if (editId) {
        const itinerary = await tripService.getTripById(editId);
        if (itinerary) {
          setDraftId(itinerary.id);
          setTitle(itinerary.title);
          setDestinations(itinerary.destinations?.join(', ') || '');
          const dests = (itinerary.destinations || []).map((n: string) => ({ id: n, name: n, address: '', lat: 0, lng: 0, types: [] }));
          setCities(dests);
          enrichCityPhotos(dests);
          setSeason(itinerary.season || '');
          setBudget(itinerary.budget || '');
          setCoverImageUrl(itinerary.coverImage || '');
          setCoverImageBase64('');
          setActivities(itinerary.activities || []);
          const dayNumbers = [...new Set((itinerary.activities || []).map((a: any) => a.day))].sort((a: number, b: number) => a - b);
          setDays(dayNumbers.length > 0 ? dayNumbers as number[] : [1]);
          setSelectedDay((dayNumbers[0] as number) || 1);
          setDayNotes(itinerary.dayNotes || {});
          setExpenses(itinerary.expenses || []);
          setBudgetCurrency(itinerary.budgetCurrency || 'USD');
          setOverview(itinerary.overview || []);
          // Load existing collaborators
          const collabs = await communityService.getCollaborators(itinerary.id);
          setCollaborators(collabs);
        }
      }
    };
    loadItinerary();
  }, [editId]);

  // Starting a brand-new trip from the + menu clears the previous draft.
  useEffect(() => {
    if ((route.params as any)?.fresh && !editId) {
      setDraftId(`it-${Date.now()}`);
      setTitle('');
      setDestinations('');
      setCities([]);
      setSeason('');
      setBudget('');
      setCoverImageUrl('');
      setCoverImageBase64('');
      setActivities([{ id: genId('act'), day: 1, title: '', notes: '', links: [], photos: [], completed: false }]);
      setDays([1]);
      setSelectedDay(1);
      setDayNotes({});
      setExpenses([]);
      setOverview([
        {
          id: 'highlights',
          title: 'Highlights',
          items: [],
        },
      ]);
      setCollapsedSections({});
    }
  }, [(route.params as any)?.fresh]);

  const searchCollabs = async (q: string) => {
    setCollabQuery(q);
    if (!q.trim()) {
      setCollabResults([]);
      return;
    }
    const users = await communityService.searchUsers(q.trim());
    setCollabResults(
      users.filter((u: any) => u.id !== user?.id && !collaborators.some((c: any) => c.id === u.id))
    );
  };

  const addCollaboratorUser = async (u: any) => {
    try {
      const role = collabRole;
      await communityService.addCollaborator(draftId, { id: u.id, name: u.name, email: u.email, role });
      setCollaborators(prev => [...prev.filter((c) => c.id !== u.id), { ...u, role }]);
      setCollabRole('editor'); // reset for the next invite
    } catch (e) {
      console.warn('Failed to add collaborator', e);
    }
    // Stay in the modal so more people can be invited; clear the search.
    setCollabQuery('');
    setCollabResults([]);
  };

  const updateCollaboratorRole = async (collab: any, role: 'editor' | 'admin') => {
    try {
      await communityService.updateCollaboratorRole(draftId, collab.id, role);
      setCollaborators(prev => prev.map((c) => (c.id === collab.id ? { ...c, role } : c)));
    } catch (e) {
      console.warn('Failed to update collaborator role', e);
    }
  };

  // NOTE: The draft is intentionally NOT saved to "Your Itineraries" while
  // editing. It only lives in memory for as long as you stay in this tab.
  // It gets added to your library only when "Save Itinerary" is pressed.

  const navigation = useNavigation();

  const addActivity = () => {
    setActivities((a) => [
      ...a,
      { id: genId('act'), day: selectedDay, title: 'New Activity', notes: '', links: [], photos: [], completed: false },
    ]);
  };

  const addDay = () => {
    const newDay = days.length + 1;
    lastAddedDayRef.current = newDay;
    setDays([...days, newDay]);
    setSelectedDay(newDay);
    // Little pop animation for the new day chip
    addDayAnim.setValue(0);
    Animated.spring(addDayAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 } as any).start();
  };

  const [searchVisible, setSearchVisible] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | undefined>(undefined);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [addressModalId, setAddressModalId] = useState<string | null>(null);
  // Trip Recap photos: which activity's photo menu is open + lightbox preview.
  const [photoPickerFor, setPhotoPickerFor] = useState<string | null>(null);
  const [photoLightbox, setPhotoLightbox] = useState<string | null>(null);

  const handleSelectPlace = (place: { name: string; lat: number; lng: number; address?: string }) => {
    const item = {
      id: genId('act'),
      day: selectedDay,
      title: place.name,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      notes: '',
      links: [],
      photos: [],
      completed: false,
    };
    setActivities((a) => [...a, item]);
    setSearchVisible(false);
  };

  const removeActivity = (id: string) => setActivities((a) => a.filter((x) => x.id !== id));

  const handleAddressPress = (item: Activity) => {
    setAddressModalId(item.id);
  };

  const handleAddressSelect = (place: { name: string; lat: number; lng: number; address?: string }) => {
    if (!addressModalId) return;
    const existing = activities.find((a) => a.id === addressModalId);
    updateActivity(addressModalId, {
      lat: place.lat,
      lng: place.lng,
      address: place.address || place.name,
      ...(existing && (!existing.title || existing.title === 'New Activity') ? { title: place.name } : {}),
    });
  };

  const getActivityPhotos = (activityId: string): ActivityPhoto[] =>
    activities.find((a) => a.id === activityId)?.photos || [];

  /** Add photos to an activity from the library (multi-select). */
  const pickPhotosForActivity = async (activityId: string) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to add photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5,
        base64: true,
        allowsMultipleSelection: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const added: ActivityPhoto[] = result.assets.map((asset: any) => ({
          id: genId('ph'),
          uri: asset.uri,
          base64: asset.base64,
          timestamp: new Date().toISOString(),
        }));
        updateActivity(activityId, { photos: [...getActivityPhotos(activityId), ...added] });
      }
    } catch (e) {
      console.warn('Photo pick failed:', e);
    }
  };

  /** Take a photo with the camera for an activity. */
  const takePhotoForActivity = async (activityId: string) => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Please grant camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const added: ActivityPhoto = {
          id: genId('ph'),
          uri: asset.uri,
          base64: asset.base64,
          timestamp: new Date().toISOString(),
        };
        updateActivity(activityId, { photos: [...getActivityPhotos(activityId), added] });
      }
    } catch (e) {
      console.warn('Camera photo failed:', e);
    }
  };

  const removeActivityPhoto = (activityId: string, photoId: string) => {
    updateActivity(activityId, { photos: getActivityPhotos(activityId).filter((p) => p.id !== photoId) });
  };

  const handleShare = async () => {
    const destText = destinations.split(',').map((s) => s.trim()).filter(Boolean).join(', ');
    const lines: string[] = [];
    if (title) lines.push(`✈️ ${title}`);
    if (destText) lines.push(`📍 ${destText}`);
    if (season) lines.push(`🗓️ ${season}`);
    days.forEach((day) => {
      lines.push(`\n— Day ${day} —`);
      if (dayNotes[day]) lines.push(dayNotes[day]);
      activities
        .filter((a) => a.day === day)
        .forEach((a) => lines.push(`• ${a.title}${a.address ? ` (${a.address})` : ''}`));
    });
    if (lines.length === 0) {
      Alert.alert('Nothing to Share', 'Add a title, destination, or some activities first.');
      return;
    }
    try {
      await Share.share({ message: lines.join('\n') });
    } catch (e) {
      console.warn('Share failed', e);
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setCoverImageBase64(asset.base64);
          setCoverImageUrl('');
          Alert.alert('Success', 'Image uploaded!');
        } else if (asset.uri) {
          setCoverImageUrl(asset.uri);
          setCoverImageBase64('');
          Alert.alert('Success', 'Image uploaded!');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const updateActivity = (id: string, updates: Partial<Activity>) => {
    setActivities((a) => a.map((x) => x.id === id ? { ...x, ...updates } : x));
  };

  /** Make sure every destination city has a thumbnail (Wikipedia/Pexels/Google). */
  const enrichCityPhotos = async (sel: any[]) => {
    const missing = sel.filter((c) => !c.photoUrl);
    if (missing.length === 0) return;
    const out = [...sel];
    await Promise.all(
      missing.map(async (c) => {
        try {
          const info = await resolvePlaceInfo(c.name, { id: c.id, photoUrl: c.photoUrl });
          if (info.photoUrl) {
            const i = out.findIndex((x) => (x.id || x.name) === (c.id || c.name));
            if (i >= 0) out[i] = { ...out[i], photoUrl: info.photoUrl };
          }
        } catch (e) {
          // Keep the city card with its fallback icon — never block the flow.
        }
      })
    );
    setCities(out);
  };

  /**
   * Auto-format a typed activity title into a real place: debounces, resolves
   * the text with Google Places (handles typos like "crntral park"), then fills
   * in the proper name + location + address so the map button lights up.
   */
  const autoFormatActivity = (id: string, text: string) => {
    if (autoFormatTimerRef.current) clearTimeout(autoFormatTimerRef.current);
    const act = activitiesRef.current.find((a) => a.id === id);
    if (!act) return;
    // Only auto-resolve places that don't already have a location.
    if (act.lat || act.lng) return;
    autoFormatTimerRef.current = setTimeout(async () => {
      const q = text.trim();
      if (q.length < 3) return;
      // Never auto-correct activity phrases ("check in hotel", "grab lunch"…).
      if (isActivityPhrase(q)) return;
      try {
        const bias = cities[0]?.lat && cities[0]?.lng ? { lat: cities[0].lat, lng: cities[0].lng } : undefined;
        const results = await searchPlacesResilient(q, bias);
        const top = results[0];
        if (top && isStrongPlaceMatch(q, top.name)) {
          updateActivity(id, { title: top.name, lat: top.lat, lng: top.lng, address: top.address });
        }
      } catch (e) {
        // Ignore — leave the title as the user typed it.
      }
    }, 800);
  };

  /** Pick up to 3 random activities and auto-build the Overview "Highlights" section. */
  const buildHighlights = async () => {
    const candidates = activitiesRef.current.filter(
      (a) => a.title.trim() && a.title.trim().toLowerCase() !== 'new activity'
    );
    if (candidates.length === 0) return;
    const picked = [...candidates].sort(() => Math.random() - 0.5).slice(0, 3);
    const bias = cities[0]?.lat && cities[0]?.lng ? { lat: cities[0].lat, lng: cities[0].lng } : undefined;
    const items = await Promise.all(
      picked.map(async (a, i) => {
        const item: OverviewPlace = {
          id: genId('hl'),
          type: 'place',
          name: a.title.trim(),
          lat: a.lat || 0,
          lng: a.lng || 0,
          address: a.address || undefined,
          photoUrl: undefined,
          description: undefined,
          number: i + 1,
        };
        try {
          const res = await searchPlacesResilient(item.name, bias);
          const top = res[0];
          if (top) {
            if (!item.lat) { item.lat = top.lat; item.lng = top.lng; }
            item.address = item.address || top.address;
            // Free-first: Wikipedia description/photo, then ~50/50 Pexels vs
            // Google photo (Google only as the fallback).
            const info = await resolvePlaceInfo(item.name, { id: top.id, photoUrl: top.photoUrl });
            item.photoUrl = info.photoUrl;
            item.description = info.description;
          }
        } catch (e) {
          // Keep the activity's own title/location.
        }
        return item;
      })
    );
    const section: OverviewSection = { id: 'highlights', title: 'Highlights', items };
    setOverview((prev) => {
      const idx = prev.findIndex((s) => s.id === 'highlights');
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], items: next[idx].items.length === 0 ? items : next[idx].items };
        return next;
      }
      return [section, ...prev];
    });
  };

  /** Load researched recommendations (Places + Food + Hidden Gems) for a specific city. */
  const loadRecommendationsFor = async (city: any) => {
    if (!city) return;
    const key = city.id || city.name;
    if (recLoadedRef.current.has(key)) return;
    recLoadedRef.current.add(key);
    setRecData((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { places: [], food: [], hidden: [] }), loading: true },
    }));
    try {
      const bias = city.lat && city.lng ? { lat: city.lat, lng: city.lng } : undefined;
      const label = citySearchLabel(city) || city.name;
      const [places, food, hidden] = await Promise.all([
        searchPlacesResilient(`must-see iconic tourist attractions in ${label}`, bias),
        searchPlacesResilient(`top best-rated restaurants in ${label}`, bias),
        searchPlacesResilient(`hidden gems off the beaten path in ${label}`, bias),
      ]);
      setRecData((prev) => ({
        ...prev,
        [key]: { places: places.slice(0, 6), food: food.slice(0, 6), hidden: hidden.slice(0, 6), loading: false },
      }));
    } catch (e) {
      setRecData((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || { places: [], food: [], hidden: [] }), loading: false },
      }));
    }
  };

  /** Tap "+" on a food recommendation → add it to the "Food" overview section. */
  const addFoodFromRecommendation = async (place: PlaceResult) => {
    let photoUrl: string | undefined;
    let description: string | undefined;
    try {
      const info = await resolvePlaceInfo(place.name, { id: place.id, photoUrl: place.photoUrl });
      photoUrl = info.photoUrl;
      description = info.description;
    } catch (e) {
      // Keep the item without photo/description rather than blocking the add.
    }
    setOverview((prev) => {
      const idx = prev.findIndex((s) => s.id === 'food');
      const newItem: OverviewPlace = {
        id: genId('food'),
        type: 'place',
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        address: place.address || undefined,
        photoUrl,
        description,
      };
      const next = [...prev];
      if (idx >= 0) {
        next[idx] = { ...next[idx], items: [...next[idx].items, newItem] };
      } else {
        next.push({ id: 'food', title: 'Food', items: [newItem] });
      }
      return next;
    });
  };

  /** Tap "+" on a place or hidden gem recommendation → it becomes the next
      numbered highlight. Only Food keeps its own section. */
  const addHighlightFromRecommendation = async (place: PlaceResult) => {
    let photoUrl: string | undefined;
    let description: string | undefined;
    try {
      const info = await resolvePlaceInfo(place.name, { id: place.id, photoUrl: place.photoUrl });
      photoUrl = info.photoUrl;
      description = info.description;
    } catch (e) {
      // Keep the item without photo/description rather than blocking the add.
    }
    setOverview((prev) => {
      const idx = prev.findIndex((s) => s.id === 'highlights');
      const items = idx >= 0 ? (prev[idx].items as OverviewPlace[]) : [];
      const number = items.reduce((mx, i) => Math.max(mx, i.number || 0), 0) + 1;
      const newItem: OverviewPlace = {
        id: genId('hl'),
        type: 'place',
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        address: place.address || undefined,
        photoUrl,
        description,
        number,
      };
      const next = [...prev];
      if (idx >= 0) {
        next[idx] = { ...next[idx], items: [...next[idx].items, newItem] };
      } else {
        next.unshift({ id: 'highlights', title: 'Highlights', items: [newItem] });
      }
      return next;
    });
  };

  const addLink = (activityId: string) => {
    const link: ActivityLink = {
      id: genId('link'),
      title: 'New Link',
      url: 'https://',
    };
    updateActivity(activityId, { links: [...(activities.find(a => a.id === activityId)?.links || []), link] });
  };

  const updateLink = (activityId: string, linkId: string, updates: Partial<ActivityLink>) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity?.links) {
      updateActivity(activityId, { links: activity.links.map(l => l.id === linkId ? { ...l, ...updates } : l) });
    }
  };

  const removeLink = (activityId: string, linkId: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity?.links) {
      updateActivity(activityId, { links: activity.links.filter(l => l.id !== linkId) });
    }
  };

  const addPhoto = async (activityId: string) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const photo: ActivityPhoto = {
          id: genId('photo'),
          uri: asset.uri,
          base64: asset.base64,
          timestamp: new Date().toISOString(),
        };
        const act = activities.find(a => a.id === activityId);
        if (act) {
          updateActivity(activityId, { photos: [...(act.photos || []), photo] });
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const removePhoto = (activityId: string, photoId: string) => {
    const act = activities.find(a => a.id === activityId);
    if (act?.photos) {
      updateActivity(activityId, { photos: act.photos.filter(p => p.id !== photoId) });
    }
  };

  const renderActivity = (item: Activity, index: number) => {
    const isExpanded = expandedActivity === item.id;
    const isDragging = draggingId === item.id;
    const photoCount = item.photos?.length || 0;

    // Per-card drag responder — only claims the touch when this card is the
    // one being dragged and we are in reorder mode.
    const cardPan = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        draggingIdRef.current === item.id && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4),
      onPanResponderMove: (_e, g) => {
        if (draggingIdRef.current !== item.id) return;
        dragMovedRef.current = true;
        dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (draggingIdRef.current !== item.id) return;
        const dayActs = activitiesRef.current.filter((a) => a.day === selectedDayRef.current);
        const idx = dayActs.findIndex((a) => a.id === item.id);
        const target = Math.max(
          0,
          Math.min(dayActs.length - 1, dragStartIndexRef.current + Math.round(g.dy / CARD_HEIGHT))
        );
        if (idx >= 0 && target !== idx) {
          // Smoothly reflow the cards into their new order.
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          const day = [...dayActs];
          const [it] = day.splice(idx, 1);
          day.splice(target, 0, it);
          setActivities((prev) => [...prev.filter((a) => a.day !== selectedDayRef.current), ...day]);
        }
        endDrag();
      },
      onPanResponderTerminate: () => {
        endDrag();
      },
    });

    return (
      <Animated.View
        key={item.id}
        style={[
          styles.activity,
          { backgroundColor: colors.card, borderColor: colors.border },
          isDragging && styles.activityDragging,
          isDragging && { transform: [{ translateY: dragY }, { scale: dragScale }], zIndex: 30, elevation: 12 },
        ]}
      >
        <Pressable
          {...cardPan.panHandlers}
          onLongPress={() => {
            startDragPickup(item.id);
          }}
          delayLongPress={500}
          onPressOut={() => {
            if (draggingIdRef.current === item.id && !dragMovedRef.current) {
              endDrag();
            }
          }}
        >
        <View style={styles.activityContent}>
          <TouchableOpacity
            style={[styles.mapBtn, item.lat && item.lng && styles.mapBtnActive]}
            onPress={() => handleAddressPress(item)}
          >
            <Icon name="map" size={18} color={item.lat && item.lng ? colors.white : colors.primary} />
          </TouchableOpacity>

          {/* Camera — add photos for the Trip Recap timeline */}
          <TouchableOpacity
            ref={(r) => {
              if (index === 0) registerTarget('create-activity-photos', r);
            }}
            style={[styles.photoBtn, photoCount > 0 && styles.photoBtnActive]}
            onPress={() => setPhotoPickerFor(item.id)}
            activeOpacity={0.85}
          >
            <Icon name="camera" size={18} color={photoCount > 0 ? colors.white : colors.primary} />
            {photoCount > 0 && (
              <View style={styles.photoBtnBadge}>
                <Text style={styles.photoBtnBadgeText}>{photoCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.activityBody}>
            <View style={styles.activityTitleRow}>
              {item.lat && item.lng && (
                <View style={styles.locationPin}>
                  <Icon name="map" size={12} color={colors.white} />
                </View>
              )}
              <TextInput
                value={item.title}
                onChangeText={(t) => {
                  setActivities((a) => a.map((x) => (x.id === item.id ? { ...x, title: t } : x)));
                  autoFormatActivity(item.id, t);
                }}
                style={[
                  styles.activityInput,
                  { color: colors.text },
                  item.completed && styles.activityInputCompleted,
                ]}
                placeholder="Activity title"
                placeholderTextColor={colors.muted}
              />
            </View>

            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => setExpandedActivity(isExpanded ? null : item.id)}
            >
              <Icon
                name={isExpanded ? 'chevronUp' : 'chevronDown'}
                size={16}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.deleteBtn} onPress={() => removeActivity(item.id)}>
            <Icon name="delete" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <TextInput
              value={item.notes}
              onChangeText={(t) => updateActivity(item.id, { notes: t })}
              placeholder="Add notes..."
              placeholderTextColor={colors.muted}
              style={[styles.notesInput, { color: colors.text, backgroundColor: colors.background }]}
            />

            {/* Photos — build the Trip Recap timeline */}
            <View style={styles.photosSection}>
              <View style={styles.photosHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Photos</Text>
                  <Text style={[styles.photosHint, { color: colors.muted }]}>
                    These build your visual Trip Recap timeline
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.photosAddBtn}
                  onPress={() => setPhotoPickerFor(item.id)}
                  activeOpacity={0.85}
                >
                  <Icon name="camera" size={14} color={colors.white} />
                  <Text style={styles.photosAddText}>Add</Text>
                </TouchableOpacity>
              </View>
              {photoCount === 0 ? (
                <TouchableOpacity
                  style={[styles.photosEmpty, { borderColor: colors.border }]}
                  onPress={() => setPhotoPickerFor(item.id)}
                  activeOpacity={0.85}
                >
                  <Icon name="image" size={22} color={colors.primary} />
                  <Text style={[styles.photosEmptyText, { color: colors.muted }]}>
                    Tap to add photos — they show up in Trip Recaps
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.photosGrid}>
                  {(item.photos || []).map((p) => (
                    <View key={p.id} style={styles.photoCell}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setPhotoLightbox(p.base64 ? `data:image/jpeg;base64,${p.base64}` : p.uri)}
                      >
                        <Image
                          source={{ uri: p.base64 ? `data:image/jpeg;base64,${p.base64}` : p.uri }}
                          style={styles.photoCellImg}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.photoCellRemove}
                        onPress={() => removeActivityPhoto(item.id, p.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Icon name="close" size={12} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.photoCellAdd, { borderColor: colors.border }]}
                    onPress={() => setPhotoPickerFor(item.id)}
                    activeOpacity={0.85}
                  >
                    <Icon name="plus" size={22} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.linksSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Links</Text>
                <TouchableOpacity onPress={() => addLink(item.id)}>
                  <Icon name="plus" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {item.links?.map((link) => (
                <View key={link.id} style={[styles.linkItem, { backgroundColor: colors.background }]}>
                  <TextInput
                    value={link.title}
                    onChangeText={(t) => updateLink(item.id, link.id, { title: t })}
                    placeholder="Link title"
                    placeholderTextColor={colors.muted}
                    style={[styles.linkInput, { color: colors.text }]}
                  />
                  <TextInput
                    value={link.url}
                    onChangeText={(t) => updateLink(item.id, link.id, { url: t })}
                    placeholder="URL"
                    placeholderTextColor={colors.muted}
                    style={[styles.linkInput, { color: colors.text }]}
                  />
                  <TouchableOpacity onPress={() => removeLink(item.id, link.id)}>
                    <Icon name="close" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
        </Pressable>
      </Animated.View>
    );
  };

  const filteredActivities = activities.filter((a) => a.day === selectedDay);
  const addressActivity = activities.find((a) => a.id === addressModalId) || null;

  // ---- Overview editor ----
  const addSection = () => setOverview((prev) => [...prev, { id: genId('sec'), title: '', items: [] }]);
  const removeSection = (id: string) => setOverview((prev) => prev.filter((s) => s.id !== id));
  const updateSectionTitle = (id: string, t: string) =>
    setOverview((prev) => prev.map((s) => (s.id === id ? { ...s, title: t } : s)));

  const makeOverviewItem = (type: OverviewItem['type']): OverviewItem => {
    if (type === 'note') return { id: genId('note'), type, text: '', bullets: false };
    if (type === 'media') return { id: genId('media'), type, uri: '', base64: undefined };
    if (type === 'place') return { id: genId('place'), type, name: '', lat: 0, lng: 0, address: undefined, photoUrl: undefined };
    return { id: genId('pack'), type, title: '', items: [] };
  };

  const addOverviewItem = (sectionId: string, type: OverviewItem['type']) => {
    const item = makeOverviewItem(type);
    setOverview((prev) => prev.map((s) => (s.id === sectionId ? { ...s, items: [...s.items, item] } : s)));
    if (type === 'media') {
      setTimeout(() => pickOverviewMedia(sectionId, item.id), 300);
    }
  };

  const updateOverviewItem = (sectionId: string, itemId: string, patch: any) =>
    setOverview((prev) => prev.map((s) => (s.id === sectionId ? { ...s, items: s.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : s)));

  const removeOverviewItem = (sectionId: string, itemId: string) =>
    setOverview((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        let items = s.items.filter((it) => it.id !== itemId);
        // Keep Highlight numbers contiguous (1, 2, 3...) after a deletion.
        if (sectionId === 'highlights') {
          let n = 0;
          items = items.map((it) =>
            it.type === 'place' && (it as OverviewPlace).number !== undefined
              ? { ...it, number: ++n }
              : it
          ) as OverviewItem[];
        }
        return { ...s, items };
      })
    );

  const pickOverviewMedia = async (sectionId: string, itemId: string) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.4, base64: true });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        updateOverviewItem(sectionId, itemId, { uri: asset.uri, base64: asset.base64 });
      }
    } catch (e) {
      console.warn('Media pick failed:', e);
    }
  };

  const packingItems = (sectionId: string, itemId: string): { id: string; text: string; checked: boolean }[] => {
    const sec = overview.find((x) => x.id === sectionId);
    const it = sec?.items.find((x) => x.id === itemId);
    return it && it.type === 'packing' ? (it as OverviewPacking).items : [];
  };
  const addPackingItem = (sectionId: string, itemId: string) =>
    updateOverviewItem(sectionId, itemId, { items: [...packingItems(sectionId, itemId), { id: genId('pki'), text: '', checked: false }] });
  const updatePackingItem = (sectionId: string, itemId: string, pkId: string, patch: any) =>
    updateOverviewItem(sectionId, itemId, { items: packingItems(sectionId, itemId).map((x) => (x.id === pkId ? { ...x, ...patch } : x)) });
  const removePackingItem = (sectionId: string, itemId: string, pkId: string) =>
    updateOverviewItem(sectionId, itemId, { items: packingItems(sectionId, itemId).filter((x) => x.id !== pkId) });

  const renderOverviewItem = (sectionId: string, item: OverviewItem) => {
    if (item.type === 'note') {
      const text = item.bullets
        ? item.text
            .split('\n')
            .map((line) => (line.trim() ? `\u2022 ${line}` : ''))
            .join('\n')
        : item.text;
      return (
        <View key={item.id} style={styles.overviewItem}>
          <View style={styles.overviewItemHeader}>
            <Text style={[styles.overviewItemLabel, { color: theme.colors.muted }]}>Note</Text>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <TouchableOpacity onPress={() => updateOverviewItem(sectionId, item.id, { bullets: !item.bullets })}>
                <Text style={{ color: item.bullets ? colors.primary : theme.colors.muted, fontWeight: '700', fontSize: 12 }}>{'• Bullets'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeOverviewItem(sectionId, item.id)}>
                <Icon name="close" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
          <TextInput
            style={[styles.overviewNoteInput, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            value={text}
            onChangeText={(t) => updateOverviewItem(sectionId, item.id, { text: t })}
            placeholder="Write your note..."
            placeholderTextColor={theme.colors.muted}
            multiline
            textAlignVertical="top"
          />
        </View>
      );
    }
    if (item.type === 'media') {
      return (
        <View key={item.id} style={styles.overviewItem}>
          <View style={styles.overviewItemHeader}>
            <Text style={[styles.overviewItemLabel, { color: theme.colors.muted }]}>Media</Text>
            <TouchableOpacity onPress={() => removeOverviewItem(sectionId, item.id)}>
              <Icon name="close" size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
          {item.uri || item.base64 ? (
            <Image source={{ uri: item.base64 ? `data:image/jpeg;base64,${item.base64}` : item.uri }} style={styles.overviewMedia} resizeMode="cover" />
          ) : (
            <TouchableOpacity style={styles.overviewMediaPicker} onPress={() => pickOverviewMedia(sectionId, item.id)} activeOpacity={0.85}>
              <Icon name="camera" size={22} color={colors.primary} />
              <Text style={[styles.overviewMediaText, { color: theme.colors.muted }]}>Add media</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    if (item.type === 'place') {
      return (
        <View key={item.id} style={styles.overviewItem}>
          <View style={styles.overviewItemHeader}>
            <Text style={[styles.overviewItemLabel, { color: theme.colors.muted }]}>Place</Text>
            <TouchableOpacity onPress={() => removeOverviewItem(sectionId, item.id)}>
              <Icon name="close" size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
          {item.name ? (
            <View style={styles.overviewPlace}>
              {item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.overviewPlaceImg} resizeMode="cover" /> : null}
              {item.number ? (
                <View style={styles.overviewPlaceNumRow}>
                  <View style={styles.overviewPlaceNum}>
                    <Text style={styles.overviewPlaceNumText}>{item.number}</Text>
                  </View>
                  <Text style={[styles.overviewPlaceName, { color: theme.colors.text }]}>{item.name}</Text>
                </View>
              ) : (
                <Text style={[styles.overviewPlaceName, { color: theme.colors.text }]}>{item.name}</Text>
              )}
              {item.address ? (
                <Text style={[styles.overviewPlaceAddr, { color: theme.colors.muted }]} numberOfLines={1}>{item.address}</Text>
              ) : null}
              {item.description ? (
                <Text style={styles.overviewPlaceDesc} numberOfLines={2}>{firstSentence(item.description)}</Text>
              ) : null}
            </View>
          ) : (
            <CityPicker
              selected={[]}
              onChange={() => {}}
              citiesOnly={false}
              placeholder="Search any place..."
              onPickOne={(pl) => updateOverviewItem(sectionId, item.id, { name: pl.name, lat: pl.lat, lng: pl.lng, address: pl.address, photoUrl: pl.photoUrl })}
            />
          )}
        </View>
      );
    }
    const pk = item as OverviewPacking;
    return (
      <View key={item.id} style={styles.overviewItem}>
        <View style={styles.overviewItemHeader}>
          <Text style={[styles.overviewItemLabel, { color: theme.colors.muted }]}>Packing List</Text>
          <TouchableOpacity onPress={() => removeOverviewItem(sectionId, item.id)}>
            <Icon name="close" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
        <TextInput
          style={[styles.overviewTitleInput, { color: theme.colors.text }]}
          value={pk.title}
          onChangeText={(t) => updateOverviewItem(sectionId, item.id, { title: t })}
          placeholder="List title (e.g. Beach day)"
          placeholderTextColor={theme.colors.muted}
        />
        {pk.items.map((x) => (
          <View key={x.id} style={styles.packingRow}>
            <TouchableOpacity onPress={() => updatePackingItem(sectionId, item.id, x.id, { checked: !x.checked })} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Icon name={x.checked ? 'check' : 'close'} size={16} color={x.checked ? colors.success : theme.colors.muted} />
            </TouchableOpacity>
            <TextInput
              style={[styles.packingInput, { color: theme.colors.text, textDecorationLine: x.checked ? 'line-through' : 'none' }]}
              value={x.text}
              onChangeText={(t) => updatePackingItem(sectionId, item.id, x.id, { text: t })}
              placeholder="Item"
              placeholderTextColor={theme.colors.muted}
            />
            <TouchableOpacity onPress={() => removePackingItem(sectionId, item.id, x.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Icon name="close" size={14} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addPackingBtn} onPress={() => addPackingItem(sectionId, item.id)} activeOpacity={0.85}>
          <Icon name="plus" size={14} color={colors.primary} />
          <Text style={styles.addPackingText}>Add item</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderOverview = () => {
    const recCity = cities.find((c) => (c.id || c.name) === recCityId) || cities[0] || null;
    const recKey = recCity ? (recCity.id || recCity.name) : '';
    const recState = recData[recKey] || { places: [], food: [], hidden: [], loading: false };
    // Keep hidden gems out of the "Places" tab even if a search returns the same spot.
    const hiddenKeys = new Set(
      (recState.hidden || []).map((h) => (h.id ? `id:${h.id}` : `n:${(h.name || '').toLowerCase()}`))
    );
    const recItems =
      recTab === 'food'
        ? recState.food
        : recTab === 'hidden'
        ? recState.hidden
        : (recState.places || []).filter((p) => {
            const key = p.id ? `id:${p.id}` : `n:${(p.name || '').toLowerCase()}`;
            return !hiddenKeys.has(key);
          });
    const displayRecLoading = recState.loading && recItems.length === 0;
    return (
    <View style={styles.overviewWrap}>
      {/* City recommendations — Places / Food / Hidden Gems tabs + per-city dropdown.
          Tap + to add places & hidden gems to Highlights, or food to the Food section */}
      <View style={[styles.recCard, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity style={styles.recHeader} onPress={() => setRecExpanded((v) => !v)} activeOpacity={0.8}>
          <Text style={[styles.recTitle, { color: theme.colors.text }]}>
            {cities.length === 0
              ? 'Place recommendations'
              : recCity
              ? `Recommended in ${recCity.name}`
              : 'Place recommendations'}
          </Text>
          <Icon name={recExpanded ? 'chevronUp' : 'chevronDown'} size={20} color={theme.colors.muted} />
        </TouchableOpacity>

        {recExpanded ? (
          <>
            {cities.length > 1 ? (
              <TouchableOpacity style={styles.recCityRow} onPress={() => setRecDropdownVisible(true)} activeOpacity={0.8}>
                <Icon name="map" size={14} color={colors.primary} />
                <Text style={[styles.recCityText, { color: theme.colors.text }]} numberOfLines={1}>
                  {recCity?.name || cities[0]?.name}
                </Text>
                <Icon name="chevronDown" size={16} color={theme.colors.muted} />
              </TouchableOpacity>
            ) : null}

            <View style={styles.recTabs}>
              {(['places', 'food', 'hidden'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.recTab, recTab === t && styles.recTabActive]}
                  onPress={() => setRecTab(t)}
                  activeOpacity={0.85}
                >
                  <Icon name={t === 'places' ? 'compass' : t === 'food' ? 'restaurant' : 'star'} size={15} color={recTab === t ? colors.white : theme.colors.muted} />
                  <Text style={[styles.recTabText, { color: recTab === t ? colors.white : theme.colors.muted }]}>
                    {t === 'places' ? 'Places' : t === 'food' ? 'Food' : 'Hidden Gems'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {cities.length === 0 ? (
              <Text style={[styles.recHint, { color: theme.colors.muted }]}>
                Add your destination above, then tap + to build your Highlights.
              </Text>
            ) : !recCity ? (
              <Text style={[styles.recHint, { color: theme.colors.muted }]}>
                Select a city above to see recommendations.
              </Text>
            ) : displayRecLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
            ) : recItems.length === 0 ? (
              <Text style={[styles.recHint, { color: theme.colors.muted }]}>
                No {recTab === 'food' ? 'food' : recTab === 'hidden' ? 'hidden gem' : 'place'} recommendations found — add highlights from your activities below.
              </Text>
            ) : (
              recItems.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.recRow}
                  onPress={() => (recTab === 'food' ? addFoodFromRecommendation(r) : addHighlightFromRecommendation(r))}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recName, { color: theme.colors.text }]} numberOfLines={1}>{r.name}</Text>
                    {r.address ? (
                      <Text style={[styles.recAddr, { color: theme.colors.muted }]} numberOfLines={1}>{r.address}</Text>
                    ) : null}
                  </View>
                  <View style={styles.recAddBtn}>
                    <Icon name="plus" size={16} color={colors.white} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <Text style={[styles.recHint, { color: theme.colors.muted }]}>
            {recCity ? `${recCity.name} recommendations ready — tap to expand.` : 'Recommendations ready — tap to expand.'}
          </Text>
        )}
      </View>

      {overview.length === 0 ? (
        <Text style={[styles.overviewEmpty, { color: theme.colors.muted }]}>Add a section to start building your overview.</Text>
      ) : null}
      {overview.map((section, si) => (
        <View key={section.id || `sec-${si}`} style={[styles.overviewSection, { backgroundColor: theme.colors.card }]}>
          <View style={styles.overviewSectionHeader}>
            <TextInput
              style={[styles.overviewTitleInput, { color: theme.colors.text }]}
              value={section.title}
              onChangeText={(t) => updateSectionTitle(section.id, t)}
              placeholder="Section title"
              placeholderTextColor={theme.colors.muted}
            />
            <TouchableOpacity
              onPress={() =>
                setCollapsedSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))
              }
            >
              <Icon name={collapsedSections[section.id] ? 'chevronDown' : 'chevronUp'} size={18} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeSection(section.id)}>
              <Icon name="close" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
          {!collapsedSections[section.id] && (
            <>
              {section.items.map((item) => renderOverviewItem(section.id, item))}
              <View style={styles.addItemRow}>
                {(['note', 'media', 'place', 'packing'] as const).map((t) => (
                  <TouchableOpacity key={t} style={styles.addItemChip} onPress={() => addOverviewItem(section.id, t)} activeOpacity={0.85}>
                    <Icon name={t === 'note' ? 'document' : t === 'media' ? 'camera' : t === 'place' ? 'location' : 'check'} size={14} color={colors.primary} />
                    <Text style={styles.addItemChipText}>{t === 'note' ? 'Note' : t === 'media' ? 'Media' : t === 'place' ? 'Place' : 'Packing List'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      ))}
      <TouchableOpacity style={[styles.addSectionBtn, { backgroundColor: theme.colors.card }]} onPress={addSection} activeOpacity={0.9}>
        <Icon name="plus" size={18} color={colors.primary} />
        <Text style={styles.addSectionText}>Add Section</Text>
      </TouchableOpacity>
      {saveButton}
    </View>
  );
  };

  const saveButton = (
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={async () => {
                // Load existing to preserve createdAt
                const existing = editId ? await tripService.getTripById(editId) : null;
                const itinerary = {
                  id: draftId,
                  title,
                  destinations: destinations.split(',').map((s) => s.trim()),
                  coverImage: getCoverImageValue(),
                  season: season || undefined,
                  budget: budget || undefined,
                  activities,
                  dayNotes,
                  expenses,
                  overview,
                  budgetCurrency,
                  userId: user?.id,
                  createdAt: existing?.createdAt || Date.now(), // Preserve original creation date
                };

                // Check itinerary limit for free users (max 5)
                if (!isPro && !user?.isPro) {
                  const userItins = await tripService.getItineraries(user?.id);
                  // Count only non-edit itineraries (exclude the current one if editing)
                  const existingCount = userItins.filter((i: any) => i.id !== draftId).length;
                  if (existingCount >= 5) {
                    Alert.alert(
                      'Itinerary Limit Reached',
                      'Free users can only have 5 itineraries. Upgrade to Waybound Pro for unlimited itineraries!',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                        text: 'Upgrade to Pro',
                          onPress: presentPaywall,
                        },
                      ]
                    );
                    return;
                  }

                  // Free users must watch a rewarded ad to save
                  Alert.alert(
                    'Watch Ad to Save',
                    'As a free user, you can save your itinerary by watching a short ad. Upgrade to Waybound Pro to save instantly!',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Watch Ad & Save',
                        onPress: async () => {
                          const earned = await adService.showRewardedAd();
                          if (earned) {
                            await tripService.saveTrip(itinerary);
                            // Persist the invite list server-side too.
                            communityService.syncCollaborators(draftId, collaborators).catch(() => {});
                            posthog?.capture('itinerary_saved', {
                              activity_count: activities.length,
                              destination_count: itinerary.destinations.filter(Boolean).length,
                              access_tier: 'free',
                              save_method: 'rewarded_ad',
                            });
                            (navigation as any).navigate('ItineraryVisibility', { id: draftId });
                          } else {
                            Alert.alert('Ad Not Completed', 'You need to watch the full ad to save. Please try again.');
                          }
                        },
                      },
                    ]
                  );
                  return;
                }

                // Pro users save directly
                await tripService.saveTrip(itinerary);
                // Persist the invite list server-side too.
                communityService.syncCollaborators(draftId, collaborators).catch(() => {});
                posthog?.capture('itinerary_saved', {
                  activity_count: activities.length,
                  destination_count: itinerary.destinations.filter(Boolean).length,
                  access_tier: 'pro',
                  save_method: 'direct',
                });
                (navigation as any).navigate('ItineraryVisibility', { id: draftId });
              }}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[colors.success, '#3BDB8A']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Icon name="save" size={16} color={colors.white} />
              <Text style={styles.actionText}>Save Itinerary</Text>
            </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <CoverBanner
        scrollY={scrollY}
        expandedHeight={BANNER_EXPANDED}
        collapsedHeight={BANNER_COLLAPSED}
        coverUri={
          coverImageBase64
            ? `data:image/jpeg;base64,${coverImageBase64}`
            : coverImageUrl || cities[0]?.photoUrl || ''
        }
        kicker="Build your trip"
        title="Create Itinerary"
        subtitle="Plan your trip day by day — cities, activities, and photos."
        actions={
          <>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: theme.colors.card }]}
              onPress={pickImage}
              activeOpacity={0.85}
            >
              <Icon
                name={coverImageBase64 || coverImageUrl || cities[0]?.photoUrl ? 'image' : 'camera'}
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: theme.colors.card }]}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Icon name="share" size={18} color={colors.primary} />
            </TouchableOpacity>
          </>
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.ScrollView
          ref={(r) => registerTarget('create-scroll', r)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!draggingId}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: insets.top + BANNER_EXPANDED, paddingBottom: 120 }}
        >
          {/* Trip Details Form */}
          <View style={[styles.formCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.label, { color: theme.colors.text, marginTop: spacing.md }]}>Trip title</Text>
            <View
              collapsable={false}
              ref={(r) => registerTarget('create-title', r)}
              style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            >
              <Icon name="itinerary" size={16} color={theme.colors.muted} />
              <TextInput
                style={[styles.inputField, { color: theme.colors.text }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Trip Title"
                placeholderTextColor={theme.colors.muted}
              />
            </View>

            <Text style={[styles.label, { color: theme.colors.text }]}>Destinations</Text>
            <View collapsable={false} ref={(r) => registerTarget('create-dest', r)} style={{ marginBottom: spacing.lg }}>
              <CityPicker
                selected={cities}
                onChange={(sel) => {
                  setCities(sel);
                  setDestinations(sel.map((c) => c.name).join(', '));
                  enrichCityPhotos(sel);
                }}
              />
            </View>

            <Text style={[styles.label, { color: theme.colors.text }]}>Season (Optional)</Text>
            <View style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Icon name="calendar" size={16} color={theme.colors.muted} />
              <TextInput
                style={[styles.inputField, { color: theme.colors.text }]}
                value={season}
                onChangeText={setSeason}
                placeholder="e.g. Summer, Winter, Spring, Fall"
                placeholderTextColor={theme.colors.muted}
              />
            </View>
          </View>

          {/* Trip Recap photo menu (per activity) */}
          <Modal
            visible={!!photoPickerFor}
            transparent
            animationType="slide"
            onRequestClose={() => setPhotoPickerFor(null)}
          >
            <View style={styles.photoMenuOverlay}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setPhotoPickerFor(null)} />
              <View style={[styles.photoMenuCard, { backgroundColor: theme.colors.card }]}>
                <View style={styles.photoMenuHandle} />
                <Text style={[styles.photoMenuTitle, { color: theme.colors.text }]}>Add Photos</Text>
                <Text style={[styles.photoMenuSub, { color: theme.colors.muted }]} numberOfLines={1}>
                  {activities.find((a) => a.id === photoPickerFor)?.title || 'Activity'} — photos build your Trip Recap
                </Text>
                <TouchableOpacity
                  style={[styles.photoMenuOption, { backgroundColor: theme.colors.background }]}
                  onPress={() => {
                    const id = photoPickerFor;
                    setPhotoPickerFor(null);
                    if (id) pickPhotosForActivity(id);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.photoMenuIcon, { backgroundColor: colors.primarySoft }]}>
                    <Icon name="image" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.photoMenuOptionText}>
                    <Text style={[styles.photoMenuOptionTitle, { color: theme.colors.text }]}>
                      Choose from Library
                    </Text>
                    <Text style={[styles.photoMenuOptionSub, { color: theme.colors.muted }]}>
                      Select one or more photos
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={20} color={theme.colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoMenuOption, { backgroundColor: theme.colors.background }]}
                  onPress={() => {
                    const id = photoPickerFor;
                    setPhotoPickerFor(null);
                    if (id) takePhotoForActivity(id);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.photoMenuIcon, { backgroundColor: '#FF6B9D20' }]}>
                    <Icon name="camera" size={20} color={colors.accent} />
                  </View>
                  <View style={styles.photoMenuOptionText}>
                    <Text style={[styles.photoMenuOptionTitle, { color: theme.colors.text }]}>Take Photo</Text>
                    <Text style={[styles.photoMenuOptionSub, { color: theme.colors.muted }]}>
                      Snap a picture with your camera
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={20} color={theme.colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoMenuCancel, { backgroundColor: theme.colors.background }]}
                  onPress={() => setPhotoPickerFor(null)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.photoMenuCancelText, { color: theme.colors.muted }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Trip Recap photo lightbox */}
          <Modal
            visible={!!photoLightbox}
            transparent
            animationType="fade"
            onRequestClose={() => setPhotoLightbox(null)}
          >
            <View style={styles.photoLightboxOverlay}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setPhotoLightbox(null)} />
              {photoLightbox ? (
                <Image source={{ uri: photoLightbox }} style={styles.photoLightboxImg} resizeMode="contain" />
              ) : null}
              <TouchableOpacity style={styles.photoLightboxClose} onPress={() => setPhotoLightbox(null)}>
                <Icon name="close" size={24} color={colors.white} />
              </TouchableOpacity>
            </View>
          </Modal>

          <Modal visible={showCollabModal} transparent animationType="slide" onRequestClose={() => setShowCollabModal(false)}>
            <View style={styles.collabModalOverlay}>
              <View style={[styles.collabModalCard, { backgroundColor: theme.colors.card }]}>
                <View style={styles.collabModalHeader}>
                  <Text style={[styles.collabModalTitle, { color: theme.colors.text }]}>Add Collaborator</Text>
                  <TouchableOpacity onPress={() => setShowCollabModal(false)}>
                    <Icon name="close" size={22} color={theme.colors.muted} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.collabModalHint, { color: theme.colors.muted }]}>
                  Search for a Waybound user by name or email to invite them, then pick a role.
                </Text>
                {/* Role picker */}
                <Text style={[styles.collabModalSection, { color: theme.colors.muted }]}>Role</Text>
                <View style={styles.collabRoleRow}>
                  <TouchableOpacity
                    style={[styles.collabRoleChip, collabRole === 'editor' && styles.collabRoleChipActive]}
                    onPress={() => setCollabRole('editor')}
                    activeOpacity={0.8}
                  >
                    <Icon name="edit" size={14} color={collabRole === 'editor' ? colors.white : colors.muted} />
                    <Text style={[styles.collabRoleChipText, { color: collabRole === 'editor' ? colors.white : colors.muted }]}>Editor</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.collabRoleChip, collabRole === 'admin' && styles.collabRoleChipActive]}
                    onPress={() => setCollabRole('admin')}
                    activeOpacity={0.8}
                  >
                    <Icon name="star" size={14} color={collabRole === 'admin' ? colors.white : colors.muted} />
                    <Text style={[styles.collabRoleChipText, { color: collabRole === 'admin' ? colors.white : colors.muted }]}>Admin</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.collabRoleHint, { color: theme.colors.muted }]}>
                  {collabRole === 'admin'
                    ? 'Admins can edit and manage collaborators.'
                    : 'Editors can edit the trip, but not manage collaborators.'}
                </Text>
                <View style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Icon name="search" size={16} color={theme.colors.muted} />
                  <TextInput
                    style={[styles.inputField, { color: theme.colors.text }]}
                    value={collabQuery}
                    onChangeText={searchCollabs}
                    placeholder="Name or email"
                    placeholderTextColor={theme.colors.muted}
                    autoFocus
                  />
                </View>
                <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
                  {collaborators.length > 0 && (
                    <View style={{ marginBottom: spacing.md }}>
                      <Text style={[styles.collabModalSection, { color: theme.colors.muted }]}>Invited</Text>
                      {collaborators.map((collab) => (
                        <View key={collab.id} style={[styles.collabResultRow, { borderColor: theme.colors.border }]}>
                          <View style={[styles.collabAvatar, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.collabAvatarText, { color: colors.primary }]}>
                              {(collab.name?.[0] || '?').toUpperCase()}
                            </Text>
                          </View>
                          <Text style={[styles.collabResultName, { color: theme.colors.text }]} numberOfLines={1}>{collab.name}</Text>
                          <TouchableOpacity
                            onPress={() => updateCollaboratorRole(collab, collab.role === 'admin' ? 'editor' : 'admin')}
                            style={[styles.collabRoleBadge, { backgroundColor: (collab.role === 'admin' ? '#F59E0B' : '#8B5CF6') + '20' }]}
                          >
                            <Text style={[styles.collabRoleBadgeText, { color: collab.role === 'admin' ? '#B45309' : colors.primary }]}>
                              {collab.role === 'admin' ? 'Admin' : 'Editor'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={async () => {
                              await communityService.removeCollaborator(draftId, collab.id);
                              setCollaborators(prev => prev.filter(c => c.id !== collab.id));
                            }}
                          >
                            <Icon name="close" size={18} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {collabResults.length > 0 ? (
                    collabResults.map((u: any) => (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.collabResultRow, { borderColor: theme.colors.border }]}
                        onPress={() => addCollaboratorUser(u)}
                      >
                        <View style={[styles.collabAvatar, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.collabAvatarText, { color: colors.primary }]}>
                            {(u.name?.[0] || '?').toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.collabResultName, { color: theme.colors.text }]}>{u.name}</Text>
                        </View>
                        <Icon name="plus" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={[styles.noCollabText, { color: theme.colors.muted, textAlign: 'center', paddingVertical: 20 }]}>
                      {collabQuery.trim() ? 'No users found. Ask them to create a Waybound account first.' : 'Type a name or email to search.'}
                    </Text>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
          {/* Overview / Itinerary tabs */}
          <View ref={(r) => registerTarget('create-tabs', r)} collapsable={false} style={styles.tabRow}>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]} onPress={() => setActiveTab('overview')} activeOpacity={0.85}>
              <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'itinerary' && styles.tabBtnActive]} onPress={() => setActiveTab('itinerary')} activeOpacity={0.85}>
              <Text style={[styles.tabText, activeTab === 'itinerary' && styles.tabTextActive]}>Itinerary</Text>
            </TouchableOpacity>
          </View>
          {/* Toolbar */}
          <View style={[styles.toolbarRow, { paddingHorizontal: compact ? spacing.lg : spacing.xl, gap: compact ? 8 : 10 }]}>
            <TouchableOpacity style={[styles.toolbarBtn, compact && styles.toolbarBtnCompact, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={() => setMapVisible(true)} activeOpacity={0.85}>
              <View style={[styles.toolbarIconWrap, compact && styles.toolbarIconWrapCompact, { backgroundColor: '#3B82F620' }]}>
                <Icon name="map" size={compact ? 16 : 18} color="#3B82F6" />
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.toolbarText, { fontSize: fs(12, scale) }, { color: theme.colors.text }]}>Map View</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolbarBtn, compact && styles.toolbarBtnCompact, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={() => setExpensesVisible(true)} activeOpacity={0.85}>
              <View style={[styles.toolbarIconWrap, compact && styles.toolbarIconWrapCompact, { backgroundColor: '#F59E0B20' }]}>
                <Icon name="currency" size={compact ? 16 : 18} color="#F59E0B" />
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.toolbarText, { fontSize: fs(12, scale) }, { color: theme.colors.text }]}>Expenses</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolbarBtn, compact && styles.toolbarBtnCompact, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={() => (navigation as any).navigate('DocumentsVault')} activeOpacity={0.85}>
              <View style={[styles.toolbarIconWrap, compact && styles.toolbarIconWrapCompact, { backgroundColor: '#8B5CF620' }]}>
                <Icon name="document" size={compact ? 16 : 18} color="#8B5CF6" />
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.toolbarText, { fontSize: fs(12, scale) }, { color: theme.colors.text }]}>Documents</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'itinerary' ? (
            <>
          {/* Day Selector */}
          <View ref={(r) => registerTarget('create-day', r)} collapsable={false} style={styles.daySelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              <TouchableOpacity style={[styles.dayChip, styles.addDayChip, { borderColor: theme.colors.border }]} onPress={addDay}>
                <Icon name="plus" size={18} color={colors.primary} />
              </TouchableOpacity>
              {days.map((day) => {
                const dayColor = getDayColor(day);
                const isSelected = selectedDay === day;
                const isNew = day === lastAddedDayRef.current;
                const chip = (
                  <TouchableOpacity
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: isSelected ? dayColor : theme.colors.card,
                        borderColor: isSelected ? dayColor : theme.colors.border,
                      }
                    ]}
                    onPress={() => setSelectedDay(day)}
                  >
                    <Text style={[
                      styles.dayChipText,
                      { color: isSelected ? colors.white : theme.colors.text }
                    ]}>
                      Day {day}
                    </Text>
                  </TouchableOpacity>
                );
                return isNew ? (
                  <Animated.View
                    key={day}
                    style={{
                      transform: [{ scale: addDayAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
                      opacity: addDayAnim,
                    }}
                  >
                    {chip}
                  </Animated.View>
                ) : (
                  <View key={day}>{chip}</View>
                );
              })}
            </ScrollView>
          </View>

          {/* Day Notes / Description */}
          <View style={styles.dayNotesWrap}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Day {selectedDay} Notes
            </Text>
            <TextInput
              value={dayNotes[selectedDay] || ''}
              onChangeText={(t) => setDayNotes((prev) => ({ ...prev, [selectedDay]: t }))}
              placeholder={`Add a description or notes for Day ${selectedDay}...`}
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.dayNotesInput, { color: colors.text, backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            />
          </View>


          {/* Activities Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Activities</Text>
          </View>

          {filteredActivities.map((item, index) => renderActivity(item, index))}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.primaryBtn]}
                onPress={addActivity}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[colors.primary, '#7985FF']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Icon name="plus" size={16} color={colors.white} />
                <Text style={styles.actionText}>Add Activity</Text>
              </TouchableOpacity>
            </View>

            {saveButton}
          </View>
            </>
          ) : (
            <>{renderOverview()}</>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={searchVisible} animationType="slide">
        <View style={[styles.modal, { paddingTop: insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Location</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSearchVisible(false)}>
              <Icon name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <PlaceSearch onSelect={handleSelectPlace} />
        </View>
      </Modal>

      <Modal visible={mapVisible} animationType="slide">
        <View style={[styles.modal, { paddingTop: insets.top + 8, paddingHorizontal: 0 }]}>
          <View style={[styles.modalHeader, { paddingHorizontal: spacing.xl }]}>
            <Text style={styles.modalTitle}>Trip Map</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setMapVisible(false)}>
              <Icon name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
            <TripMap
              points={activities
                .filter((a) => a.lat && a.lng)
                .map((a) => ({ lat: a.lat!, lng: a.lng!, title: a.title, color: getDayColor(a.day), day: a.day }))}
              highlightIndex={highlightIndex}
              onMarkerPress={(i) => setHighlightIndex(i)}
            />
          </View>
        </View>
      </Modal>

      {/* Per-activity Address Modal */}
      <Modal visible={!!addressModalId} animationType="slide">
        <View style={[styles.modal, { paddingTop: insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Save Address</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setAddressModalId(null)}>
              <Icon name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: spacing.xl, flex: 1 }}>
            <PlaceSearch
              onSelect={handleAddressSelect}
              initialQuery={addressActivity?.address || ''}
            />
          </View>
          <View style={{ flex: 1, marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>
            {addressActivity && addressActivity.lat && addressActivity.lng ? (
              <TripMap
                points={[{ lat: addressActivity.lat!, lng: addressActivity.lng!, title: addressActivity.title, color: getDayColor(addressActivity.day), day: addressActivity.day }]}
                actionLabel="Save"
                onAction={() => setAddressModalId(null)}
              />
            ) : (
              <View style={styles.addressEmptyMap}>
                <Icon name="map" size={36} color={colors.muted} />
                <Text style={[styles.addressEmptyText, { color: colors.muted }]}>
                  Search above and select a place to see it on the map.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <ExpensesModal
        visible={expensesVisible}
        onClose={() => setExpensesVisible(false)}
        budgetAmount={parseFloat(budget) || 0}
        budgetCurrency={budgetCurrency}
        onBudgetChange={(amt, cur) => { setBudget(amt > 0 ? String(amt) : ''); setBudgetCurrency(cur); }}
        expenses={expenses}
        onExpensesChange={setExpenses}
      />

      {/* City dropdown for recommendations (multiple destinations) */}
      <Modal visible={recDropdownVisible} transparent animationType="fade" onRequestClose={() => setRecDropdownVisible(false)}>
        <TouchableOpacity style={styles.recDropdownOverlay} activeOpacity={1} onPress={() => setRecDropdownVisible(false)}>
          <View style={[styles.recDropdownCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.recDropdownTitle, { color: theme.colors.text }]}>Recommended in</Text>
            {cities.map((c) => {
              const key = c.id || c.name;
              const active = key === recCityId;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.recDropdownRow, active && { backgroundColor: colors.primarySoft }]}
                  onPress={() => {
                    setRecCityId(key);
                    setRecDropdownVisible(false);
                    loadRecommendationsFor(c);
                  }}
                  activeOpacity={0.85}
                >
                  <Icon name="location" size={16} color={active ? colors.primary : theme.colors.muted} />
                  <Text style={[styles.recDropdownRowText, { color: theme.colors.text, fontWeight: active ? '800' : '500' }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  {active ? <Icon name="check" size={16} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, ...shadows.soft },
  inviteText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', ...shadows.soft },
  bannerWrap: { width: '100%', height: 200, marginBottom: spacing.md, position: 'relative' },
  bannerImage: { width: '100%', height: '100%' },
  bannerChangeBtn: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(10,16,30,0.55)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  bannerChangeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  collabModalSection: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  addressEmptyMap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  addressEmptyText: { textAlign: 'center', fontSize: 14 },
  kicker: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  formCard: { marginHorizontal: spacing.xl, borderRadius: radius.xxl, padding: spacing.xl, ...shadows.card },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4, borderRadius: radius.md, marginBottom: 12 },
  inputField: { flex: 1, paddingVertical: 10, fontSize: 15 },
  daySelector: { paddingHorizontal: spacing.xl, marginTop: spacing.lg, marginBottom: spacing.md },
  dayChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, minWidth: 80, alignItems: 'center' },
  dayChipText: { fontSize: 14, fontWeight: '700' },
  addDayChip: { backgroundColor: 'transparent', minWidth: 44, width: 44, paddingHorizontal: 0 },
  dayNotesWrap: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  dayNotesInput: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, minHeight: 72, fontSize: 14, textAlignVertical: 'top', marginTop: spacing.sm },
  toolbarRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: spacing.xl, marginTop: spacing.sm, marginBottom: spacing.sm },
  toolbarBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.full, borderWidth: 1, borderColor: 'transparent' },
  toolbarBtnCompact: { gap: 6, paddingHorizontal: 8, paddingVertical: 10 },
  toolbarIconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolbarIconWrapCompact: { width: 24, height: 24, borderRadius: 12 },
  toolbarText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, marginTop: spacing.sm, marginBottom: spacing.sm },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radius.full, backgroundColor: colors.card },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 15, fontWeight: '700', color: colors.muted },
  tabTextActive: { color: colors.white },
  overviewWrap: { paddingHorizontal: spacing.xl, gap: spacing.md },
  overviewEmpty: { textAlign: 'center', fontSize: 14, marginVertical: spacing.xl },
  recCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: 6,
    ...shadows.soft,
  },
  recTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  recHint: {
    fontSize: 13,
    marginTop: 2,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  recName: {
    fontSize: 14,
    fontWeight: '700',
  },
  recAddr: {
    fontSize: 11,
    marginTop: 1,
  },
  recAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // City dropdown for recommendations (multiple destinations)
  recCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  recCityText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  recTabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  recTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  recTabText: { fontSize: 12, fontWeight: '700', flexShrink: 0 },
  recDropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  recDropdownCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadows.card },
  recDropdownTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  recDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  recDropdownRowText: { flex: 1, fontSize: 15 },
  overviewSection: { borderRadius: radius.xl, padding: spacing.md, ...shadows.soft, gap: spacing.sm },
  overviewSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  overviewTitleInput: { flex: 1, fontSize: 16, fontWeight: '800', paddingVertical: 4 },
  overviewItem: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm, backgroundColor: colors.background },
  overviewItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overviewItemLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  overviewNoteInput: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, minHeight: 90, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  overviewMedia: { width: '100%', height: 160, borderRadius: radius.md },
  overviewMediaPicker: { height: 90, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 6 },
  overviewMediaText: { fontSize: 13, fontWeight: '600' },
  overviewPlace: { gap: 8 },
  overviewPlaceImg: { width: '100%', height: 170, borderRadius: radius.md },
  overviewPlaceName: { fontSize: 15, fontWeight: '700' },
  overviewPlaceAddr: { fontSize: 12, marginTop: 2 },
  overviewPlaceNumRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  overviewPlaceNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewPlaceNumText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  overviewPlaceDesc: { fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 4 },
  packingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  packingInput: { flex: 1, fontSize: 14, paddingVertical: 6 },
  addPackingBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  addPackingText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  addItemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  addItemChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  addItemChipText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  addSectionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.lg, paddingVertical: 14, marginBottom: spacing.md },
  addSectionText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  sectionHeader: { paddingHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  sectionHint: { fontSize: 12, fontWeight: '600' },
  activity: { marginBottom: 12, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', marginHorizontal: spacing.xl, ...shadows.soft },
  activityDragging: { ...shadows.card, shadowColor: '#0F172A', shadowOpacity: 0.25, shadowRadius: 18, elevation: 14, borderColor: colors.primary },
  activityContent: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: 10 },
  mapBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  mapBtnActive: { backgroundColor: colors.primary },
  activityBody: { flex: 1 },
  activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  locationPin: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  locationPinText: { fontSize: 16 },
  activityInput: { flex: 1, fontSize: 15, fontWeight: '700', padding: 0 },
  activityInputCompleted: { textDecorationLine: 'line-through', opacity: 0.6 },
  expandBtn: { marginTop: 4 },
  deleteBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center' },
  // Camera button + photo grid for Trip Recap photos
  photoBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoBtnActive: { backgroundColor: colors.primary },
  photoBtnBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  photoBtnBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  photosSection: { gap: spacing.sm },
  photosHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  photosHint: { fontSize: 11, marginTop: 2 },
  photosAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  photosAddText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  photosEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  photosEmptyText: { fontSize: 12, fontWeight: '600' },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoCell: { width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden', position: 'relative' },
  photoCellImg: { width: '100%', height: '100%' },
  photoCellRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCellAdd: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Photo menu bottom sheet
  photoMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,15,30,0.55)',
    justifyContent: 'flex-end',
  },
  photoMenuCard: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
    ...shadows.deep,
  },
  photoMenuHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  photoMenuTitle: { fontSize: 20, fontWeight: '800' },
  photoMenuSub: { fontSize: 13, marginTop: -8 },
  photoMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  photoMenuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMenuOptionText: { flex: 1 },
  photoMenuOptionTitle: { fontSize: 15, fontWeight: '700' },
  photoMenuOptionSub: { fontSize: 12, marginTop: 2 },
  photoMenuCancel: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.full,
  },
  photoMenuCancelText: { fontSize: 14, fontWeight: '700' },
  // Photo lightbox
  photoLightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoLightboxImg: { width: '100%', height: '100%' },
  photoLightboxClose: {
    position: 'absolute',
    top: 54,
    right: spacing.xl,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  notesInput: { borderRadius: radius.md, padding: spacing.md, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  linksSection: { gap: spacing.sm },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: spacing.xs },
  linkItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.sm, borderRadius: radius.md },
  linkInput: { flex: 1, fontSize: 13, paddingVertical: 4 },
  actions: { marginTop: 8, gap: 10, paddingBottom: 140, paddingHorizontal: spacing.xl },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.full },
  primaryBtn: { flex: 2, overflow: 'hidden', ...shadows.fab },
  secondaryBtn: { flex: 1, backgroundColor: colors.primarySoft },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.full, overflow: 'hidden', ...shadows.fab },
  actionText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  secondaryText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  modal: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  modalClose: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadows.soft },
  imagePreviewContainer: { position: 'relative', marginBottom: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  imagePreview: { width: '100%', height: 200, borderRadius: radius.lg },
  removeImageBtn: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  uploadButton: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.md },
  uploadButtonGradient: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  uploadButtonText: { flex: 1 },
  uploadTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  uploadSubtitle: { fontSize: 13, fontWeight: '500' },
  hiddenEmojiInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  collabSectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  collabHint: { fontSize: 12, marginTop: 4 },
  addCollabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  addCollabText: { fontSize: 14, fontWeight: '700' },
  collabList: { gap: 8, marginTop: spacing.md },
  collabChip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: 1 },
  collabAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  collabAvatarText: { fontSize: 14, fontWeight: '800' },
  collabName: { flex: 1, fontSize: 14, fontWeight: '600' },
  noCollabText: { fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  collabModalOverlay: { flex: 1, backgroundColor: 'rgba(8,15,30,0.5)', justifyContent: 'center', paddingHorizontal: spacing.xl },
  collabModalCard: { borderRadius: radius.lg, padding: spacing.lg, ...shadows.card },
  collabModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  collabModalTitle: { fontSize: 18, fontWeight: '800' },
  collabModalHint: { fontSize: 13, marginBottom: spacing.md },
  collabResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.sm,
  },
  collabResultName: { flex: 1, fontSize: 14, fontWeight: '700' },
  collabResultEmail: { fontSize: 12, marginTop: 1 },
  collabRoleRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  collabRoleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  collabRoleChipActive: {
    backgroundColor: colors.primary,
  },
  collabRoleChipText: { fontSize: 13, fontWeight: '700' },
  collabRoleHint: { fontSize: 12, marginBottom: spacing.md },
  collabRoleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  collabRoleBadgeText: { fontSize: 12, fontWeight: '700' },
  buyProCollabBtn: {
    marginTop: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    overflow: 'hidden',
  },
  buyProCollabText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default CreateItineraryScreen;