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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import tripService from '../services/tripService';
import PlaceSearch from '../components/PlaceSearch';
import TripMap from '../components/TripMap';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';

const CreateItineraryScreen: React.FC = () => {
  const [title, setTitle] = useState('Japan 2026');
  const [destinations, setDestinations] = useState('Tokyo, Kyoto');
  const [activities, setActivities] = useState<any[]>([
    { id: 'a1', day: 1, title: 'Arrive Tokyo', notes: '' },
  ]);
  const [draftId] = useState(() => `it-${Date.now()}`);
  const theme = useContext(ThemeContext);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const save = async () => {
      const itinerary = {
        id: draftId,
        title,
        destinations: destinations.split(',').map((s) => s.trim()),
        activities,
      };
      try {
        await tripService.saveTrip(itinerary);
      } catch (e) {
        console.warn('Failed to autosave itinerary', e);
      }
    };
    save();
  }, [title, destinations, activities, draftId]);

  const navigation = useNavigation();

  const addActivity = () => {
    setActivities((a) => [
      ...a,
      { id: `${Date.now()}`, day: a.length + 1, title: 'New Activity', notes: '' },
    ]);
  };

  const [searchVisible, setSearchVisible] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | undefined>(undefined);

  const handleSelectPlace = (place: { name: string; lat: number; lng: number }) => {
    const item = {
      id: `${Date.now()}`,
      day: activities.length + 1,
      title: place.name,
      lat: place.lat,
      lng: place.lng,
      notes: '',
    };
    setActivities((a) => [...a, item]);
    setSearchVisible(false);
  };

  const removeActivity = (id: string) => setActivities((a) => a.filter((x) => x.id !== id));

  const renderItem = useCallback(
    ({ item, drag, isActive, index }: RenderItemParams<any>) => {
      return (
        <TouchableOpacity
          style={[
            styles.activity,
            isActive && styles.activityActive,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
          onLongPress={drag}
          onPress={() => {
            setHighlightIndex(index);
            setMapVisible(true);
          }}
          activeOpacity={0.9}
        >
          <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.dayBadge}>
            <Text style={styles.dayBadgeText}>{item.day}</Text>
          </LinearGradient>
          <View style={styles.activityBody}>
            <Text style={styles.activityLabel}>Activity</Text>
            <TextInput
              value={item.title}
              onChangeText={(t) =>
                setActivities((a) => a.map((x) => (x.id === item.id ? { ...x, title: t } : x)))
              }
              style={[styles.activityInput, { color: theme.colors.text }]}
              placeholderTextColor={theme.colors.muted}
            />
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => removeActivity(item.id)}>
            <Icon name="delete" size={18} color={colors.danger} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [theme.colors.card, theme.colors.border, theme.colors.text, theme.colors.muted]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                    activities,
                  };
                  await tripService.saveTrip(itinerary);
                  navigation.navigate('Main' as any, { screen: 'Library' });
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
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: 10,
    ...shadows.soft,
  },
  activityActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dayBadgeText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  activityBody: {
    flex: 1,
  },
  activityLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '700',
    marginBottom: 2,
  },
  activityInput: {
    fontSize: 15,
    fontWeight: '700',
    padding: 0,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  actions: {
    marginTop: 8,
    gap: 10,
    paddingBottom: 120,
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
});

export default CreateItineraryScreen;
