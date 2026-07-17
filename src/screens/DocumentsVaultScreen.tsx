import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
// import * as DocumentPicker from 'expo-document-picker';
// import * as FileSystem from 'expo-file-system';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import storageService from '../services/storageService';

const DOCUMENTS_KEY = 'WB_DOCUMENTS';

type Document = {
  id: string;
  name: string;
  type: string;
  uri: string;
  size: number;
  addedAt: string;
};

const DocumentsVaultScreen: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const insets = useSafeAreaInsets();
  const theme = useContext(ThemeContext);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const saved = await storageService.load(DOCUMENTS_KEY);
    if (saved) {
      setDocuments(saved);
    }
  };

  const saveDocuments = async (newDocs: Document[]) => {
    await storageService.save(DOCUMENTS_KEY, newDocs);
    setDocuments(newDocs);
  };

  const pickDocument = async () => {
    Alert.alert(
      'Add Document',
      'Document picker will be available after installing expo-document-picker. For now, you can manually add documents.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Sample',
          onPress: () => {
            const doc: Document = {
              id: Date.now().toString(),
              name: 'Sample Document.pdf',
              type: 'application/pdf',
              uri: 'sample',
              size: 0,
              addedAt: new Date().toISOString(),
            };
            const updated = [...documents, doc];
            saveDocuments(updated);
          },
        },
      ]
    );
  };

  const deleteDocument = (id: string) => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = documents.filter((doc) => doc.id !== id);
            await saveDocuments(updated);
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return 'document';
    if (type.includes('image')) return 'image';
    return 'document';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Documents Vault</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          {documents.length} {documents.length === 1 ? 'document' : 'documents'} stored
        </Text>
      </View>

      {/* Add Document Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={pickDocument}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={[colors.primary, '#7985FF']}
          style={styles.addButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Icon name="plus" size={24} color={colors.white} />
          <Text style={styles.addButtonText}>Add Document</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Documents List */}
      <FlatList
        data={documents}
        keyExtractor={(doc) => doc.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.documentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            activeOpacity={0.9}
          >
            <View style={[styles.documentIcon, { backgroundColor: colors.primary + '20' }]}>
              <Icon name={getFileIcon(item.type)} size={28} color={colors.primary} />
            </View>
            <View style={styles.documentInfo}>
              <Text style={[styles.documentName, { color: theme.colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.documentMeta, { color: theme.colors.muted }]}>
                {formatFileSize(item.size)} • {new Date(item.addedAt).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => deleteDocument(item.id)}
              style={styles.deleteButton}
            >
              <Icon name="trash" size={20} color={colors.accent} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="document" size={48} color={theme.colors.muted} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No documents yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
              Store your tickets, hotel vouchers, and travel documents here
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
  addButton: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.soft,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  documentMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});

export default DocumentsVaultScreen;