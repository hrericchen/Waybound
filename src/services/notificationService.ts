import storageService from './storageService';
import { getFirestore } from './firebase';

const db = getFirestore();

export type Notification = {
  id: string;
  userId: string; // The user who receives the notification
  type: 'like' | 'follow' | 'save' | 'comment';
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
      const snapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
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
      await db.collection('notifications').doc(fullNotification.id).set(fullNotification);
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
      await db.collection('notifications').doc(notificationId).update({ read: true });
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
      const snapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .get();
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
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
      const snapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .get();
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
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
};

export default notificationService;