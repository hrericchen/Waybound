import React, { useEffect, useState, useCallback, useContext } from 'react';
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
  Animated,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
// import * as ImagePicker from 'expo-image-picker';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import tripService from '../services/tripService';
import { communityService } from '../services/communityService';
import PlaceSearch from '../components/PlaceSearch';
import TripMap from '../components/TripMap';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import { Activity, ActivityLink, ActivityPhoto } from '../types';
import { AuthContext } from '../context/AuthContext';

const CreateItineraryScreen: React.FC = () => {
  const route = useRoute();
  const editId = (route.params as any)?.editId;
  const [title, setTitle] = useState('Japan 2026');
  const [destinations, setDestinations] = useState('Tokyo, Kyoto');
  const [tags, setTags] = useState('');
  const [season, setSeason] = useState('');
  const [budget, setBudget] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageBase64, setCoverImageBase64] = useState('');
  const [activities, setActivities] = useState<Activity[]>([
    { id: 'a1', day: 1, title: 'Arrive Tokyo', notes: '', links: [], photos: [], completed: false },
  ]);
  const [days, setDays] = useState<number[]>([1]);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [draftId, setDraftId] = useState(() => `it-${Date.now()}`);
  const theme = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);

  // Animation for drag
  const scaleAnim = useCallback((isActive: boolean) => {
    return isActive ? 1.05 : 1;
  }, []);

  // Compute the cover image value (base64 data URI takes priority over URL)
  const getCoverImageValue = () =>
    coverImageBase64
      ? `data:image/jpeg;base64,${coverImageBase64}`
      : coverImageUrl || undefined;

  // Load existing itinerary for editing
  useEffect(() => {
    const loadItinerary = async () => {
      if (editId) {
        const itinerary = await tripService.getTripById(editId);
        if (itinerary) {
          setDraftId(itinerary.id);
          setTitle(itinerary.title);
          setDestinations(itinerary.destinations?.join(', ') || '');
          setTags(itinerary.tags?.join(', ') || '');
          setSeason(itinerary.season || '');
          setBudget(itinerary.budget || '');
          setCoverImageUrl(itinerary.coverImage || '');
          setCoverImageBase64('');
          setActivities(itinerary.activities || []);
          const dayNumbers = [...new Set((itinerary.activities || []).map((a: any) => a.day))].sort((a: number, b: number) => a - b);
          setDays(dayNumbers.length > 0 ? dayNumbers as number[] : [1]);
          setSelectedDay((dayNumbers[0] as number) || 1);
        }
      }
    };
    loadItinerary();
  }, [editId]);

  useEffect(() => {
    const save = async () => {
      const itinerary = {
        id: draftId,
        title,
        destinations: destinations.split(',').map((s) => s.trim()),
        coverImage: getCoverImageValue(),
        tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
        season: season || undefined,
        budget: budget || undefined,
        activities,
        userId: user?.id,
      };
      try {
        await tripService.saveTrip(itinerary);
      } catch (e) {
        console.warn('Failed to autosave itinerary', e);
      }
    };
    save();
  }, [title, destinations, tags, season, budget, coverImageUrl, coverImageBase64, activities, draftId, user]);

  const navigation = useNavigation();

  const addActivity = () => {
    setActivities((a) => [
      ...a,
      { id: `${Date.now()}`, day: selectedDay, title: 'New Activity', notes: '', links: [], photos: [], completed: false },
    ]);
  };

  const addDay = () => {
    const newDay = days.length + 1;
    setDays([...days, newDay]);
    setSelectedDay(newDay);
  };

  const [searchVisible, setSearchVisible] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | undefined>(undefined);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [emojiInputId, setEmojiInputId] = useState<string | null>(null);
  const [emojiText, setEmojiText] = useState('');

  const handleSelectPlace = (place: { name: string; lat: number; lng: number }) => {
    const item = {
      id: `${Date.now()}`,
      day: activities.length + 1,
      title: place.name,
      lat: place.lat,
      lng: place.lng,
      notes: '',
      links: [],
      photos: [],
      completed: false,
    };
    setActivities((a) => [...a, item]);
    setSearchVisible(false);
  };

  const removeActivity = (id: string) => setActivities((a) => a.filter((x) => x.id !== id));

  const pickImage = async () => {
    Alert.alert(
      'Upload Photo',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose from Gallery',
          onPress: () => {
            Alert.alert('Gallery', 'Image picker would open here. Install expo-image-picker for full functionality.');
          },
        },
        {
          text: 'Choose File',
          onPress: () => {
            Alert.alert('File Browser', 'File browser would open here.');
          },
        },
        {
          text: 'Add Sample Image',
          onPress: () => {
            const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            setCoverImageBase64(sampleBase64);
            setCoverImageUrl('');
            Alert.alert('Success', 'Sample image added!');
          },
        },
      ]
    );
  };

  const toggleActivityComplete = (id: string) => {
    setActivities((a) => a.map((x) => x.id === id ? { ...x, completed: !x.completed } : x));
  };

  const updateActivity = (id: string, updates: Partial<Activity>) => {
    setActivities((a) => a.map((x) => x.id === id ? { ...x, ...updates } : x));
  };

  const addLink = (activityId: string) => {
    const link: ActivityLink = {
      id: `link-${Date.now()}`,
      title: 'New Link',
      url: 'https://',
    };
    updateActivity(activityId, { links: [...(activities.find(a => a.id === activityId)?.links || []), link] });
  };

  const updateLink = (activityId: string, linkId: string, updates: Partial<ActivityLink>) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity && activity.links) {
      const updatedLinks = activity.links.map(l => l.id === linkId ? { ...l, ...updates } : l);
      updateActivity(activityId, { links: updatedLinks });
    }
  };

  const removeLink = (activityId: string, linkId: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity && activity.links) {
      const updatedLinks = activity.links.filter(l => l.id !== linkId);
      updateActivity(activityId, { links: updatedLinks });
    }
  };

  const addPhoto = async (activityId: string) => {
    Alert.alert(
      'Add Photo',
      'Photo picker will be available after installing expo-image-picker. Add a sample photo for now.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Sample',
          onPress: () => {
            const photo: ActivityPhoto = {
              id: `photo-${Date.now()}`,
              uri: 'sample',
              base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              timestamp: new Date().toISOString(),
            };
            const activity = activities.find(a => a.id === activityId);
            if (activity) {
              updateActivity(activityId, { photos: [...(activity.photos || []), photo] });
            }
          },
        },
      ]
    );
  };

  const removePhoto = (activityId: string, photoId: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity && activity.photos) {
      const updatedPhotos = activity.photos.filter(p => p.id !== photoId);
      updateActivity(activityId, { photos: updatedPhotos });
    }
  };

  const handleEmojiPress = (activityId: string) => {
    setEmojiInputId(activityId);
    setEmojiText('');
  };

  const handleEmojiSubmit = () => {
    if (emojiInputId && emojiText.trim()) {
      updateActivity(emojiInputId, { emoji: emojiText.trim() });
      setEmojiInputId(null);
      setEmojiText('');
    }
  };

  const renderItem = useCallback(
    ({ item, drag, isActive, index }: RenderItemParams<Activity>) => {
      const isExpanded = expandedActivity === item.id;
      
      return (
        <Animated.View
          style={[
            styles.activity,
            isActive && styles.activityActive,
            { 
              backgroundColor: theme.colors.card, 
              borderColor: theme.colors.border,
              transform: [{ scale: scaleAnim(isActive) }],
            },
          ]}
        >
           {/* The entire box (except inner interactive controls) can be
               long-pressed to start reordering. Tapping the title text
               field simply edits the text and does not trigger dragging,
               because TextInput consumes touch events for editing while
               the surrounding Pressable area handles the long-press drag. */}
           <TouchableOpacity
             onLongPress={drag}
             delayLongPress={200}
             activeOpacity={1}
           >
            <View style={styles.activityContent}>
              {/* Emoji Button */}
              <TouchableOpacity
                style={styles.emojiBtn}
                onPress={() => handleEmojiPress(item.id)}
              >
                <Text style={styles.emojiText}>{item.emoji || '😀'}</Text>
              </TouchableOpacity>

              {/* Hidden emoji input for system keyboard - auto-focuses when emoji button is pressed */}
              {emojiInputId === item.id && (
                <TextInput
                  ref={(ref) => ref?.focus()}
                  style={styles.hiddenEmojiInput}
                  value={emojiText}
                  onChangeText={setEmojiText}
                  onSubmitEditing={handleEmojiSubmit}
                  blurOnSubmit={true}
                  autoFocus={true}
                  keyboardType="default"
                  autoCorrect={false}
                  autoCapitalize="none"
                  placeholder="Type emoji..."
                />
              )}

              {/* Complete Checkbox */}
              <TouchableOpacity
                style={[styles.checkbox, item.completed && styles.checkboxChecked]}
                onPress={() => toggleActivityComplete(item.id)}
              >
                {item.completed && <Icon name="check" size={16} color={colors.white} />}
              </TouchableOpacity>

              {/* Activity Info */}
              <View style={styles.activityBody}>
                <View style={styles.activityTitleRow}>
                  {item.lat && item.lng && (
                    <View style={styles.locationPin}>
                      <Text style={styles.locationPinText}>📍</Text>
                    </View>
                  )}
                  <TextInput
                    value={item.title}
                    onChangeText={(t) =>
                      setActivities((a) => a.map((x) => (x.id === item.id ? { ...x, title: t } : x)))
                    }
                    style={[
                      styles.activityInput, 
                      { color: theme.colors.text },
                      item.completed && styles.activityInputCompleted,
                    ]}
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>
                
                {/* Expand/Collapse Button */}
                <TouchableOpacity
                  style={styles.expandBtn}
                  onPress={() => setExpandedActivity(isExpanded ? null : item.id)}
                >
                  <Icon 
                    name={isExpanded ? 'chevronUp' : 'chevronDown'} 
                    size={16} 
                    color={theme.colors.muted} 
                  />
                </TouchableOpacity>
              </View>

              {/* Delete Button */}
              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeActivity(item.id)}>
                <Icon name="delete" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>

            {/* Expanded Content */}
            {isExpanded && (
              <View style={styles.expandedContent}>
                {/* Notes */}
                <TextInput
                  value={item.notes}
                  onChangeText={(t) => updateActivity(item.id, { notes: t })}
                  placeholder="Add notes..."
                  placeholderTextColor={theme.colors.muted}
                  style={[styles.notesInput, { color: theme.colors.text, backgroundColor: theme.colors.background }]}
                />

                {/* Links Section */}
                <View style={styles.linksSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Links</Text>
                    <TouchableOpacity onPress={() => addLink(item.id)}>
                      <Icon name="plus" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                  {item.links?.map((link) => (
                    <View key={link.id} style={[styles.linkItem, { backgroundColor: theme.colors.background }]}>
                      <TextInput
                        value={link.title}
                        onChangeText={(t) => updateLink(item.id, link.id, { title: t })}
                        placeholder="Link title"
                        placeholderTextColor={theme.colors.muted}
                        style={[styles.linkInput, { color: theme.colors.text }]}
                      />
                      <TextInput
                        value={link.url}
                        onChangeText={(t) => updateLink(item.id, link.id, { url: t })}
                        placeholder="URL"
                        placeholderTextColor={theme.colors.muted}
                        style={[styles.linkInput, { color: theme.colors.text }]}
                      />
                      <TouchableOpacity onPress={() => removeLink(item.id, link.id)}>
                        <Icon name="close" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* Photos Section (for completed activities) */}
                {item.completed && (
                  <View style={styles.photosSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Photos</Text>
                      <TouchableOpacity onPress={() => addPhoto(item.id)}>
                        <Icon name="camera" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.photosGrid}>
                      {item.photos?.map((photo) => (
                        <View key={photo.id} style={styles.photoItem}>
                          <Image
                            source={{ uri: photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri }}
                            style={styles.photo}
                          />
                          <TouchableOpacity
                            style={styles.removePhotoBtn}
                            onPress={() => removePhoto(item.id, photo.id)}
                          >
                            <Icon name="close" size={14} color={colors.white} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [expandedActivity, theme.colors, scaleAnim, emojiInputId, emojiText]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <View style={styles.header}>
            <View>
              <Text style={[styles.kicker, { color: theme.colors.muted }]}>Build your trip</Text>
              <Text style={[styles.title, { color: theme.colors.text }]}>Create Itinerary</Text>
            </View>
          </View>

          <View style={[styles.formCard, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Trip title</Text>
          <View style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
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
          <View style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Icon name="location" size={16} color={theme.colors.muted} />
            <TextInput
              style={[styles.inputField, { color: theme.colors.text }]}
              value={destinations}
              onChangeText={setDestinations}
              placeholder="Destinations (comma separated)"
              placeholderTextColor={theme.colors.muted}
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

          <Text style={[styles.label, { color: theme.colors.text }]}>Budget (Optional)</Text>
          <View style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Icon name="currency" size={16} color={theme.colors.muted} />
            <TextInput
              style={[styles.inputField, { color: theme.colors.text }]}
              value={budget}
              onChangeText={setBudget}
              placeholder="e.g. 2000"
              placeholderTextColor={theme.colors.muted}
              keyboardType="numeric"
            />
          </View>

          <Text style={[styles.label, { color: theme.colors.text }]}>Cover Image</Text>
          
          {/* Image Preview */}
          {(coverImageBase64 || coverImageUrl) && (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: coverImageBase64 ? `data:image/jpeg;base64,${coverImageBase64}` : coverImageUrl }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => {
                  setCoverImageBase64('');
                  setCoverImageUrl('');
                }}
              >
                <Icon name="close" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          )}

          {/* Upload Button */}
          <TouchableOpacity
            style={[styles.uploadButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            onPress={pickImage}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[colors.primary + '20', '#7985FF20']}
              style={styles.uploadButtonGradient}
            >
              <Icon name="upload" size={24} color={colors.primary} />
              <View style={styles.uploadButtonText}>
                <Text style={[styles.uploadTitle, { color: theme.colors.text }]}>
                  {coverImageBase64 || coverImageUrl ? 'Change Photo' : 'Upload Photo'}
                </Text>
                <Text style={[styles.uploadSubtitle, { color: theme.colors.muted }]}>
                  Tap to select from gallery
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* URL Input (Optional) */}
          <View style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Icon name="link" size={16} color={theme.colors.muted} />
            <TextInput
              style={[styles.inputField, { color: theme.colors.text }]}
              value={coverImageUrl}
              onChangeText={setCoverImageUrl}
              placeholder="Or paste image URL (optional)"
              placeholderTextColor={theme.colors.muted}
            />
          </View>
        </View>

        {/* Day Selector */}
        <View style={styles.daySelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {days.map((day) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayChip,
                  { 
                    backgroundColor: selectedDay === day ? colors.primary : theme.colors.card,
                    borderColor: selectedDay === day ? colors.primary : theme.colors.border,
                  }
                ]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[
                  styles.dayChipText,
                  { color: selectedDay === day ? colors.white : theme.colors.text }
                ]}>
                  Day {day}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.dayChip, styles.addDayChip, { borderColor: theme.colors.border }]} onPress={addDay}>
              <Icon name="plus" size={18} color={colors.primary} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Activities</Text>
          <Text style={[styles.sectionHint, { color: theme.colors.muted }]}>
            Long-press to reorder
          </Text>
        </View>

        <DraggableFlatList
          data={activities}
          onDragEnd={({ data }) =>
            setActivities(data.map((item, index) => ({ ...item, day: index + 1 })))
          }
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 20 }}
          ListFooterComponent={
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
                <TouchableOpacity
                  style={[styles.actionBtn, styles.secondaryBtn]}
                  onPress={() => setSearchVisible(true)}
                  activeOpacity={0.9}
                >
                  <Icon name="location" size={16} color={colors.primary} />
                  <Text style={styles.secondaryText}>Add</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.actionBtn, styles.mapBtn]}
                onPress={() => setMapVisible(true)}
                activeOpacity={0.9}
              >
                <Icon name="map" size={16} color={colors.white} />
                <Text style={styles.actionText}>Open Map</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={async () => {
                  const itinerary = {
                    id: draftId,
                    title,
                    destinations: destinations.split(',').map((s) => s.trim()),
                    coverImage: getCoverImageValue(),
                    tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
                    season: season || undefined,
                    budget: budget || undefined,
                    activities,
                    userId: user?.id,
                  };
                  await tripService.saveTrip(itinerary);
                  Alert.alert(
                    'Itinerary Saved!',
                    'Would you like to publish this itinerary to the community for others to see?',
                    [
                      { text: 'No, keep private', onPress: () => (navigation as any).navigate('Main', { screen: 'Library' }) },
                      {
                        text: 'Publish to Community',
                        onPress: () => {
                          try {
                            communityService.publishItinerary({
                              ...itinerary,
                              authorName: user?.name || 'Anonymous',
                              authorId: user?.id,
                              authorAvatar: (user as any)?.avatarUrl,
                            });
                            Alert.alert('Published!', 'Your itinerary is now visible in the community.');
                          } catch (e) {
                            console.warn('Failed to publish to community', e);
                          }
                          (navigation as any).navigate('Main', { screen: 'Library' });
                        },
                      },
                    ]
                  );
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
            </View>
          }
        />
        </ScrollView>
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
                .map((a) => ({ lat: a.lat, lng: a.lng, title: a.title }))}
              highlightIndex={highlightIndex}
              onMarkerPress={(i) => setHighlightIndex(i)}
            />
          </View>
        </View>
      </Modal>
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
  },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  formCard: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    ...shadows.card,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: radius.md,
    marginBottom: 12,
  },
  inputField: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
  },
  daySelector: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  dayChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  dayChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  addDayChip: {
    backgroundColor: 'transparent',
    minWidth: 44,
    width: 44,
    paddingHorizontal: 0,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  activity: {
    marginBottom: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.soft,
  },
  activityActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    ...shadows.deep,
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: 10,
  },
  emojiBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  activityBody: {
    flex: 1,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  locationPin: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPinText: {
    fontSize: 16,
  },
  activityInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    padding: 0,
  },
  activityInputCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  expandBtn: {
    marginTop: 4,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  notesInput: {
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  linksSection: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  linkInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
  },
  photosSection: {
    gap: spacing.sm,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    marginTop: 8,
    gap: 10,
    paddingBottom: 140,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.full,
  },
  primaryBtn: {
    flex: 2,
    overflow: 'hidden',
    ...shadows.fab,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.primarySoft,
  },
  mapBtn: {
    backgroundColor: '#0F172A',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.full,
    overflow: 'hidden',
    ...shadows.fab,
  },
  actionText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButton: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  uploadButtonText: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  uploadSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  hiddenEmojiInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});

export default CreateItineraryScreen;
