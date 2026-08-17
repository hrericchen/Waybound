import React, { useEffect, useState, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  TextInput,
  ScrollView,
  Image,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { communityService } from '../services/communityService';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../theme/theme';
import { useTour } from '../context/TourContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import Avatar from '../components/Avatar';
import { colors, radius, shadows, spacing } from '../theme/theme';
import { useRevenueCat } from '../context/RevenueCatContext';
import { getTagById } from '../config/tags';
import notificationService from '../services/notificationService';
import { API_ORIGIN } from '../config/api';

type TabType = 'discover' | 'forum';
type DiscoverFilter = 'all' | 'itineraries' | 'users';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = spacing.xl * 2;
const GRID_GAP = 10;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING - GRID_GAP) / 2;

const FORUM_TAGS = [
  { id: 'tips' as const, label: 'Tips', color: '#059669', bgColor: '#ECFDF5' },
  { id: 'etiquette' as const, label: 'Etiquette', color: '#7C3AED', bgColor: '#F3EEFF' },
  { id: 'other' as const, label: 'Other', color: '#6366F1', bgColor: '#EEF2FF' },
];

function relevanceScore(text: string, query: string): number {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 100;
  if (lower.startsWith(q)) return 50;
  if (lower.includes(q)) return 25;
  return 0;
}

