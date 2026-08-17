import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import { EMERGENCY_NUMBERS } from '../data/emergencyNumbers';

const EmergencyNumbersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const theme = useContext(ThemeContext);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? EMERGENCY_NUMBERS.filter((c) =>
        `${c.name} ${c.code}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : EMERGENCY_NUMBERS;

  const callNumber = (number: string, label: string) => {
    Linking.openURL(`${Platform.OS === 'web' ? 'http://' : 'tel:'}${number}`).catch(() => {
      Alert.alert('Unavailable', `Could not open dialer for ${label}.`);
    });
  };

  const renderItem = ({ item }: { item: typeof EMERGENCY_NUMBERS[number] }) => (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <Text style={styles.flag}>{item.flag}</Text>
      <View style={styles.cardBody}>
        <Text style={[styles.countryName, { color: theme.colors.text }]}>{item.name}</Text>
        <Text style={[styles.countryCode, { color: theme.colors.muted }]}>{item.code}</Text>
        <View style={styles.numbersRow}>
          <NumberButton label="General" number={item.general} onPress={callNumber} />
          <NumberButton label="Police" number={item.police} onPress={callNumber} />
          <NumberButton label="Ambulance" number={item.ambulance} onPress={callNumber} />
          <NumberButton label="Fire" number={item.fire} onPress={callNumber} />
        </View>
        {item.notes ? (
          <Text style={[styles.note, { color: theme.colors.muted }]}>{item.notes}</Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Emergency Numbers</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Save a life — search a country below.</Text>
      </View>
      <View style={[styles.searchWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Icon name="search" size={18} color={theme.colors.muted} />
        <TextInput
          placeholder="Search by country or code..."
          placeholderTextColor={theme.colors.muted}
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: theme.colors.text }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Icon name="close" size={16} color={theme.colors.muted} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="search" size={32} color={theme.colors.muted} />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>No country found. Try another name.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const NumberButton: React.FC<{
  label: string;
  number: string;
  onPress: (number: string, label: string) => void;
}> = ({ label, number, onPress }) => {
  const theme = useContext(ThemeContext);
  return (
    <TouchableOpacity
            style={[styles.numberBtn, { backgroundColor: colors.primarySoft }]}
      onPress={() => onPress(number, label)}
      activeOpacity={0.8}
    >
      <Text style={[styles.numberLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.numberValue, { color: colors.primary }]}>{number}</Text>
    </TouchableOpacity>
  );
};

export default EmergencyNumbersScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.xl,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: Platform.select({ web: 40, default: undefined }),
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadows.soft,
    borderWidth: 1,
  },
  flag: { fontSize: 32 },
  cardBody: { flex: 1 },
  countryName: { fontSize: 16, fontWeight: '700' },
  countryCode: { fontSize: 12, fontWeight: '600' },
  numbersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs },
  numberBtn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  numberLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  numberValue: { fontSize: 14, fontWeight: '800' },
  note: { fontSize: 11, marginTop: 4 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: spacing.xl },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
