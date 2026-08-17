import React, { useEffect, useState, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Share,
  StatusBar,
  Image,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import CityPicker from '../components/CityPicker';
import OverviewEditor, { OverviewSection } from '../components/OverviewEditor';
import TripMap from '../components/TripMap';
import CoverBanner from '../components/CoverBanner';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import { AuthContext } from '../context/AuthContext';
import tripService from '../services/tripService';
import { PlaceResult } from '../services/placesService';

let idCounter = 0;
const genId = (p = 'id') => `${p}-${Date.now()}-${idCounter++}`;

type GuideMedia = { id: string; uri: string; base64?: string };

// Cover banner collapse dimensions (below the status bar).
const BANNER_EXPANDED = 190;
const BANNER_COLLAPSED = 54;

const TravelGuideScreen: React.FC = () => {
  const route = useRoute();
  const editId = (route.params as any)?.editId;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const theme = useContext(ThemeContext);
  const { user } = useContext(AuthContext);

  const scrollY = useRef(new Animated.Value(0)).current;

  const [cities, setCities] = useState<PlaceResult[]>([]);
  const [title, setTitle] = useState('');
  const [blurb, setBlurb] = useState('');
  const [overview, setOverview] = useState<OverviewSection[]>([]);
  const [gallery, setGallery] = useState<GuideMedia[]>([]);
  const [mapVisible, setMapVisible] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  // User-chosen cover image (overrides the city thumbnail fallback).
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageBase64, setCoverImageBase64] = useState('');

  // Load an existing guide for editing
  useEffect(() => {
    (async () => {
      if (!editId) return;
      try {
        const g = await tripService.getTripById(editId);
        if (g) {
          setTitle(g.title || '');
          setBlurb(g.guide?.blurb || '');
          setOverview(g.guide?.overview || []);
          setGallery(g.guide?.gallery || []);
          setCities(
            g.guide?.cities ||
            (g.destinations || []).map((n: string) => ({ id: n, name: n, address: '', lat: 0, lng: 0, types: [] }))
          );
          // Restore a user-chosen cover image (stored as a data URI or URL).
          if (g.coverImage?.startsWith('data:image')) {
            setCoverImageBase64(g.coverImage.split(',')[1] || '');
            setCoverImageUrl('');
          } else if (g.coverImage) {
            setCoverImageUrl(g.coverImage);
            setCoverImageBase64('');
          }
        }
      } catch (e) {
        console.warn('Failed to load guide:', e);
      }
    })();
  }, [editId]);

  const handleSave = async () => {
    if (cities.length === 0) {
      Alert.alert('Add a City', 'Pick at least one city for your guide.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Add a Title', 'Give your guide a title.');
      return;
    }
    try {
      const id = editId || genId('it');
      // User-chosen cover image wins; otherwise fall back to the first city's photo.
      const coverImage = coverImageBase64
        ? `data:image/jpeg;base64,${coverImageBase64}`
        : coverImageUrl || cities[0]?.photoUrl || undefined;
      await tripService.saveTrip({
        id,
        title: title.trim(),
        destinations: cities.map((c) => c.name),
        coverImage,
        kind: 'guide',
        guide: { cities, blurb, overview, gallery },
        activities: [],
        dayNotes: {},
        expenses: [],
        budgetCurrency: 'USD',
        userId: user?.id,
        createdAt: Date.now(),
      });
      // Next: choose public / private.
      (navigation as any).navigate('ItineraryVisibility', { id });
    } catch (e) {
      console.warn('Failed to save guide:', e);
      Alert.alert('Error', 'Could not save the guide. Please try again.');
    }
  };

  const handleShare = async () => {
    const lines: string[] = [];
    if (title.trim()) lines.push(`📖 ${title.trim()}`);
    cities.forEach((c) => lines.push(`📍 ${c.name}`));
    if (blurb.trim()) lines.push(`\n${blurb.trim()}`);
    if (lines.length === 0) {
      Alert.alert('Nothing to Share', 'Add a title and some cities first.');
      return;
    }
    try {
      await Share.share({ message: lines.join('\n') });
    } catch (e) {
      console.warn('Share failed', e);
    }
  };

  const addGalleryMedia = async () => {
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
        const added = result.assets.map((asset: any) => ({
          id: genId('gmed'),
          uri: asset.uri,
          base64: asset.base64,
        }));
        setGallery((prev) => [...prev, ...added]);
      }
    } catch (e) {
      console.warn('Gallery pick failed:', e);
    }
  };

  const removeGalleryMedia = (id: string) => setGallery((prev) => prev.filter((m) => m.id !== id));

  /** Pick a custom cover image (overrides the city thumbnail fallback). */
  const pickCover = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to set a cover photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setCoverImageBase64(asset.base64);
          setCoverImageUrl('');
        } else if (asset.uri) {
          setCoverImageUrl(asset.uri);
          setCoverImageBase64('');
        }
        Alert.alert('Cover Set', 'Your cover image will be used. Cities are used only as a fallback.');
      }
    } catch (e) {
      console.warn('Cover pick failed:', e);
    }
  };

  // Collect every place across all overview sections for the guide map.
  const guideMapPoints = overview.flatMap((s) =>
    (s.items || [])
      .filter((it: any) => it.type === 'place' && it.lat && it.lng)
      .map((it: any) => ({ lat: it.lat, lng: it.lng, title: it.name }))
  );

  // Live draft stats for the save footer.
  const citiesCount = cities.length;
  const sectionsCount = overview.length;
  const mediaCount =
    gallery.length +
    overview.reduce((n, s) => n + (s.items || []).filter((it: any) => it.type === 'media').length, 0);

  // Effective banner image: user-chosen cover first, then the first city's photo.
  const effectiveCover = coverImageBase64
    ? `data:image/jpeg;base64,${coverImageBase64}`
    : coverImageUrl || cities[0]?.photoUrl || '';

  const guideLabel =
    cities.length === 1
      ? `Tell readers how you know ${cities[0].name}`
      : 'Tell readers how you know about these cities';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Collapsible cover banner (share + cover picker actions) */}
      <CoverBanner
        scrollY={scrollY}
        expandedHeight={BANNER_EXPANDED}
        collapsedHeight={BANNER_COLLAPSED}
        coverUri={effectiveCover}
        kicker="Write a guide"
        title="Travel Guide Studio"
        subtitle="Share your city know-how with travelers"
        actions={
          <>
            <TouchableOpacity style={styles.bannerActionBtn} onPress={pickCover} activeOpacity={0.85}>
              <Icon name={effectiveCover ? 'image' : 'camera'} size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.bannerActionBtn} onPress={handleShare} activeOpacity={0.85}>
              <Icon name="share" size={18} color={colors.primary} />
            </TouchableOpacity>
          </>
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: insets.top + BANNER_EXPANDED, paddingBottom: 24 }}
        >
          {/* Step 1 — Destinations */}
          <View style={[styles.formCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardStepBadge}>
                <Text style={styles.cardStepText}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Destinations</Text>
                <Text style={[styles.cardSub, { color: theme.colors.muted }]}>
                  Pick the cities or towns this guide covers.
                </Text>
              </View>
              {citiesCount > 0 && (
                <View style={styles.countChip}>
                  <Text style={styles.countChipText}>{citiesCount}</Text>
                </View>
              )}
            </View>
            <CityPicker selected={cities} onChange={setCities} />
          </View>

          {/* Step 2 — Story */}
          <View style={[styles.formCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardStepBadge}>
                <Text style={styles.cardStepText}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Story</Text>
                <Text style={[styles.cardSub, { color: theme.colors.muted }]}>
                  {guideLabel}
                </Text>
              </View>
            </View>

            <Text style={[styles.label, { color: theme.colors.text }]}>Guide title</Text>
            <View style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Icon name="document" size={16} color={theme.colors.muted} />
              <TextInput
                style={[styles.inputField, { color: theme.colors.text }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. A Local's Guide to Tokyo"
                placeholderTextColor={theme.colors.muted}
                maxLength={70}
              />
              <Text style={[styles.charHint, { color: theme.colors.muted }]}>{title.length}/70</Text>
            </View>

            <Text style={[styles.label, { color: theme.colors.text }]}>From the author</Text>
            <View style={[styles.textAreaWrap, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text }]}
                value={blurb}
                onChangeText={setBlurb}
                placeholder="Share why you love these places, who the guide is for, and what makes it worth reading…"
                placeholderTextColor={theme.colors.muted}
                multiline
                numberOfLines={5}
                maxLength={600}
                textAlignVertical="top"
              />
              <Text style={[styles.charHint, { color: theme.colors.muted, textAlign: 'right' }]}>{blurb.length}/600</Text>
            </View>
          </View>

          {/* Step 3 — Content */}
          <View style={[styles.formCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardStepBadge}>
                <Text style={styles.cardStepText}>3</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Content</Text>
                <Text style={[styles.cardSub, { color: theme.colors.muted }]}>
                  Sections with notes, places, photos & packing lists.
                </Text>
              </View>
              <TouchableOpacity style={styles.mapPreviewBtn} onPress={() => setMapVisible(true)} activeOpacity={0.85}>
                <Icon name="map" size={15} color="#3B82F6" />
                <Text style={styles.mapPreviewText}>Map</Text>
              </TouchableOpacity>
            </View>
            <OverviewEditor value={overview} onChange={setOverview} />
          </View>

          {/* Step 4 — Gallery */}
          <View style={[styles.formCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardStepBadge}>
                <Text style={styles.cardStepText}>4</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Gallery</Text>
                <Text style={[styles.cardSub, { color: theme.colors.muted }]}>
                  Add photos so readers can see what to expect.
                </Text>
              </View>
              <TouchableOpacity style={styles.galleryAddBtn} onPress={addGalleryMedia} activeOpacity={0.85}>
                <Icon name="plus" size={15} color={colors.white} />
                <Text style={styles.galleryAddText}>Add Media</Text>
              </TouchableOpacity>
            </View>
            {gallery.length === 0 ? (
              <TouchableOpacity style={styles.galleryEmpty} onPress={addGalleryMedia} activeOpacity={0.85}>
                <Icon name="camera" size={26} color={colors.primary} />
                <Text style={[styles.galleryEmptyText, { color: theme.colors.muted }]}>Tap to add your own photos</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.galleryGrid}>
                {gallery.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.galleryCell}
                    activeOpacity={0.85}
                    onPress={() => setLightbox(m.base64 ? `data:image/jpeg;base64,${m.base64}` : m.uri)}
                  >
                    <Image source={{ uri: m.base64 ? `data:image/jpeg;base64,${m.base64}` : m.uri }} style={styles.galleryImg} resizeMode="cover" />
                    <TouchableOpacity style={styles.galleryRemove} onPress={() => removeGalleryMedia(m.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Icon name="close" size={14} color={colors.white} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {gallery.length > 0 ? (
              <TouchableOpacity style={styles.galleryAddMore} onPress={addGalleryMedia} activeOpacity={0.85}>
                <Icon name="plus" size={15} color={colors.primary} />
                <Text style={styles.galleryAddMoreText}>Add more photos</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Animated.ScrollView>

        {/* Save footer */}
        <View style={[styles.footer, { backgroundColor: theme.colors.card }]}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={[styles.footerTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {title.trim() || 'Untitled guide'}
            </Text>
            <Text style={[styles.footerSub, { color: theme.colors.muted }]}>
              {citiesCount} cities · {sectionsCount} sections · {mediaCount} photos
            </Text>
          </View>
          <TouchableOpacity style={styles.footerSave} activeOpacity={0.9} onPress={handleSave}>
            <LinearGradient colors={[colors.primary, '#7985FF']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            <Icon name="save" size={16} color={colors.white} />
            <Text style={styles.footerSaveText}>{editId ? 'Save Changes' : 'Save Guide'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Guide Map */}
      <Modal visible={mapVisible} animationType="slide">
        <View style={[styles.modal, { paddingTop: insets.top + 8, paddingHorizontal: 0 }]}>
          <View style={[styles.modalHeader, { paddingHorizontal: spacing.xl }]}>
            <Text style={styles.modalTitle}>Guide Map</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setMapVisible(false)}>
              <Icon name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
            <TripMap
              points={guideMapPoints}
              redPins
              noLines
              showLabels
              actionLabel={guideMapPoints.length > 0 ? `${guideMapPoints.length} places on map` : ' '}
            />
          </View>
        </View>
      </Modal>

      {/* Photo lightbox */}
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setLightbox(null)} />
          {lightbox ? <Image source={{ uri: lightbox }} style={styles.lightboxImg} resizeMode="contain" /> : null}
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightbox(null)}>
            <Icon name="close" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1 },
  // Banner action buttons (rendered inside the collapsible cover banner)
  bannerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  // Step cards
  formCard: { marginHorizontal: spacing.xl, borderRadius: radius.xxl, padding: spacing.xl, ...shadows.card, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.lg },
  cardStepBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStepText: { fontSize: 15, fontWeight: '800', color: colors.primary },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  countChip: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countChipText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4, borderRadius: radius.md, marginBottom: 12 },
  inputField: { flex: 1, paddingVertical: 10, fontSize: 15 },
  charHint: { fontSize: 11, fontWeight: '600' },
  textAreaWrap: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: 12 },
  textArea: { minHeight: 110, fontSize: 14, lineHeight: 20, textAlignVertical: 'top', padding: 0 },
  mapPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#3B82F615',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  mapPreviewText: { color: '#3B82F6', fontSize: 12, fontWeight: '700' },
  saveText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  // Gallery
  galleryAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  galleryAddText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  galleryEmpty: {
    height: 110,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  galleryEmptyText: { fontSize: 13, fontWeight: '600' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  galleryCell: { width: '31%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', position: 'relative' },
  galleryImg: { width: '100%', height: '100%' },
  galleryRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryAddMore: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: spacing.md },
  galleryAddMoreText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  // Save footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerTitle: { fontSize: 14, fontWeight: '800' },
  footerSub: { fontSize: 12, marginTop: 2 },
  footerSave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.full,
    overflow: 'hidden',
    ...shadows.fab,
  },
  footerSaveText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  // Modals
  modal: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  modalClose: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadows.soft },
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  lightboxImg: { width: '100%', height: '100%' },
  lightboxClose: {
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
});

export default TravelGuideScreen;


