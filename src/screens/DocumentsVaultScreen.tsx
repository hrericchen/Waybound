import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Platform,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
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
  const [picking, setPicking] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const insets = useSafeAreaInsets();
  const theme = useContext(ThemeContext);
  const navigation = useNavigation();

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
    if (picking) return; // Prevent concurrent pickers ("Different document picking in progress")
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      const typedResult = result as any;
      if (!typedResult.canceled && typedResult.assets && typedResult.assets.length > 0) {
        const asset = typedResult.assets[0];
        const newDoc: Document = {
          id: Date.now().toString(),
          name: asset.name,
          type: asset.mimeType || 'application/pdf',
          uri: asset.uri,
          size: asset.size || 0,
          addedAt: new Date().toISOString(),
        };
        
        const updated = [newDoc, ...documents];
        await saveDocuments(updated);
        Alert.alert('Success', 'Document added successfully!');
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to add document. Please try again.');
    } finally {
      setPicking(false);
    }
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

  const isImageDoc = (type: string) => (type || '').startsWith('image/');

  // "Download" — hands the file to the OS (share/save sheet) via expo-sharing.
  const shareDocument = async (doc: Document, mode: 'View' | 'Download') => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(mode, 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(doc.uri, {
        mimeType: doc.type,
        dialogTitle: mode === 'View' ? `Open ${doc.name}` : `Save ${doc.name}`,
        UTI: doc.type,
      });
    } catch (e) {
      console.warn('Failed to share document:', e);
      Alert.alert('Error', 'Could not open the document on this device.');
    }
  };

  const handleDocPress = (doc: Document) => {
    if (isImageDoc(doc.type)) {
      setPreviewDoc(doc);
      return;
    }
    Alert.alert(doc.name, 'What would you like to do?', [
      { text: 'View', onPress: () => shareDocument(doc, 'View') },
      { text: 'Download', onPress: () => shareDocument(doc, 'Download') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Icon name="close" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Documents Vault</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            {documents.length} {documents.length === 1 ? 'document' : 'documents'} stored
          </Text>
        </View>
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
            onPress={() => handleDocPress(item)}
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
              onPress={() => handleDocPress(item)}
              style={styles.openButton}
            >
              <Icon name={isImageDoc(item.type) ? 'image' : 'eye'} size={20} color={colors.primary} />
            </TouchableOpacity>
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

      {/* Full-screen image preview */}
      <Modal visible={!!previewDoc} transparent animationType="fade" onRequestClose={() => setPreviewDoc(null)}>
        <Pressable style={styles.previewOverlay} onPress={() => setPreviewDoc(null)}>
          {previewDoc ? (
            <Image source={{ uri: previewDoc.uri }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewDoc(null)}>
            <Icon name="close" size={24} color={colors.white} />
          </TouchableOpacity>
          {previewDoc ? (
            <Text style={styles.previewName} numberOfLines={1}>{previewDoc.name}</Text>
          ) : null}
        </Pressable>
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
  openButton: {
    padding: 8,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,15,30,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
  previewClose: {
    position: 'absolute',
    top: 48,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    position: 'absolute',
    bottom: 48,
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
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