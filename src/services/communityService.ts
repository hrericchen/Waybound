// Community service — fully AsyncStorage-based.
// Firebase Firestore requires native modules on React Native; use this local-only version.

import storageService from './storageService';

const COMMUNITY_USERS_KEY = 'COMMUNITY_USERS';
const COMMUNITY_ITINERARIES_KEY = 'COMMUNITY_ITINERARIES';

export const communityService = {
  async registerUser(user: any) {
    const users = (await storageService.load(COMMUNITY_USERS_KEY)) || [];
    if (!users.find((u: any) => u.id === user.id)) {
      users.push({
        id: user.id,
        name: user.name || (user.email || '').split('@')[0],
        email: user.email,
        createdAt: Date.now(),
      });
      await storageService.save(COMMUNITY_USERS_KEY, users);
    }
  },

  async getUsers() {
    return (await storageService.load(COMMUNITY_USERS_KEY)) || [];
  },

  async searchUsers(queryStr: string) {
    const all = await this.getUsers();
    const q = queryStr.toLowerCase();
    return all.filter(
      (u: any) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  },

  async publishItinerary(itinerary: any) {
    const docData = {
      id: itinerary.id,
      title: itinerary.title,
      destinations: itinerary.destinations,
      activities: itinerary.activities,
      coverImage: itinerary.coverImage || '',
      description: itinerary.description || '',
      authorId: itinerary.authorId,
      authorName: itinerary.authorName,
      createdAt: Date.now(),
      likes: 0,
      views: 0,
      featured: false,
      tags: itinerary.tags || [],
    };
    const list = (await storageService.load(COMMUNITY_ITINERARIES_KEY)) || [];
    list.push(docData);
    await storageService.save(COMMUNITY_ITINERARIES_KEY, list);
  },

  async getItineraries(filter = 'featured') {
    const list = (await storageService.load(COMMUNITY_ITINERARIES_KEY)) || [];
    switch (filter) {
      case 'featured':
        return list.filter((i: any) => i.featured).sort((a: any, b: any) => b.createdAt - a.createdAt);
      case 'most_liked':
        return list.sort((a: any, b: any) => b.likes - a.likes);
      case 'most_viewed':
        return list.sort((a: any, b: any) => b.views - a.views);
      default:
        return list.sort((a: any, b: any) => b.createdAt - a.createdAt);
    }
  },

  async likeItinerary(id: string) {
    const list = (await storageService.load(COMMUNITY_ITINERARIES_KEY)) || [];
    const idx = list.findIndex((i: any) => i.id === id);
    if (idx >= 0) {
      list[idx].likes += 1;
      await storageService.save(COMMUNITY_ITINERARIES_KEY, list);
    }
  },

  async incrementView(id: string) {
    const list = (await storageService.load(COMMUNITY_ITINERARIES_KEY)) || [];
    const idx = list.findIndex((i: any) => i.id === id);
    if (idx >= 0) {
      list[idx].views += 1;
      await storageService.save(COMMUNITY_ITINERARIES_KEY, list);
    }
  },

  async getItinerariesByAuthor(authorId: string) {
    const list = (await storageService.load(COMMUNITY_ITINERARIES_KEY)) || [];
    return list.filter((i: any) => i.authorId === authorId);
  },

  async getItineraryById(id: string) {
    const list = (await storageService.load(COMMUNITY_ITINERARIES_KEY)) || [];
    return list.find((i: any) => i.id === id) || null;
  },

  async deleteItinerary(id: string) {
    const list = (await storageService.load(COMMUNITY_ITINERARIES_KEY)) || [];
    const idx = list.findIndex((i: any) => i.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
      await storageService.save(COMMUNITY_ITINERARIES_KEY, list);
    }
  },
};

export default communityService;
