import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import storageService from '../services/storageService';

const PACKING_ITEMS_KEY = 'WB_PACKING_ITEMS';

type PackingItem = {
  id: string;
  text: string;
  checked: boolean;
};

const PackingChecklistScreen: React.FC = () => {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const insets = useSafeAreaInsets();
  const theme = useContext(ThemeContext);
  const navigation = useNavigation();

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    const saved = await storageService.load(PACKING_ITEMS_KEY);
    if (saved) {
      setItems(saved);
    }
  };

  const saveItems = async (newItems: PackingItem[]) => {
    await storageService.save(PACKING_ITEMS_KEY, newItems);
    setItems(newItems);
  };

  const addItem = () => {
    if (newItem.trim()) {
      const item: PackingItem = {
        id: Date.now().toString(),
        text: newItem.trim(),
        checked: false,
      };
      saveItems([...items, item]);
      setNewItem('');
      Keyboard.dismiss();
    }
  };

  const toggleItem = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    saveItems(updated);
  };

  const deleteItem = (id: string) => {
    const updated = items.filter((item) => item.id !== id);
    saveItems(updated);
  };

  const checkedCount = items.filter((item) => item.checked).length;
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Icon name="close" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Packing Checklist</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            {checkedCount}/{items.length} items packed
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressContainer, { backgroundColor: theme.colors.card }]}>
        <View style={styles.progressInfo}>
          <Text style={[styles.progressText, { color: theme.colors.text }]}>
            {Math.round(progress)}% Complete
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
          <LinearGradient
            colors={[colors.primary, '#7985FF']}
            style={[styles.progressFill, { width: `${progress}%` }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>
      </View>

      {/* Add Item Input */}
      <View style={[styles.inputContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TextInput
          placeholder="Add packing item..."
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, { color: theme.colors.text }]}
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={addItem}
        />
        <TouchableOpacity onPress={addItem} style={styles.addButton}>
          <LinearGradient
            colors={[colors.primary, '#7985FF']}
            style={styles.addButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name="plus" size={20} color={colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Packing List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => toggleItem(item.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, item.checked && styles.checkboxChecked, { borderColor: theme.colors.border }]}>
              {item.checked && (
                <LinearGradient
                  colors={[colors.primary, '#7985FF']}
                  style={styles.checkboxFill}
                >
                  <Icon name="check" size={16} color={colors.white} />
                </LinearGradient>
              )}
            </View>
            <Text
              style={[
                styles.itemText,
                { color: theme.colors.text },
                item.checked && styles.itemTextChecked,
              ]}
            >
              {item.text}
            </Text>
            <TouchableOpacity
              onPress={() => deleteItem(item.id)}
              style={styles.deleteButton}
            >
              <Icon name="trash" size={18} color={colors.accent} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="checklist" size={48} color={theme.colors.muted} />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
              No items yet. Start adding packing items!
            </Text>
          </View>
        }
      />
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
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  progressContainer: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    ...shadows.soft,
  },
  progressInfo: {
    marginBottom: spacing.sm,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  inputContainer: {
    marginHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: spacing.lg,
    ...shadows.soft,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  addButton: {
    width: 36,
    height: 36,
  },
  addButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderWidth: 0,
  },
  checkboxFill: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  deleteButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default PackingChecklistScreen;