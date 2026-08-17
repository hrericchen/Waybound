import React, { useState, useContext, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { ThemeContext, colors, radius, spacing } from '../theme/theme';
import { searchPlacesResilient, isCityPlace, PlaceResult } from '../services/placesService';

type CityPickerProps = {
  selected: PlaceResult[];
  onChange: (selected: PlaceResult[]) => void;
  placeholder?: string;
  /** Restrict suggestions to cities/towns only (default true). */
  citiesOnly?: boolean;
  /** When provided, tapping a suggestion calls this once and clears (single-pick mode). */
  onPickOne?: (place: PlaceResult) => void;
};

/**
 * Reusable place picker. Defaults to cities/towns only; pass citiesOnly={false}
 * to allow any place (used for overview "add a place"). Suggestions appear as
 * soon as you start typing, and selected places render as cards with a Google
 * thumbnail — not a banner.
 */
const CityPicker: React.FC<CityPickerProps> = ({
  selected,
  onChange,
  placeholder = 'Search a city or town...',
  citiesOnly = true,
  onPickOne,
}) => {
  const theme = useContext(ThemeContext);
  const [query, setQuery] = useState('');
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

  const runSearch = async (q: string, force = false) => {
    const qq = q.trim();
    if (qq.length < 3) {
      setResults([]);
      return;
    }
    if (!force && qq === lastQueryRef.current) return;
    lastQueryRef.current = qq;
    setSearching(true);
    try {
      const found = await searchPlacesResilient(qq);
      const filtered = citiesOnly ? found.filter(isCityPlace) : found;
      setResults(filtered.slice(0, 15));
    } catch (e) {
      setResults([]);
    }
    setSearching(false);
  };

  const onQueryChange = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 450);
  };

  const add = (p: PlaceResult) => {
    if (onPickOne) {
      onPickOne(p);
      setQuery('');
      setResults([]);
      return;
    }
    if (selected.some((c) => c.name.toLowerCase() === p.name.toLowerCase())) return;
    onChange([...selected, p]);
    setQuery('');
    setResults([]);
  };

  const remove = (key: string) => onChange(selected.filter((c) => (c.id || c.name) !== key));

  return (
    <View>
      <View style={[styles.searchWrap, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
        <Icon name="search" size={16} color={theme.colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.muted}
          value={query}
          onChangeText={onQueryChange}
          onFocus={() => runSearch(query, true)}
          autoCorrect={false}
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {results.length > 0 ? (
        <View style={[styles.results, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          {results.map((r) => (
            <TouchableOpacity key={r.id || r.name} style={styles.resultRow} onPress={() => add(r)} activeOpacity={0.85}>
              <Icon name="location" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultName, { color: theme.colors.text }]}>{r.name}</Text>
                <Text style={[styles.resultAddr, { color: theme.colors.muted }]} numberOfLines={1}>
                  {r.address}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {!onPickOne && selected.length > 0 ? (
        <View style={styles.cardList}>
          {selected.map((c) => (
            <View key={c.id || c.name} style={[styles.card, { backgroundColor: theme.colors.card }]}>
              {c.photoUrl ? (
                <Image source={{ uri: c.photoUrl }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Icon name="location" size={18} color={colors.primary} />
                </View>
              )}
              <Text style={[styles.cardName, { color: theme.colors.text }]} numberOfLines={1}>
                {c.name}
              </Text>
              <TouchableOpacity onPress={() => remove(c.id || c.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15 },
  results: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md },
  resultName: { fontSize: 14, fontWeight: '700' },
  resultAddr: { fontSize: 12, marginTop: 2 },
  cardList: { gap: spacing.sm, marginTop: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  thumb: { width: 52, height: 52, borderRadius: radius.md },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F620' },
  cardName: { flex: 1, fontSize: 15, fontWeight: '700' },
});

export default CityPicker;
