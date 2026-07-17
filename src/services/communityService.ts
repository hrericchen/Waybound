import { getFirestore } from './firebase';
import storageService from './storageService';

const db = getFirestore();

export const communityService = {
  async getUsers() {
    try {
      const snapshot = await db.collection('users').orderBy('name').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    } catch (e) {
      console.warn('Firestore getUsers failed, using local:', e);
      return [];
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
      console.warn('Firestore registerUser failed:', e);
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

      return results;
    } catch (e) {
      console.warn('Firestore getItineraries failed, using local:', e);
      const local = (await storageService.load('COMMUNITY_ITINERARIES')) || [];
      return local;
    }
  },

  async publishItinerary(itinerary: any) {
    try {
      await db.collection('itineraries').doc(itinerary.id).set({
        ...itinerary,
        publishedAt: Date.now(),
      });
    } catch (e) {
      console.warn('Firestore publishItinerary failed:', e);
      // Fallback to local
      const list = (await storageService.load('COMMUNITY_ITINERARIES')) || [];
      list.push(itinerary);
      await storageService.save('COMMUNITY_ITINERARIES', list);
    }
  },

  async searchUsers(query: string) {
    try {
      const snapshot = await db.collection('users').get();
      const lower = query.toLowerCase();
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter((u: any) => 
          u.name?.toLowerCase().includes(lower) ||
          u.email?.toLowerCase().includes(lower)
        );
    } catch (e) {
      console.warn('Firestore searchUsers failed:', e);
      return [];
    }
  },

  async searchItineraries(query: string) {
    try {
      const snapshot = await db.collection('itineraries').get();
      const lower = query.toLowerCase();
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter((i: any) =>
          i.title?.toLowerCase().includes(lower) ||
          i.destinations?.some((d: string) => d.toLowerCase().includes(lower))
        );
    } catch (e) {
      console.warn('Firestore searchItineraries failed:', e);
      return [];
    }
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
};