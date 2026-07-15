import React, { useState } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GOOGLE_API_KEY } from '../constants/google';
import { Icon } from './Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';

const PlaceSearch: React.FC<{ onSelect: (place: { name: string; lat: number; lng: number }) => void }> = ({
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const search = async (q: string) => {
    setQuery(q);
    if (!q || q.length < 2) return setResults([]);
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith('<')) {
      console.warn('Google Places API key not set in src/constants/google.ts');
      return setResults([]);
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        q
      )}&key=${GOOGLE_API_KEY}&types=geocode&language=en`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.predictions || []);
    } catch (e) {
      console.warn('Places search failed', e);
    }
  };

  const fetchDetails = async (placeId: string) => {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith('<')) return null;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_API_KEY}&fields=geometry,name,formatted_address`;
    const res = await fetch(url);
    const data = await res.json();
    return data.result;
  };

  const handleSelect = async (item: any) => {
    const det = await fetchDetails(item.place_id);
    if (det && det.geometry && det.geometry.location) {
      onSelect({
        name: det.name || det.formatted_address,
        lat: det.geometry.location.lat,
        lng: det.geometry.location.lng,
      });
    }
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
          onChangeText={search}
          style={styles.input}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(r) => r.place_id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => handleSelect(item)} activeOpacity={0.85}>
            <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.rowIcon}>
              <Icon name="location" size={16} color={colors.primary} />
            </LinearGradient>
            <Text style={styles.rowText}>{item.description}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.length >= 2 ? (
            <Text style={styles.empty}>No places found</Text>
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
  empty: {
    marginTop: spacing.xl,
    textAlign: 'center',
    color: colors.muted,
  },
});

export default PlaceSearch;
