import storageService from './storageService';
import tripsData from '../data/trips.json';
import notificationService from './notificationService';

const tripService = {
  async getTrips() {
    // Return mock data; in future replace with Firestore fetch
    return tripsData;
  },
  
  async getTripById(id: string) {
    // First check mock data
    const mockTrip = tripsData.find((t: any) => t.id === id);
    if (mockTrip) return mockTrip;
    
    // Then check saved itineraries
    const saved = await this.getItineraries();
    return saved.find((i: any) => i.id === id) || null;
  },
  
  // Save itinerary to user's local storage
  async saveTrip(itinerary: any) {
    const list = (await storageService.load(storageService.STORAGE_KEYS.ITINERARIES)) || [];
    const idx = list.findIndex((i: any) => i.id === itinerary.id);
    if (idx >= 0) list[idx] = itinerary;
    else list.push(itinerary);
    await storageService.save(storageService.STORAGE_KEYS.ITINERARIES, list);
    return itinerary;
  },
  
  async deleteItinerary(id: string) {
    const list = (await storageService.load(storageService.STORAGE_KEYS.ITINERARIES)) || [];
    const next = list.filter((i: any) => i.id !== id);
    await storageService.save(storageService.STORAGE_KEYS.ITINERARIES, next);
  },
  
  async updateItinerary(id: string, updates: any) {
    const list = (await storageService.load(storageService.STORAGE_KEYS.ITINERARIES)) || [];
    const idx = list.findIndex((i: any) => i.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updates };
      await storageService.save(storageService.STORAGE_KEYS.ITINERARIES, list);
    }
  },
  
  async getItineraries(userId?: string) {
    const allItineraries = (await storageService.load(storageService.STORAGE_KEYS.ITINERARIES)) || [];
    // If userId is provided, filter to only that user's itineraries
    if (userId) {
      return allItineraries.filter((i: any) => i.userId === userId);
    }
    return allItineraries;
  },

  // Save any trip (official, community, or user-created) as a customizable copy
  // This makes ALL itineraries savable and customizable
  async saveTripAsCustomizable(trip: any, userId: string, userName: string) {
    // Create a deep copy of the trip
    const customTrip = {
      ...JSON.parse(JSON.stringify(trip)), // Deep copy to avoid reference issues
      id: `custom-${trip.id}-${Date.now()}`, // New unique ID
      originalId: trip.id, // Keep reference to original
      userId: userId, // Associate with user
      authorName: userName,
      isCustomCopy: true,
      savedAt: Date.now(),
      // Convert official trip format to itinerary format if needed
      activities: trip.activities || (trip.days || []).map((d: any, i: number) => ({
        id: `${trip.id}-day-${d.day || i + 1}`,
        day: d.day || i + 1,
        title: d.title || '',
        notes: Array.isArray(d.activities) ? d.activities.join(' · ') : '',
        links: [],
        photos: [],
        completed: false,
      })),
      // Keep original fields for reference
      coverImage: trip.coverImage || trip.image,
      destinations: trip.destinations || (trip.country ? [trip.country] : []),
      tags: trip.tags || [],
      season: trip.season,
      budget: trip.budget,
      category: trip.category,
    };

    // Save to user's itineraries
    await this.saveTrip(customTrip);

    // If this is a community itinerary, notify the original owner
    if (trip.authorId && trip.authorId !== userId) {
      try {
        await notificationService.notifyItinerarySave(
          trip.authorId,
          userId,
          userName,
          trip.id,
          trip.title
        );
      } catch (e) {
        console.warn('Failed to send save notification:', e);
      }
    }

    return customTrip;
  },

  // Save user data (profile pictures, settings, etc.) per user
  async saveUserData(userId: string, data: any) {
    const allUserData = (await storageService.load(storageService.STORAGE_KEYS.USER_DATA)) || {};
    allUserData[userId] = { ...allUserData[userId], ...data };
    await storageService.save(storageService.STORAGE_KEYS.USER_DATA, allUserData);
  },

  // Get user data
  async getUserData(userId: string) {
    const allUserData = (await storageService.load(storageService.STORAGE_KEYS.USER_DATA)) || {};
    return allUserData[userId] || {};
  },

  // Save profile picture for a user
  async saveProfilePicture(userId: string, avatarUrl: string) {
    await this.saveUserData(userId, { avatarUrl });
  },

  // Get profile picture for a user
  async getProfilePicture(userId: string) {
    const userData = await this.getUserData(userId);
    return userData.avatarUrl || null;
  },
};

export default tripService;