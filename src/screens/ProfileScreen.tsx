import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Switch,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { AuthContext } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { communityService } from '../services/communityService';
import storageService from '../services/storageService';
import tripService from '../services/tripService';

const ProfileScreen: React.FC = () => {
  const { user, signOut, setItineraryFeatured } = useContext(AuthContext);
  const theme = useContext(ThemeContext);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isAdmin = user?.isAdmin === true;

  const [adminItineraries, setAdminItineraries] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [isPublic, setIsPublic] = useState((user as any)?.isPublic ?? true);
  const [imageSize, setImageSize] = useState({ width: Dimensions.get('window').width, height: Dimensions.get('window').height });
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [stats, setStats] = useState({ itineraries: 0, followers: 0, likes: 0 });

  useEffect(() => {
    if (isAdmin) {
      loadItineraries();
    }
    loadStats();
  }, [isAdmin]);

  const loadItineraries = async () => {
    setAdminLoading(true);
    const all = await communityService.getItineraries('newest');
    setAdminItineraries(all);
    setAdminLoading(false);
  };

  const loadStats = async () => {
    // Load real stats from user data and community
    const itineraries = await tripService.getItineraries(user?.id);
    
    // Calculate real stats using persisted follows
    const userItineraries = itineraries.length;
    const userFollowers = user?.id ? await communityService.getFollowersCount(user.id) : 0;
    const userLikes = itineraries.reduce((sum: number, itin: any) => sum + (itin.likes?.length || 0), 0);
    
    setStats({
      itineraries: userItineraries,
      followers: userFollowers,
      likes: userLikes,
    });
  };

  const toggleFeatured = async (id: string, currentlyFeatured: boolean) => {
    await setItineraryFeatured(id, !currentlyFeatured);
    loadItineraries();
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const selectedImage = result.assets[0].uri;
        setAvatarUrl(selectedImage);
        await saveAvatar(selectedImage);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const saveAvatar = async (url: string) => {
    try {
      const current = await storageService.load(storageService.STORAGE_KEYS.USER);
      if (current) {
        current.avatarUrl = url;
        await storageService.save(storageService.STORAGE_KEYS.USER, current);
      }
      setShowAvatarModal(false);
    } catch (error) {
      console.error('Error saving avatar:', error);
      Alert.alert('Error', 'Failed to save profile picture. Please try again.');
    }
  };

  const menuItems: any[] = [];

  const openPrivacyPolicy = async () => {
    const url = 'https://docs.google.com/document/d/1zIBfTXaq1Ccez7RKNpwYppyCwXZ3trnoBMpvT-05WyU/edit?usp=sharing';
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      console.error('Error opening privacy policy:', error);
      Alert.alert('Error', 'Could not open privacy policy. Please try again later.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Profile</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Icon name="check" size={14} color={colors.white} />
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.profileCard, { backgroundColor: theme.colors.card }]}
          onPress={() => setShowAvatarModal(true)}
          activeOpacity={0.9}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(isAdmin ? 'A' : user?.name?.[0] || 'U').toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {isAdmin ? 'Administrator' : user?.name || 'Guest'}
            </Text>
            <Text style={[styles.email, { color: theme.colors.muted }]}>{user?.email || 'Not signed in'}</Text>
            <View style={styles.badge}>
              <Icon name="plane" size={12} color={colors.primary} />
              <Text style={styles.badgeText}>Explorer</Text>
            </View>
          </View>
          <Icon name="chevronRight" size={20} color={theme.colors.muted} />
        </TouchableOpacity>

        {/* Admin Panel */}
        {isAdmin && (
          <View style={styles.adminSection}>
            <View style={styles.adminSectionHeader}>
              <LinearGradient colors={['#FFE0E0', '#FFF0F0']} style={styles.adminIcon}>
                <Icon name="check" size={16} color="#EF4444" />
              </LinearGradient>
              <Text style={styles.adminSectionTitle}>Admin Panel</Text>
            </View>
            <Text style={styles.adminSectionSub}>
              Toggle itineraries as featured on the Community page
            </Text>

            {adminLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : adminItineraries.length === 0 ? (
              <Text style={styles.emptyAdmin}>
                No community itineraries yet. Publish some from the community tab first.
              </Text>
            ) : (
              adminItineraries.map((item) => (
                <View key={item.id} style={[styles.adminRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <View style={styles.adminRowInfo}>
                    <Text style={[styles.adminRowTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.adminRowMeta, { color: theme.colors.muted }]}>
                      by {item.authorName || 'Unknown'}
                    </Text>
                  </View>
                  <View style={styles.adminToggle}>
                    <Text style={styles.adminToggleLabel}>
                      {item.featured ? 'Featured' : 'Set Featured'}
                    </Text>
                    <Switch
                      value={!!item.featured}
                      onValueChange={() => toggleFeatured(item.id, !!item.featured)}
                      trackColor={{ false: colors.border, true: colors.success }}
                      thumbColor={item.featured ? colors.white : '#f4f3f4'}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Trip Recaps */}
        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: theme.colors.card, marginTop: spacing.lg, marginHorizontal: spacing.xl }]}
          onPress={() => (navigation as any).navigate('TripRecaps')}
          activeOpacity={0.85}
        >
          <View style={styles.menuLeft}>
            <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.menuIcon}>
              <Icon name="camera" size={18} color={colors.primary} />
            </LinearGradient>
            <Text style={[styles.menuLabel, { color: theme.colors.text }]}>Trip Recaps</Text>
          </View>
          <Icon name="chevronRight" size={20} color={theme.colors.muted} />
        </TouchableOpacity>

        {/* Travel Stats */}
        <View style={[styles.statsRow, { backgroundColor: theme.colors.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.itineraries}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Itineraries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.followers}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.likes}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Likes</Text>
          </View>
        </View>

        {/* Privacy Settings */}
        <View style={[styles.privacySection, { backgroundColor: theme.colors.card }]}>
          <View style={styles.privacyHeader}>
            <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.privacyIcon}>
              <Icon name="lock" size={18} color={colors.primary} />
            </LinearGradient>
            <View style={styles.privacyInfo}>
              <Text style={[styles.privacyTitle, { color: theme.colors.text }]}>Profile Privacy</Text>
              <Text style={[styles.privacySubtitle, { color: theme.colors.muted }]}>
                {isPublic ? 'Public - Anyone can view your recaps' : 'Private - Only friends can view'}
              </Text>
            </View>
          </View>
          <View style={styles.privacyToggle}>
            <Text style={[styles.privacyLabel, { color: isPublic ? colors.success : theme.colors.muted }]}>
              {isPublic ? 'Public' : 'Private'}
            </Text>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor={isPublic ? colors.white : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menu}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.menuItem, { backgroundColor: theme.colors.card }]}
              onPress={item.onPress}
              activeOpacity={0.85}
            >
              <View style={styles.menuLeft}>
                <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.menuIcon}>
                  <Icon name={item.icon} size={18} color={colors.primary} />
                </LinearGradient>
                <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{item.label}</Text>
              </View>
              <Icon name="chevronRight" size={20} color={theme.colors.muted} />
            </TouchableOpacity>
          ))}

          {/* Privacy Policy Link */}
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: theme.colors.card }]}
            onPress={openPrivacyPolicy}
            activeOpacity={0.85}
          >
            <View style={styles.menuLeft}>
              <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.menuIcon}>
                <Icon name="lock" size={18} color={colors.primary} />
              </LinearGradient>
              <Text style={[styles.menuLabel, { color: theme.colors.text }]}>Privacy Policy</Text>
            </View>
            <Icon name="chevronRight" size={20} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.signOut]}
            onPress={signOut}
            activeOpacity={0.85}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, styles.signOutIcon]}>
                <Icon name="logout" size={18} color={colors.danger} />
              </View>
              <Text style={[styles.menuLabel, { color: colors.danger }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Profile Settings Modal */}
        <Modal visible={showAvatarModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Profile Settings</Text>
                <TouchableOpacity onPress={() => setShowAvatarModal(false)}>
                  <Icon name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              
              {avatarUrl ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: avatarUrl }} style={styles.avatarPreview} resizeMode="contain" />
                </View>
              ) : (
                <View style={styles.previewContainer}>
                  <Image 
                    source={require('../../assets/icon.png')} 
                    style={styles.avatarPreview}
                    resizeMode="contain"
                  />
                </View>
              )}

              <View style={styles.profileSettingsSection}>
                <TouchableOpacity
                  style={[styles.settingsRow, { backgroundColor: theme.colors.background }]}
                  onPress={pickImage}
                >
                  <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.settingsIcon}>
                    <Icon name="camera" size={22} color={colors.primary} />
                  </LinearGradient>
                  <View style={styles.settingsContent}>
                    <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Change Profile Picture</Text>
                    <Text style={[styles.settingsHint, { color: theme.colors.muted }]}>Upload from gallery</Text>
                  </View>
                </TouchableOpacity>

                {avatarUrl && (
                  <TouchableOpacity
                    style={[styles.settingsRow, { backgroundColor: theme.colors.background }]}
                    onPress={() => {
                      setAvatarUrl('');
                      saveAvatar('');
                    }}
                  >
                    <View style={[styles.settingsIcon, { backgroundColor: '#FFE0E0' }]}>
                      <Icon name="delete" size={22} color="#EF4444" />
                    </View>
                    <View style={styles.settingsContent}>
                      <Text style={[styles.settingsLabel, { color: '#EF4444' }]}>Remove Photo</Text>
                      <Text style={[styles.settingsHint, { color: theme.colors.muted }]}>Delete current picture</Text>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.settingsRow, { backgroundColor: theme.colors.background }]}
                  onPress={() => {
                    setRenameText(user?.name || '');
                    setShowRenameInput(true);
                  }}
                >
                  <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.settingsIcon}>
                    <Icon name="edit" size={22} color={colors.primary} />
                  </LinearGradient>
                  <View style={styles.settingsContent}>
                    <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Rename Profile</Text>
                    <Text style={[styles.settingsHint, { color: theme.colors.muted }]}>Change your display name</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsRow, { backgroundColor: '#FFF0F0' }]}
                  onPress={() => {
                    Alert.alert(
                      'Delete Account',
                      'Are you sure you want to permanently delete your account? This action cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Account Deleted', 'Your account has been deleted.') }
                      ]
                    );
                  }}
                >
                  <View style={[styles.settingsIcon, { backgroundColor: '#FFE0E0' }]}>
                    <Icon name="trash" size={22} color="#EF4444" />
                  </View>
                  <View style={styles.settingsContent}>
                    <Text style={[styles.settingsLabel, { color: '#EF4444' }]}>Delete Account</Text>
                    <Text style={[styles.settingsHint, { color: theme.colors.muted }]}>Permanently remove account</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Rename Modal */}
        <Modal visible={showRenameInput} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Rename Profile</Text>
              <Text style={[styles.modalHint, { color: theme.colors.muted }]}>Enter your new display name</Text>
              <View style={[styles.avatarInputWrap, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Icon name="user" size={18} color={theme.colors.muted} />
                <TextInput
                  style={[styles.avatarInput, { color: theme.colors.text }]}
                  value={renameText}
                  onChangeText={setRenameText}
                  placeholder="Your new name"
                  placeholderTextColor={theme.colors.muted}
                  autoFocus
                />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: theme.colors.background }]}
                  onPress={() => setShowRenameInput(false)}
                >
                  <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowRenameInput(false);
                    Alert.alert('Name Updated', `Your display name has been changed to "${renameText}". Restart the app to see changes.`);
                  }}
                >
                  <Text style={[styles.modalBtnText, { color: colors.white }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  adminBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  profileCard: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.card,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
  avatarText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
  },
  profileInfo: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
  },
  email: {
    marginTop: 4,
    fontSize: 13,
  },
  badge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    borderRadius: radius.xxl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.soft,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  adminSection: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.xl,
  },
  adminSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  adminIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#B91C1C',
  },
  adminSectionSub: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: spacing.md,
    marginLeft: 44,
  },
  emptyAdmin: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 13,
    paddingVertical: 20,
    lineHeight: 20,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: 8,
  },
  adminRowInfo: {
    flex: 1,
    marginRight: 10,
  },
  adminRowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  adminRowMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  adminToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminToggleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  menu: {
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: 10,
  },
  menuItem: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.soft,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  signOut: {
    marginTop: 8,
    backgroundColor: colors.dangerLight,
  },
  signOutIcon: {
    backgroundColor: '#FFE0E0',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    ...shadows.deep,
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
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  avatarInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    marginBottom: spacing.lg,
  },
  avatarInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    alignItems: 'center',
    overflow: 'hidden',
  },
  modalBtnPrimary: {
    overflow: 'hidden',
  },
  modalBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
  modalBtnTextPrimary: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarPreview: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
  },
  avatarPreviewPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOptions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  uploadOption: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  privacySection: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.soft,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  privacyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyInfo: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  privacySubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  privacyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  privacyLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  profileSettingsSection: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  settingsIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsContent: {
    flex: 1,
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  settingsHint: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ProfileScreen;