import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import tripService from '../services/tripService';
import { communityService } from '../services/communityService';
import notificationService from '../services/notificationService';
import { exportPDF, exportICS, exportCSV, exportPNGCard, exportShareableLink } from '../services/exportService';
import { Icon } from '../components/Icon';
import TripMap from '../components/TripMap';
import ExpensesModal from '../components/ExpensesModal';
import { colors, radius, shadows, spacing } from '../theme/theme';
import { AuthContext } from '../context/AuthContext';
import { useRevenueCat } from '../context/RevenueCatContext';
import { useResponsive, fs } from '../utils/responsive';

const { width } = Dimensions.get('window');

/** Shorten a possibly long description to a single sentence for compact cards. */
function firstSentence(desc?: string): string {
  if (!desc) return '';
  const trimmed = desc.trim().replace(/\s+/g, ' ');
  const end = trimmed.indexOf('. ');
  const sentence = end > 0 ? trimmed.slice(0, end + 1) : trimmed;
  return sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence;
}

/** Open the given coordinates in the platform maps app. */
const openInMaps = (lat: number, lng: number, label?: string) => {
  const url = Platform.select({
    ios: `maps:0,0?q=${encodeURIComponent(label || `${lat},${lng}`)}@${lat},${lng}`,
    android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(label || 'Location')})`,
  });
  if (url) Linking.openURL(url).catch(() => {});
};

// Accent colors for numbered guide overview sections.
const SECTION_COLORS = ['#5B67F5', '#FF6B9D', '#3B82F6', '#F59E0B', '#22C55E', '#8B5CF6', '#EC4899', '#14B8A6'];

// Day colors (matches the create-itinerary palette)
const DAY_COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];
const getDayColor = (day: number) => DAY_COLORS[(day - 1) % DAY_COLORS.length];

const TripDetailScreen: React.FC<any> = ({ route, navigation }) => {
  const { id } = route.params || {};
  const [trip, setTrip] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [viewDay, setViewDay] = useState<number | null>(null);
  const [expensesVisible, setExpensesVisible] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const insets = useSafeAreaInsets();
  const { scale, compact } = useResponsive();
  const { user } = useContext(AuthContext);
  const { isPro, presentPaywall } = useRevenueCat();

  useEffect(() => {
    let timeout: any;
    (async () => {
      try {
        // Try community first for Firestore-based community itineraries
        let t: any = await communityService.getCommunityItineraryById(id);
        // Fall back to local
        if (!t) {
          t = await tripService.getItineraryById(id);
        }
        if (t) { setTrip(t); setLoadError(false); }
        else { setTrip(null); setLoadError(true); }
        if (t && user) {
          // Owner check: match userId, authorId, or email
          setIsOwner(
            t.userId === user.id || 
            t.userId === user.email || 
            t.authorId === user.id ||
            t.authorId === user.email
          );
          // Fallback: the trip exists in this user's local library, so they own it
          // (covers trips created before sign-in or with mismatched id/email).
          try {
            const mine = await tripService.getItineraries();
            if (mine.some((i: any) => i.id === t.id)) setIsOwner(true);
          } catch (_) {}
        }
      } catch (e) {
        console.warn('Failed to load trip:', e);
        setTrip(null);
        setLoadError(true);
      }
    })();
    timeout = setTimeout(() => {
      if (!trip) setLoadError(true);
    }, 10000);
    return () => clearTimeout(timeout);
  }, [id, user]);

  if (!trip) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        {loadError ? (
          <>
            <Text style={[styles.loadingText, { marginBottom: 16 }]}>Could not load trip</Text>
            <TouchableOpacity
              style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 }}
              onPress={() => navigation.goBack()}
            >
              <Text style={{ color: colors.white, fontWeight: '700' }}>Go Back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.loadingText}>Loading trip...</Text>
        )}
      </View>
    );
  }

  const isGuide = trip.kind === 'guide' && !Array.isArray(trip.activities);
  // User-created itineraries (they always have userId) are treated as
  // itineraries even if they have no activities yet — never as template trips.
  // A saved copy that inherited `kind: "guide"` from the source still renders as
  // an itinerary when it carries `activities` (see saveTripAsCustomizable).
  const isItinerary = !isGuide && (Array.isArray(trip.activities) || !!trip.userId);
  const dayCount = isItinerary
    ? (new Set((trip.activities || []).map((a: any) => a.day).filter(Boolean)).size || (trip.userId ? 1 : 0))
    : trip.days?.length || 0;
  const spotCount = isItinerary ? trip.destinations?.length || 0 : trip.highlights?.length || 0;
  const highlightCount = isItinerary ? trip.activities?.length || 0 : trip.highlights?.length || 0;
  const mapPins = isGuide
    ? (trip.guide?.overview || []).flatMap((s: any) =>
        (s.items || [])
          .filter((it: any) => it.type === 'place' && it.lat && it.lng)
          .map((it: any) => ({ lat: it.lat, lng: it.lng, title: it.name, day: undefined }))
      )
    : (trip?.activities || []).filter((a: any) => a.lat && a.lng);

  // Guide-specific derived data for the reader experience.
  const guideCities: any[] = trip.guide?.cities || (trip.destinations || []).map((n: string) => ({ name: n }));
  const guideBlurb: string = trip.guide?.blurb || trip.description || '';

  const dayVals: number[] = ((trip?.activities || []) as any[]).map((a: any) => a.day).filter((d: any): d is number => typeof d === 'number');
  const dayNumbers: number[] = [...new Set(dayVals)].sort((a, b) => a - b);
  // Default to the first day without a hook (avoids conditional-hook error after the early return above)
  const effectiveViewDay = viewDay ?? (dayNumbers[0] ?? null);
  const visibleActivities = effectiveViewDay ? (trip?.activities || []).filter((a: any) => a.day === effectiveViewDay) : (trip?.activities || []);

  const handleDelete = () => {
    Alert.alert(
      'Delete Itinerary',
      'Are you sure you want to delete this itinerary?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await tripService.deleteItinerary(trip.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handlePublish = () => {
    Alert.alert(
      'Publish to Community',
      'Would you like to publish this itinerary to the community for others to see?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            try {
              await communityService.publishItinerary({
                ...trip,
                authorName: user?.name || 'Anonymous',
                authorId: user?.id,
                authorAvatar: (user as any)?.avatarUrl,
              });
              Alert.alert('Success', 'Your itinerary has been published to the community!');
            } catch (e) {
              console.warn('Failed to publish to community', e);
              Alert.alert('Error', 'Failed to publish. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleExportPress = () => {
    if (!isPro && !user?.isPro) {
      Alert.alert(
        'Pro Feature',
        'Exporting is exclusive to Waybound Pro. Upgrade to export in all formats!',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => presentPaywall() },
        ]
      );
      return;
    }
    const formatOptions = [
      { text: 'Export as PDF', onPress: () => exportPDF(trip) },
      { text: 'Export as ICS (Calendar)', onPress: () => exportICS(trip) },
      { text: 'Export as CSV', onPress: () => exportCSV(trip) },
      { text: 'Export as PNG Card', onPress: () => exportPNGCard(trip) },
      { text: 'Shareable Link', onPress: () => exportShareableLink(trip) },
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert('Export Itinerary', 'Choose an export format:', formatOptions);
  };

  // Save any trip (official, community, or user) as a customizable copy
  const handleSaveCustomizable = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save and customize itineraries.');
      return;
    }

    try {
      const customTrip = await tripService.saveTripAsCustomizable(
        trip,
        user.id,
        user.name || 'User'
      );

      // If saving a community itinerary, record the save server-side so
      // the 'Most Saved' sort reflects it
      if (trip.authorId && trip.id) {
        try {
          const saves = trip.saves || [];
          if (!saves.includes(user.id)) {
            const updatedSaves = [...saves, user.id];
            await communityService.updateItinerary(trip.id, { saves: updatedSaves });
          }
        } catch (_) {}
      }
      
      Alert.alert(
        'Saved!',
        'This itinerary has been saved to your library. You can now customize it however you like!',
        [
          {
            text: 'View in Library',
            onPress: () => (navigation as any).navigate('Main', { screen: 'Library' }),
          },
          {
            text: 'Edit Now',
            onPress: () => (navigation as any).navigate('Create', { editId: customTrip.id }),
          },
        ]
      );
    } catch (e) {
      console.error('Failed to save customizable trip:', e);
      Alert.alert('Error', 'Failed to save itinerary. Please try again.');
    }
  };

  // Like a community itinerary
  const handleLike = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to like itineraries.');
      return;
    }

    try {
      // Toggle like
      const likes = trip.likes || [];
      const isLiked = likes.includes(user.id);
      
      if (isLiked) {
        // Unlike
        const updatedLikes = likes.filter((id: string) => id !== user.id);
        await communityService.updateItinerary(trip.id, { likes: updatedLikes });
        setTrip({ ...trip, likes: updatedLikes });
      } else {
        // Like
        const updatedLikes = [...likes, user.id];
        await communityService.updateItinerary(trip.id, { likes: updatedLikes });
        setTrip({ ...trip, likes: updatedLikes });
        
        // Notify the owner
        if (trip.authorId && trip.authorId !== user.id) {
          await notificationService.notifyItineraryLike(
            trip.authorId,
            user.id,
            user.name || 'Someone',
            trip.id,
            trip.title
          );
        }
      }
    } catch (e) {
      console.error('Failed to like itinerary:', e);
    }
  };

  const renderQuickActions = () => (
    <View style={[styles.quickRow, { gap: compact ? 8 : 10 }]}>
      <TouchableOpacity style={[styles.quickBtn, compact && styles.quickBtnCompact]} activeOpacity={0.85} onPress={() => setMapVisible(true)}>
        <View style={[styles.quickIconWrap, compact && styles.quickIconWrapCompact, { backgroundColor: '#3B82F620' }]}>
          <Icon name="map" size={compact ? 16 : 18} color="#3B82F6" />
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.quickBtnText, { fontSize: fs(12, scale) }]}>Map</Text>
      </TouchableOpacity>
      {!isGuide && (
        <>
          <TouchableOpacity style={[styles.quickBtn, compact && styles.quickBtnCompact]} activeOpacity={0.85} onPress={() => setExpensesVisible(true)}>
            <View style={[styles.quickIconWrap, compact && styles.quickIconWrapCompact, { backgroundColor: '#F59E0B20' }]}>
              <Icon name="currency" size={compact ? 16 : 18} color="#F59E0B" />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.quickBtnText, { fontSize: fs(12, scale) }]}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, compact && styles.quickBtnCompact]} activeOpacity={0.85} onPress={() => (navigation as any).navigate('DocumentsVault')}>
            <View style={[styles.quickIconWrap, compact && styles.quickIconWrapCompact, { backgroundColor: '#8B5CF620' }]}>
              <Icon name="document" size={compact ? 16 : 18} color="#8B5CF6" />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.quickBtnText, { fontSize: fs(12, scale) }]}>Documents</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  // Enhanced guide overview + gallery rendering (shared by the guide branch
  // and regular itineraries that carry an overview).
  const renderOverviewSections = () => {
    const sections = trip.guide?.overview || trip.overview || [];
    if (sections.length === 0) return null;
    return (
      <View style={styles.overviewBlock}>
        {isGuide && (
          <View style={styles.guideSectionHeading}>
            <Icon name="compass" size={16} color={colors.primary} />
            <Text style={styles.guideSectionHeadingText}>Guide Overview</Text>
          </View>
        )}
        {sections.map((section: any, si: number) => (
          <View key={section.id || `sec-${si}`} style={styles.ovSection}>
            {section.title ? (
              <View style={styles.ovSectionTitleRow}>
                <View style={[styles.ovSectionNum, { backgroundColor: SECTION_COLORS[si % SECTION_COLORS.length] }]}>
                  <Text style={styles.ovSectionNumText}>{si + 1}</Text>
                </View>
                <Text style={styles.ovTitle}>{section.title}</Text>
              </View>
            ) : null}
            <View style={styles.ovSectionBody}>
              {section.items.map((item: any, ii: number) => {
                if (item.type === 'note') {
                  if (item.bullets) {
                    const lines = item.text.split('\n').filter((l: string) => l.trim());
                    if (lines.length === 0) return null;
                    return (
                      <View key={item.id || `it-${si}-${ii}`} style={styles.ovBulletList}>
                        {lines.map((l: string, i: number) => (
                          <View key={i} style={styles.ovBulletRow}>
                            <View style={[styles.ovBulletDot, { backgroundColor: SECTION_COLORS[si % SECTION_COLORS.length] }]} />
                            <Text style={styles.ovNote}>{l}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  }
                  return <Text key={item.id || `it-${si}-${ii}`} style={styles.ovNote}>{item.text}</Text>;
                }
                if (item.type === 'media') {
                  return item.uri || item.base64 ? (
                    <TouchableOpacity
                      key={item.id || `it-${si}-${ii}`}
                      activeOpacity={0.9}
                      onPress={() => setLightboxUri(item.base64 ? `data:image/jpeg;base64,${item.base64}` : item.uri)}
                    >
                      <Image source={{ uri: item.base64 ? `data:image/jpeg;base64,${item.base64}` : item.uri }} style={styles.ovMedia} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : null;
                }
                if (item.type === 'place') {
                  return (
                    <View key={item.id || `it-${si}-${ii}`} style={styles.ovPlace}>
                      {item.photoUrl ? (
                        <TouchableOpacity activeOpacity={0.9} onPress={() => setLightboxUri(item.photoUrl)}>
                          <Image source={{ uri: item.photoUrl }} style={styles.ovPlaceImg} resizeMode="cover" />
                        </TouchableOpacity>
                      ) : null}
                      <Text style={styles.ovPlaceName}>{item.name}</Text>
                      {item.address ? <Text style={styles.ovPlaceAddr} numberOfLines={1}>{item.address}</Text> : null}
                      {item.description ? (
                        <Text style={styles.ovPlaceDesc} numberOfLines={2}>{firstSentence(item.description)}</Text>
                      ) : null}
                      {item.lat && item.lng ? (
                        <TouchableOpacity style={styles.ovPlaceMapBtn} onPress={() => openInMaps(item.lat, item.lng, item.name)} activeOpacity={0.85}>
                          <Icon name="location" size={13} color="#3B82F6" />
                          <Text style={styles.ovPlaceMapText}>Open in Maps</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                }
                return (
                  <View key={item.id || `it-${si}-${ii}`} style={styles.ovPacking}>
                    {item.title ? <Text style={styles.ovPackingTitle}>{item.title}</Text> : null}
                    <View style={styles.ovPackingBox}>
                      {item.items.map((x: any, xi: number) => (
                        <View key={x.id || `pk-${si}-${ii}-${xi}`} style={styles.ovPackingRow}>
                          <View style={[styles.ovPackingCheck, x.checked && styles.ovPackingCheckOn]}>
                            <Icon name="check" size={12} color={x.checked ? colors.white : 'transparent'} />
                          </View>
                          <Text style={[styles.ovPackingText, x.checked && styles.ovPackingDone]}>{x.text}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderGallery = () => {
    const media = trip.guide?.gallery || [];
    if (media.length === 0) return null;
    return (
      <View style={styles.overviewBlock}>
        <View style={styles.guideSectionHeading}>
          <Icon name="camera" size={16} color={colors.primary} />
          <Text style={styles.guideSectionHeadingText}>Photos ({media.length})</Text>
        </View>
        <View style={styles.galleryGrid}>
          {media.map((m: any) => (
            <TouchableOpacity
              key={m.id}
              style={styles.galleryCell}
              activeOpacity={0.85}
              onPress={() => setLightboxUri(m.base64 ? `data:image/jpeg;base64,${m.base64}` : m.uri)}
            >
              <Image source={{ uri: m.base64 ? `data:image/jpeg;base64,${m.base64}` : m.uri }} style={styles.galleryImg} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.heroWrap}>
          {(trip.coverImage || trip.image) && !heroImgFailed ? (
            <Image
              source={{ uri: trip.coverImage || trip.image }}
              style={styles.hero}
              resizeMode="cover"
              onError={() => setHeroImgFailed(true)}
            />
          ) : (
            <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.hero} />
          )}

          <LinearGradient
            colors={['rgba(8,15,30,0.45)', 'transparent', 'rgba(8,15,30,0.75)']}
            style={styles.heroGradient}
          />
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => navigation.goBack()}
          >
            <View style={styles.btnInner}>
              <Icon name="back" size={22} color={colors.white} />
            </View>
          </TouchableOpacity>

           {/* Share — always top-right */}
           <TouchableOpacity
             style={[styles.editBtn, { top: insets.top + 8 }]}
             onPress={() => exportShareableLink(trip)}
           >
             <View style={styles.btnInner}>
               <Icon name="share" size={20} color={colors.white} />
             </View>
           </TouchableOpacity>

           {/* Pen — owners edit, everyone else saves an editable copy */}
           <TouchableOpacity
             style={[styles.editBtn, { top: insets.top + 8, right: 66 }]}
             onPress={() => {
               if (isOwner) {
                 (navigation as any).navigate(isGuide ? 'TravelGuide' : 'Create', { editId: trip.id });
               } else {
                 handleSaveCustomizable();
               }
             }}
           >
             <View style={styles.btnInner}>
               <Icon name="edit" size={20} color={colors.white} />
             </View>
           </TouchableOpacity>

           {/* Compact map view button (public trips & any trip with pins) */}
           {mapPins.length > 0 && (
             <TouchableOpacity
               style={[styles.editBtn, { top: insets.top + 8, right: 116 }]}
               onPress={() => setMapVisible(true)}
             >
               <View style={styles.btnInner}>
                 <Icon name="map" size={20} color={colors.white} />
               </View>
             </TouchableOpacity>
           )}

           {/* Like overlay button for community itineraries */}
           {trip.authorId && !isOwner && (
             <TouchableOpacity
               style={[styles.likeOverlayBtn, { top: insets.top + 8, right: 166 }]}
               onPress={handleLike}
               activeOpacity={0.8}
             >
               <View style={styles.btnInner}>
                 <Icon
                   name={(trip.likes || []).includes(user?.id) ? 'heartFilled' : 'heart'}
                   size={20}
                   color={(trip.likes || []).includes(user?.id) ? colors.danger : colors.white}
                 />
               </View>
             </TouchableOpacity>
           )}
          <View style={styles.heroContent}>
            <View style={styles.heroTagRow}>
              <View
                style={[
                  styles.heroGuideBadge,
                  { backgroundColor: isGuide ? colors.accent : '#8B5CF6' },
                ]}
              >
                <Icon name={isGuide ? 'bookmark' : 'itinerary'} size={12} color={colors.white} />
                <Text style={styles.heroTagText}>{isGuide ? 'GUIDE' : 'ITINERARY'}</Text>
              </View>
              <View style={styles.heroTag}>
                <Icon name="location" size={12} color={colors.white} />
                <Text style={styles.heroTagText}>
                  {isGuide
                    ? guideCities.map((c: any) => c.name).join(', ') || trip.destinations?.join(', ') || 'Travel Guide'
                    : isItinerary ? trip.destinations?.join(', ') || 'Custom Trip' : trip.country}
                </Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{trip.title}</Text>
            {trip.authorName && (
              <View style={styles.creatorInfo}>
                <Icon name="user" size={14} color={colors.white} />
                <Text style={styles.creatorText}>by {trip.authorName}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.sheet}>
          {isGuide ? (
            <>
              {/* Cities covered by the guide */}
              {guideCities.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: spacing.sm }}>
                  {guideCities.map((c: any, i: number) => (
                    <View key={`${c.id || c.name}-${i}`} style={[styles.guideCityChip, { backgroundColor: SECTION_COLORS[i % SECTION_COLORS.length] + '1A' }]}>
                      <Icon name="location" size={13} color={SECTION_COLORS[i % SECTION_COLORS.length]} />
                      <Text style={[styles.guideCityText, { color: SECTION_COLORS[i % SECTION_COLORS.length] }]}>{c.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* From the author */}
              {guideBlurb.trim() ? (
                <View style={styles.guideBlurbCard}>
                  <View style={styles.guideBlurbHeader}>
                    <View style={styles.guideBlurbIcon}>
                      <Icon name="edit" size={14} color={colors.primary} />
                    </View>
                    <Text style={styles.guideBlurbLabel}>From the author</Text>
                  </View>
                  <Text style={styles.guideBlurbText}>{guideBlurb.trim()}</Text>
                </View>
              ) : null}

              {renderQuickActions()}
              {renderOverviewSections()}
              {renderGallery()}

              {isOwner ? (
                <View style={styles.ownerActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.publishBtn]}
                    onPress={handlePublish}
                    activeOpacity={0.9}
                  >
                    <Icon name="globe" size={16} color={colors.white} />
                    <Text style={styles.actionBtnText}>Publish</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={handleDelete}
                    activeOpacity={0.9}
                  >
                    <Icon name="delete" size={16} color={colors.white} />
                    <Text style={styles.actionBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.save}
                  activeOpacity={0.9}
                  onPress={handleSaveCustomizable}
                >
                  <LinearGradient
                    colors={[colors.primary, '#7985FF']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  <Icon name="save" size={18} color={colors.white} />
                  <Text style={styles.saveText}>Save to Library</Text>
                </TouchableOpacity>
              )}
            </>
          ) : isItinerary ? (
            <>
              <View style={styles.chipsRow}>
                {trip.isActive && (
                  <LinearGradient colors={['#DCFCE7', '#E8FCEF']} style={styles.chip}>
                    <Icon name="check" size={14} color="#16A34A" />
                    <Text style={[styles.chipText, { color: '#15803D' }]}>Active</Text>
                  </LinearGradient>
                )}
                <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.chip}>
                  <Icon name="calendar" size={14} color={colors.primary} />
                  <Text style={[styles.chipText, { color: colors.primary }]}>
                    {dayCount} Days
                  </Text>
                </LinearGradient>
              </View>
              {(trip.season || trip.budget) && (
                <View style={styles.metaCard}>
                  {trip.season && (
                    <View style={styles.metaItem}>
                      <Icon name="calendar" size={16} color={colors.primary} />
                      <Text style={styles.metaLabel}>Season</Text>
                      <Text style={styles.metaValue}>{trip.season}</Text>
                    </View>
                  )}
                  {trip.budget && (
                    <>
                      {trip.season && <View style={styles.metaDivider} />}
                      <View style={styles.metaItem}>
                        <Icon name="currency" size={16} color={colors.primary} />
                        <Text style={styles.metaLabel}>Budget</Text>
                        <Text style={styles.metaValue}>${trip.budget}</Text>
                      </View>
                    </>
                  )}
                </View>
              )}

              {renderQuickActions()}

              {renderOverviewSections()}
              {renderGallery()}

              {/* Day tabs for viewers (same colors as the original) */}
              {dayNumbers.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: spacing.md }}>
                  {dayNumbers.map((day) => {
                    const color = getDayColor(day);
                    const active = effectiveViewDay === day;
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[styles.dayTab, { borderColor: color, backgroundColor: active ? color : 'transparent' }]}
                        onPress={() => setViewDay(day)}
                      >
                        <Text style={[styles.dayTabText, { color: active ? '#fff' : color }]}>Day {day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {effectiveViewDay != null && trip.dayNotes?.[effectiveViewDay] ? (
                <View style={styles.dayNotesCard}>
                  <Text style={styles.dayNotesText}>{trip.dayNotes[effectiveViewDay]}</Text>
                </View>
              ) : null}

              <Text style={styles.sectionLabel}>Activities</Text>
              <View style={styles.timeline}>
                {visibleActivities?.length === 0 ? (
                  <View style={styles.emptyTimelineContainer}>
                    <Icon name="itinerary" size={48} color={colors.muted} />
                    <Text style={styles.emptyTimeline}>Nothing to see here yet</Text>
                    <Text style={styles.emptyTimelineSub}>Add activities to your itinerary</Text>
                  </View>
                ) : (
                  visibleActivities?.map((activity: any, i: number) => {
                    const dayColor = activity.day ? getDayColor(activity.day) : colors.primary;
                    return (
                      <View key={activity.id} style={styles.timelineItem}>
                        <View style={styles.timelineLeft}>
                          <LinearGradient
                            colors={[dayColor, dayColor]}
                            style={[styles.timelineDot]}
                          />
                          {i < (visibleActivities?.length || 0) - 1 && <View style={styles.timelineLine} />}
                        </View>
                        <View style={styles.timelineCard}>
                          <View style={styles.dayBadgeWrap}>
                            <Text style={styles.dayBadge}>Day {activity.day || effectiveViewDay || i + 1}</Text>
                          </View>
                          <Text style={styles.dayTitle}>{activity.title}</Text>
                          {activity.notes && (
                            <Text style={styles.dayActivities}>{activity.notes}</Text>
                          )}
                        {activity.photos && activity.photos.length > 0 && (
                          <View style={styles.activityPhotos}>
                            {activity.photos.map((photo: any) => (
                              <Image
                                key={photo.id}
                                source={{ uri: photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri }}
                                style={styles.activityPhoto}
                              />
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                  })
                )}
              </View>

              {isOwner && (
                <View style={styles.ownerActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.publishBtn]}
                    onPress={handlePublish}
                    activeOpacity={0.9}
                  >
                    <Icon name="globe" size={16} color={colors.white} />
                    <Text style={styles.actionBtnText}>Publish</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.ownerExportBtn]}
                    onPress={handleExportPress}
                    activeOpacity={0.9}
                  >
                    <Icon name="document" size={16} color={colors.white} />
                    <Text style={styles.actionBtnText}>Export</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={handleDelete}
                    activeOpacity={0.9}
                  >
                    <Icon name="delete" size={16} color={colors.white} />
                    <Text style={styles.actionBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isOwner && (
                <TouchableOpacity
                  style={styles.save}
                  activeOpacity={0.9}
                  onPress={handleSaveCustomizable}
                >
                  <LinearGradient
                    colors={[colors.primary, '#7985FF']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  <Icon name="save" size={18} color={colors.white} />
                  <Text style={styles.saveText}>Save & Customize</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <View style={styles.chipsRow}>
                <LinearGradient colors={['#FFE0E0', '#FFF0F0']} style={styles.chip}>
                  <Icon name="calendar" size={14} color="#EF4444" />
                  <Text style={[styles.chipText, { color: '#B91C1C' }]}>
                    {dayCount} Days
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
                    {highlightCount} Highlights
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

              {renderQuickActions()}

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

              {!isOwner && (
                <TouchableOpacity
                  style={styles.save}
                  activeOpacity={0.9}
                  onPress={handleSaveCustomizable}
                >
                  <LinearGradient
                    colors={[colors.primary, '#7985FF']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  <Icon name="save" size={18} color={colors.white} />
                  <Text style={styles.saveText}>Save & Customize</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={mapVisible} animationType="slide" onRequestClose={() => setMapVisible(false)}>
        <View style={[styles.mapModal, { paddingTop: insets.top + 8 }]}>
          <View style={styles.mapModalHeader}>
            <Text style={styles.mapModalTitle}>Trip Map</Text>
            <TouchableOpacity onPress={() => setMapVisible(false)}>
              <Icon name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
            <TripMap
              points={mapPins.map((a: any) => ({
                lat: a.lat,
                lng: a.lng,
                title: a.title,
                color: a.day ? DAY_COLORS[(a.day - 1) % DAY_COLORS.length] : '#EF4444',
                day: a.day,
              }))}
            />
          </View>
        </View>
      </Modal>

      {/* Photo lightbox */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setLightboxUri(null)} />
          {lightboxUri ? <Image source={{ uri: lightboxUri }} style={styles.lightboxImage} resizeMode="contain" /> : null}
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUri(null)}>
            <Icon name="close" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </Modal>

      <ExpensesModal
        visible={expensesVisible}
        onClose={() => setExpensesVisible(false)}
        budgetAmount={parseFloat(trip.budget) || 0}
        budgetCurrency={trip.budgetCurrency || 'USD'}
        onBudgetChange={(amt, cur) => {
          setTrip((prev: any) => ({ ...prev, budget: amt > 0 ? String(amt) : '', budgetCurrency: cur }));
          if (isOwner) tripService.updateItinerary(id, { budget: amt > 0 ? String(amt) : '', budgetCurrency: cur }).catch(() => {});
        }}
        expenses={trip.expenses || []}
        onExpensesChange={(exp) => {
          setTrip((prev: any) => ({ ...prev, expenses: exp }));
          if (isOwner) tripService.updateItinerary(id, { expenses: exp }).catch(() => {});
        }}
      />
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
  },
  editBtn: {
    position: 'absolute',
    right: 16,
  },
  likeOverlayBtn: {
    position: 'absolute',
    right: 16,
  },
  btnInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mapModal: { flex: 1, backgroundColor: colors.background },
  mapModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  mapModalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
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
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  heroGuideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  heroTitle: {
    marginTop: 2,
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  creatorText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
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
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: spacing.xl,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 12,
    ...shadows.soft,
  },
  quickBtnCompact: {
    gap: 4,
    paddingVertical: 10,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconWrapCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
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
  emptyTimelineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTimeline: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyTimelineSub: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
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
  dayTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  dayTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dayNotesCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  dayNotesText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
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
  activityPhotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  activityPhoto: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
  },
  actionButtonsContainer: {
    gap: 10,
    marginTop: 8,
  },
  save: {
    paddingVertical: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    ...shadows.fab,
  },
  likeBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exportBtn: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  overviewBlock: { gap: spacing.md, marginBottom: spacing.xl },
  ovSection: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: 8, ...shadows.soft },
  ovTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  ovNote: { color: colors.text, fontSize: 14, lineHeight: 21 },
  ovMedia: { width: '100%', height: 160, borderRadius: radius.md },
  ovPlace: { gap: 8 },
  ovPlaceImg: { width: '100%', height: 170, borderRadius: radius.md },
  ovPlaceName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  ovPlaceAddr: { color: colors.muted, fontSize: 12, marginTop: 2 },
  ovPlaceDesc: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  galleryCell: { width: '31%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden' },
  galleryImg: { width: '100%', height: '100%' },
  ovPacking: { gap: 6 },
  ovPackingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ovPackingText: { color: colors.text, fontSize: 14, flex: 1 },
  ovPackingDone: { textDecorationLine: 'line-through', color: colors.muted },
  // Guide reader enhancements
  guideSectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  guideSectionHeadingText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  ovSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ovSectionNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovSectionNumText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  ovSectionBody: { gap: 12, marginTop: 2 },
  ovBulletList: { gap: 8 },
  ovBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ovBulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 7,
  },
  ovPlaceMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#3B82F615',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  ovPlaceMapText: { color: '#3B82F6', fontSize: 12, fontWeight: '700' },
  ovPackingTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  ovPackingBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 10,
  },
  ovPackingCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovPackingCheckOn: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  guideCityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  guideCityText: { fontSize: 13, fontWeight: '700' },
  guideBlurbCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.soft,
    marginBottom: spacing.md,
  },
  guideBlurbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  guideBlurbIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBlurbLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  guideBlurbText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: { width: '100%', height: '100%' },
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
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
    ...shadows.fab,
  },
  publishBtn: {
    backgroundColor: colors.primary,
    flex: 1.4,
  },
  ownerExportBtn: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  deleteBtn: {
    backgroundColor: colors.danger,
  },
  actionBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});

export default TripDetailScreen;