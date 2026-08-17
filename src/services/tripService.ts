import storageService from './storageService';
import tripsData from '../data/trips.json';
import notificationService from './notificationService';
import { setDoc, deleteDoc, doc } from 'firebase/firestore';
import { getFirestoreDb } from './firebase';

const db = getFirestoreDb();

// Helper: reattach photos and cover image to a single itinerary
async function rehydrate(itinerary: any) {
  if (!itinerary) return itinerary;

  // Reattach cover image
  if (!itinerary.coverImage) {
    const base64 = await storageService.loadCoverImage(itinerary.id);
    if (base64) {
      itinerary.coverImage = `data:image/jpeg;base64,${base64}`;
    }
  }

  // Reattach activity photos
  if (itinerary.activities) {
    itinerary.activities = await Promise.all(
      itinerary.activities.map(async (activity: any) => {
        if (activity.photos && activity.photos.length > 0) {
          const photosWithBase64 = await Promise.all(
            activity.photos.map(async (photo: any) => {
              if (!photo.base64) {
                const b64 = await storageService.loadActivityPhoto(itinerary.id, activity.id, photo.id);
                if (b64) return { ...photo, base64: b64 };
              }
              return photo;
            })
          );
          return { ...activity, photos: photosWithBase64 };
        }
        return activity;
      })
    );
  }

  return itinerary;
}

