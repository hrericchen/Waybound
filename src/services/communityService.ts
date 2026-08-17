import { getFirestoreDb } from './firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  addDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import storageService from './storageService';
import notificationService from './notificationService';

const db = getFirestoreDb();

// Local fallback users for testing
const LOCAL_USERS = [
  { id: 'test-001', name: 'Test User', email: 'test@waybound.app', createdAt: Date.now() - 86400000 },
];

export const communityService = {
  async getUsers() {
    try {
      const q = query(collection(db, 'users'), orderBy('name'));
      const snapshot = await getDocs(q);
      const firestoreUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Merge with local users to ensure everyone is visible
      const localUsers = (await storageService.load('COMMUNITY_USERS')) || [];
      const allUsers = [...firestoreUsers, ...localUsers, ...LOCAL_USERS];

      // Remove duplicates by id
      const uniqueUsers = allUsers.filter((user: any, index: number, self: any[]) =>
        index === self.findIndex((u: any) => u.id === user.id)
      );

      // Exclude admin users AND users who set their profile to private
      const filteredUsers = uniqueUsers.filter((u: any) =>
        !u.isAdmin && u.id !== 'admin-001' && !u.email?.includes('admin') && u.isPublic !== false && !u.deleted
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

      // Exclude admin users AND private users
      const filteredUsers = uniqueUsers.filter((u: any) =>
        !u.isAdmin && u.id !== 'admin-001' && !u.email?.includes('admin') && u.isPublic !== false && !u.deleted
      );

      return filteredUsers.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    }
  },

  async registerUser(user: { id: string; name: string; email: string; isAdmin?: boolean; avatarUrl?: string; tag?: string }) {
    try {
      const docData: any = {
        name: user.name,
        email: user.email,
        createdAt: Date.now(),
      };
      if (user.isAdmin) docData.isAdmin = true;
      if (user.avatarUrl) docData.avatarUrl = user.avatarUrl;
      if (user.tag) docData.tag = user.tag;
      // Use merge so fields like isPro, isAdmin, isPublic, followerCount are preserved
      await setDoc(doc(db, 'users', user.id), docData, { merge: true });
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

  /** Fetch a single user's profile from Firestore (with local fallback) */
  async getUser(userId: string) {
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) return { id: snap.id, ...snap.data() } as any;
      return null;
    } catch (e) {
      console.warn('Firestore getUser failed, using local:', e);
      const users = (await storageService.load('COMMUNITY_USERS')) || [];
      return users.find((u: any) => u.id === userId) || null;
    }
  },

  /** Persist arbitrary fields (isPro, tag, followerCount, etc.) to a user document server-side */
  async updateUserStatus(userId: string, fields: Record<string, any>) {
    try {
      await setDoc(doc(db, 'users', userId), fields, { merge: true });
      return true;
    } catch (e) {
      console.warn('Firestore updateUserStatus failed:', e);
      return false;
    }
  },

  /** Recompute and store a user's follower count on their server-side document */
  async syncFollowerCountServer(userId: string) {
    try {
      const q = query(collection(db, 'follows'), where('targetUserId', '==', userId));
      const snapshot = await getDocs(q);
      const count = snapshot.docs.filter((d) => !d.data().deleted).length;
      await setDoc(doc(db, 'users', userId), { followerCount: count }, { merge: true });
    } catch (e) {
      console.warn('Firestore syncFollowerCountServer failed:', e);
    }
  },

  /** Grant or revoke Pro on a user (admin action, saves to Firestore).
   *  Uses `grantedPro` (not `isPro`) so it can't be confused with the
   *  informational `isPro` flag synced from RevenueCat purchases. */
  async setUserPro(userId: string, isPro: boolean) {
    try {
      await updateDoc(doc(db, 'users', userId), { grantedPro: isPro });
      return true;
    } catch (e) {
      console.warn('Firestore setUserPro failed:', e);
      return false;
    }
  },

  /** Grant or revoke Mini on a user (admin action, saves to Firestore).
   *  Uses `grantedMini`; legacy `isMini` grants are still honored when read. */
  async setUserMini(userId: string, isMini: boolean) {
    try {
      await updateDoc(doc(db, 'users', userId), { grantedMini: isMini });
      return true;
    } catch (e) {
      console.warn('Firestore setUserMini failed:', e);
      return false;
    }
  },

  /** File a user report (moderation). */
  async reportUser(reporterId: string, targetUserId: string, reason: string) {
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId,
        targetUserId,
        reason,
        createdAt: Date.now(),
      });

      // Let every admin know about the report in-app (bell -> Notifications).
      try {
        const [reporter, target] = await Promise.all([
          this.getUser(reporterId),
          this.getUser(targetUserId),
        ]);
        const reporterName = reporter?.name || 'A user';
        const targetName = target?.name || 'a user';
        const admins = await this.getAdminUserIds();
        for (const adminId of admins) {
          if (adminId === reporterId) continue;
          await notificationService.createNotification({
            userId: adminId,
            type: 'report',
            fromUserId: reporterId,
            fromUserName: reporterName,
            message: `${reporterName} reported ${targetName}: ${reason}`,
          });
        }
      } catch (e) {
        console.warn('Failed to notify admins about report:', e);
      }
      return true;
    } catch (e) {
      console.warn('Firestore reportUser failed:', e);
      return false;
    }
  },

  /** Fetch all user reports (newest first) with reporter/target names and the
   *  target's moderation state (warnings / suspension / deleted) resolved. */
  async getReports() {
    try {
      const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const users = new Map<string, any>();
      for (const r of reports) {
        for (const id of [r.reporterId, r.targetUserId]) {
          if (id && !users.has(id)) {
            try {
              users.set(id, await this.getUser(id));
            } catch {
              users.set(id, null);
            }
          }
        }
      }
      return reports.map(r => {
        const target = users.get(r.targetUserId);
        return {
          ...r,
          reporterName: users.get(r.reporterId)?.name || 'Unknown user',
          targetName: target?.name || 'Unknown user',
          targetWarningCount: target?.moderation?.warningCount || 0,
          targetSuspended: !!target?.suspendedUntil && target.suspendedUntil > Date.now(),
          targetDeleted: !!target?.deleted,
        };
      });
    } catch (e) {
      console.warn('Firestore getReports failed:', e);
      return [];
    }
  },

  /** Dismiss a report without taking action. */
  async resolveReport(reportId: string) {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      return true;
    } catch (e) {
      console.warn('Firestore resolveReport failed:', e);
      return false;
    }
  },

  /** Issue a warning to a user (admin action): records it on their profile and
   *  sends them an in-app warning notification. `adminId` is the acting admin's
   *  uid (used to satisfy Firestore's fromUserId == request.auth.uid rule). */
  async warnUser(adminId: string, targetUserId: string, reason: string, note?: string) {
    try {
      const userRef = doc(db, 'users', targetUserId);
      const snap = await getDoc(userRef);
      const existing = snap.exists() ? snap.data() : {};
      const warnings = existing.moderation?.warnings || [];
      warnings.push({ reason, note: note || '', createdAt: Date.now() });
      await setDoc(
        userRef,
        {
          moderation: { ...(existing.moderation || {}), warnings, warningCount: warnings.length },
          lastModeratedAt: Date.now(),
        },
        { merge: true }
      );
      await notificationService.notifyModerationWarning(targetUserId, adminId, reason, note);
      return true;
    } catch (e) {
      console.warn('Firestore warnUser failed:', e);
      return false;
    }
  },

  /** Suspend a user for N days (admin action): blocks their access until the
   *  suspension expires and notifies them in-app. */
  async suspendUser(adminId: string, targetUserId: string, days: number, reason: string, note?: string) {
    try {
      const until = Date.now() + days * 24 * 60 * 60 * 1000;
      await setDoc(
        doc(db, 'users', targetUserId),
        { suspendedUntil: until, suspendedReason: reason, suspendedAt: Date.now() },
        { merge: true }
      );
      await notificationService.notifyModerationSuspension(targetUserId, adminId, days, reason, note);
      return true;
    } catch (e) {
      console.warn('Firestore suspendUser failed:', e);
      return false;
    }
  },

  /** Lift an active suspension early (admin action). */
  async liftSuspension(userId: string) {
    try {
      await updateDoc(doc(db, 'users', userId), { suspendedUntil: 0, suspendedReason: '' });
      return true;
    } catch (e) {
      console.warn('Firestore liftSuspension failed:', e);
      return false;
    }
  },

  /** Wipe a user's content from Firestore: itineraries they authored, follows
   *  they're part of, their notifications, and reports they're involved in. */
  async deleteUserContent(userId: string) {
    const tryDelete = async (q: any) => {
      try {
        const snap = await getDocs(q);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach((d: any) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (e) {
        console.warn('Firestore deleteUserContent batch failed:', e);
      }
    };
    try {
      await tryDelete(query(collection(db, 'itineraries'), where('authorId', '==', userId)));
      await tryDelete(query(collection(db, 'follows'), where('followerId', '==', userId)));
      await tryDelete(query(collection(db, 'follows'), where('targetUserId', '==', userId)));
      await tryDelete(query(collection(db, 'notifications'), where('userId', '==', userId)));
      await tryDelete(query(collection(db, 'notifications'), where('fromUserId', '==', userId)));
      await tryDelete(query(collection(db, 'reports'), where('reporterId', '==', userId)));
      await tryDelete(query(collection(db, 'reports'), where('targetUserId', '==', userId)));
      return true;
    } catch (e) {
      console.warn('Firestore deleteUserContent failed:', e);
      return false;
    }
  },

  /** Ids of every account flagged as admin. */
  async getAdminUserIds() {
    try {
      const q = query(collection(db, 'users'), where('isAdmin', '==', true));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => d.id);
    } catch (e) {
      console.warn('Firestore getAdminUserIds failed:', e);
      return [];
    }
  },

  async getItineraries(sortBy: string = 'newest') {
    try {
      const snapshot = await getDocs(collection(db, 'itineraries'));
      const remoteAll = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      // Track tombstones (deleted flag) so stale local copies of deleted
      // itineraries never resurface in the feed as "Unknown" ghosts.
      const deletedIds = new Set(remoteAll.filter((d: any) => d.deleted).map((d: any) => d.id));
      let results = remoteAll.filter((d: any) => !d.deleted);

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
      const local = await storageService.loadAllCommItineraries();
      const firestoreIds = new Set(results.map((r: any) => r.id));
      // Keep local items not in Firestore (e.g. published while offline/denied)
      // so the author still sees them in the community.
      const freshLocal = local.filter((l: any) => !firestoreIds.has(l.id) && !deletedIds.has(l.id) && !l.deleted);
      const allResults = [...results, ...freshLocal];

      // Reattach cover images from separate storage to avoid CursorWindow errors
      return Promise.all(
        allResults.map(async (i: any) => {
          if (!i.coverImage) {
            const base64 = await storageService.loadCoverImage(i.id);
            if (base64) {
              return { ...i, coverImage: `data:image/jpeg;base64,${base64}` };
            }
          }
          return i;
        })
      );
    } catch (e) {
      console.warn('Firestore getItineraries failed, using local:', e);
      const local = await storageService.loadAllCommItineraries();

      // Reattach cover images from separate storage to avoid CursorWindow errors
      return Promise.all(
        local.map(async (i: any) => {
          if (!i.coverImage) {
            const base64 = await storageService.loadCoverImage(i.id);
            if (base64) {
              return { ...i, coverImage: `data:image/jpeg;base64,${base64}` };
            }
          }
          return i;
        })
      );
    }
  },

   async publishItinerary(itinerary: any) {
     try {
       // Never publish without an id — a missing id would make Firestore generate
       // a random document id, silently creating duplicate copies on re-publish.
       if (!itinerary.id) {
         console.warn('[community] publishItinerary skipped: itinerary has no id');
         return;
       }

       // Store cover images compactly: keep only the base64 payload so large
       // data URIs (1MB+ risk) are never written to Firestore verbatim.
       let normalized: any = { ...itinerary };
       if (typeof normalized.coverImage === 'string' && normalized.coverImage.startsWith('data:image')) {
         normalized.coverImageBase64 = normalized.coverImage.split(',')[1];
         delete normalized.coverImage;
       }

       // Filter out undefined values to prevent Firestore errors
       const cleanItinerary = Object.fromEntries(
         Object.entries(normalized).filter(([_, v]) => v !== undefined)
       );

       // Merge so re-publishing the same itinerary UPDATES the existing post
       // instead of clobbering it (likes/saves/featured are preserved).
       await setDoc(doc(db, 'itineraries', itinerary.id), {
         ...cleanItinerary,
         deleted: false,
         publishedAt: Date.now(),
       }, { merge: true });

       // Drop any stale local cache copy of this itinerary so the community feed
       // never shows both the old and the updated version.
       try {
         const ids = await storageService.getCommItinIds();
         if (ids.includes(itinerary.id)) {
           await storageService.deleteCommItineraryItem(itinerary.id);
           await storageService.setCommItinIds(ids.filter((x: string) => x !== itinerary.id));
         }
       } catch (_) {}
     } catch (e) {
       console.warn('Firestore publishItinerary failed:', e);
       // Fallback to local
        const ids = await storageService.getCommItinIds();
        const existing = ids.includes(itinerary.id)
          ? await storageService.loadCommItineraryItem(itinerary.id)
          : null;
        const merged = existing
          ? { ...existing, ...itinerary, publishedAt: Date.now() }
          : { ...itinerary, publishedAt: Date.now() };

        // Extract cover image to separate storage to avoid CursorWindow errors
        if (merged.coverImage?.startsWith('data:image')) {
          const base64Data = merged.coverImage.split(',')[1];
          await storageService.saveCoverImage(merged.id, base64Data);
          delete merged.coverImage;
          delete merged.coverImageBase64;
        } else if (merged.coverImageBase64) {
          await storageService.saveCoverImage(merged.id, merged.coverImageBase64);
          delete merged.coverImageBase64;
        }
        
        // Save as individual key to avoid CursorWindow
        await storageService.saveCommItineraryItem(merged.id, merged);
        if (!ids.includes(merged.id)) {
          ids.push(merged.id);
          await storageService.setCommItinIds(ids);
        }
     }
   },

  async updateItinerary(itineraryId: string, updates: any) {
    try {
      await updateDoc(doc(db, 'itineraries', itineraryId), updates);
    } catch (e) {
      console.warn('Firestore updateItinerary failed, using local:', e);
      // Fallback to local: upsert (add if not found)
      const ids = await storageService.getCommItinIds();
      const existing = ids.includes(itineraryId)
        ? await storageService.loadCommItineraryItem(itineraryId)
        : null;
      
      // Extract cover image to separate storage if being updated
      if (updates.coverImage?.startsWith('data:image') || updates.coverImageBase64) {
        const base64Data = updates.coverImage?.startsWith('data:image') 
          ? updates.coverImage.split(',')[1] 
          : updates.coverImageBase64;
        if (base64Data) {
          await storageService.saveCoverImage(itineraryId, base64Data);
          const { coverImage, coverImageBase64, ...restUpdates } = updates;
          updates = restUpdates;
        }
      }
      
      const merged = existing
        ? { ...existing, ...updates }
        : { id: itineraryId, ...updates };
      await storageService.saveCommItineraryItem(itineraryId, merged);
      if (!ids.includes(itineraryId)) {
        ids.push(itineraryId);
        await storageService.setCommItinIds(ids);
      }
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

  async searchItineraries(searchQuery: string) {
    const lower = searchQuery.toLowerCase();
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
      const snapshot = await getDocs(collection(db, 'itineraries'));
      const tags = new Set<string>();
      snapshot.docs.forEach(d => {
        const data = d.data();
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
      await updateDoc(doc(db, 'itineraries', itineraryId), { featured });
    } catch (e) {
      console.warn('Firestore setItineraryFeatured failed:', e);
    }
  },

/** Fetch a single community itinerary by id (Firestore with local fallback) */
  async getCommunityItineraryById(id: string) {
    // Try Firestore first
    try {
      const snap = await getDoc(doc(db, 'itineraries', id));
      if (snap.exists() && !snap.data().deleted) {
        const data = snap.data();
        let coverImage = data.coverImage || null;
        if (!coverImage && data.coverImageBase64) {
          coverImage = `data:image/jpeg;base64,${data.coverImageBase64}`;
        } else if (!coverImage) {
          const base64 = await storageService.loadCoverImage(id);
          if (base64) coverImage = `data:image/jpeg;base64,${base64}`;
        }
        return { id: snap.id, ...data, coverImage } as any;
      }
    } catch (e) {
      console.warn('Firestore getCommunityItineraryById failed, using local:', e);
    }

    // Fallback to local storage
    const item = await storageService.loadCommItineraryItem(id);
    if (item && !item.coverImage) {
      const base64 = await storageService.loadCoverImage(id);
      if (base64) {
        item.coverImage = `data:image/jpeg;base64,${base64}`;
      } else if (item.coverImageBase64) {
        item.coverImage = `data:image/jpeg;base64,${item.coverImageBase64}`;
      }
    }
    return item;
  },

  async getItinerariesByAuthor(authorId: string) {
    try {
      const q = query(collection(db, 'itineraries'), where('authorId', '==', authorId));
      const snapshot = await getDocs(q);
      return Promise.all(
        snapshot.docs
          .filter(d => !d.data().deleted)
          .map(async d => {
          const data = d.data();
          let coverImage = data.coverImage || null;
          if (!coverImage && data.coverImageBase64) {
            coverImage = `data:image/jpeg;base64,${data.coverImageBase64}`;
          } else if (!coverImage) {
            const base64 = await storageService.loadCoverImage(d.id);
            if (base64) coverImage = `data:image/jpeg;base64,${base64}`;
          }
          return { id: d.id, ...data, coverImage } as any;
        })
      );
    } catch (e) {
      console.warn('Firestore getItinerariesByAuthor failed, using local:', e);
      const local = await storageService.loadAllCommItineraries();
      return Promise.all(
        local.filter((i: any) => i.authorId === authorId && !i.deleted).map(async (i: any) => {
          if (!i.coverImage) {
            const base64 = await storageService.loadCoverImage(i.id);
            if (base64) {
              return { ...i, coverImage: `data:image/jpeg;base64,${base64}` };
            } else if (i.coverImageBase64) {
              return { ...i, coverImage: `data:image/jpeg;base64,${i.coverImageBase64}` };
            }
          }
          return i;
        })
      );
    }
  },

  async getFeaturedItineraries() {
    try {
      // Fetch all itineraries without a composite index requirement
      // (sort in memory to avoid needing where+orderBy index)
      const q = query(
        collection(db, 'itineraries'),
        where('featured', '==', true)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .filter(d => !d.data().deleted)
        .map(d => ({ id: d.id, ...d.data() } as any))
        .sort((a: any, b: any) => (b.publishedAt || 0) - (a.publishedAt || 0));

      return Promise.all(
        results.map(async (data: any) => {
          let coverImage = data.coverImage || null;
          if (!coverImage && data.coverImageBase64) {
            coverImage = `data:image/jpeg;base64,${data.coverImageBase64}`;
          } else if (!coverImage) {
            const base64 = await storageService.loadCoverImage(data.id);
            if (base64) coverImage = `data:image/jpeg;base64,${base64}`;
          }
          return { ...data, coverImage } as any;
        })
      );
    } catch (e) {
      console.warn('Firestore getFeaturedItineraries failed:', e);
      const local = await storageService.loadAllCommItineraries();
      return Promise.all(
        local.filter((i: any) => i.featured).map(async (i: any) => {
          if (!i.coverImage) {
            const base64 = await storageService.loadCoverImage(i.id);
            if (base64) {
              return { ...i, coverImage: `data:image/jpeg;base64,${base64}` };
            } else if (i.coverImageBase64) {
              return { ...i, coverImage: `data:image/jpeg;base64,${i.coverImageBase64}` };
            }
          }
          return i;
        })
      );
    }
  },

  // Follow/unfollow a user (persisted to local storage + Firestore)
  async followUser(followerId: string, targetUserId: string) {
    const key = 'FOLLOWS';
    const follows = (await storageService.load(key)) || {};
    if (!follows[followerId]) follows[followerId] = [];
    if (!follows[followerId].includes(targetUserId)) {
      follows[followerId].push(targetUserId);
      await storageService.save(key, follows);
    }

    // Sync to Firestore
    try {
      await setDoc(doc(db, 'follows', `${followerId}_${targetUserId}`), {
        followerId,
        targetUserId,
        createdAt: Date.now(),
      });
      // Keep the target user's follower count in sync server-side
      await this.syncFollowerCountServer(targetUserId);
    } catch (e) {
      console.warn('Firestore followUser failed:', e);
    }
  },

  async unfollowUser(followerId: string, targetUserId: string) {
    const key = 'FOLLOWS';
    const follows = (await storageService.load(key)) || {};
    if (follows[followerId]) {
      follows[followerId] = follows[followerId].filter((id: string) => id !== targetUserId);
      await storageService.save(key, follows);
    }

    // Sync to Firestore
    try {
      await setDoc(doc(db, 'follows', `${followerId}_${targetUserId}`), {
        followerId,
        targetUserId,
        deleted: true,
        deletedAt: Date.now(),
      });
      // Keep the target user's follower count in sync server-side
      await this.syncFollowerCountServer(targetUserId);
    } catch (e) {
      console.warn('Firestore unfollowUser failed:', e);
    }
  },

  async getFollowedUsers(userId: string): Promise<string[]> {
    const key = 'FOLLOWS';
    const follows = (await storageService.load(key)) || {};

    // Also try to merge with Firestore data
    try {
      const q = query(collection(db, 'follows'), where('followerId', '==', userId));
      const snapshot = await getDocs(q);
      const firestoreFollowed = snapshot.docs
        .map((d) => d.data())
        .filter((d: any) => !d.deleted)
        .map((d: any) => d.targetUserId);

      // Merge with local
      const localFollowed = follows[userId] || [];
      const merged = [...new Set([...localFollowed, ...firestoreFollowed])];
      return merged;
    } catch (e) {
      console.warn('Firestore getFollowedUsers failed, using local:', e);
      return follows[userId] || [];
    }
  },

  async getFollowersCount(userId: string): Promise<number> {
    // Preferred: server-side stored count on the user document (across all devices)
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists() && typeof snap.data().followerCount === 'number' && snap.data().followerCount >= 0) {
        return snap.data().followerCount;
      }
    } catch (e) {
      console.warn('Firestore stored followerCount failed, falling back:', e);
    }

    const key = 'FOLLOWS';
    const follows = (await storageService.load(key)) || {};

    // Fallback: count from the follows collection
    try {
      const q = query(collection(db, 'follows'), where('targetUserId', '==', userId));
      const snapshot = await getDocs(q);
      const firestoreCount = snapshot.docs.filter((d) => !d.data().deleted).length;

      let localCount = 0;
      for (const followerId of Object.keys(follows)) {
        if (follows[followerId].includes(userId)) localCount++;
      }

      return Math.max(firestoreCount, localCount);
    } catch (e) {
      console.warn('Firestore getFollowersCount failed, using local:', e);
      let count = 0;
      for (const followerId of Object.keys(follows)) {
        if (follows[followerId].includes(userId)) count++;
      }
      return count;
    }
  },

  /** Get the list of user IDs who follow a given user */
  async getFollowerIds(userId: string): Promise<string[]> {
    // Try Firestore first
    try {
      const q = query(collection(db, 'follows'), where('targetUserId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((d) => d.data())
        .filter((d: any) => !d.deleted)
        .map((d: any) => d.followerId);
    } catch (e) {
      console.warn('Firestore getFollowerIds failed, using local:', e);
      const follows = (await storageService.load('FOLLOWS')) || {};
      const followerIds: string[] = [];
      for (const fid of Object.keys(follows)) {
        if (follows[fid].includes(userId)) followerIds.push(fid);
      }
      return followerIds;
    }
  },

  /** Get total likes across all of a user's itineraries */
  async getTotalLikesForUser(userId: string): Promise<number> {
    try {
      const q = query(collection(db, 'itineraries'), where('authorId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.reduce((sum, d) => {
        const likes = d.data().likes || [];
        const likesCount = Array.isArray(likes) ? likes.length : 0;
        return sum + likesCount;
      }, 0);
    } catch (e) {
      console.warn('Firestore getTotalLikesForUser failed:', e);
      return 0;
    }
  },

  /** Update author name across all community content (itineraries, posts, comments, etc.) */
  async updateAuthorName(userId: string, newName: string) {
    // Update community itineraries
    try {
      const q = query(collection(db, 'itineraries'), where('authorId', '==', userId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.update(d.ref, { authorName: newName });
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore updateAuthorName itineraries failed, using local:', e);
      const local = await storageService.loadAllCommItineraries();
      const updated = local.map((i: any) => i.authorId === userId ? { ...i, authorName: newName } : i);
      // Save back individually
      const ids = await storageService.getCommItinIds();
      for (const item of updated) {
        await storageService.saveCommItineraryItem(item.id, item);
      }
    }

    // Update forum posts
    try {
      const q = query(collection(db, 'forumPosts'), where('authorId', '==', userId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.update(d.ref, { authorName: newName });
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore updateAuthorName forumPosts failed, using local:', e);
      // Forum posts are Firestore-only in current implementation
    }

    // Update comments in forum posts
    try {
      const q = query(collection(db, 'forumPosts'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        const data = d.data();
        const comments = (data.comments || []).map((c: any) =>
          c.authorId === userId ? { ...c, authorName: newName } : c
        );
        if (comments.some((c: any) => c.authorId === userId)) {
          batch.update(d.ref, { comments });
        }
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore updateAuthorName comments failed:', e);
    }

    // Update friend requests where user is involved
    try {
      const q1 = query(collection(db, 'friendRequests'), where('fromUserId', '==', userId));
      const snap1 = await getDocs(q1);
      const batch1 = writeBatch(db);
      snap1.docs.forEach(d => batch1.update(d.ref, { fromUserName: newName }));
      await batch1.commit();

      const q2 = query(collection(db, 'friendRequests'), where('toUserId', '==', userId));
      const snap2 = await getDocs(q2);
      const batch2 = writeBatch(db);
      snap2.docs.forEach(d => batch2.update(d.ref, { toUserName: newName }));
      await batch2.commit();
    } catch (e) {
      console.warn('Firestore updateAuthorName friendRequests failed:', e);
    }

    // Update friendships where user is involved
    try {
      const q1 = query(collection(db, 'friendships'), where('userId1', '==', userId));
      const snap1 = await getDocs(q1);
      const batch1 = writeBatch(db);
      snap1.docs.forEach(d => batch1.update(d.ref, { userName1: newName }));
      await batch1.commit();

      const q2 = query(collection(db, 'friendships'), where('userId2', '==', userId));
      const snap2 = await getDocs(q2);
      const batch2 = writeBatch(db);
      snap2.docs.forEach(d => batch2.update(d.ref, { userName2: newName }));
      await batch2.commit();
    } catch (e) {
      console.warn('Firestore updateAuthorName friendships failed:', e);
    }

    // Update notifications from this user
    try {
      const q = query(collection(db, 'notifications'), where('fromUserId', '==', userId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.update(d.ref, { fromUserName: newName });
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore updateAuthorName notifications failed:', e);
      const notifications = (await storageService.load(storageService.STORAGE_KEYS.NOTIFICATIONS)) || [];
      const updated = notifications.map((n: any) =>
        n.fromUserId === userId ? { ...n, fromUserName: newName } : n
      );
      await storageService.save(storageService.STORAGE_KEYS.NOTIFICATIONS, updated);
    }
  },

  /** Propagate a changed avatar to the user's existing community content. */
  async updateAuthorAvatar(userId: string, avatarUrl: string) {
    // Update community itineraries
    try {
      const q = query(collection(db, 'itineraries'), where('authorId', '==', userId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.update(d.ref, { authorAvatar: avatarUrl }));
      await batch.commit();
    } catch (e) {
      console.warn('Firestore updateAuthorAvatar itineraries failed, using local:', e);
      const local = await storageService.loadAllCommItineraries();
      const updated = local.map((i: any) => i.authorId === userId ? { ...i, authorAvatar: avatarUrl } : i);
      const ids = await storageService.getCommItinIds();
      for (const item of updated) {
        await storageService.saveCommItineraryItem(item.id, item);
      }
    }

    // Update forum posts
    try {
      const q = query(collection(db, 'forumPosts'), where('authorId', '==', userId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.update(d.ref, { authorAvatar: avatarUrl }));
      await batch.commit();
    } catch (e) {
      console.warn('Firestore updateAuthorAvatar forumPosts failed:', e);
    }

    // Update comments in forum posts
    try {
      const q = query(collection(db, 'forumPosts'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        const data = d.data();
        const comments = (data.comments || []).map((c: any) =>
          c.authorId === userId ? { ...c, authorAvatar: avatarUrl } : c
        );
        if (comments.some((c: any) => c.authorId === userId)) {
          batch.update(d.ref, { comments });
        }
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore updateAuthorAvatar comments failed:', e);
    }
  },

  async updateItineraryCoverImage(itineraryId: string, coverImage: string) {
    try {
      // Store cover images compactly: keep only the base64 payload
      let normalized: any = { coverImageBase64: coverImage };
      if (coverImage.startsWith('data:image')) {
        normalized.coverImageBase64 = coverImage.split(',')[1];
      }
      await updateDoc(doc(db, 'itineraries', itineraryId), normalized);
    } catch (e) {
      console.warn('Firestore updateItineraryCoverImage failed, using local:', e);
      const existing = await storageService.loadCommItineraryItem(itineraryId);
      if (existing) {
        let base64 = coverImage;
        if (coverImage.startsWith('data:image')) {
          base64 = coverImage.split(',')[1];
        }
        await storageService.saveCoverImage(itineraryId, base64);
        await storageService.saveCommItineraryItem(itineraryId, { ...existing, coverImageBase64: base64 });
      }
    }
  },

  /**
   * Remove accidentally published official itineraries from the community collection.
   * Official itineraries belong in local data (trips.json), not in Firestore community.
   */
  async deleteOfficialFromCommunity() {
    const OFFICIAL_IDS = [
      'itin-japan-001',
      'itin-europe-001',
      'itin-bali-001',
      'itin-nyc-001',
      'itin-thailand-001',
      'qifeng-001',
    ];

    let deleted = 0;
    let skipped = 0;

    for (const id of OFFICIAL_IDS) {
      try {
        // Hard delete from Firestore
        await deleteDoc(doc(db, 'itineraries', id));
        deleted++;
      } catch (e) {
        // May not exist yet — that's fine
        skipped++;
      }
    }

    // Also clean local storage
    try {
      const ids = await storageService.getCommItinIds();
      for (const id of ids) {
        if (OFFICIAL_IDS.includes(id)) {
          await storageService.deleteCommItineraryItem(id);
        }
      }
      await storageService.setCommItinIds(ids.filter(x => !OFFICIAL_IDS.includes(x)));
    } catch (e) {
      console.warn('Local cleanup failed:', e);
    }

    return { deleted, skipped };
  },

  /** Delete a single itinerary from Firestore (admin action) */
  async adminDeleteItinerary(itineraryId: string) {
    try {
      // Tombstone first so stale caches / other devices hide it even if the
      // hard delete below fails (offline/permissions).
      try {
        await setDoc(doc(db, 'itineraries', itineraryId), { deleted: true }, { merge: true });
      } catch (_) {}
      // Hard delete from Firestore.
      await deleteDoc(doc(db, 'itineraries', itineraryId));

      // Clean ALL local caches so no ghost copy resurfaces as "Unknown".
      try { await storageService.deleteCommItineraryItem(itineraryId); } catch (_) {}
      let ids = await storageService.getCommItinIds();
      ids = ids.filter(x => x !== itineraryId);
      await storageService.setCommItinIds(ids);
      try { await storageService.deleteItineraryItem(itineraryId); } catch (_) {}
      let myIds = await storageService.getItinIds();
      myIds = myIds.filter(x => x !== itineraryId);
      await storageService.setItinIds(myIds);
      try { await storageService.deleteActivityPhotos(itineraryId); } catch (_) {}
      try { await storageService.deleteCoverImage(itineraryId); } catch (_) {}
      return true;
    } catch (e) {
      console.warn('adminDeleteItinerary failed:', e);
      return false;
    }
  },

  async deleteAllCommunityItineraries() {
    try {
      // Delete from Firestore
      const snapshot = await getDocs(collection(db, 'itineraries'));
      const batch = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(batch);
      // Delete from local storage
      const ids = await storageService.getCommItinIds();
      for (const id of ids) {
        await storageService.deleteCommItineraryItem(id);
      }
      await storageService.setCommItinIds([]);
      return true;
    } catch (e) {
      console.warn('Firestore delete failed, clearing local only:', e);
      const ids = await storageService.getCommItinIds();
      for (const id of ids) {
        await storageService.deleteCommItineraryItem(id);
      }
      await storageService.setCommItinIds([]);
      return true;
    }
  },

  /** Permanently delete a user's account and all their content (admin action).
   *  The Firebase Auth credential can't be removed from the client for another
   *  user, so the account is tombstoned (deleted: true) and its content wiped —
   *  the next time they open the app they're shown an "Account closed" screen. */
  async deleteAccount(userId: string) {
    try {
      // Tombstone the community user record first so it disappears everywhere.
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { deleted: true, deletedAt: Date.now() });
      await this.deleteUserContent(userId);
      // Remove from local cache too.
      const users = (await storageService.load('COMMUNITY_USERS')) || [];
      const filtered = users.filter((u: any) => u.id !== userId);
      await storageService.save('COMMUNITY_USERS', filtered);
      return true;
    } catch (e) {
      console.warn('Failed to delete account:', e);
      return false;
    }
  },

  // ---- Collaboration ----

  /** Persist the collaborator list to the itinerary's Firestore doc (server-side). */
  async syncCollaborators(itineraryId: string, collaborators: any[]) {
    try {
      await setDoc(doc(db, 'itineraries', itineraryId), { collaborators }, { merge: true });
      return true;
    } catch (e) {
      console.warn('Firestore syncCollaborators failed:', e);
      return false;
    }
  },

  /** Add a collaborator to an itinerary. Only the owner (Pro users) can send invites. */
  async addCollaborator(itineraryId: string, collaborator: { id: string; name: string; email?: string; role?: 'editor' | 'admin' }) {
    const key = 'COLLABORATORS';
    const allCollabs = (await storageService.load(key)) || {};
    if (!allCollabs[itineraryId]) allCollabs[itineraryId] = [];
    
    const exists = allCollabs[itineraryId].find((c: any) => c.id === collaborator.id);
    if (!exists) {
      allCollabs[itineraryId].push({
        id: collaborator.id,
        name: collaborator.name,
        email: collaborator.email || '',
        role: collaborator.role || 'editor',
        addedAt: Date.now(),
      });
      await storageService.save(key, allCollabs);
      // Best-effort server-side sync so the invite survives reinstalls/devices.
      this.syncCollaborators(itineraryId, allCollabs[itineraryId]).catch(() => {});
    }
    return allCollabs[itineraryId];
  },

  /** Change a collaborator's permission role ('editor' | 'admin'). */
  async updateCollaboratorRole(itineraryId: string, userId: string, role: 'editor' | 'admin') {
    const key = 'COLLABORATORS';
    const allCollabs = (await storageService.load(key)) || {};
    if (allCollabs[itineraryId]) {
      allCollabs[itineraryId] = allCollabs[itineraryId].map((c: any) =>
        c.id === userId ? { ...c, role } : c
      );
      await storageService.save(key, allCollabs);
      this.syncCollaborators(itineraryId, allCollabs[itineraryId]).catch(() => {});
    }
    return allCollabs[itineraryId] || [];
  },

  /** Remove a collaborator from an itinerary */
  async removeCollaborator(itineraryId: string, userId: string) {
    const key = 'COLLABORATORS';
    const allCollabs = (await storageService.load(key)) || {};
    if (allCollabs[itineraryId]) {
      allCollabs[itineraryId] = allCollabs[itineraryId].filter((c: any) => c.id !== userId);
      await storageService.save(key, allCollabs);
      this.syncCollaborators(itineraryId, allCollabs[itineraryId]).catch(() => {});
    }
  },

  /** Get all collaborators for an itinerary (Firestore first, then local). */
  async getCollaborators(itineraryId: string): Promise<any[]> {
    try {
      const snap = await getDoc(doc(db, 'itineraries', itineraryId));
      if (snap.exists() && Array.isArray(snap.data().collaborators)) {
        return snap.data().collaborators;
      }
    } catch (e) {
      console.warn('Firestore getCollaborators failed, using local:', e);
    }
    const key = 'COLLABORATORS';
    const allCollabs = (await storageService.load(key)) || {};
    return allCollabs[itineraryId] || [];
  },

  /** Get all itineraries where a user is a collaborator */
  async getCollaboratorItineraries(userId: string): Promise<string[]> {
    const key = 'COLLABORATORS';
    const allCollabs = (await storageService.load(key)) || {};
    const itineraryIds: string[] = [];
    for (const [itinId, collabs] of Object.entries(allCollabs)) {
      if ((collabs as any[]).some((c: any) => c.id === userId)) {
        itineraryIds.push(itinId);
      }
    }
    return itineraryIds;
  },

  // ---- Forum / Tips ----

  /** Create a new forum post (tips, etiquette, other) — saves to Firestore, supports images */
  async createForumPost(post: {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    authorTag?: string;
    title: string;
    content: string;
    tag: 'tips' | 'etiquette' | 'other';
    images?: string[];
  }) {
    const docData = {
      ...post,
      upvotes: [],
      comments: [],
      createdAt: Date.now(),
    };
    try {
      await setDoc(doc(db, 'forumPosts', post.id), docData);
    } catch (e) {
      console.warn('Firestore createForumPost failed:', e);
    }
    // Local fallback so posts always persist and appear even if Firestore is unavailable.
    try {
      const local = (await storageService.load('FORUM_POSTS')) || [];
      await storageService.save('FORUM_POSTS', [...local.filter((p: any) => p.id !== post.id), docData]);
    } catch (e2) {}
    return docData;
  },

  /** Get all forum posts, sorted by newest first */
  async getForumPosts(): Promise<any[]> {
    try {
      const q = query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const remote = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d: any) => !d.deleted);
      // Merge local-only (offline) posts with the server list, dedup by id.
      let local: any[] = [];
      try {
        local = (await storageService.load('FORUM_POSTS')) || [];
      } catch (e2) {}
      const map = new Map<string, any>();
      [...local, ...remote].forEach((p: any) => {
        if (p && p.id && !p.deleted && !map.has(p.id)) map.set(p.id, p);
      });
      return Array.from(map.values()).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (e) {
      console.warn('Firestore getForumPosts failed:', e);
      try {
        return ((await storageService.load('FORUM_POSTS')) || []).filter((p: any) => !p.deleted);
      } catch (e2) {
        return [];
      }
    }
  },

  /** Upvote a forum post */
  async upvoteForumPost(postId: string, userId: string) {
    try {
      const ref = doc(db, 'forumPosts', postId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const upvotes: string[] = data.upvotes || [];
      if (!upvotes.includes(userId)) {
        upvotes.push(userId);
        await updateDoc(ref, { upvotes });
      }
    } catch (e) {
      console.warn('Firestore upvoteForumPost failed:', e);
    }
    try {
      const local = (await storageService.load('FORUM_POSTS')) || [];
      await storageService.save('FORUM_POSTS', local.map((p: any) => p.id === postId ? { ...p, upvotes: [...(p.upvotes || []).filter((x: string) => x !== userId), userId] } : p));
    } catch (e2) {}
  },

  /** Remove upvote from a forum post */
  async unupvoteForumPost(postId: string, userId: string) {
    try {
      const ref = doc(db, 'forumPosts', postId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const upvotes: string[] = (data.upvotes || []).filter((id: string) => id !== userId);
      await updateDoc(ref, { upvotes });
    } catch (e) {
      console.warn('Firestore unupvoteForumPost failed:', e);
    }
    try {
      const local = (await storageService.load('FORUM_POSTS')) || [];
      await storageService.save('FORUM_POSTS', local.map((p: any) => p.id === postId ? { ...p, upvotes: (p.upvotes || []).filter((x: string) => x !== userId) } : p));
    } catch (e2) {}
  },

  /** Add a comment to a forum post */
  async addComment(postId: string, comment: {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    text: string;
  }) {
    const localPosts = (await storageService.load('FORUM_POSTS')) || [];
    const existing = localPosts.find((p: any) => p.id === postId);
    const comments = [...(existing?.comments || []), { ...comment, createdAt: Date.now() }];
    try {
      const ref = doc(db, 'forumPosts', postId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { comments });
      }
    } catch (e) {
      console.warn('Firestore addComment failed:', e);
    }
    try {
      const local = (await storageService.load('FORUM_POSTS')) || [];
      await storageService.save('FORUM_POSTS', local.map((p: any) => p.id === postId ? { ...p, comments } : p));
    } catch (e2) {}
    return comments;
  },

  /** Delete a forum post (soft delete) */
  async deleteForumPost(postId: string) {
    try {
      await updateDoc(doc(db, 'forumPosts', postId), { deleted: true });
    } catch (e) {
      console.warn('Firestore deleteForumPost failed:', e);
    }
    try {
      const local = (await storageService.load('FORUM_POSTS')) || [];
      await storageService.save('FORUM_POSTS', local.map((p: any) => p.id === postId ? { ...p, deleted: true } : p));
    } catch (e2) {}
  },
};