const CommunityScreen = () => {
  const { getFeaturedItineraries } = useContext(AuthContext);
  const { user } = useContext(AuthContext);
  const theme = useContext(ThemeContext);
  const { isPro, isMini, presentPaywall } = useRevenueCat();
  const { registerTarget } = useTour();

  const [users, setUsers] = useState<any[]>([]);
  const [itineraries, setItineraries] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [discoverData, setDiscoverData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [forumLoading, setForumLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>('all');
  const [itinerarySort, setItinerarySort] = useState<'newest' | 'liked' | 'saved'>('newest');
  const [refreshing, setRefreshing] = useState(false);
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());

  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTag, setNewPostTag] = useState<'tips' | 'etiquette' | 'other'>('tips');
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [upvotedPosts, setUpvotedPosts] = useState<Set<string>>(new Set());

  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const loadData = useCallback(async () => {
    try {
      const [u, f, localF] = await Promise.all([
        communityService.getUsers(),
        communityService.getFeaturedItineraries(),
        getFeaturedItineraries(),
      ]);
      setUsers(u);
      // Merge Firestore + local featured sets, deduplicating by id
      const featuredMap = new Map<string, any>();
      [...(f || []), ...(localF || [])].forEach((item: any) => {
        if (item.id && !featuredMap.has(item.id)) featuredMap.set(item.id, item);
      });
      setFeatured(Array.from(featuredMap.values()));
      const i = await communityService.getItineraries('newest');
      setItineraries(i);
      buildDiscoverData(query, i, u, discoverFilter);
    } catch (e) {
      console.warn(e);
    }
  }, [getFeaturedItineraries, query, discoverFilter]);

  const loadForumPosts = useCallback(async () => {
    setForumLoading(true);
    try {
      const posts = await communityService.getForumPosts();
      setForumPosts(posts);
    } catch (e) {
      console.warn('Failed to load forum posts:', e);
    } finally {
      setForumLoading(false);
    }
  }, []);

  const refreshFollowedUsers = useCallback(() => {
    if (user?.id) {
      communityService.getFollowedUsers(user.id).then(followed => {
        setFollowedUsers(new Set(followed));
      });
    }
  }, [user]);

  // Refresh data every time screen comes into focus to pick up profile picture changes
  useEffect(() => {
    loadData().finally(() => setLoading(false));
    refreshFollowedUsers();
    // Re-fetch when screen focuses to get latest avatarUrls + follow state
    const unsubscribe = (navigation as any).addListener('focus', () => {
      loadData();
      refreshFollowedUsers();
    });
    return unsubscribe;
  }, [loadData, navigation, refreshFollowedUsers]);

  useEffect(() => {
    if (activeTab === 'forum' && (isPro || isMini)) {
      loadForumPosts();
    }
  }, [activeTab, isPro, isMini, loadForumPosts]);

  const buildDiscoverData = useCallback((q: string, itins: any[], usrs: any[], filter: DiscoverFilter) => {
    const trimmed = q.trim().toLowerCase();
    const results: any[] = [];

    if (filter === 'all' || filter === 'itineraries') {
      const matchedItins = trimmed
        ? itins.filter((i: any) =>
            i.title?.toLowerCase().includes(trimmed) ||
            i.destinations?.some((d: string) => d.toLowerCase().includes(trimmed)) ||
            i.authorName?.toLowerCase().includes(trimmed)
          )
        : [...itins];

      matchedItins.sort((a: any, b: any) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        if (trimmed) {
          const aScore = Math.max(
            relevanceScore(a.title || '', trimmed),
            relevanceScore(a.authorName || '', trimmed),
          );
          const bScore = Math.max(
            relevanceScore(b.title || '', trimmed),
            relevanceScore(b.authorName || '', trimmed),
          );
          if (aScore !== bScore) return bScore - aScore;
        }
        if (itinerarySort === 'liked') {
          return (b.likes?.length || 0) - (a.likes?.length || 0);
        }
        if (itinerarySort === 'saved') {
          return (b.saves?.length || 0) - (a.saves?.length || 0);
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      for (const item of matchedItins) {
        results.push({ ...item, _type: 'itinerary' });
      }
    }

    if (filter === 'all' || filter === 'users') {
      const matchedUsers = trimmed
        ? usrs.filter((u: any) =>
            u.name?.toLowerCase().includes(trimmed) ||
            u.email?.toLowerCase().includes(trimmed)
          )
        : [...usrs];

      if (trimmed) {
        matchedUsers.sort((a: any, b: any) => {
          const aS = Math.max(relevanceScore(a.name || '', trimmed), relevanceScore(a.email || '', trimmed));
          const bS = Math.max(relevanceScore(b.name || '', trimmed), relevanceScore(b.email || '', trimmed));
          if (aS !== bS) return bS - aS;
          return (a.name || '').localeCompare(b.name || '');
        });
      } else if (filter === 'all') {
        // In "All" tab: sort users by newest first to match itinerary ordering
        matchedUsers.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      } else {
        matchedUsers.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      }

      for (const u of matchedUsers) {
        results.push({ ...u, _type: 'user' });
      }
    }

    setDiscoverData(results);
  }, [itinerarySort]);

  useEffect(() => {
    if (user?.id) {
      communityService.getFollowedUsers(user.id).then(followed => {
        setFollowedUsers(new Set(followed));
      });
    }
  }, [user]);

  useEffect(() => {
    buildDiscoverData(query, itineraries, users, discoverFilter);
  }, [query, itineraries, users, discoverFilter, itinerarySort, buildDiscoverData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    if (activeTab === 'forum' && (isPro || isMini)) await loadForumPosts();
    setRefreshing(false);
  }, [loadData, activeTab, isPro, isMini, loadForumPosts]);

  const handleTabSwitch = (tab: TabType) => {
    if (tab === 'forum' && !isPro && !isMini) {
      presentPaywall();
      return;
    }
    setActiveTab(tab);
  };

  const handleFollowUser = async (targetUserId: string) => {
    try {
      if (followedUsers.has(targetUserId)) {
        setFollowedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetUserId);
          return newSet;
        });
        if (user?.id) await communityService.unfollowUser(user.id, targetUserId);
      } else {
        setFollowedUsers(prev => new Set(prev).add(targetUserId));
        if (user?.id) {
          await communityService.followUser(user.id, targetUserId);
          // Send follow notification
          try {
            await notificationService.notifyFollow(targetUserId, user.id, user.name || 'A traveler');
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('Failed to follow user', e);
    }
  };

  const handleLike = async (item: any) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to like itineraries.');
      return;
    }
    try {
      const likes = item.likes || [];
      const isLiked = likes.includes(user.id);
      const updatedLikes = isLiked
        ? likes.filter((id: string) => id !== user.id)
        : [...likes, user.id];
      await communityService.updateItinerary(item.id, { likes: updatedLikes });
      // Send notification when liking (not unliking)
      if (!isLiked && item.authorId && item.authorId !== user.id) {
        try {
          await notificationService.notifyItineraryLike(
            item.authorId, user.id, user.name || 'A traveler', item.id, item.title
          );
        } catch (_) {}
      }
      const updateList = (prev: any[]) => prev.map(i => i.id === item.id ? { ...i, likes: updatedLikes } : i);
      setItineraries(updateList);
      setDiscoverData(prev => prev.map(i => i.id === item.id && i._type === 'itinerary' ? { ...i, likes: updatedLikes } : i));
    } catch (e) {
      console.error('Failed to like itinerary:', e);
    }
  };

  const handleSave = async (item: any) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save itineraries.');
      return;
    }
    try {
      const saves = item.saves || [];
      const isSaved = saves.includes(user.id);
      const updatedSaves = isSaved
        ? saves.filter((id: string) => id !== user.id)
        : [...saves, user.id];
      await communityService.updateItinerary(item.id, { saves: updatedSaves });
      const updateList = (prev: any[]) => prev.map(i => i.id === item.id ? { ...i, saves: updatedSaves } : i);
      setItineraries(updateList);
      setDiscoverData(prev => prev.map(i => i.id === item.id && i._type === 'itinerary' ? { ...i, saves: updatedSaves } : i));
    } catch (e) {
      console.error('Failed to save itinerary:', e);
    }
  };

  const handleCreatePost = async () => {
    if (!user || !newPostTitle.trim() || !newPostContent.trim()) return;

    setUploadingImages(true);
    try {
      // Upload images if any (images are already base64 data URIs)
      const imageUrls: string[] = [];
      if (newPostImages.length > 0) {
        for (const imgData of newPostImages) {
          try {
            const uploadRes = await fetch(`${API_ORIGIN}/api/upload`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image: imgData,
                fileName: `forum_${Date.now()}.jpg`,
              }),
            });
            const uploadData = await uploadRes.json();
            if (uploadData.url) {
              imageUrls.push(uploadData.url);
            }
          } catch (uploadErr) {
            console.warn('Image upload failed:', uploadErr);
          }
        }
      }

      const postId = `forum-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const result = await communityService.createForumPost({
        id: postId,
        authorId: user.id,
        authorName: user.name || 'User',
        authorAvatar: user.avatarUrl,
        authorTag: user.tag,
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        tag: newPostTag,
        images: imageUrls.length > 0 ? imageUrls : undefined,
      });
      if (result) {
        setForumPosts(prev => [result, ...prev]);
        setShowCreatePost(false);
        setNewPostTitle('');
        setNewPostContent('');
        setNewPostTag('tips');
        setNewPostImages([]);
      }
    } catch (e) {
      console.warn('Failed to create post:', e);
    } finally {
      setUploadingImages(false);
    }
  };

  const handlePickPostImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to upload images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 4,
      base64: true,
    });
    if (!result.canceled && result.assets) {
      const newImages = result.assets.map(a => {
        if (a.base64) {
          return `data:image/jpeg;base64,${a.base64}`;
        }
        return a.uri;
      });
      setNewPostImages(prev => [...prev, ...newImages].slice(0, 4));
    }
  };

  const handleUpvote = async (postId: string) => {
    if (!user) return;
    const isUpvoted = upvotedPosts.has(postId);
    if (isUpvoted) {
      setUpvotedPosts(prev => { const s = new Set(prev); s.delete(postId); return s; });
      await communityService.unupvoteForumPost(postId, user.id);
      setForumPosts(prev => prev.map(p => p.id === postId
        ? { ...p, upvotes: (p.upvotes || []).filter((id: string) => id !== user.id) }
        : p));
    } else {
      setUpvotedPosts(prev => new Set(prev).add(postId));
      await communityService.upvoteForumPost(postId, user.id);
      setForumPosts(prev => prev.map(p => p.id === postId
        ? { ...p, upvotes: [...(p.upvotes || []), user.id] }
        : p));
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!user || !commentText.trim()) return;
    const commentId = `cmt-${Date.now()}`;
    const result = await communityService.addComment(postId, {
      id: commentId,
      authorId: user.id,
      authorName: user.name || 'User',
      authorAvatar: user.avatarUrl,
      text: commentText.trim(),
    });
    if (result) {
      setForumPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: result } : p));
      setCommentText('');
    }
  };

  /** Open a post's comments and focus the input so the user can reply right away. */
  const openComments = (postId: string) => {
    setShowCommentsFor(postId);
    setCommentText('');
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await communityService.deleteForumPost(postId);
          setForumPosts(prev => prev.filter(p => p.id !== postId));
        },
      },
    ]);
  };

  const renderUserItem = ({ item }: any) => {
    const isOwnAccount = user?.id === item.id;
    const userTag = item.tag ? getTagById(item.tag) : getTagById('explorer');

    return (
      <TouchableOpacity
        style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.85}
        onPress={() => (navigation as any).navigate('UserProfile', { userId: item.id })}
      >
        <Avatar uri={item.avatarUrl} name={item.name || 'U'} size={48} radius={16} style={styles.avatarImage} />
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
            {isOwnAccount && <Text style={[styles.youBadge, { color: colors.muted }]}>You</Text>}
          </View>
          <View style={[styles.userTagChip, { backgroundColor: userTag!.bgColor, borderColor: userTag!.color }]}>
            <Text style={styles.userTagEmoji}>{userTag!.emoji}</Text>
            <Text style={[styles.userTagText, { color: userTag!.color }]}>{userTag!.name}</Text>
          </View>
        </View>
        {/* Follow lives on the profile page — tap the card to open it. */}
        {!isOwnAccount && (
          <Icon name="chevronRight" size={18} color={colors.muted} />
        )}
      </TouchableOpacity>
    );
  };

  const renderItineraryItem = ({ item }: any) => {
    const isLiked = (item.likes || []).includes(user?.id);
    const isSaved = (item.saves || []).includes(user?.id);
    const coverUri = item.coverImageBase64
      ? `data:image/jpeg;base64,${item.coverImageBase64}`
      : (item.coverImage || item.image || '');

    return (
      <View style={[styles.itinCardBox, item.featured && styles.itinCardBoxFeatured]}>
        {item.featured && (
          <LinearGradient colors={['#16A34A', '#22C55E']} style={styles.featuredBadge}>
            <Icon name="star" size={10} color={colors.white} />
            <Text style={styles.featuredBadgeText}>FEATURED</Text>
          </LinearGradient>
        )}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => (navigation as any).navigate('TripDetail', { id: item.id })}
          style={styles.itinCardTouchable}
        >
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.itinCardImage} />
          ) : (
            <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.itinCardImageFallback}>
              <Icon name="image" size={32} color={colors.white} />
            </LinearGradient>
          )}
          <LinearGradient colors={['transparent', 'rgba(8,15,30,0.75)']} style={styles.itinCardOverlay} />
          <View style={styles.itinCardContent}>
            <View
              style={[
                styles.guideBadge,
                { backgroundColor: item.kind === 'guide' ? '#EC4899' : '#8B5CF6' },
              ]}
            >
              <Text style={styles.guideBadgeText}>{item.kind === 'guide' ? 'GUIDE' : 'ITINERARY'}</Text>
            </View>
            <Text style={styles.itinCardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.itinCardAuthor} numberOfLines={1}>
              {item.authorName || 'Unknown'} · {item.destinations?.slice(0, 2).join(', ') || 'Custom trip'}
            </Text>
            {item.createdAt && (
              <Text style={[styles.itinCardDate, { color: colors.muted }]}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            )}
            <View style={styles.itinCardStats}>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleLike(item); }} style={styles.statItem}>
                <Icon name={isLiked ? 'heartFilled' : 'heart'} size={12} color={isLiked ? colors.danger : colors.white} />
                <Text style={[styles.statText, { color: isLiked ? colors.danger : colors.white }]}>{item.likes?.length || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleSave(item); }} style={styles.statItem}>
                <Icon name="bookmark" size={12} color={isSaved ? colors.primary : colors.white} />
                <Text style={[styles.statText, { color: isSaved ? colors.primary : colors.white }]}>{item.saves?.length || 0} saved</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleLike(item); }} style={styles.heartBtn}>
          <Icon name={isLiked ? 'heartFilled' : 'heart'} size={18} color={isLiked ? colors.danger : colors.white} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderDiscoverItem = ({ item }: any) => {
    if (item._type === 'user') return renderUserItem({ item });
    return renderItineraryItem({ item });
  };

  const renderForumPost = ({ item }: any) => {
    const userTag = item.authorTag ? getTagById(item.authorTag) : getTagById('explorer');
    const isUpvoted = upvotedPosts.has(item.id);
    const isAuthor = user?.id === item.authorId;
    const forumTagConfig = FORUM_TAGS.find(t => t.id === item.tag);

    return (
      <View style={[styles.forumCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.forumHeader}>
          <View style={styles.forumAuthor}>
            <Avatar uri={item.authorAvatar} name={item.authorName || 'U'} size={40} radius={14} style={styles.forumAvatar} />
            <View>
              <View style={styles.forumAuthorRow}>
                <Text style={[styles.forumAuthorName, { color: colors.text }]}>{item.authorName}</Text>
                <View style={[styles.miniTag, { backgroundColor: userTag!.bgColor }]}>
                  <Text style={styles.miniTagEmoji}>{userTag!.emoji}</Text>
                </View>
              </View>
              <Text style={[styles.forumTime, { color: colors.muted }]}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
          {isAuthor && (
            <TouchableOpacity onPress={() => handleDeletePost(item.id)}>
              <Icon name="trash" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity activeOpacity={0.7} onPress={() => openComments(item.id)}>
          <Text style={[styles.forumTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.forumContent, { color: colors.muted }]} numberOfLines={3}>{item.content}</Text>

          {/* Display images if any */}
          {item.images && item.images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.forumImagesScroll}>
              {item.images.map((imgUrl: string, idx: number) => (
                <Image
                  key={idx}
                  source={{ uri: imgUrl.startsWith('/') ? `${API_ORIGIN}${imgUrl}` : imgUrl }}
                  style={styles.forumImage}
                />
              ))}
            </ScrollView>
          )}

          {forumTagConfig && (
            <View style={[styles.forumTagChip, { backgroundColor: forumTagConfig.bgColor, borderColor: forumTagConfig.color }]}>
              <Text style={[styles.forumTagText, { color: forumTagConfig.color }]}>{forumTagConfig.label}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.forumActions}>
          <TouchableOpacity style={styles.forumActionBtn} onPress={() => handleUpvote(item.id)}>
            <Icon name="arrowUp" size={16} color={isUpvoted ? colors.primary : colors.muted} />
            <Text style={[styles.forumActionText, isUpvoted && { color: colors.primary }]}>
              {(item.upvotes || []).length} Helpful
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.forumActionBtn} onPress={() => {
            if (showCommentsFor === item.id) {
              setShowCommentsFor(null);
            } else {
              openComments(item.id);
            }
          }}>
            <Icon name="chat" size={16} color={colors.muted} />
            <Text style={styles.forumActionText}>{(item.comments || []).length} Comments</Text>
          </TouchableOpacity>
        </View>

        {showCommentsFor === item.id && (
          <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
            {(item.comments || []).map((cmt: any) => (
              <View key={cmt.id} style={styles.commentItem}>
                <Avatar uri={cmt.authorAvatar} name={cmt.authorName || 'U'} size={28} radius={14} style={styles.commentAvatar} />
                <View style={styles.commentBody}>
                  <Text style={[styles.commentAuthor, { color: colors.text }]}>{cmt.authorName}</Text>
                  <Text style={[styles.commentText, { color: colors.muted }]}>{cmt.text}</Text>
                </View>
              </View>
            ))}
            <View style={styles.commentInputRow}>
              <TextInput
                style={[styles.commentInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment..."
                placeholderTextColor={colors.muted}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.commentSendBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleAddComment(item.id)}
                disabled={!commentText.trim()}
              >
                <Icon name="send" size={14} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.emptyIcon}>
        <Icon name="search" size={28} color={colors.primary} />
      </LinearGradient>
      <Text style={styles.emptyTitle}>
        {activeTab === 'forum' ? 'No posts yet' : 'No results found'}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'forum' ? 'Be the first to share a tip!' : 'Try a different search or filter'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <View ref={(r) => registerTarget('community-header', r)} collapsable={false} style={styles.header}>
        <View>
          <Text style={styles.kicker}>EXPLORE</Text>
          <Text style={styles.title}>Community</Text>
        </View>
        <LinearGradient colors={[colors.primarySoft, '#E0E4FF']} style={styles.headerIcon}>
          <Icon name="globe" size={20} color={colors.primary} />
        </LinearGradient>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'discover' && styles.tabBtnActive]}
          onPress={() => { setActiveTab('discover'); setQuery(''); }}
        >
          <Icon name="search" size={16} color={activeTab === 'discover' ? colors.white : colors.muted} />
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>Discover</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'forum' && styles.tabBtnActive]}
          onPress={() => handleTabSwitch('forum')}
        >
          <Icon name="chat" size={16} color={activeTab === 'forum' ? colors.white : colors.muted} />
          <Text style={[styles.tabText, activeTab === 'forum' && styles.tabTextActive]}>
            Forum {!isPro && !isMini && '🔒'}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'discover' && (
        <>
          <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="search" size={20} color={colors.muted} />
            <TextInput
              placeholder="Search itineraries & users..."
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.text }]}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Icon name="close" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterRow}>
            {(['all', 'itineraries', 'users'] as DiscoverFilter[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, discoverFilter === f && styles.filterChipActive]}
                onPress={() => setDiscoverFilter(f)}
              >
                <Text style={[styles.filterChipText, discoverFilter === f && styles.filterChipTextActive]}>
                  {f === 'all' ? 'All' : f === 'itineraries' ? 'Itineraries' : 'Users'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {discoverFilter !== 'users' && (
            <View style={styles.sortRow}>
              {(['newest', 'liked', 'saved'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sortChip, itinerarySort === s && styles.sortChipActive]}
                  onPress={() => setItinerarySort(s)}
                >
                  <Text style={[styles.sortChipText, itinerarySort === s && styles.sortChipTextActive]}>
                    {s === 'newest' ? 'Newest' : s === 'liked' ? 'Most Liked' : 'Most Saved'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={discoverData}
              keyExtractor={(item: any) => `${item._type}-${item.id}`}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120 }}
              renderItem={renderDiscoverItem}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
              }
              ListHeaderComponent={
                featured.length > 0 && !query && discoverFilter === 'all' ? (
                  <View style={styles.featuredSection}>
                    <LinearGradient colors={['#FFF7ED', '#FFE4CC']} style={styles.featuredBanner}>
                      <Icon name="bookmark" size={16} color="#9A3412" />
                      <Text style={styles.featuredBannerText}>Featured Itineraries</Text>
                    </LinearGradient>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
                      {featured.map((item: any) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.featuredCard}
                          activeOpacity={0.9}
                          onPress={() => (navigation as any).navigate('TripDetail', { id: item.id })}
                        >
                          {(item.coverImageBase64 ? `data:image/jpeg;base64,${item.coverImageBase64}` : (item.coverImage || item.image)) ? (
                            <Image source={{ uri: item.coverImageBase64 ? `data:image/jpeg;base64,${item.coverImageBase64}` : (item.coverImage || item.image) }} style={styles.featuredImage} />
                          ) : (
                            <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.featuredImageFallback}>
                              <Icon name="map" size={24} color={colors.white} />
                            </LinearGradient>
                          )}
                          <LinearGradient colors={['transparent', 'rgba(8,15,30,0.7)']} style={styles.featuredOverlay} />
                          <View style={styles.featuredContent}>
                            <Text style={styles.featuredTitle} numberOfLines={2}>{item.title}</Text>
                            <Text style={styles.featuredAuthor}>{item.authorName || 'Waybound'}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : null
              }
              ListEmptyComponent={renderEmpty}
            />
          )}
        </>
      )}

      {activeTab === 'forum' && (
        <>
          <TouchableOpacity
            style={[styles.createPostBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              setNewPostTitle('');
              setNewPostContent('');
              setNewPostTag('tips');
              setShowCreatePost(true);
            }}
          >
            <Icon name="plus" size={16} color={colors.white} />
            <Text style={styles.createPostBtnText}>New Post</Text>
          </TouchableOpacity>

          {forumLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={forumPosts}
              keyExtractor={(item: any) => item.id}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120 }}
              renderItem={renderForumPost}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
              }
              ListEmptyComponent={renderEmpty}
            />
          )}
        </>
      )}

      {/* Create Post Modal */}
      <Modal visible={showCreatePost} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Post</Text>
              <TouchableOpacity onPress={() => {
                setShowCreatePost(false);
                setNewPostImages([]);
              }}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Tag</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {FORUM_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagSelectChip,
                    { backgroundColor: tag.bgColor, borderColor: tag.color },
                    newPostTag === tag.id && { borderWidth: 2 },
                  ]}
                  onPress={() => setNewPostTag(tag.id)}
                >
                  <Text style={[styles.tagSelectText, { color: tag.color }]}>{tag.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Title</Text>
            <TextInput
              style={[styles.postInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              value={newPostTitle}
              onChangeText={setNewPostTitle}
              placeholder="e.g., Best packing tips for Europe"
              placeholderTextColor={colors.muted}
            />

            <Text style={[styles.inputLabel, { color: colors.text }]}>Content</Text>
            <TextInput
              style={[styles.postInput, styles.postContentInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              value={newPostContent}
              onChangeText={setNewPostContent}
              placeholder="Share your knowledge..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            {/* Image Upload */}
            <Text style={[styles.inputLabel, { color: colors.text, marginTop: spacing.md }]}>Images (optional)</Text>
            <View style={styles.imageUploadRow}>
              {newPostImages.map((imgData, idx) => (
                <View key={idx} style={styles.uploadedImageWrap}>
                  <Image source={{ uri: imgData }} style={styles.uploadedImage} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => setNewPostImages(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Icon name="close" size={14} color={colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
              {newPostImages.length < 4 && (
                <TouchableOpacity
                  style={[styles.addImageBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={handlePickPostImage}
                >
                  <Icon name="camera" size={24} color={colors.muted} />
                  <Text style={[styles.addImageText, { color: colors.muted }]}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: (!newPostTitle.trim() || !newPostContent.trim() || uploadingImages) ? 0.5 : 1 }]}
              onPress={handleCreatePost}
              disabled={!newPostTitle.trim() || !newPostContent.trim() || uploadingImages}
            >
              {uploadingImages ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  kicker: { color: colors.primary, fontWeight: '700', fontSize: 12, letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  headerIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  searchWrap: {
    marginHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15 },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: 8, marginBottom: spacing.md },
  filterChip: {
    flex: 1,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  filterChipTextActive: { color: colors.white },
  sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  sortChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sortChipActive: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  sortChipText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  sortChipTextActive: { color: colors.white },
  tabRow: { flexDirection: 'row', marginHorizontal: spacing.xl, marginBottom: spacing.md, gap: 8 },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: radius.full,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontWeight: '700', fontSize: 13, color: colors.muted },
  tabTextActive: { color: colors.white },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  userCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.lg,
    borderRadius: radius.lg, marginBottom: 10, ...shadows.soft,
  },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarImage: { width: 48, height: 48, borderRadius: 16, marginRight: spacing.md },
  avatarText: { fontSize: 20, fontWeight: '800', color: colors.white },
  itinAvatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  userInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  youBadge: { fontSize: 10, fontWeight: '700', backgroundColor: colors.card, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden' },
  userTagChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, marginTop: 4 },
  userTagEmoji: { fontSize: 10 },
  userTagText: { fontSize: 10, fontWeight: '700' },
  email: { fontSize: 13, marginTop: 2 },
  itinStats: { flexDirection: 'row', gap: 12, marginTop: 4 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 11, fontWeight: '600' },
  itinDate: { fontSize: 10, marginTop: 2 },
  heartBtn: { position: 'absolute', top: 10, right: 10, zIndex: 20, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(10,16,30,0.55)', alignItems: 'center', justifyContent: 'center' },
  featuredBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 3, zIndex: 20 },
  featuredBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  emptyText: { marginTop: 8, textAlign: 'center', lineHeight: 20, color: colors.muted },
  featuredSection: { marginBottom: spacing.lg },
  featuredBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, marginBottom: spacing.md },
  featuredBannerText: { fontSize: 12, fontWeight: '800', color: '#9A3412' },
  featuredRow: { gap: 12 },
  featuredCard: { width: 180, height: 150, borderRadius: radius.lg, overflow: 'hidden', ...shadows.card },
  featuredImage: { width: '100%', height: '100%', position: 'absolute' },
  featuredImageFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  featuredOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  featuredContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md },
  featuredTitle: { color: colors.white, fontSize: 13, fontWeight: '800', lineHeight: 17 },
  featuredAuthor: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 3 },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary },
  followBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  followBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  followBtnTextActive: { color: colors.white },

  // Itinerary box cards (featured-style)
  itinCardBox: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  itinCardBoxFeatured: {
    borderColor: '#22C55E',
    borderWidth: 2,
  },
  itinCardTouchable: { flex: 1 },
  itinCardImage: { width: '100%', height: 160 },
  itinCardImageFallback: { width: '100%', height: 160, alignItems: 'center', justifyContent: 'center' },
  itinCardOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  itinCardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    gap: 4,
  },
  itinCardTitle: { color: colors.white, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  guideBadge: { alignSelf: 'flex-start', backgroundColor: '#8B5CF6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, marginBottom: 6 },
  guideBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  itinCardAuthor: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  itinCardDate: { fontSize: 11, marginTop: 2 },
  itinCardStats: { flexDirection: 'row', gap: 12, marginTop: 6 },

  // Forum
  createPostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: spacing.xl, marginBottom: spacing.md, paddingVertical: 12, borderRadius: radius.full, ...shadows.fab },
  createPostBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  forumCard: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: 10, borderWidth: 1, ...shadows.soft },
  forumHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  forumAuthor: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  forumAvatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  forumAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  forumAuthorName: { fontSize: 14, fontWeight: '700' },
  miniTag: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  miniTagEmoji: { fontSize: 10 },
  forumTime: { fontSize: 11, marginTop: 1 },
  forumTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  forumContent: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  forumTagChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, marginBottom: spacing.md },
  forumTagText: { fontSize: 11, fontWeight: '700' },
  forumActions: { flexDirection: 'row', gap: 16 },
  forumActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  forumActionText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  commentsSection: { borderTopWidth: 1, paddingTop: spacing.md, marginTop: spacing.md },
  commentItem: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { fontSize: 11, fontWeight: '700' },
  commentBody: { flex: 1 },
  commentAuthor: { fontSize: 12, fontWeight: '700' },
  commentText: { fontSize: 13, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  commentInput: { flex: 1, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13 },
  commentSendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: spacing.xl },
  modalContent: { width: '100%', borderRadius: radius.xxl, padding: spacing.xxl, maxHeight: '85%', ...shadows.deep },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  inputLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: spacing.md },
  tagSelectChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, marginRight: 8 },
  tagSelectText: { fontSize: 13, fontWeight: '700' },
  postInput: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: spacing.sm },
  postContentInput: { minHeight: 100 },
  submitBtn: { paddingVertical: 14, borderRadius: radius.full, alignItems: 'center', marginTop: spacing.lg },
  submitBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },

  // Image upload styles
  imageUploadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  uploadedImageWrap: { width: 80, height: 80, borderRadius: radius.md, overflow: 'hidden', position: 'relative' },
  uploadedImage: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  addImageBtn: { width: 80, height: 80, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addImageText: { fontSize: 10, fontWeight: '600' },

  // Forum images
  forumImagesScroll: { marginBottom: spacing.sm },
  forumImage: { width: 200, height: 150, borderRadius: radius.md, marginRight: 8 },
});

export default CommunityScreen;