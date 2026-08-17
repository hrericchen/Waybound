import React, { useContext, useEffect, useState, useCallback } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import Avatar from '../components/Avatar';
import { useRevenueCat } from '../context/RevenueCatContext';
import { communityService } from '../services/communityService';
import { apiService } from '../services/apiService';
import storageService from '../services/storageService';
import tripService from '../services/tripService';
import { getFirebaseAuth } from '../services/firebase';
import { updateProfile } from 'firebase/auth';
import { sanitizeDisplayName } from '../utils/displayName';
import TRAVELER_TAGS, { getTagById } from '../config/tags';
import { posthog } from '../config/posthog';
import { useTour } from '../context/TourContext';

const ProfileScreen: React.FC = () => {
    const { user, signOut, deleteAccount, setItineraryFeatured, updateUser } = useContext(AuthContext);
  const theme = useContext(ThemeContext);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isAdmin = user?.isAdmin === true;
  const { isPro, presentPaywall, manageSubscription } = useRevenueCat();
  const {
    registerTarget,
    startTour,
    hasHomeTourCompleted,
    hasProfileTourCompleted,
    active: tourActive,
  } = useTour();

  const [adminItineraries, setAdminItineraries] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [isPublic, setIsPublic] = useState((user as any)?.isPublic ?? true);
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [stats, setStats] = useState({ itineraries: 0, followers: 0, likes: 0 });
  const [adminSearch, setAdminSearch] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState(user?.tag || 'explorer');
  const [adminCoverItineraryId, setAdminCoverItineraryId] = useState<string | null>(null);
  // Moderation inbox state (admin only)
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [moderationTarget, setModerationTarget] = useState<any>(null);
  const [modNote, setModNote] = useState('');
  const [modBusy, setModBusy] = useState(false);
  // Entitlement grants (RevenueCat Pro / Mini) — admin only
  const [entUid, setEntUid] = useState('');
  const [entCustomer, setEntCustomer] = useState<any>(null);
  const [entLookupLoading, setEntLookupLoading] = useState(false);
  const [entActionLoading, setEntActionLoading] = useState(false);
  const [entDuration, setEntDuration] = useState('lifetime');
  const [entError, setEntError] = useState('');

  const currentTag = getTagById(selectedTagId);

  useEffect(() => {
    if (isAdmin) {
      loadItineraries();
    }
    loadStats();
  }, [isAdmin]);

  // First time you open the Profile tab (once the home tour has been seen),
  // run the profile customization tour — same rules as the other tutorials.
  // While any tour is active we wait; when it ends this effect re-runs (still
  // focused) and starts the profile tour.
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const maybeStart = async () => {
        const homeDone = await hasHomeTourCompleted(user?.id);
        const profileDone = await hasProfileTourCompleted(user?.id);
        if (homeDone && !profileDone && mounted) {
          setTimeout(() => {
            if (mounted) startTour('profile');
          }, 700);
        }
      };
      // Never fight an already-running tour (e.g. the home tour pointing at this tab).
      if (!tourActive) {
        maybeStart();
      }
      return () => {
        mounted = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tourActive, hasProfileTourCompleted, startTour, user?.id])
  );

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

  const loadReports = useCallback(async () => {
    if (!isAdmin) return;
    setReportsLoading(true);
    try {
      const list = await communityService.getReports();
      setReports(list);
    } catch (e) {
      console.warn('Failed to load reports:', e);
    } finally {
      setReportsLoading(false);
    }
  }, [isAdmin]);

  // ---- Admin: RevenueCat Pro / Mini entitlement grants (via backend) ----

  const getAdminToken = async (): Promise<string> => {
    const fbUser = getFirebaseAuth().currentUser;
    if (!fbUser) throw new Error('Not signed in as admin');
    return await fbUser.getIdToken();
  };

  const lookupCustomer = async (): Promise<void> => {
    const uid = entUid.trim();
    if (!uid) {
      Alert.alert('Enter a User ID', "Paste the user's Firebase UID to look up.");
      return;
    }
    setEntLookupLoading(true);
    setEntError('');
    try {
      const token = await getAdminToken();
      const res = await apiService.adminGetCustomer(token, uid);
      if (res.error) {
        setEntError(res.error);
        setEntCustomer(null);
      } else {
        setEntCustomer(res.data);
      }
    } catch (e: any) {
      setEntError(e?.message || 'Lookup failed');
      setEntCustomer(null);
    } finally {
      setEntLookupLoading(false);
    }
  };

  const runEntitlement = async (action: 'grant' | 'revoke', entitlement: 'pro' | 'mini') => {
    const uid = entUid.trim();
    if (!uid) {
      Alert.alert('Enter a User ID', "Paste the user's Firebase UID first.");
      return;
    }
    const tierLabel = entitlement === 'pro' ? 'Pro' : 'Mini';
    const verb = action === 'grant' ? 'Grant' : 'Revoke';
    const durationLabel =
      action === 'grant' && entDuration !== 'lifetime'
        ? ` for ${entDuration === 'P30D' ? '1 month' : entDuration === 'P7D' ? '7 days' : entDuration}`
        : '';
    Alert.alert(
      `${verb} ${tierLabel}`,
      `${verb} ${tierLabel}${durationLabel} for user ${uid}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          onPress: async () => {
            setEntActionLoading(true);
            setEntError('');
            try {
              const token = await getAdminToken();
              const res = await apiService.adminEntitlement(token, {
                uid,
                entitlement,
                action,
                duration: action === 'grant' ? entDuration : undefined,
              });
              if (res.error) {
                setEntError(res.error);
                Alert.alert('Failed', res.error);
              } else {
                Alert.alert('Done', res.data?.message || 'Updated');
                lookupCustomer();
              }
            } catch (e: any) {
              setEntError(e?.message || 'Request failed');
              Alert.alert('Failed', e?.message || 'Request failed');
            } finally {
              setEntActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Refresh the reports badge every time the Profile tab is opened.
  useFocusEffect(
    useCallback(() => {
      if (isAdmin) loadReports();
    }, [isAdmin, loadReports])
  );

  const handleResolveReport = async (reportId: string) => {
    const ok = await communityService.resolveReport(reportId);
    if (ok) {
      setReports(prev => prev.filter(r => r.id !== reportId));
      Alert.alert('Dismissed', 'The report has been closed.');
    } else {
      Alert.alert('Error', 'Could not dismiss the report. Please try again.');
    }
  };

  // ---- Admin moderation actions (warning / suspension / account deletion) ----

  const openModeration = (report: any) => {
    setModerationTarget(report);
    setModNote('');
    setShowModerationModal(true);
  };

  const closeModeration = () => {
    if (modBusy) return;
    setShowModerationModal(false);
    setModerationTarget(null);
    setModNote('');
  };

  const finishModerationAction = async (reportId: string, actionLabel: string) => {
    const resolved = await communityService.resolveReport(reportId);
    if (resolved) setReports(prev => prev.filter(r => r.id !== reportId));
    setShowModerationModal(false);
    setModerationTarget(null);
    setModNote('');
    setModBusy(false);
    Alert.alert(
      actionLabel,
      resolved
        ? 'The report has been closed.'
        : 'The report could not be closed automatically — you can dismiss it manually.'
    );
  };

  // Admin actions run through the backend (server-side, tamper-proof) using the
  // admin's Firebase ID token. If the backend isn't reachable/configured, we
  // fall back to client-side Firestore so moderation still works in dev.
  const getAdminIdToken = async (): Promise<string | null> => {
    try {
      const auth = getFirebaseAuth();
      return (await auth.currentUser?.getIdToken()) || null;
    } catch (e) {
      console.warn('[moderation] Failed to get admin token:', e);
      return null;
    }
  };

  const handleWarnUser = async () => {
    if (!moderationTarget || !user?.id) return;
    setModBusy(true);
    let ok = false;
    const token = await getAdminIdToken();
    if (token) {
      const res = await apiService.adminModeration(token, 'warn', {
        uid: moderationTarget.targetUserId,
        reason: moderationTarget.reason,
        note: modNote.trim(),
      });
      ok = !!res.data?.ok;
      if (!ok) console.warn('[moderation] Server warn failed:', res.error);
    }
    if (!ok) {
      // Dev fallback: client-side Firestore (server not configured/reachable).
      ok = await communityService.warnUser(
        user.id,
        moderationTarget.targetUserId,
        moderationTarget.reason,
        modNote.trim()
      );
    }
    if (ok) {
      await finishModerationAction(moderationTarget.id, 'Warning sent');
    } else {
      setModBusy(false);
      Alert.alert('Error', 'Could not send the warning. Please try again.');
    }
  };

  const handleSuspendUser = async (days: number) => {
    if (!moderationTarget || !user?.id) return;
    setModBusy(true);
    let ok = false;
    const token = await getAdminIdToken();
    if (token) {
      const res = await apiService.adminModeration(token, 'suspend', {
        uid: moderationTarget.targetUserId,
        days,
        reason: moderationTarget.reason,
        note: modNote.trim(),
      });
      ok = !!res.data?.ok;
      if (!ok) console.warn('[moderation] Server suspend failed:', res.error);
    }
    if (!ok) {
      // Dev fallback: client-side Firestore (server not configured/reachable).
      ok = await communityService.suspendUser(
        user.id,
        moderationTarget.targetUserId,
        days,
        moderationTarget.reason,
        modNote.trim()
      );
    }
    if (ok) {
      await finishModerationAction(moderationTarget.id, `Suspended ${days} day${days > 1 ? 's' : ''}`);
    } else {
      setModBusy(false);
      Alert.alert('Error', 'Could not suspend the account. Please try again.');
    }
  };

  const handleDeleteReportedAccount = () => {
    if (!moderationTarget) return;
    Alert.alert(
      'Delete Account',
      `This will permanently delete ${moderationTarget.targetName}'s account from the server — their profile, itineraries, follows, and notifications will be gone, and they will no longer be able to sign in. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setModBusy(true);
            let ok = false;
            const token = await getAdminIdToken();
            if (token) {
              const res = await apiService.adminModeration(token, 'delete', {
                uid: moderationTarget.targetUserId,
              });
              ok = !!res.data?.ok;
              if (!ok) console.warn('[moderation] Server delete failed:', res.error);
            }
            if (!ok) {
              // Dev fallback: tombstone the account client-side (server down).
              ok = await communityService.deleteAccount(moderationTarget.targetUserId);
            }
            if (ok) {
              await finishModerationAction(moderationTarget.id, 'Account deleted');
            } else {
              setModBusy(false);
              Alert.alert('Error', 'Could not delete the account. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDismissFromModal = async () => {
    if (!moderationTarget) return;
    setModBusy(true);
    const ok = await communityService.resolveReport(moderationTarget.id);
    setModBusy(false);
    setShowModerationModal(false);
    setModerationTarget(null);
    setModNote('');
    if (ok) {
      setReports(prev => prev.filter(r => r.id !== moderationTarget.id));
      Alert.alert('Dismissed', 'The report has been closed.');
    } else {
      Alert.alert('Error', 'Could not dismiss the report. Please try again.');
    }
  };

  const formatReportTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const toggleFeatured = async (id: string, currentlyFeatured: boolean) => {
    const newFeatured = !currentlyFeatured;
    setAdminItineraries(prev => prev.map(item => 
      item.id === id ? { ...item, featured: newFeatured } : item
    ));
    await setItineraryFeatured(id, newFeatured);
    await communityService.setItineraryFeatured(id, newFeatured);
    setTimeout(() => loadItineraries(), 500);
  };

  const pickAdminCoverImage = async (itineraryId: string) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload a cover image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.4,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const base64 = asset.base64 || '';
        const dataUri = base64 ? `data:image/jpeg;base64,${base64}` : asset.uri;
        if (base64 || dataUri.startsWith('data:image')) {
          await communityService.updateItineraryCoverImage(itineraryId, dataUri);
        }
        setTimeout(() => loadItineraries(), 500);
      }
    } catch (error) {
      console.error('Error picking admin cover image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
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
        allowsEditing: false,
        quality: 0.4,
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
        // Update the auth context immediately so the home avatar refreshes.
        try {
          await updateUser({ avatarUrl: url });
        } catch (e) {
          console.warn('Failed to update user context avatar:', e);
        }
        // Sync avatar to Firestore so other users can see it
        try {
          await communityService.registerUser({
            id: current.id,
            name: current.name || 'User',
            email: current.email || '',
            avatarUrl: url,
            tag: current.tag,
            isAdmin: current.isAdmin,
          });
        } catch (e) {
          console.warn('Failed to sync avatar to Firestore:', e);
        }
        // Update the avatar on the user's existing posts / itineraries / comments.
        try {
          if (current.id) {
            await communityService.updateAuthorAvatar(current.id, url);
          }
        } catch (e) {
          console.warn('Failed to update author avatars:', e);
        }
      }
    } catch (error) {
      console.error('Error saving avatar:', error);
      Alert.alert('Error', 'Failed to save profile picture. Please try again.');
    }
  };

  const handleTagSelect = async (tagId: string) => {
    setSelectedTagId(tagId);
    setShowTagPicker(false);

    // Save tag to user storage + sync to Firestore
    try {
      const current = await storageService.load(storageService.STORAGE_KEYS.USER);
      if (current) {
        current.tag = tagId;
        await storageService.save(storageService.STORAGE_KEYS.USER, current);
        // Sync tag to Firestore so it shows server-side in community users list
        try {
          await communityService.registerUser({
            id: current.id,
            name: current.name || 'User',
            email: current.email || '',
            avatarUrl: current.avatarUrl,
            tag: tagId,
            isAdmin: current.isAdmin,
          });
        } catch (e) {
          console.warn('Failed to sync tag to Firestore:', e);
        }
      }
      // Track tag change in PostHog
      if (posthog) {
        posthog.capture('tag_changed', { tag_id: tagId, tag_name: getTagById(tagId)?.name });
      }
    } catch (error) {
      console.error('Error saving tag:', error);
    }
  };

  const menuItems: any[] = [];

  const openPrivacyPolicy = async () => {
    const url = 'https://kaviastudios.com#legal=waybound-privacy';
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
      <ScrollView
        ref={(r) => registerTarget('profile-scroll', r)}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Profile</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isPro ? (
              <TouchableOpacity 
                style={styles.manageBtn}
                onPress={() => manageSubscription()}
              >
                <Text style={styles.manageBtnText}>MANAGE</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.upgradeBtn}
                onPress={() => presentPaywall()}
              >
                <Text style={styles.upgradeBtnText}>UPGRADE</Text>
              </TouchableOpacity>
            )}
            {isAdmin && (
              <View style={styles.adminBadge}>
                <Icon name="check" size={14} color={colors.white} />
                <Text style={styles.adminBadgeText}>ADMIN</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity 
          ref={(r) => registerTarget('profile-card', r)}
          style={[styles.profileCard, { backgroundColor: theme.colors.card }]}
          onPress={() => setShowAvatarModal(true)}
          activeOpacity={0.9}
        >
          <Avatar
            uri={avatarUrl}
            name={isAdmin ? 'A' : user?.name || 'U'}
            size={72}
            radius={24}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {isAdmin ? 'Administrator' : user?.name || 'Guest'}
            </Text>
            <Text style={[styles.email, { color: theme.colors.muted }]}>{user?.email || 'Not signed in'}</Text>
            <View
              collapsable={false}
              ref={(r) => registerTarget('profile-tag', r)}
              style={[styles.badge, currentTag ? { backgroundColor: currentTag.bgColor, borderColor: currentTag.color, borderWidth: 1 } : {}]}
            >
              {currentTag ? (
                <>
                  <Text style={styles.badgeEmoji}>{currentTag.emoji}</Text>
                  <Text style={[styles.badgeText, { color: currentTag.color }]}>{currentTag.name}</Text>
                </>
              ) : (
                <>
                  <Icon name="plane" size={12} color={colors.primary} />
                  <Text style={styles.badgeText}>Explorer</Text>
                </>
              )}
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
              Manage community itineraries: feature, add covers, or delete.
            </Text>

            {/* Admin actions — moderation only (admin grants removed) */}
            <View style={styles.adminActionRow}>
              <TouchableOpacity
                style={[styles.adminActionBtn, { backgroundColor: '#EF4444' + '15', borderColor: '#EF4444' }]}
                onPress={async () => {
                  if (!isAdmin) return;
                  Alert.alert('Clean Up', 'Remove official itineraries (奇峰异洞, Japan, Europe, Bali, NYC, Thailand) from community?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove All', style: 'destructive', onPress: async () => {
                      const result = await communityService.deleteOfficialFromCommunity();
                      Alert.alert('Done', `Removed ${result.deleted} items.`);
                      loadItineraries();
                    }},
                  ]);
                }}
              >
                <Icon name="trash" size={14} color="#EF4444" />
                <Text style={[styles.adminActionBtnText, { color: '#EF4444' }]}>Clean Up Official</Text>
              </TouchableOpacity>
            </View>

            {/* Pro / Mini entitlement grants (RevenueCat, proxied via backend) */}
            <View style={[styles.entCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.adminReportsLeft}>
                <View style={[styles.adminReportsIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Icon name="crown" size={16} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.adminReportsTitle, { color: theme.colors.text }]}>Pro / Mini Entitlements</Text>
                  <Text style={[styles.adminReportsSub, { color: theme.colors.muted }]}>
                    Grant or revoke RevenueCat Pro / Mini for any user (Firebase UID).
                  </Text>
                </View>
              </View>

              <View style={[styles.avatarInputWrap, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Icon name="person" size={18} color={theme.colors.muted} />
                <TextInput
                  style={[styles.avatarInput, { color: theme.colors.text }]}
                  value={entUid}
                  onChangeText={setEntUid}
                  placeholder="User Firebase UID"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.entRow}>
                <TouchableOpacity
                  style={[styles.entBtn, { backgroundColor: '#DBEAFE' }]}
                  onPress={lookupCustomer}
                  disabled={entLookupLoading}
                  activeOpacity={0.85}
                >
                  {entLookupLoading ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <Icon name="search" size={14} color="#2563EB" />
                  )}
                  <Text style={[styles.entBtnText, { color: '#2563EB' }]}>Look up</Text>
                </TouchableOpacity>
              </View>

              {entError ? <Text style={styles.entError}>{entError}</Text> : null}

              {entCustomer ? (
                <>
                  <View style={[styles.entStatus, { backgroundColor: theme.colors.background }]}>
                    <Text style={[styles.adminRowMeta, { color: theme.colors.muted }]}>
                      {entCustomer.found
                        ? `Pro: ${entCustomer.activeEntitlements?.includes('Waybound Pro') ? 'ACTIVE' : 'inactive'}  •  Mini: ${entCustomer.activeEntitlements?.includes('Waybound Mini') ? 'ACTIVE' : 'inactive'}`
                        : 'Not found in RevenueCat yet (grants below will create the customer).'}
                    </Text>
                  </View>

                  <View style={styles.entDurationRow}>
                    {[
                      { key: 'lifetime', label: 'Lifetime' },
                      { key: 'P30D', label: '1 Month' },
                      { key: 'P7D', label: '7 Days' },
                    ].map((d) => (
                      <TouchableOpacity
                        key={d.key}
                        style={[
                          styles.entDurationBtn,
                          entDuration === d.key
                            ? { backgroundColor: '#2563EB', borderColor: '#2563EB' }
                            : { borderColor: theme.colors.border },
                        ]}
                        onPress={() => setEntDuration(d.key)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.entDurationText,
                            { color: entDuration === d.key ? '#FFFFFF' : theme.colors.muted },
                          ]}
                        >
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.entBtnGrid}>
                    <TouchableOpacity
                      style={[styles.entBtn, { backgroundColor: '#DBEAFE' }]}
                      onPress={() => runEntitlement('grant', 'pro')}
                      disabled={entActionLoading}
                      activeOpacity={0.85}
                    >
                      <Icon name="crown" size={14} color="#2563EB" />
                      <Text style={[styles.entBtnText, { color: '#2563EB' }]}>Grant Pro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.entBtn, { backgroundColor: '#FEE2E2' }]}
                      onPress={() => runEntitlement('revoke', 'pro')}
                      disabled={entActionLoading}
                      activeOpacity={0.85}
                    >
                      <Icon name="close" size={14} color="#DC2626" />
                      <Text style={[styles.entBtnText, { color: '#DC2626' }]}>Revoke Pro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.entBtn, { backgroundColor: '#FEF3C7' }]}
                      onPress={() => runEntitlement('grant', 'mini')}
                      disabled={entActionLoading}
                      activeOpacity={0.85}
                    >
                      <Icon name="star" size={14} color="#D97706" />
                      <Text style={[styles.entBtnText, { color: '#D97706' }]}>Grant Mini</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.entBtn, { backgroundColor: '#FEE2E2' }]}
                      onPress={() => runEntitlement('revoke', 'mini')}
                      disabled={entActionLoading}
                      activeOpacity={0.85}
                    >
                      <Icon name="close" size={14} color="#DC2626" />
                      <Text style={[styles.entBtnText, { color: '#DC2626' }]}>Revoke Mini</Text>
                    </TouchableOpacity>
                  </View>

                  {entActionLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} /> : null}
                </>
              ) : null}
            </View>

            {/* Reports inbox (moderation) */}
            <TouchableOpacity
              style={[styles.adminReportsRow, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => {
                setShowReportsModal(true);
                loadReports();
              }}
              activeOpacity={0.85}
            >
              <View style={styles.adminReportsLeft}>
                <View style={[styles.adminReportsIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Icon name="flag" size={16} color="#EF4444" />
                </View>
                <View>
                  <Text style={[styles.adminReportsTitle, { color: theme.colors.text }]}>Reports</Text>
                  <Text style={[styles.adminReportsSub, { color: theme.colors.muted }]}>
                    {reportsLoading
                      ? 'Loading...'
                      : reports.length === 0
                        ? 'No open reports'
                        : `${reports.length} open report${reports.length > 1 ? 's' : ''}`}
                  </Text>
                </View>
              </View>
              {reports.length > 0 && (
                <View style={styles.reportsBadge}>
                  <Text style={styles.reportsBadgeText}>{reports.length}</Text>
                </View>
              )}
              <Icon name="chevronRight" size={20} color={theme.colors.muted} />
            </TouchableOpacity>

            {/* Admin Search */}
            <View style={[styles.avatarInputWrap, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, marginBottom: spacing.md }]}>
              <Icon name="search" size={18} color={theme.colors.muted} />
              <TextInput
                style={[styles.avatarInput, { color: theme.colors.text }]}
                value={adminSearch}
                onChangeText={setAdminSearch}
                placeholder="Search itineraries..."
                placeholderTextColor={theme.colors.muted}
              />
            </View>

            {adminLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : !adminSearch.trim() ? (
              <Text style={styles.emptyAdmin}>
                Search for itineraries by title or author to manage featured status.
              </Text>
            ) : (() => {
              const filtered = adminItineraries.filter(item =>
                item.title?.toLowerCase().includes(adminSearch.toLowerCase()) ||
                item.authorName?.toLowerCase().includes(adminSearch.toLowerCase())
              );
              return filtered.length === 0 ? (
                <Text style={styles.emptyAdmin}>
                  No itineraries found matching "{adminSearch}".
                </Text>
              ) : (
                filtered.map((item) => (
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
                      <TouchableOpacity
                        style={[styles.adminCoverBtn, { backgroundColor: colors.primarySoft }]}
                        onPress={() => pickAdminCoverImage(item.id)}
                      >
                        <Icon name="image" size={14} color={colors.primary} />
                        <Text style={[styles.adminCoverBtnText, { color: colors.primary }]}>
                          {item.coverImage || item.coverImageBase64 ? 'Change Cover' : 'Add Cover'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.adminDeleteBtn, { backgroundColor: '#FEE2E2' }]}
                        onPress={() => {
                          Alert.alert('Delete Itinerary', `Delete "${item.title}"?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: async () => {
                              const ok = await communityService.adminDeleteItinerary(item.id);
                              if (ok) loadItineraries();
                              else Alert.alert('Error', 'Failed to delete.');
                            }},
                          ]);
                        }}
                      >
                        <Icon name="trash" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              );
            })()}
          </View>
        )}

        {/* Trip Recaps */}
        <TouchableOpacity
          ref={(r) => registerTarget('profile-recaps', r)}
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
        <View
          collapsable={false}
          ref={(r) => registerTarget('profile-privacy', r)}
          style={[styles.privacySection, { backgroundColor: theme.colors.card }]}
        >
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
              onValueChange={async (val) => {
                setIsPublic(val);
                try {
                  const current = await storageService.load(storageService.STORAGE_KEYS.USER) || {};
                  current.isPublic = val;
                  await storageService.save(storageService.STORAGE_KEYS.USER, current);
                  await communityService.registerUser({
                    id: current.id,
                    name: current.name,
                    email: current.email,
                    avatarUrl: current.avatarUrl,
                    tag: current.tag,
                    isAdmin: current.isAdmin,
                  });
                  // Update isPublic in Firestore
                  const { getFirestoreDb } = require('../services/firebase');
                  const { doc, updateDoc } = require('firebase/firestore');
                  await updateDoc(doc(getFirestoreDb(), 'users', current.id), { isPublic: val });
                } catch {}
              }}
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
              
              <View style={styles.previewContainer}>
                <Avatar
                  uri={avatarUrl}
                  name={user?.name || 'U'}
                  size={140}
                  radius={radius.xl}
                  style={styles.avatarPreview}
                />
              </View>

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

                {/* Tag Selection */}
                <TouchableOpacity
                  style={[styles.settingsRow, { backgroundColor: theme.colors.background }]}
                  onPress={() => setShowTagPicker(true)}
                >
                  <LinearGradient
                    colors={[currentTag?.color ? currentTag.color + '30' : colors.primarySoft, '#E0E4FF']}
                    style={styles.settingsIcon}
                  >
                    <Text style={{ fontSize: 20 }}>{currentTag?.emoji || '🔭'}</Text>
                  </LinearGradient>
                  <View style={styles.settingsContent}>
                    <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>
                      Choose Traveler Tag
                    </Text>
                    <Text style={[styles.settingsHint, { color: currentTag?.color || theme.colors.muted }]}>
                      {currentTag?.name || 'Explorer'}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={20} color={theme.colors.muted} />
                </TouchableOpacity>

                                <TouchableOpacity
                  style={[styles.settingsRow, { backgroundColor: '#FFF0F0' }]}
                  onPress={() => {
                    Alert.alert(
                      'Delete Account',
                      'This will permanently delete your account, your profile, all your itineraries, and every trace of your data in Firebase. This cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete My Account',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await deleteAccount();
                              // Once user is null, RootNavigator switches to the
                              // Auth stack (Splash -> SignIn) automatically.
                            } catch (e) {
                              console.warn('Delete account failed:', e);
                              Alert.alert('Error', 'Something went wrong while deleting your account. Please try again.');
                            }
                          },
                        },
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

        {/* Tag Picker Modal */}
        <Modal visible={showTagPicker} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.card, maxHeight: '80%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  Choose Your Tag
                </Text>
                <TouchableOpacity onPress={() => setShowTagPicker(false)}>
                  <Icon name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                {TRAVELER_TAGS.map((tag) => {
                  const isSelected = selectedTagId === tag.id;
                  const isProTag = tag.id === 'pro';
                  const isLocked = isProTag && !isPro;
                  
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      style={[
                        styles.tagOption,
                        {
                          backgroundColor: isSelected ? tag.bgColor : theme.colors.background,
                          borderColor: isSelected ? tag.color : theme.colors.border,
                          borderWidth: isSelected ? 2 : 1,
                          opacity: isLocked ? 0.5 : 1,
                        },
                      ]}
                      onPress={() => {
                        if (isLocked) {
                          presentPaywall();
                          return;
                        }
                        handleTagSelect(tag.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.tagOptionLeft}>
                        <View style={[styles.tagOptionEmoji, { backgroundColor: tag.bgColor }]}>
                          <Text style={{ fontSize: 22 }}>{tag.emoji}</Text>
                        </View>
                        <View style={styles.tagOptionInfo}>
                          <Text style={[styles.tagOptionName, { color: tag.color }]}>
                            {tag.name}
                            {isLocked ? ' ' : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tagOptionCheckWrap}>
                        {isLocked ? (
                          <Icon name="lock" size={18} color={tag.color} />
                        ) : isSelected ? (
                          <Icon name="check" size={20} color={tag.color} />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Reports Modal (admin moderation inbox) */}
        <Modal visible={showReportsModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.card, maxHeight: '85%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Reports</Text>
                <TouchableOpacity onPress={() => setShowReportsModal(false)}>
                  <Icon name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.modalHint, { color: theme.colors.muted, marginBottom: spacing.md }]}>
                {reports.length === 0
                  ? 'No open reports — you’re all caught up!'
                  : `Reviewing ${reports.length} open report${reports.length > 1 ? 's' : ''}.`}
              </Text>
              {reportsLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
              ) : reports.length === 0 ? (
                <View style={styles.reportsEmptyWrap}>
                  <Icon name="flag" size={40} color={colors.muted} />
                  <Text style={[styles.reportsEmpty, { color: theme.colors.muted }]}>No reports yet</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                  {reports.map((r) => (
                    <View
                      key={r.id}
                      style={[styles.reportItem, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                    >
                      <View style={styles.reportItemTop}>
                        <View style={styles.reportIcon}>
                          <Icon name="flag" size={16} color="#EF4444" />
                        </View>
                        <View style={styles.reportInfo}>
                          <Text style={[styles.reportReason, { color: theme.colors.text }]} numberOfLines={2}>
                            {r.reason || 'Report'}
                          </Text>
                          <Text style={[styles.reportMeta, { color: theme.colors.muted }]} numberOfLines={1}>
                            {r.reporterName} reported {r.targetName} · {formatReportTime(r.createdAt)}
                          </Text>
                          {(r.targetWarningCount > 0 || r.targetSuspended || r.targetDeleted) && (
                            <View style={styles.reportBadges}>
                              {r.targetWarningCount > 0 && (
                                <View style={[styles.reportBadge, { backgroundColor: '#FEF3C7' }]}>
                                  <Text style={[styles.reportBadgeText, { color: '#B45309' }]}>
                                    {r.targetWarningCount} warning{r.targetWarningCount > 1 ? 's' : ''}
                                  </Text>
                                </View>
                              )}
                              {r.targetSuspended && (
                                <View style={[styles.reportBadge, { backgroundColor: '#FDE68A' }]}>
                                  <Text style={[styles.reportBadgeText, { color: '#92400E' }]}>Suspended</Text>
                                </View>
                              )}
                              {r.targetDeleted && (
                                <View style={[styles.reportBadge, { backgroundColor: '#FEE2E2' }]}>
                                  <Text style={[styles.reportBadgeText, { color: '#B91C1C' }]}>Deleted</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.reportActions}>
                        <TouchableOpacity
                          style={[styles.reportActionBtn, { backgroundColor: colors.primarySoft }]}
                          onPress={() => {
                            setShowReportsModal(false);
                            (navigation as any).navigate('UserProfile', { userId: r.targetUserId });
                          }}
                        >
                          <Text style={[styles.reportActionText, { color: colors.primary }]}>View Profile</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.reportActionBtn, { backgroundColor: '#EEF2FF' }]}
                          onPress={() => openModeration(r)}
                        >
                          <Text style={[styles.reportActionText, { color: '#6366F1' }]}>Take Action</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.reportActionBtn, { backgroundColor: '#F3F4F6' }]}
                          onPress={() => handleResolveReport(r.id)}
                        >
                          <Text style={[styles.reportActionText, { color: colors.muted }]}>Dismiss</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Moderation Action Modal (admin) */}
        <Modal visible={showModerationModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Take Action</Text>
                <TouchableOpacity onPress={closeModeration} disabled={modBusy}>
                  <Icon name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              {moderationTarget && (
                <>
                  <Text style={[styles.modalHint, { color: theme.colors.muted }]}>
                    {moderationTarget.targetName} · Reported for "{moderationTarget.reason}"
                  </Text>
                  <View
                    style={[
                      styles.avatarInputWrap,
                      { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                    ]}
                  >
                    <Icon name="message" size={18} color={theme.colors.muted} />
                    <TextInput
                      style={[styles.avatarInput, { color: theme.colors.text }]}
                      value={modNote}
                      onChangeText={setModNote}
                      placeholder="Note to the user (optional)"
                      placeholderTextColor={theme.colors.muted}
                      editable={!modBusy}
                    />
                  </View>
                  <Text style={[styles.moderationGroupLabel, { color: theme.colors.muted }]}>
                    What would you like to do?
                  </Text>
                  <View style={styles.moderationActions}>
                    <TouchableOpacity
                      style={[styles.moderationBtn, { backgroundColor: '#FEF3C7' }]}
                      onPress={handleWarnUser}
                      disabled={modBusy}
                      activeOpacity={0.8}
                    >
                      <Icon name="warning" size={20} color="#D97706" />
                      <View style={styles.moderationBtnBody}>
                        <Text style={[styles.moderationBtnTitle, { color: '#92400E' }]}>Send Warning</Text>
                        <Text style={[styles.moderationBtnSub, { color: '#B45309' }]}>
                          Notifies them in-app and records a warning
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.moderationBtn, { backgroundColor: '#FEF3C7' }]}
                      onPress={() => handleSuspendUser(1)}
                      disabled={modBusy}
                      activeOpacity={0.8}
                    >
                      <Icon name="lock" size={20} color="#D97706" />
                      <View style={styles.moderationBtnBody}>
                        <Text style={[styles.moderationBtnTitle, { color: '#92400E' }]}>Suspend 1 Day</Text>
                        <Text style={[styles.moderationBtnSub, { color: '#B45309' }]}>
                          Blocks their access for 24 hours
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.moderationBtn, { backgroundColor: '#FEF3C7' }]}
                      onPress={() => handleSuspendUser(7)}
                      disabled={modBusy}
                      activeOpacity={0.8}
                    >
                      <Icon name="lock" size={20} color="#D97706" />
                      <View style={styles.moderationBtnBody}>
                        <Text style={[styles.moderationBtnTitle, { color: '#92400E' }]}>Suspend 7 Days</Text>
                        <Text style={[styles.moderationBtnSub, { color: '#B45309' }]}>
                          Blocks their access for one week
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.moderationBtn, { backgroundColor: '#FEF3C7' }]}
                      onPress={() => handleSuspendUser(30)}
                      disabled={modBusy}
                      activeOpacity={0.8}
                    >
                      <Icon name="lock" size={20} color="#D97706" />
                      <View style={styles.moderationBtnBody}>
                        <Text style={[styles.moderationBtnTitle, { color: '#92400E' }]}>Suspend 30 Days</Text>
                        <Text style={[styles.moderationBtnSub, { color: '#B45309' }]}>
                          Blocks their access for one month
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.moderationBtn, { backgroundColor: '#FEE2E2' }]}
                      onPress={handleDeleteReportedAccount}
                      disabled={modBusy}
                      activeOpacity={0.8}
                    >
                      <Icon name="trash" size={20} color="#EF4444" />
                      <View style={styles.moderationBtnBody}>
                        <Text style={[styles.moderationBtnTitle, { color: '#B91C1C' }]}>Delete Account</Text>
                        <Text style={[styles.moderationBtnSub, { color: '#EF4444' }]}>
                          Permanently closes their account and removes all content
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.moderationBtn, { backgroundColor: '#F3F4F6' }]}
                      onPress={handleDismissFromModal}
                      disabled={modBusy}
                      activeOpacity={0.8}
                    >
                      <Icon name="check" size={20} color={colors.muted} />
                      <View style={styles.moderationBtnBody}>
                        <Text style={[styles.moderationBtnTitle, { color: colors.muted }]}>Dismiss</Text>
                        <Text style={[styles.moderationBtnSub, { color: colors.muted }]}>
                          Close this report without any action
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  {modBusy && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}
                </>
              )}
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
                  onPress={async () => {
                    if (!renameText.trim()) return;
                    // Filter offensive / leetspeak names → use a safe generated one.
                    const safe = sanitizeDisplayName(renameText);
                    if (safe.changed) setRenameText(safe.value);
                    const newName = safe.value;
                    if (!newName) return;
                    try { const usrs = await communityService.getUsers(); if (usrs.some((u: any) => u.name?.toLowerCase() === newName.toLowerCase() && u.id !== user?.id)) { Alert.alert('Name Taken', 'This display name is already in use.'); return; } } catch {}
                    setShowRenameInput(false);
                    try {
                      const current = await storageService.load(storageService.STORAGE_KEYS.USER) || {};
                      current.name = newName;
                      await storageService.save(storageService.STORAGE_KEYS.USER, current);
                      await communityService.registerUser({ id: current.id, name: newName, email: current.email, avatarUrl: current.avatarUrl, tag: current.tag });
                      // Update ALL instances of the author name across community content
                      await communityService.updateAuthorName(current.id, newName);
                      // Reflect the change immediately in the app UI
                      await updateUser({ name: newName });
                      // Also sync to Firebase auth profile so onAuthStateChanged picks it up
                      try {
                        const fbAuth = getFirebaseAuth();
                        if (fbAuth.currentUser) await updateProfile(fbAuth.currentUser, { displayName: newName });
                      } catch (_) {}
                    } catch {}
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
  upgradeBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    ...shadows.fab,
  },
  upgradeBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  manageBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    ...shadows.fab,
  },
  manageBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
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
  badgeEmoji: {
    fontSize: 12,
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
  adminCoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  adminCoverBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  adminDeleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  adminActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  adminActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  adminActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  entCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  entRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  entBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  entError: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  entStatus: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  entDurationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  entDurationBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  entDurationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  entBtnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminReportsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  adminReportsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  adminReportsIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminReportsTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  adminReportsSub: {
    fontSize: 11,
    marginTop: 2,
  },
  reportsBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 4,
  },
  reportsBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  reportsEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 10,
  },
  reportsEmpty: {
    fontSize: 14,
    textAlign: 'center',
  },
  reportItem: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: 10,
  },
  reportItemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reportIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportInfo: {
    flex: 1,
  },
  reportReason: {
    fontSize: 14,
    fontWeight: '700',
  },
  reportMeta: {
    fontSize: 11,
    marginTop: 3,
  },
  reportActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  reportActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  reportActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reportBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  reportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  reportBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  moderationGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  moderationActions: {
    gap: 8,
  },
  moderationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  moderationBtnBody: {
    flex: 1,
  },
  moderationBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  moderationBtnSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
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
  modalBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarPreview: {
    width: 140,
    height: 140,
    borderRadius: radius.xl,
  },
  avatarPreviewPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPreviewText: {
    color: colors.white,
    fontSize: 48,
    fontWeight: '800',
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
  // Tag picker styles
  proNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  proNoticeText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  tagOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tagOptionEmoji: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagOptionInfo: {
    flex: 1,
  },
  tagOptionName: {
    fontSize: 15,
    fontWeight: '700',
  },
  tagOptionLocked: {
    fontSize: 12,
    marginTop: 2,
  },
  tagOptionCheckWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagUpgradeBtn: {
    marginTop: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  tagUpgradeText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default ProfileScreen;
