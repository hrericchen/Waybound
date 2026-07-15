import storageService from './storageService';
import tripsData from '../data/trips.json';

const tripService = {
  async getTrips() {
    // Return mock data; in future replace with Firestore fetch
    return tripsData;
  },
  async getTripById(id: string) {
    const all = tripsData;
    return all.find((t: any) => t.id === id) || null;
  },
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
  async getItineraries() {
    return (await storageService.load(storageService.STORAGE_KEYS.ITINERARIES)) || [];
  }
};

export default tripService;
