import React, { useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import CityPicker from './CityPicker';
import { Icon } from './Icon';
import { ThemeContext, colors, radius, spacing, shadows } from '../theme/theme';

export type OverviewNote = { id: string; type: 'note'; text: string; bullets: boolean };
export type OverviewMedia = { id: string; type: 'media'; uri: string; base64?: string };
export type OverviewPlace = { id: string; type: 'place'; name: string; lat: number; lng: number; address?: string; photoUrl?: string; description?: string };
export type OverviewPacking = { id: string; type: 'packing'; title: string; items: { id: string; text: string; checked: boolean }[] };
export type OverviewItem = OverviewNote | OverviewMedia | OverviewPlace | OverviewPacking;
export type OverviewSection = { id: string; title: string; items: OverviewItem[] };

let idCounter = 0;
const genId = (p = 'id') => `${p}-${Date.now()}-${idCounter++}`;

/** Shorten a possibly long description to a single sentence for compact cards. */
function firstSentence(desc?: string): string {
  if (!desc) return '';
  const trimmed = desc.trim().replace(/\s+/g, ' ');
  const end = trimmed.indexOf('. ');
  const sentence = end > 0 ? trimmed.slice(0, end + 1) : trimmed;
  return sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence;
}

type Props = {
  value: OverviewSection[];
  onChange: (sections: OverviewSection[]) => void;
};

/**
 * Reusable overview editor: sections with notes (bullet toggle), media,
 * places (Places API with Google photo), and customizable packing lists —
 * all in chronological order.
 */
const OverviewEditor: React.FC<Props> = ({ value, onChange }) => {
  const theme = useContext(ThemeContext);

  const addSection = () => onChange([...value, { id: genId('sec'), title: '', items: [] }]);
  const removeSection = (id: string) => onChange(value.filter((s) => s.id !== id));
  const updateSectionTitle = (id: string, t: string) =>
    onChange(value.map((s) => (s.id === id ? { ...s, title: t } : s)));

  const makeOverviewItem = (type: OverviewItem['type']): OverviewItem => {
    if (type === 'note') return { id: genId('note'), type, text: '', bullets: false };
    if (type === 'media') return { id: genId('media'), type, uri: '', base64: undefined };
    if (type === 'place') return { id: genId('place'), type, name: '', lat: 0, lng: 0, address: undefined, photoUrl: undefined };
    return { id: genId('pack'), type, title: '', items: [] };
  };

  const addOverviewItem = (sectionId: string, type: OverviewItem['type']) => {
    const item = makeOverviewItem(type);
    onChange(value.map((s) => (s.id === sectionId ? { ...s, items: [...s.items, item] } : s)));
    if (type === 'media') {
      setTimeout(() => pickOverviewMedia(sectionId, item.id), 300);
    }
  };

  const updateOverviewItem = (sectionId: string, itemId: string, patch: any) =>
    onChange(value.map((s) => (s.id === sectionId ? { ...s, items: s.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : s)));

  const removeOverviewItem = (sectionId: string, itemId: string) =>
    onChange(value.map((s) => (s.id === sectionId ? { ...s, items: s.items.filter((it) => it.id !== itemId) } : s)));

  const pickOverviewMedia = async (sectionId: string, itemId: string) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.4, base64: true });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        updateOverviewItem(sectionId, itemId, { uri: asset.uri, base64: asset.base64 });
      }
    } catch (e) {
      console.warn('Media pick failed:', e);
    }
  };

  const packingItems = (sectionId: string, itemId: string): { id: string; text: string; checked: boolean }[] => {
    const sec = value.find((x) => x.id === sectionId);
    const it = sec?.items.find((x) => x.id === itemId);
    return it && it.type === 'packing' ? (it as OverviewPacking).items : [];
  };
  const addPackingItem = (sectionId: string, itemId: string) =>
    updateOverviewItem(sectionId, itemId, { items: [...packingItems(sectionId, itemId), { id: genId('pki'), text: '', checked: false }] });
  const updatePackingItem = (sectionId: string, itemId: string, pkId: string, patch: any) =>
    updateOverviewItem(sectionId, itemId, { items: packingItems(sectionId, itemId).map((x) => (x.id === pkId ? { ...x, ...patch } : x)) });
  const removePackingItem = (sectionId: string, itemId: string, pkId: string) =>
    updateOverviewItem(sectionId, itemId, { items: packingItems(sectionId, itemId).filter((x) => x.id !== pkId) });

  const renderNote = (sectionId: string, item: OverviewNote) => {
    const text = item.bullets
      ? item.text
          .split('\n')
          .map((line) => (line.trim() ? `\u2022 ${line}` : ''))
          .join('\n')
      : item.text;
    return (
      <View key={item.id} style={styles.item}>
        <View style={styles.itemHeader}>
          <Text style={[styles.itemLabel, { color: theme.colors.muted }]}>Note</Text>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <TouchableOpacity onPress={() => updateOverviewItem(sectionId, item.id, { bullets: !item.bullets })}>
              <Text style={{ color: item.bullets ? colors.primary : theme.colors.muted, fontWeight: '700', fontSize: 12 }}>{'\u2022'} Bullets</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeOverviewItem(sectionId, item.id)}>
              <Icon name="close" size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
        <TextInput
          style={[styles.noteInput, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
          value={text}
          onChangeText={(t) => updateOverviewItem(sectionId, item.id, { text: t })}
          placeholder="Write your note..."
          placeholderTextColor={theme.colors.muted}
          multiline
          textAlignVertical="top"
        />
      </View>
    );
  };

  const renderMedia = (sectionId: string, item: OverviewMedia) => (
    <View key={item.id} style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={[styles.itemLabel, { color: theme.colors.muted }]}>Media</Text>
        <TouchableOpacity onPress={() => removeOverviewItem(sectionId, item.id)}>
          <Icon name="close" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>
      {item.uri || item.base64 ? (
        <Image source={{ uri: item.base64 ? `data:image/jpeg;base64,${item.base64}` : item.uri }} style={styles.media} resizeMode="cover" />
      ) : (
        <TouchableOpacity style={styles.mediaPicker} onPress={() => pickOverviewMedia(sectionId, item.id)} activeOpacity={0.85}>
          <Icon name="camera" size={22} color={colors.primary} />
          <Text style={[styles.mediaText, { color: theme.colors.muted }]}>Add media</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPlace = (sectionId: string, item: OverviewPlace) => (
    <View key={item.id} style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={[styles.itemLabel, { color: theme.colors.muted }]}>Place</Text>
        <TouchableOpacity onPress={() => removeOverviewItem(sectionId, item.id)}>
          <Icon name="close" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>
      {item.name ? (
        <View style={styles.place}>
          {item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.placeImg} resizeMode="cover" /> : null}
          <Text style={[styles.placeName, { color: theme.colors.text }]}>{item.name}</Text>
          {item.address ? (
            <Text style={[styles.placeAddr, { color: theme.colors.muted }]} numberOfLines={1}>{item.address}</Text>
          ) : null}
          {item.description ? (
            <Text style={[styles.placeDesc, { color: theme.colors.muted }]} numberOfLines={2}>{firstSentence(item.description)}</Text>
          ) : null}
        </View>
      ) : (
        <CityPicker
          selected={[]}
          onChange={() => {}}
          citiesOnly={false}
          placeholder="Search any place..."
          onPickOne={(pl) => updateOverviewItem(sectionId, item.id, { name: pl.name, lat: pl.lat, lng: pl.lng, address: pl.address, photoUrl: pl.photoUrl })}
        />
      )}
    </View>
  );

  const renderPacking = (sectionId: string, item: OverviewPacking) => (
    <View key={item.id} style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={[styles.itemLabel, { color: theme.colors.muted }]}>Packing List</Text>
        <TouchableOpacity onPress={() => removeOverviewItem(sectionId, item.id)}>
          <Icon name="close" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>
      <TextInput
        style={[styles.titleInput, { color: theme.colors.text }]}
        value={item.title}
        onChangeText={(t) => updateOverviewItem(sectionId, item.id, { title: t })}
        placeholder="List title (e.g. Beach day)"
        placeholderTextColor={theme.colors.muted}
      />
      {item.items.map((x) => (
        <View key={x.id} style={styles.packingRow}>
          <TouchableOpacity onPress={() => updatePackingItem(sectionId, item.id, x.id, { checked: !x.checked })} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Icon name={x.checked ? 'check' : 'close'} size={16} color={x.checked ? colors.success : theme.colors.muted} />
          </TouchableOpacity>
          <TextInput
            style={[styles.packingInput, { color: theme.colors.text, textDecorationLine: x.checked ? 'line-through' : 'none' }]}
            value={x.text}
            onChangeText={(t) => updatePackingItem(sectionId, item.id, x.id, { text: t })}
            placeholder="Item"
            placeholderTextColor={theme.colors.muted}
          />
          <TouchableOpacity onPress={() => removePackingItem(sectionId, item.id, x.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Icon name="close" size={14} color={colors.danger} />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.addPackingBtn} onPress={() => addPackingItem(sectionId, item.id)} activeOpacity={0.85}>
        <Icon name="plus" size={14} color={colors.primary} />
        <Text style={styles.addPackingText}>Add item</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOverviewItem = (sectionId: string, item: OverviewItem) => {
    if (item.type === 'note') return renderNote(sectionId, item);
    if (item.type === 'media') return renderMedia(sectionId, item);
    if (item.type === 'place') return renderPlace(sectionId, item);
    return renderPacking(sectionId, item);
  };

  return (
    <View style={styles.wrap}>
      {value.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.muted }]}>Add a section to start building your overview.</Text>
      ) : null}
      {value.map((section, si) => (
        <View key={section.id || `sec-${si}`} style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <TextInput
              style={[styles.titleInput, { color: theme.colors.text }]}
              value={section.title}
              onChangeText={(t) => updateSectionTitle(section.id, t)}
              placeholder="Section title"
              placeholderTextColor={theme.colors.muted}
            />
            <TouchableOpacity onPress={() => removeSection(section.id)}>
              <Icon name="close" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
          {section.items.map((item) => renderOverviewItem(section.id, item))}
          <View style={styles.addItemRow}>
            {(['note', 'media', 'place', 'packing'] as const).map((t) => (
              <TouchableOpacity key={t} style={styles.addItemChip} onPress={() => addOverviewItem(section.id, t)} activeOpacity={0.85}>
                <Icon name={t === 'note' ? 'document' : t === 'media' ? 'camera' : t === 'place' ? 'location' : 'check'} size={14} color={colors.primary} />
                <Text style={styles.addItemChipText}>{t === 'note' ? 'Note' : t === 'media' ? 'Media' : t === 'place' ? 'Place' : 'Packing List'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <TouchableOpacity style={[styles.addSectionBtn, { backgroundColor: theme.colors.card }]} onPress={addSection} activeOpacity={0.9}>
        <Icon name="plus" size={18} color={colors.primary} />
        <Text style={styles.addSectionText}>Add Section</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  empty: { textAlign: 'center', fontSize: 14, marginVertical: spacing.xl },
  section: { borderRadius: radius.xl, padding: spacing.md, ...shadows.soft, gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleInput: { flex: 1, fontSize: 16, fontWeight: '800', paddingVertical: 4 },
  item: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm, backgroundColor: colors.background },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  noteInput: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, minHeight: 90, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  media: { width: '100%', height: 160, borderRadius: radius.md },
  mediaPicker: { height: 90, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 6 },
  mediaText: { fontSize: 13, fontWeight: '600' },
  place: { gap: 8 },
  placeImg: { width: '100%', height: 170, borderRadius: radius.md },
  placeName: { fontSize: 15, fontWeight: '700' },
  placeAddr: { fontSize: 12, marginTop: 2 },
  placeDesc: { fontSize: 12, lineHeight: 17 },
  packingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  packingInput: { flex: 1, fontSize: 14, paddingVertical: 6 },
  addPackingBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  addPackingText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  addItemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  addItemChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  addItemChipText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  addSectionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.lg, paddingVertical: 14 },
  addSectionText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
});

export default OverviewEditor;
