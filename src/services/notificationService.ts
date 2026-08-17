import storageService from './storageService';
import { getFirestoreDb } from './firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';

const db = getFirestoreDb();

export type Notification = {
  id: string;
  userId: string; // The user who receives the notification
  type: 'like' | 'follow' | 'save' | 'comment' | 'report' | 'warning' | 'suspension';
  fromUserId: string;
  fromUserName: string;
  itineraryId?: string;
  itineraryTitle?: string;
  message: string;
  createdAt: number;
  read: boolean;
};

const notificationService = {
  // Get notifications for a specific user
  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      // Try Firestore first
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      }
    } catch (e) {
      // Silently fail - Firestore permissions may not be set up, use local storage
      // console.warn('Firestore getNotifications failed, using local:', e);
    }

    // Fallback to local storage
    const allNotifications = (await storageService.load(storageService.STORAGE_KEYS.NOTIFICATIONS)) || [];
    return allNotifications
      .filter((n: Notification) => n.userId === userId)
      .sort((a: Notification, b: Notification) => b.createdAt - a.createdAt);
  },

  // Create a notification
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<void> {
    const fullNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      read: false,
    };

    // Don't create notification if user is notifying themselves
    if (fullNotification.userId === fullNotification.fromUserId) {
      return;
    }

    try {
      await setDoc(doc(db, 'notifications', fullNotification.id), fullNotification);
    } catch (e) {
      console.warn('Firestore createNotification failed, using local:', e);
      // Fallback to local storage
      const notifications = (await storageService.load(storageService.STORAGE_KEYS.NOTIFICATIONS)) || [];
      notifications.push(fullNotification);
      await storageService.save(storageService.STORAGE_KEYS.NOTIFICATIONS, notifications);
    }
  },

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (e) {
      console.warn('Firestore markAsRead failed, using local:', e);
      const notifications = (await storageService.load(storageService.STORAGE_KEYS.NOTIFICATIONS)) || [];
      const idx = notifications.findIndex((n: Notification) => n.id === notificationId);
      if (idx >= 0) {
        notifications[idx].read = true;
        await storageService.save(storageService.STORAGE_KEYS.NOTIFICATIONS, notifications);
      }
    }
  },

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.update(d.ref, { read: true });
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore markAllAsRead failed, using local:', e);
      const notifications = (await storageService.load(storageService.STORAGE_KEYS.NOTIFICATIONS)) || [];
      notifications.forEach((n: Notification) => {
        if (n.userId === userId) {
          n.read = true;
        }
      });
      await storageService.save(storageService.STORAGE_KEYS.NOTIFICATIONS, notifications);
    }
  },

  // Get unread count for a user
  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.getNotifications(userId);
    return notifications.filter(n => !n.read).length;
  },

  // Clear all notifications for a user (for new users or testing)
  async clearNotifications(userId: string): Promise<void> {
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', userId));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore clearNotifications failed, using local:', e);
      const notifications = (await storageService.load(storageService.STORAGE_KEYS.NOTIFICATIONS)) || [];
      const filtered = notifications.filter((n: Notification) => n.userId !== userId);
      await storageService.save(storageService.STORAGE_KEYS.NOTIFICATIONS, filtered);
    }
  },

  // Notify when someone likes an itinerary
  async notifyItineraryLike(itineraryOwnerId: string, fromUserId: string, fromUserName: string, itineraryId: string, itineraryTitle: string): Promise<void> {
    await this.createNotification({
      userId: itineraryOwnerId,
      type: 'like',
      fromUserId,
      fromUserName,
      itineraryId,
      itineraryTitle,
      message: `${fromUserName} liked your itinerary "${itineraryTitle}"`,
    });
  },

  // Notify when someone follows a user
  async notifyFollow(followedUserId: string, fromUserId: string, fromUserName: string): Promise<void> {
    await this.createNotification({
      userId: followedUserId,
      type: 'follow',
      fromUserId,
      fromUserName,
      message: `${fromUserName} started following you`,
    });
  },

  // Notify when someone saves an itinerary
  async notifyItinerarySave(itineraryOwnerId: string, fromUserId: string, fromUserName: string, itineraryId: string, itineraryTitle: string): Promise<void> {
    await this.createNotification({
      userId: itineraryOwnerId,
      type: 'save',
      fromUserId,
      fromUserName,
      itineraryId,
      itineraryTitle,
      message: `${fromUserName} saved your itinerary "${itineraryTitle}"`,
    });
  },

  // Moderation: warning issued by the Waybound team. `fromUserId` is the acting
  // admin's uid (Firestore rules require fromUserId == request.auth.uid), but
  // the recipient sees the friendly "Waybound Team" as the sender name.
  async notifyModerationWarning(userId: string, fromUserId: string, reason: string, note?: string): Promise<void> {
    await this.createNotification({
      userId,
      type: 'warning',
      fromUserId,
      fromUserName: 'Waybound Team',
      message: note
        ? `has issued a warning on your profile (${reason}): ${note}`
        : `has issued a warning on your profile (${reason}). Please review our community guidelines.`,
    });
  },

  // Moderation: account suspension issued by the Waybound team.
  async notifyModerationSuspension(userId: string, fromUserId: string, days: number, reason: string, note?: string): Promise<void> {
    await this.createNotification({
      userId,
      type: 'suspension',
      fromUserId,
      fromUserName: 'Waybound Team',
      message: `has suspended your account for ${days} day${days > 1 ? 's' : ''} (${reason}).${note ? ` ${note}` : ''}`,
    });
  },
};

export default notificationService;