const tripService = {
  async getTrips() {
    // Return mock data; in future replace with Firestore fetch
    return tripsData;
  },
  
  async getTripById(id: string) {
    const mockTrip = tripsData.find((t: any) => t.id === id);
    if (mockTrip) return mockTrip;

    let trip = await storageService.loadItineraryItem(id);
    if (!trip) {
      // Also check community local cache
      trip = await storageService.loadCommItineraryItem(id);
    }
    return rehydrate(trip);
  },

  async getItineraryById(id: string) {
    const mockTrip = tripsData.find((t: any) => t.id === id);
    if (mockTrip) return mockTrip;

    let trip = await storageService.loadItineraryItem(id);
    if (!trip) {
      trip = await storageService.loadCommItineraryItem(id);
    }
    return rehydrate(trip);
  },

  // Get all user itineraries (with photos/cover reattached for display)
  async getItineraries(userId?: string) {
    let all = await storageService.loadAllItineraries();
    
    // Reattach cover images and photos
    all = await Promise.all(all.map(i => rehydrate(i)));
    
    if (userId) {
      return all.filter((i: any) => i.userId === userId);
    }
    return all;
  },

  // Save itinerary to user's local storage (each under its own key to avoid CursorWindow)
  async saveTrip(itinerary: any) {
    const ids = await storageService.getItinIds();
    const existing = ids.includes(itinerary.id)
      ? await storageService.loadItineraryItem(itinerary.id)
      : null;

    const toSave = {
      ...itinerary,
      createdAt: itinerary.createdAt || existing?.createdAt || Date.now()
    };

    // Extract cover image to separate storage
    if (toSave.coverImage?.startsWith('data:image')) {
      const b64 = toSave.coverImage.split(',')[1];
      await storageService.saveCoverImage(toSave.id, b64);
      delete toSave.coverImage;
      delete toSave.coverImageBase64;
    } else if ((toSave as any).coverImageBase64) {
      await storageService.saveCoverImage(toSave.id, (toSave as any).coverImageBase64);
      delete (toSave as any).coverImageBase64;
    }

    // Extract activity photos to separate storage
    if (toSave.activities) {
      await storageService.deleteActivityPhotos(toSave.id);
      toSave.activities = await Promise.all(
        toSave.activities.map(async (a: any) => {
          if (a.photos?.length) {
            const stripped = await Promise.all(
              a.photos.map(async (p: any) => {
                if (p.base64) {
                  await storageService.saveActivityPhoto(toSave.id, a.id, p.id, p.base64);
                  const { base64, ...rest } = p;
                  return rest;
                }
                return p;
              })
            );
            return { ...a, photos: stripped };
          }
          return a;
        })
      );
    }

    // Save individually — no single row exceeds CursorWindow limit
    await storageService.saveItineraryItem(toSave.id, toSave);
    
    // Add ID to registry if new
    if (!ids.includes(toSave.id)) {
      ids.push(toSave.id);
      await storageService.setItinIds(ids);
    }

    return itinerary;
  },
  
  // Helper: reattach activity photos from separate storage
  async _reattachPhotos(itinerary: any) {
    return rehydrate(itinerary);
  },

  /** Delete an itinerary — locally AND from Firestore (server-side for everyone) */
  async deleteItinerary(id: string) {
    // Clean up photo and cover image storage first
    try { await storageService.deleteActivityPhotos(id); } catch (_) {}
    try { await storageService.deleteCoverImage(id); } catch (_) {}
    
    // Remove from individual storage
    try { await storageService.deleteItineraryItem(id); } catch (_) {}

    // Update ID registry
    let ids = await storageService.getItinIds();
    ids = ids.filter(x => x !== id);
    await storageService.setItinIds(ids);

    // Also clean up from community local cache
    let commIds = await storageService.getCommItinIds();
    if (commIds.includes(id)) {
      try { await storageService.deleteCommItineraryItem(id); } catch (_) {}
      commIds = commIds.filter(x => x !== id);
      await storageService.setCommItinIds(commIds);
    }

    // Mark deleted in Firestore first (tombstone) so other devices and stale
    // caches filter it out even if the hard delete below fails (offline/permissions).
    try {
      await setDoc(doc(db, 'itineraries', id), { deleted: true }, { merge: true });
    } catch (e) {
      console.warn('[tripService] Firestore tombstone failed:', e);
    }

    // Server-side hard delete from Firestore so it deletes for everyone
    try {
      await deleteDoc(doc(db, 'itineraries', id));
      console.log(`[tripService] Hard-deleted itinerary ${id} from Firestore`);
    } catch (e) {
      console.warn('[tripService] Firestore delete failed (may be offline):', e);
    }
  },
  
  async updateItinerary(id: string, updates: any) {
    const existing = await storageService.loadItineraryItem(id);
    if (!existing) return null;

    // Extract cover image if being updated
    if (updates.coverImage?.startsWith('data:image')) {
      const b64 = updates.coverImage.split(',')[1];
      await storageService.saveCoverImage(id, b64);
      const { coverImage, coverImageBase64, ...rest } = updates;
      updates = rest;
    }

    const updated = { ...existing, ...updates };
    await storageService.saveItineraryItem(id, updated);
    return updated;
  },

  // Save any trip (official, community, or user-created) as a customizable copy
  // This makes ALL itineraries savable and customizable
  async saveTripAsCustomizable(trip: any, userId: string, userName: string) {
    // Extract cover image to separate storage BEFORE creating deep copy
    // to prevent CursorWindow errors on Android
    let coverImageBase64: string | null = null;
    if (trip.coverImage?.startsWith('data:image')) {
      coverImageBase64 = trip.coverImage.split(',')[1];
    } else if (trip.coverImageBase64) {
      coverImageBase64 = trip.coverImageBase64;
    }

    // Create a deep copy WITHOUT the large cover image
    const { coverImage, coverImageBase64: _cb64, ...rest } = trip;
    const customTrip = {
      ...JSON.parse(JSON.stringify(rest)), // Deep copy without cover
      id: `custom-${trip.id}-${Date.now()}`,
      originalId: trip.id,
      userId: userId,
      authorName: userName,
      isCustomCopy: true,
      savedAt: Date.now(),
      createdAt: trip.createdAt || Date.now(),
      // Convert official trip format to itinerary format if needed
      activities: rest.activities || (rest.days || []).map((d: any, i: number) => ({
        id: `${trip.id}-day-${d.day || i + 1}`,
        day: d.day || i + 1,
        title: d.title || '',
        notes: Array.isArray(d.activities) ? d.activities.join(' · ') : '',
        links: [],
        photos: [],
        completed: false,
      })),
      // Keep original fields for reference
      destinations: rest.destinations || (rest.country ? [rest.country] : []),
      tags: rest.tags || [],
      season: rest.season,
      budget: rest.budget,
      category: rest.category,
    };

    // Import the source trip's budget into the expenses section so it shows
    // up in the Expenses tab once saved.
    if (rest.budget && !(customTrip.expenses || []).some((e: any) => e.notes === 'Budget')) {
      customTrip.expenses = [
        ...(customTrip.expenses || []),
        {
          id: `expense-budget-${Date.now()}`,
          category: 'other' as const,
          amount: typeof rest.budget === 'number' ? rest.budget : parseFloat(rest.budget) || 0,
          currency: rest.budgetCurrency || 'USD',
          notes: 'Budget',
          timestamp: Date.now(),
        },
      ];
    }

    // Save cover image to separate storage to avoid CursorWindow errors
    if (coverImageBase64) {
      await storageService.saveCoverImage(customTrip.id, coverImageBase64);
      // Attach full data URI for immediate display
      (customTrip as any).coverImage = `data:image/jpeg;base64,${coverImageBase64}`;
    } else if (trip.image && typeof trip.image === 'string' && !trip.image.startsWith('data:')) {
      // External URL — keep as-is, no size issue
      (customTrip as any).coverImage = trip.image;
    }

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