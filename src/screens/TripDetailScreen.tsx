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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import tripService from '../services/tripService';
import { communityService } from '../services/communityService';
import notificationService from '../services/notificationService';
import { Icon } from '../components/Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';
import { AuthContext } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const TripDetailScreen: React.FC<any> = ({ route, navigation }) => {
  const { id } = route.params || {};
  const [trip, setTrip] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    tripService.getTripById(id).then((t: any) => {
      setTrip(t);
      if (t && user) {
        setIsOwner(t.userId === user.id || t.userId === user.email);
      }
    });
  }, [id, user]);

  if (!trip) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading trip...</Text>
      </View>
    );
  }

  const isItinerary = !!trip.activities;
  const dayCount = isItinerary ? trip.activities?.length || 0 : trip.days?.length || 0;
  const spotCount = isItinerary ? trip.destinations?.length || 0 : trip.highlights?.length || 0;
  const highlightCount = isItinerary ? trip.activities?.length || 0 : trip.highlights?.length || 0;

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.heroWrap}>
          {(trip.coverImage || trip.image) ? (
            <Image
              source={{ uri: trip.coverImage || trip.image }}
              style={styles.hero}
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
           {/* Edit button for owners or custom copies */}
           {(isOwner || trip.isCustomCopy) && (
             <TouchableOpacity
               style={[styles.editBtn, { top: insets.top + 8 }]}
               onPress={() => (navigation as any).navigate('Create', { editId: trip.id })}
             >
               <View style={styles.btnInner}>
                 <Icon name="edit" size={20} color={colors.white} />
               </View>
             </TouchableOpacity>
           )}
          <View style={styles.heroContent}>
            <View style={styles.heroTag}>
              <Icon name="location" size={12} color={colors.white} />
              <Text style={styles.heroTagText}>
                {isItinerary ? trip.destinations?.join(', ') || 'Custom Trip' : trip.country}
              </Text>
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
          {isItinerary ? (
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

              <Text style={styles.sectionLabel}>Activities</Text>
              <View style={styles.timeline}>
                {trip.activities?.length === 0 ? (
                  <View style={styles.emptyTimelineContainer}>
                    <Icon name="itinerary" size={48} color={colors.muted} />
                    <Text style={styles.emptyTimeline}>Nothing to see here yet</Text>
                    <Text style={styles.emptyTimelineSub}>Add activities to your itinerary</Text>
                  </View>
                ) : (
                  trip.activities?.map((activity: any, i: number) => (
                    <View key={activity.id} style={styles.timelineItem}>
                      <View style={styles.timelineLeft}>
                        <LinearGradient
                          colors={[colors.primary, '#7985FF']}
                          style={[styles.timelineDot]}
                        />
                        {i < (trip.activities?.length || 0) - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.timelineCard}>
                        <View style={styles.dayBadgeWrap}>
                          <Text style={styles.dayBadge}>Day {i + 1}</Text>
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
                  ))
                )}
              </View>

              {isOwner && (
                <View style={styles.ownerActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.publishBtn]}
                    onPress={handlePublish}
                    activeOpacity={0.9}
                  >
                    <Icon name="globe" size={18} color={colors.white} />
                    <Text style={styles.actionBtnText}>Publish to Community</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={handleDelete}
                    activeOpacity={0.9}
                  >
                    <Icon name="delete" size={18} color={colors.white} />
                    <Text style={styles.actionBtnText}>Delete Itinerary</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.chipsRow}>
                <LinearGradient colors={['#FFE0E0', '#FFF0F0']} style={styles.chip}>
                  <Icon name="calendar" size={14} color="#EF4444" />
                  <Text style={[styles.chipText, { color: '#B91C1C' }]}>
                    {dayCount || 4} Days
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

              {/* Save & Customize button - works for ALL trips */}
              <View style={styles.actionButtonsContainer}>
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
                
                {/* Like button for community itineraries */}
                {trip.authorId && (
                  <TouchableOpacity
                    style={[styles.save, styles.likeBtn]}
                    activeOpacity={0.9}
                    onPress={handleLike}
                  >
                    <Icon 
                      name="heart" 
                      size={18} 
                      color={(trip.likes || []).includes(user?.id) ? colors.danger : colors.muted} 
                    />
                    <Text style={styles.saveText}>
                      {trip.likes?.length || 0} Likes
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
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
    ...StyleSheet.absoluteFillObject,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
  },
  editBtn: {
    position: 'absolute',
    right: 16,
  },
  btnInner: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: 'rgba(15,23,42,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
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
  saveText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  ownerActions: {
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.full,
    overflow: 'hidden',
    ...shadows.fab,
  },
  publishBtn: {
    backgroundColor: colors.primary,
  },
  deleteBtn: {
    backgroundColor: colors.danger,
  },
  actionBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default TripDetailScreen;