import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  USER: 'WB_USER',
  ITINERARIES: 'WB_ITINERARIES',       // legacy: single-key array (kept for migration)
  ITIN_IDS: 'WB_ITIN_IDS',             // lightweight array of itinerary IDs
  ITIN_PREFIX: 'WB_ITIN_',             // prefix for individual itinerary keys
  FAVORITES: 'WB_FAVORITES',
  SETTINGS: 'WB_SETTINGS',
  NOTIFICATIONS: 'WB_NOTIFICATIONS',
  USER_DATA: 'WB_USER_DATA',
  COMMUNITY_USERS: 'COMMUNITY_USERS',
  COMMUNITY_ITINERARIES: 'COMMUNITY_ITINERARIES',
  COMM_ITIN_IDS: 'COMM_ITIN_IDS',      // lightweight array of community itinerary IDs
  COMM_ITIN_PREFIX: 'COMM_ITIN_',      // prefix for individual community itinerary keys
};

const storageService = {
  async save(key: string, value: any) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
    async load(key: string) {
    const v = await AsyncStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  },
  /** Wipe ALL local storage (used during account deletion). */
  async clearAll() {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.warn('[storage] clearAll failed:', e);
    }
  },
  STORAGE_KEYS,

  // ---- Individual itinerary storage (avoids CursorWindow by keeping each row small) ----

  /** Get all itinerary IDs */
  async getItinIds(): Promise<string[]> {
    const ids = await AsyncStorage.getItem(STORAGE_KEYS.ITIN_IDS);
    return ids ? JSON.parse(ids) : [];
  },

  /** Set itinerary ID list */
  async setItinIds(ids: string[]) {
    await AsyncStorage.setItem(STORAGE_KEYS.ITIN_IDS, JSON.stringify(ids));
  },

  /** Save a single itinerary under its own key (no photos — already stripped) */
  async saveItineraryItem(id: string, data: any) {
    await AsyncStorage.setItem(`${STORAGE_KEYS.ITIN_PREFIX}${id}`, JSON.stringify(data));
  },

  /** Load a single itinerary */
  async loadItineraryItem(id: string): Promise<any | null> {
    const v = await AsyncStorage.getItem(`${STORAGE_KEYS.ITIN_PREFIX}${id}`);
    return v ? JSON.parse(v) : null;
  },

  /** Remove a single itinerary from storage */
  async deleteItineraryItem(id: string) {
    await AsyncStorage.removeItem(`${STORAGE_KEYS.ITIN_PREFIX}${id}`);
  },

  /** Load all itineraries (migrates from old format if needed) */
  async loadAllItineraries(): Promise<any[]> {
    let ids = await this.getItinIds();
    
    if (ids.length === 0) {
      // Try to migrate from old single-key format (catch CursorWindow if old data is too big)
      try {
        const oldList = await this.load(STORAGE_KEYS.ITINERARIES);
        if (oldList && Array.isArray(oldList) && oldList.length > 0) {
          console.log('[storage] Migrating from old ITINERARIES format...');
          for (const item of oldList) {
            if (item && item.id) {
              await this.saveItineraryItem(item.id, item);
              ids.push(item.id);
            }
          }
          await this.setItinIds(ids);
          console.log(`[storage] Migrated ${ids.length} itineraries`);
        }
      } catch (e) {
        console.warn('[storage] Old ITINERARIES data is corrupted/too large, starting fresh:', e);
        // Clear the old key so we don't retry
        try { await AsyncStorage.removeItem(STORAGE_KEYS.ITINERARIES); } catch (_) {}
      }
    }
    
    const results: any[] = [];
    for (const id of ids) {
      try {
        const item = await this.loadItineraryItem(id);
        if (item) results.push(item);
      } catch (e) {
        console.warn(`[storage] Failed to load itinerary ${id}:`, e);
      }
    }
    return results;
  },

  // ---- Community itinerary storage (individual keys to avoid CursorWindow) ----

  async getCommItinIds(): Promise<string[]> {
    const ids = await AsyncStorage.getItem(STORAGE_KEYS.COMM_ITIN_IDS);
    return ids ? JSON.parse(ids) : [];
  },

  async setCommItinIds(ids: string[]) {
    await AsyncStorage.setItem(STORAGE_KEYS.COMM_ITIN_IDS, JSON.stringify(ids));
  },

  async saveCommItineraryItem(id: string, data: any) {
    await AsyncStorage.setItem(`${STORAGE_KEYS.COMM_ITIN_PREFIX}${id}`, JSON.stringify(data));
  },

  async loadCommItineraryItem(id: string): Promise<any | null> {
    const v = await AsyncStorage.getItem(`${STORAGE_KEYS.COMM_ITIN_PREFIX}${id}`);
    return v ? JSON.parse(v) : null;
  },

  async deleteCommItineraryItem(id: string) {
    await AsyncStorage.removeItem(`${STORAGE_KEYS.COMM_ITIN_PREFIX}${id}`);
  },

  async loadAllCommItineraries(): Promise<any[]> {
    let ids = await this.getCommItinIds();
    if (ids.length === 0) {
      try {
        const oldList = await this.load(STORAGE_KEYS.COMMUNITY_ITINERARIES);
        if (oldList && Array.isArray(oldList) && oldList.length > 0) {
          console.log('[storage] Migrating from old COMMUNITY_ITINERARIES format...');
          for (const item of oldList) {
            if (item && item.id) {
              await this.saveCommItineraryItem(item.id, item);
              ids.push(item.id);
            }
          }
          await this.setCommItinIds(ids);
        }
      } catch (e) {
        console.warn('[storage] Old COMMUNITY_ITINERARIES data is corrupted/too large, starting fresh:', e);
        try { await AsyncStorage.removeItem(STORAGE_KEYS.COMMUNITY_ITINERARIES); } catch (_) {}
      }
    }
    const results: any[] = [];
    for (const id of ids) {
      try {
        const item = await this.loadCommItineraryItem(id);
        if (item) results.push(item);
      } catch (e) {
        console.warn(`[storage] Failed to load comm itinerary ${id}:`, e);
      }
    }
    return results;
  },

  // ---- Cover images (unchanged) ----

  async saveCoverImage(itineraryId: string, base64: string) {
    await AsyncStorage.setItem(`WB_COVER_${itineraryId}`, base64);
  },
  async loadCoverImage(itineraryId: string) {
    return await AsyncStorage.getItem(`WB_COVER_${itineraryId}`);
  },
  async deleteCoverImage(itineraryId: string) {
    await AsyncStorage.removeItem(`WB_COVER_${itineraryId}`);
  },

  // ---- Activity photos (store separately to avoid CursorWindow) ----

  async saveActivityPhoto(itineraryId: string, activityId: string, photoId: string, base64: string) {
    await AsyncStorage.setItem(`WB_PHOTO_${itineraryId}_${activityId}_${photoId}`, base64);
  },
  async loadActivityPhoto(itineraryId: string, activityId: string, photoId: string) {
    return await AsyncStorage.getItem(`WB_PHOTO_${itineraryId}_${activityId}_${photoId}`);
  },
  async deleteActivityPhotos(itineraryId: string) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const photoKeys = keys.filter(k => k.startsWith(`WB_PHOTO_${itineraryId}_`));
      if (photoKeys.length > 0) {
        await AsyncStorage.multiRemove(photoKeys);
      }
    } catch (e) {
      console.warn('[storage] deleteActivityPhotos failed:', e);
    }
  },
};

export default storageService;
