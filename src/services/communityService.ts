import { getFirestore } from './firebase';
import storageService from './storageService';

const db = getFirestore();

// Local fallback users for testing
const LOCAL_USERS = [
  { id: 'test-001', name: 'Test User', email: 'test@waybound.app', createdAt: Date.now() - 86400000 },
  { id: 'test-002', name: 'Sarah Chen', email: 'sarah@example.com', createdAt: Date.now() - 172800000 },
  { id: 'test-003', name: 'Mike Johnson', email: 'mike@example.com', createdAt: Date.now() - 259200000 },
  { id: 'test-004', name: 'Emma Wilson', email: 'emma@example.com', createdAt: Date.now() - 345600000 },
  { id: 'test-005', name: 'David Kim', email: 'david@example.com', createdAt: Date.now() - 432000000 },
];

export const communityService = {
  async getUsers() {
    try {
      const snapshot = await db.collection('users').orderBy('name').get();
      const firestoreUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Merge with local users to ensure everyone is visible
      const localUsers = (await storageService.load('COMMUNITY_USERS')) || [];
      const allUsers = [...firestoreUsers, ...localUsers, ...LOCAL_USERS];
      
      // Remove duplicates by id
      const uniqueUsers = allUsers.filter((user: any, index: number, self: any[]) => 
        index === self.findIndex((u: any) => u.id === user.id)
      );
      
      // Exclude admin users
      const filteredUsers = uniqueUsers.filter((u: any) => 
        !u.isAdmin && u.id !== 'admin-001' && !u.email?.includes('admin')
      );
      
      return filteredUsers.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    } catch (e) {
      console.warn('Firestore getUsers failed, using local:', e);
      const localUsers = (await storageService.load('COMMUNITY_USERS')) || [];
      const allUsers = [...localUsers, ...LOCAL_USERS];
      
      // Remove duplicates by id
      const uniqueUsers = allUsers.filter((user: any, index: number, self: any[]) => 
        index === self.findIndex((u: any) => u.id === user.id)
      );
      
      // Exclude admin users
      const filteredUsers = uniqueUsers.filter((u: any) => 
        !u.isAdmin && u.id !== 'admin-001' && !u.email?.includes('admin')
      );
      
      return filteredUsers.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    }
  },

  async registerUser(user: { id: string; name: string; email: string }) {
    try {
      await db.collection('users').doc(user.id).set({
        name: user.name,
        email: user.email,
        createdAt: Date.now(),
      });
    } catch (e) {
      console.warn('Firestore registerUser failed, using local:', e);
      // Fallback to local storage
      const users = (await storageService.load('COMMUNITY_USERS')) || [];
      const existing = users.find((u: any) => u.id === user.id);
      if (!existing) {
        users.push({
          ...user,
          createdAt: Date.now(),
        });
        await storageService.save('COMMUNITY_USERS', users);
      }
    }
  },

  async getItineraries(sortBy: string = 'newest') {
    try {
      let query = db.collection('itineraries');
      
      // Note: Firestore doesn't support orderBy on different fields easily
      // For now, just get all and sort in memory
      const snapshot = await query.get();
      let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      // Sort in memory
      results.sort((a: any, b: any) => {
        switch (sortBy) {
          case 'oldest':
            return (a.createdAt || 0) - (b.createdAt || 0);
          case 'days_asc':
            return (a.days || 0) - (b.days || 0);
          case 'days_desc':
            return (b.days || 0) - (a.days || 0);
          case 'budget_asc':
            return (a.budget || 0) - (b.budget || 0);
          case 'budget_desc':
            return (b.budget || 0) - (a.budget || 0);
          case 'newest':
          default:
            return (b.createdAt || 0) - (a.createdAt || 0);
        }
      });

      // Merge with local itineraries to include ones published by the current user
      // that may not have synced to Firestore yet
      const local = (await storageService.load('COMMUNITY_ITINERARIES')) || [];
      const allResults = [...results, ...local.filter((l: any) => !results.find((r: any) => r.id === l.id))];
      return allResults;
    } catch (e) {
      console.warn('Firestore getItineraries failed, using local:', e);
      const local = (await storageService.load('COMMUNITY_ITINERARIES')) || [];
      return local;
    }
  },

   async publishItinerary(itinerary: any) {
     try {
       // Filter out undefined values to prevent Firestore errors
       const cleanItinerary = Object.fromEntries(
         Object.entries(itinerary).filter(([_, v]) => v !== undefined)
       );
       
       await db.collection('itineraries').doc(itinerary.id).set({
         ...cleanItinerary,
         publishedAt: Date.now(),
       });
     } catch (e) {
       console.warn('Firestore publishItinerary failed:', e);
       // Fallback to local
       const list = (await storageService.load('COMMUNITY_ITINERARIES')) || [];
       const idx = list.findIndex((i: any) => i.id === itinerary.id);
       if (idx >= 0) {
         list[idx] = { ...list[idx], ...itinerary, publishedAt: Date.now() };
       } else {
         list.push({ ...itinerary, publishedAt: Date.now() });
       }
       await storageService.save('COMMUNITY_ITINERARIES', list);
     }
   },

  async updateItinerary(itineraryId: string, updates: any) {
    try {
      await db.collection('itineraries').doc(itineraryId).update(updates);
    } catch (e) {
      console.warn('Firestore updateItinerary failed, using local:', e);
      // Fallback to local: upsert (add if not found)
      const list = (await storageService.load('COMMUNITY_ITINERARIES')) || [];
      const idx = list.findIndex((i: any) => i.id === itineraryId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates };
      } else {
        list.push({ id: itineraryId, ...updates });
      }
      await storageService.save('COMMUNITY_ITINERARIES', list);
    }
  },

  async searchUsers(query: string) {
    const lower = query.toLowerCase();
    // Reuse getUsers() which already merges Firestore + local storage +
    // built-in mock users and filters out admins, so search always works
    // even when Firestore is unreachable, permission-denied, or empty.
    const allUsers = await this.getUsers();
    return allUsers.filter((u: any) =>
      u.name?.toLowerCase().includes(lower) ||
      u.email?.toLowerCase().includes(lower)
    );
  },

  async searchItineraries(query: string) {
    const lower = query.toLowerCase();
    // Reuse getItineraries() which already falls back to local storage.
    const allItineraries = await this.getItineraries('newest');
    return allItineraries.filter((i: any) =>
      i.title?.toLowerCase().includes(lower) ||
      i.destinations?.some((d: string) => d.toLowerCase().includes(lower)) ||
      i.authorName?.toLowerCase().includes(lower)
    );
  },

  async getAllTags() {
    try {
      const snapshot = await db.collection('itineraries').get();
      const tags = new Set<string>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.tags && Array.isArray(data.tags)) {
          data.tags.forEach((tag: string) => tags.add(tag));
        }
      });
      return Array.from(tags);
    } catch (e) {
      console.warn('Firestore getAllTags failed:', e);
      return [];
    }
  },

  async setItineraryFeatured(itineraryId: string, featured: boolean) {
    try {
      await db.collection('itineraries').doc(itineraryId).update({ featured });
    } catch (e) {
      console.warn('Firestore setItineraryFeatured failed:', e);
    }
  },

  async getItinerariesByAuthor(authorId: string) {
    try {
      const snapshot = await db.collection('itineraries')
        .where('authorId', '==', authorId)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    } catch (e) {
      console.warn('Firestore getItinerariesByAuthor failed, using local:', e);
      const local = (await storageService.load('COMMUNITY_ITINERARIES')) || [];
      return local.filter((i: any) => i.authorId === authorId);
    }
  },

  async getFeaturedItineraries() {
    try {
      const snapshot = await db.collection('itineraries')
        .where('featured', '==', true)
        .orderBy('publishedAt', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    } catch (e) {
      console.warn('Firestore getFeaturedItineraries failed:', e);
      return [];
    }
  },

  // Follow/unfollow a user (persisted to local storage)
  async followUser(followerId: string, targetUserId: string) {
    const key = 'FOLLOWS';
    const follows = (await storageService.load(key)) || {};
    if (!follows[followerId]) follows[followerId] = [];
    if (!follows[followerId].includes(targetUserId)) {
      follows[followerId].push(targetUserId);
      await storageService.save(key, follows);
    }
  },

  async unfollowUser(followerId: string, targetUserId: string) {
    const key = 'FOLLOWS';
    const follows = (await storageService.load(key)) || {};
    if (follows[followerId]) {
      follows[followerId] = follows[followerId].filter((id: string) => id !== targetUserId);
      await storageService.save(key, follows);
    }
  },

  async getFollowedUsers(userId: string): Promise<string[]> {
    const key = 'FOLLOWS';
    const follows = (await storageService.load(key)) || {};
    return follows[userId] || [];
  },

  async getFollowersCount(userId: string): Promise<number> {
    const key = 'FOLLOWS';
    const follows = (await storageService.load(key)) || {};
    let count = 0;
    for (const followerId of Object.keys(follows)) {
      if (follows[followerId].includes(userId)) count++;
    }
    return count;
  },
};
