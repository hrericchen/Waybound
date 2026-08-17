import { getFirebaseAuth, getFirestoreDb } from './firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import storageService from './storageService';

const auth = getFirebaseAuth();
const db = getFirestoreDb();

export const friendService = {
  async sendFriendRequest(toUserId: string, toUserName: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Must be logged in');

    const fromUserId = currentUser.uid;
    // Use locally cached name which may be newer than Firebase Auth displayName
    const cached = await storageService.load(storageService.STORAGE_KEYS.USER);
    const fromUserName = cached?.name || currentUser.displayName || currentUser.email?.split('@')[0] || 'User';

    await addDoc(collection(db, 'friendRequests'), {
      fromUserId,
      fromUserName,
      toUserId,
      toUserName,
      status: 'pending',
      createdAt: Date.now(),
    });
  },

  async acceptFriendRequest(requestId: string) {
    const requestRef = doc(db, 'friendRequests', requestId);
    const requestDoc = await getDoc(requestRef);
    if (!requestDoc.exists()) return;

    const request = requestDoc.data();
    if (!request) return;

    const batch = writeBatch(db);

    // Add friendship for both users
    const friendship1 = doc(collection(db, 'friendships'));
    batch.set(friendship1, {
      userId1: request.fromUserId,
      userName1: request.fromUserName,
      userId2: request.toUserId,
      userName2: request.toUserName,
      createdAt: Date.now(),
    });

    const friendship2 = doc(collection(db, 'friendships'));
    batch.set(friendship2, {
      userId1: request.toUserId,
      userName1: request.toUserName,
      userId2: request.fromUserId,
      userName2: request.fromUserName,
      createdAt: Date.now(),
    });

    // Update request status
    batch.update(requestRef, {
      status: 'accepted',
    });

    await batch.commit();
  },

  async declineFriendRequest(requestId: string) {
    await updateDoc(doc(db, 'friendRequests', requestId), {
      status: 'declined',
    });
  },

  async getFriends(userId: string) {
    const q = query(
      collection(db, 'friendships'),
      where('userId1', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));
  },

  async getFriendRequests(userId: string) {
    const q = query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));
  },

  async removeFriend(userId1: string, userId2: string) {
    const q = query(
      collection(db, 'friendships'),
      where('userId1', '==', userId1),
      where('userId2', '==', userId2)
    );
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach(d => {
      batch.delete(d.ref);
    });

    await batch.commit();
  },

  async isFriend(userId1: string, userId2: string): Promise<boolean> {
    const q = query(
      collection(db, 'friendships'),
      where('userId1', '==', userId1),
      where('userId2', '==', userId2)
    );
    const snapshot = await getDocs(q);

    return !snapshot.empty;
  },
};
