import { getFirebaseAuth, getFirestore } from './firebase';

const auth = getFirebaseAuth();
const db = getFirestore();

export const friendService = {
  async sendFriendRequest(toUserId: string, toUserName: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Must be logged in');

    const fromUserId = currentUser.uid;
    const fromUserName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';

    await db.collection('friendRequests').add({
      fromUserId,
      fromUserName,
      toUserId,
      toUserName,
      status: 'pending',
      createdAt: Date.now(),
    });
  },

  async acceptFriendRequest(requestId: string) {
    const requestDoc = await db.collection('friendRequests').doc(requestId).get();
    if (!requestDoc.exists) return;

    const request = requestDoc.data();
    if (!request) return;

    const batch = db.batch();

    // Add friendship for both users
    const friendship1 = db.collection('friendships').doc();
    batch.set(friendship1, {
      userId1: request.fromUserId,
      userName1: request.fromUserName,
      userId2: request.toUserId,
      userName2: request.toUserName,
      createdAt: Date.now(),
    });

    const friendship2 = db.collection('friendships').doc();
    batch.set(friendship2, {
      userId1: request.toUserId,
      userName1: request.toUserName,
      userId2: request.fromUserId,
      userName2: request.fromUserName,
      createdAt: Date.now(),
    });

    // Update request status
    batch.update(db.collection('friendRequests').doc(requestId), {
      status: 'accepted',
    });

    await batch.commit();
  },

  async declineFriendRequest(requestId: string) {
    await db.collection('friendRequests').doc(requestId).update({
      status: 'declined',
    });
  },

  async getFriends(userId: string) {
    const snapshot = await db
      .collection('friendships')
      .where('userId1', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  },

  async getFriendRequests(userId: string) {
    const snapshot = await db
      .collection('friendRequests')
      .where('toUserId', '==', userId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  },

  async removeFriend(userId1: string, userId2: string) {
    const snapshot = await db
      .collection('friendships')
      .where('userId1', '==', userId1)
      .where('userId2', '==', userId2)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  },

  async isFriend(userId1: string, userId2: string): Promise<boolean> {
    const snapshot = await db
      .collection('friendships')
      .where('userId1', '==', userId1)
      .where('userId2', '==', userId2)
      .get();

    return !snapshot.empty;
  },
};