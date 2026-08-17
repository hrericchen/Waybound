import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GOOGLE_API_KEY, PLACES_API_KEY } from '../constants/google';
import { Icon } from './Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';
import { searchPlacesResilient, geocodeAddress, PlaceResult } from '../services/placesService';

const SAMPLE_LOCATIONS = [
  // Tokyo landmarks
  { name: 'Tokyo Skytree', lat: 35.7101, lng: 139.8107 },
  { name: 'Meiji Jingu Shrine', lat: 35.6764, lng: 139.6993 },
  { name: 'Senso-ji Temple', lat: 35.7148, lng: 139.7967 },
  { name: 'Tokyo Tower', lat: 35.6586, lng: 139.7454 },
  { name: 'Shibuya Crossing', lat: 35.6595, lng: 139.7004 },
  { name: 'Shinjuku Gyoen', lat: 35.6852, lng: 139.7100 },
  { name: 'Imperial Palace', lat: 35.6852, lng: 139.7528 },
  { name: 'Akihabara', lat: 35.7023, lng: 139.7745 },
  { name: 'Harajuku', lat: 35.6702, lng: 139.7026 },
  { name: 'Asakusa', lat: 35.7148, lng: 139.7967 },
  { name: 'Ueno Park', lat: 35.7141, lng: 139.7744 },
  { name: 'Roppongi Hills', lat: 35.6605, lng: 139.7293 },
  { name: 'Tokyo Disneyland', lat: 35.6329, lng: 139.8804 },
  { name: 'Odaiba', lat: 35.6185, lng: 139.7767 },
  { name: 'Ginza', lat: 35.6717, lng: 139.7649 },
  { name: 'Shimokitazawa', lat: 35.6610, lng: 139.6735 },
  { name: 'Yoyogi Park', lat: 35.6717, lng: 139.6989 },
  { name: 'Tokyo Station', lat: 35.6812, lng: 139.7671 },
  { name: 'Ueno Zoo', lat: 35.7141, lng: 139.7744 },
  { name: 'Tokyo National Museum', lat: 35.7188, lng: 139.7767 },
  
  // Kyoto landmarks
  { name: 'Fushimi Inari Shrine', lat: 34.9671, lng: 135.7727 },
  { name: 'Kinkaku-ji (Golden Pavilion)', lat: 35.0394, lng: 135.7292 },
  { name: 'Arashiyama Bamboo Grove', lat: 35.0170, lng: 135.6719 },
  { name: 'Kiyomizu-dera Temple', lat: 34.9949, lng: 135.7850 },
  { name: 'Gion District', lat: 35.0036, lng: 135.7756 },
  { name: 'Nijo Castle', lat: 35.0142, lng: 135.7482 },
  { name: 'Philosopher\'s Path', lat: 35.0259, lng: 135.7935 },
  { name: 'Iwatayama Monkey Park', lat: 35.0142, lng: 135.6719 },
  { name: 'Heian Shrine', lat: 35.0117, lng: 135.7780 },
  
  // Osaka landmarks
  { name: 'Osaka Castle', lat: 34.6873, lng: 135.5262 },
  { name: 'Dotonbori', lat: 34.6686, lng: 135.5006 },
  { name: 'Universal Studios Japan', lat: 34.6654, lng: 135.4323 },
  { name: 'Shinsekai', lat: 34.6525, lng: 135.5063 },
  { name: 'Umeda Sky Building', lat: 34.7056, lng: 135.4901 },
  
  // Schools & Universities
  { name: 'University of Tokyo', lat: 35.7148, lng: 139.7627 },
  { name: 'Kyoto University', lat: 35.0267, lng: 135.7811 },
  { name: 'Osaka University', lat: 34.8195, lng: 135.5322 },
  { name: 'Tokyo Institute of Technology', lat: 35.6058, lng: 139.6839 },
  { name: 'Waseda University', lat: 35.7090, lng: 139.7207 },
  { name: 'Keio University', lat: 35.6489, lng: 139.7426 },
  
  // Additional world landmarks
  { name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945 },
  { name: 'Statue of Liberty', lat: 40.6892, lng: -74.0445 },
  { name: 'Big Ben', lat: 51.5007, lng: -0.1246 },
  { name: 'Sydney Opera House', lat: -33.8568, lng: 151.2153 },
  { name: 'Colosseum', lat: 41.8902, lng: 12.4922 },
  { name: 'Machu Picchu', lat: -13.1631, lng: -72.5450 },
  { name: 'Taj Mahal', lat: 27.1751, lng: 78.0421 },
  { name: 'Great Wall of China', lat: 40.4319, lng: 116.5704 },
  { name: 'Christ the Redeemer', lat: -22.9519, lng: -43.2105 },
  { name: 'Pyramids of Giza', lat: 29.9792, lng: 31.1342 },
  { name: 'Burj Khalifa', lat: 25.1972, lng: 55.2744 },
  { name: 'Leaning Tower of Pisa', lat: 43.7230, lng: 10.3966 },
  { name: 'Sagrada Familia', lat: 41.4036, lng: 2.1744 },
  { name: 'Louvre Museum', lat: 48.8606, lng: 2.3376 },
  { name: 'Brandenburg Gate', lat: 52.5163, lng: 13.3777 },
  { name: 'White House', lat: 38.8977, lng: -77.0365 },
  { name: 'Central Park', lat: 40.7829, lng: -73.9654 },
  { name: 'Golden Gate Bridge', lat: 37.8199, lng: -122.4783 },
  { name: 'Hollywood Sign', lat: 34.1341, lng: -118.3215 },
  { name: 'Las Vegas Strip', lat: 36.1147, lng: -115.1728 },
];

