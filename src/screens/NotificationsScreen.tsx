import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';

type Notification = {
  id: string;
  type: 'saved' | 'liked' | 'followed';
  username: string;
  message: string;
  time: string;
  read: boolean;
};

const NotificationsScreen: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const insets = useSafeAreaInsets();
  const theme = useContext(ThemeContext);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    // Mock notifications - in real app, fetch from Firestore
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'saved',
        username: '@sarah_travels',
        message: 'saved your "Tokyo Adventure" itinerary',
        time: '2 hours ago',
        read: false,
      },
      {
        id: '2',
        type: 'liked',
        username: '@mike_explorer',
        message: 'liked your "Paris Getaway" trip',
        time: '5 hours ago',
        read: false,
      },
      {
        id: '3',
        type: 'followed',
        username: '@jessica_adventures',
        message: 'started following you',
        time: '1 day ago',
        read: true,
      },
      {
        id: '4',
        type: 'saved',
        username: '@david_backpacker',
        message: 'saved your "Bali Paradise" itinerary',
        time: '2 days ago',
        read: true,
      },
      {
        id: '5',
        type: 'liked',
        username: '@lisa_wanderlust',
        message: 'liked your "New York City" trip',
        time: '3 days ago',
        read: true,
      },
    ];
    setNotifications(mockNotifications);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'saved':
        return 'bookmark';
      case 'liked':
        return 'heart';
      case 'followed':
        return 'user';
      default:
        return 'bell';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'saved':
        return '#4ECDC4';
      case 'liked':
        return '#FF6B6B';
      case 'followed':
        return '#FFD93D';
      default:
        return colors.primary;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        !item.read && styles.unreadCard,
      ]}
      onPress={() => markAsRead(item.id)}
      activeOpacity={0.9}
    >
      <View style={[styles.notificationIcon, { backgroundColor: getNotificationColor(item.type) + '20' }]}>
        <Icon name={getNotificationIcon(item.type)} size={24} color={getNotificationColor(item.type)} />
      </View>
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationMessage, { color: theme.colors.text }]}>
          <Text style={styles.username}>{item.username}</Text> {item.message}
        </Text>
        <Text style={[styles.notificationTime, { color: theme.colors.muted }]}>
          {item.time}
        </Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </Text>
        </View>
      </View>

      {/* Notification Stats */}
      <View style={[styles.statsContainer, { backgroundColor: theme.colors.card }]}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: '#4ECDC420' }]}>
            <Icon name="bookmark" size={20} color="#4ECDC4" />
          </View>
          <Text style={[styles.statNumber, { color: theme.colors.text }]}>
            {notifications.filter(n => n.type === 'saved').length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Saved</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: '#FF6B6B20' }]}>
            <Icon name="heart" size={20} color="#FF6B6B" />
          </View>
          <Text style={[styles.statNumber, { color: theme.colors.text }]}>
            {notifications.filter(n => n.type === 'liked').length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Liked</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: '#FFD93D20' }]}>
            <Icon name="user" size={20} color="#FFD93D" />
          </View>
          <Text style={[styles.statNumber, { color: theme.colors.text }]}>
            {notifications.filter(n => n.type === 'followed').length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Followers</Text>
        </View>
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120 }}
        renderItem={renderNotification}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="bell" size={48} color={theme.colors.muted} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No notifications yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
              When someone saves, likes, or follows you, you'll see it here
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
  statsContainer: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
    ...shadows.soft,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  username: {
    color: colors.primary,
    fontWeight: '700',
  },
  notificationTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
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

export default NotificationsScreen;