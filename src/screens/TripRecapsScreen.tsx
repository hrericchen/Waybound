import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import tripService from '../services/tripService';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import { Itinerary, ActivityPhoto } from '../types';

const TripRecapsScreen: React.FC = () => {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Itinerary | null>(null);
  const insets = useSafeAreaInsets();
  const theme = useContext(ThemeContext);
  const navigation = useNavigation();
  const route = useRoute();

  useEffect(() => {
    loadItineraries();
  }, []);

  const loadItineraries = async () => {
    const allItineraries = await tripService.getItineraries();
    setItineraries(allItineraries);
  };

  const getTripPhotos = (itinerary: Itinerary): ActivityPhoto[] => {
    const allPhotos: ActivityPhoto[] = [];
    itinerary.activities.forEach(activity => {
      if (activity.photos && activity.completed) {
        allPhotos.push(...activity.photos);
      }
    });
    return allPhotos.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const renderTripCard = ({ item }: { item: Itinerary }) => {
    const photos = getTripPhotos(item);
    const hasPhotos = photos.length > 0;

    return (
      <TouchableOpacity
        style={[styles.tripCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        onPress={() => setSelectedTrip(item)}
        activeOpacity={0.9}
      >
        <View style={styles.tripCardHeader}>
          <View style={styles.tripCardInfo}>
            <Text style={[styles.tripCardTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.tripCardMeta, { color: theme.colors.muted }]}>
              {item.destinations.slice(0, 2).join(', ')}
            </Text>
          </View>
          {hasPhotos && (
            <View style={[styles.photoBadge, { backgroundColor: colors.primary + '20' }]}>
              <Icon name="camera" size={16} color={colors.primary} />
              <Text style={[styles.photoBadgeText, { color: colors.primary }]}>
                {photos.length}
              </Text>
            </View>
          )}
        </View>

        {hasPhotos && (
          <View style={styles.photoPreviewRow}>
            {photos.slice(0, 3).map((photo, index) => (
              <Image
                key={photo.id}
                source={{ uri: photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri }}
                style={styles.photoPreview}
              />
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderPhotoTimeline = () => {
    if (!selectedTrip) return null;

    const photos = getTripPhotos(selectedTrip);

    if (photos.length === 0) {
      return (
        <View style={styles.emptyTimeline}>
          <Icon name="camera" size={48} color={theme.colors.muted} />
          <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
            No photos yet. Mark activities as complete and add photos to create your visual timeline.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.timeline}>
        {photos.map((photo, index) => {
          const activity = selectedTrip.activities.find(a => a.photos?.some(p => p.id === photo.id));
          return (
            <View key={photo.id} style={styles.timelineItem}>
              <View style={styles.timelineLine}>
                <View style={styles.timelineDot} />
                {index < photos.length - 1 && <View style={[styles.timelineConnector, { backgroundColor: theme.colors.border }]} />}
              </View>
              <View style={[styles.timelineContent, { backgroundColor: theme.colors.card }]}>
                <Image
                  source={{ uri: photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri }}
                  style={styles.timelinePhoto}
                />
                {activity && (
                  <View style={styles.timelineMeta}>
                    <Text style={[styles.timelineActivity, { color: theme.colors.text }]}>
                      {activity.emoji} {activity.title}
                    </Text>
                    <Text style={[styles.timelineDate, { color: theme.colors.muted }]}>
                      {new Date(photo.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Trip Recaps</Text>
        <View style={{ width: 24 }} />
      </View>

      {!selectedTrip ? (
        <>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            Select a trip to view your visual timeline
          </Text>
          <FlatList
            data={itineraries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120 }}
            renderItem={renderTripCard}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="itinerary" size={48} color={theme.colors.muted} />
                <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                  No trips yet. Create your first itinerary to get started!
                </Text>
              </View>
            }
          />
        </>
      ) : (
        <>
          <View style={styles.selectedTripHeader}>
            <TouchableOpacity onPress={() => setSelectedTrip(null)}>
              <Icon name="chevron-left" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.selectedTripTitle, { color: theme.colors.text }]}>
              {selectedTrip.title}
            </Text>
          </View>
          {renderPhotoTimeline()}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    paddingHorizontal: spacing.xl,
    fontSize: 15,
    marginBottom: spacing.lg,
  },
  tripCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    ...shadows.soft,
  },
  tripCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  tripCardInfo: {
    flex: 1,
  },
  tripCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  tripCardMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  photoBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  photoPreviewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
  },
  selectedTripHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectedTripTitle: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
  },
  timeline: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  timelineLine: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.soft,
  },
  timelinePhoto: {
    width: '100%',
    height: 250,
  },
  timelineMeta: {
    padding: spacing.md,
  },
  timelineActivity: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyTimeline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default TripRecapsScreen;