const PlaceSearch: React.FC<{
  onSelect: (place: { name: string; lat: number; lng: number; address?: string }) => void;
  locationBias?: { lat: number; lng: number };
  initialQuery?: string;
}> = ({ onSelect, locationBias, initialQuery }) => {
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef('');

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  // Prefill when the parent passes a saved location name/address
  useEffect(() => {
    setQuery(initialQuery || '');
    if (initialQuery) {
      search(initialQuery, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const search = async (q: string, force = false) => {
    setQuery(q);
    const qq = (q || '').trim();
    if (qq.length < 3) return setResults([]);
    if (!force && qq === lastQueryRef.current) return;
    lastQueryRef.current = qq;
    setSearching(true);
    if ((!PLACES_API_KEY || PLACES_API_KEY.startsWith('<')) && (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith('<'))) {
      console.warn('Google Places API keys not set in src/constants/google.ts');
      const filtered = SAMPLE_LOCATIONS.filter((loc) =>
        loc.name.toLowerCase().includes(q.toLowerCase())
      ).map((loc) => ({
        id: `sample-${loc.name}`,
        name: loc.name,
        address: '',
        lat: loc.lat,
        lng: loc.lng,
        types: [],
      }));
      setResults(filtered);
      setSearching(false);
      return;
    }
    try {
      const found = await searchPlacesResilient(q, locationBias);
      setResults(found);
    } catch (e) {
      console.warn('Places search failed', e);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const onQueryChange = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 450);
  };

  const handleSelect = (item: PlaceResult) => {
    onSelect({
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      address: item.address,
    });
  };

  const handleCustomLocation = async () => {
    // Fallback: user enters a raw address that returned no API results
    const geocoded = await geocodeAddress(query);
    onSelect({
      name: query,
      lat: geocoded?.lat ?? locationBias?.lat ?? 0,
      lng: geocoded?.lng ?? locationBias?.lng ?? 0,
      address: geocoded?.address || query,
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.inputWrap}>
        <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.inputIcon}>
          <Icon name="search" size={16} color={colors.primary} />
        </LinearGradient>
        <TextInput
          placeholder="Search places"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={onQueryChange}
          style={styles.input}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => handleSelect(item)} activeOpacity={0.85}>
            <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.rowIcon}>
              <Icon name="location" size={16} color={colors.primary} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>{item.name}</Text>
              {item.address ? <Text style={styles.rowSub}>{item.address}</Text> : null}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          searching ? (
            <Text style={styles.empty}>Searching…</Text>
          ) : query.length >= 2 ? (
            <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
              <Text style={styles.empty}>No places found</Text>
              <TouchableOpacity style={styles.customBtn} onPress={handleCustomLocation} activeOpacity={0.85}>
                <Icon name="location" size={16} color={colors.primary} />
                <Text style={styles.customText}>Add Custom Location / Drop Pin</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.empty}>Start typing to search destinations</Text>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    marginBottom: spacing.lg,
    ...shadows.soft,
  },
  inputIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  customText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  empty: {
    marginTop: spacing.xl,
    textAlign: 'center',
    color: colors.muted,
  },
});

export default PlaceSearch;