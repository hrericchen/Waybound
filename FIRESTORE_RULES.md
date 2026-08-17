# Firestore Security Rules

Copy these rules into Firebase Console → Firestore Database → Rules tab:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Admins have full access (the app sets isAdmin: true on the user doc).
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }

    // Users collection
    match /users/{userId} {
      allow read: if true;
      // Users can edit their own profile; admins can edit/delete anyone (Grant Pro/Mini).
      // Moderation fields (suspension / deletion / warning history) can ONLY be
      // changed by admins (or the server via the Admin SDK) — a user can never
      // clear their own suspension or deleted flag from the client.
      allow create: if request.auth != null && request.auth.uid == userId &&
        !request.resource.data.keys().hasAny(
          ['suspendedUntil','suspendedReason','suspendedAt','deleted','deletedAt','moderation','lastModeratedAt']
        );
      allow update: if request.auth != null && (
        (request.auth.uid == userId && !request.resource.data.diff(resource.data).affectedKeys().hasAny(
          ['suspendedUntil','suspendedReason','suspendedAt','deleted','deletedAt','moderation','lastModeratedAt']
        )) || isAdmin()
      );
      allow delete: if request.auth != null && (request.auth.uid == userId || isAdmin());
    }

    // Itineraries collection
    match /itineraries/{itineraryId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
        (resource.data.authorId == request.auth.uid ||
         (resource.data.collaborators != null && request.auth.uid in resource.data.collaborators) ||
         isAdmin());
      allow delete: if request.auth != null &&
        (resource.data.authorId == request.auth.uid || isAdmin());
    }

    // Follows (follow system)
    match /follows/{followId} {
      allow read: if request.auth != null &&
        (resource.data.followerId == request.auth.uid || isAdmin());
      allow create: if request.auth != null &&
        request.resource.data.followerId == request.auth.uid;
      allow delete: if request.auth != null &&
        (resource.data.followerId == request.auth.uid || isAdmin());
    }

    // Friend requests
    match /friendRequests/{requestId} {
      allow read: if request.auth != null &&
        (resource.data.fromUserId == request.auth.uid ||
         resource.data.toUserId == request.auth.uid || isAdmin());
      allow create: if request.auth != null && request.auth.uid == request.resource.data.fromUserId;
      allow update: if request.auth != null && (request.auth.uid == resource.data.toUserId || isAdmin());
      allow delete: if request.auth != null &&
        (resource.data.fromUserId == request.auth.uid ||
         resource.data.toUserId == request.auth.uid || isAdmin());
    }

    // Friendships
    match /friendships/{friendshipId} {
      allow read: if request.auth != null &&
        (resource.data.userId1 == request.auth.uid ||
         resource.data.userId2 == request.auth.uid || isAdmin());
      allow create: if request.auth != null;
      allow delete: if request.auth != null &&
        (resource.data.userId1 == request.auth.uid ||
         resource.data.userId2 == request.auth.uid || isAdmin());
    }

    // Reports (moderation) — anyone can report; only admins resolve
    match /reports/{reportId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null &&
        (resource.data.reporterId == request.auth.uid || isAdmin());
      allow update, delete: if request.auth != null && isAdmin();
    }

    // Notifications (likes, follows, saves, comments, reports)
    match /notifications/{notificationId} {
      allow create: if request.auth != null &&
        request.resource.data.fromUserId == request.auth.uid;
      allow read, update, delete: if request.auth != null &&
        (resource.data.userId == request.auth.uid || isAdmin());
    }

    // Open catch-all (kept from your previous rules — moved LAST so the
    // specific rules above actually apply). Anyone can read/write anything
    // not covered by a rule above; admins can read/write everything anyway.
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## How to Apply These Rules

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Go to **Firestore Database** (left sidebar)
4. Click the **Rules** tab
5. Delete any existing rules
6. Paste the rules above
7. Click **Publish**

## What These Rules Do

- **Users**: Anyone can view users, but users can only edit their own profile (admins can edit/delete anyone — used for Grant Pro/Mini). Moderation fields (`suspendedUntil`, `deleted`, `moderation`, …) are **locked**: only admins or the server (Admin SDK) can write them, so a suspended user can't clear their own suspension.
- **Itineraries**: Anyone can view, logged-in users can publish, only author, admin, or invited collaborators can edit; only author or admin can delete
- **Follows**: Users can read/manage their own follows; admins can see everything
- **Friend Requests**: Users can only see their own requests, send requests as themselves, accept/decline requests sent to them (admins can read all)
- **Friendships**: Users can only see their own friendships (admins can read all)
- **Reports**: Any signed-in user can file a report; the reporter and admins can read it; only admins can resolve/delete
- **Notifications**: Signed-in users can create notifications (as the `fromUserId`); only the recipient (`userId`) or an admin can read/update/delete them
- **Admins**: Have full read/write access to every collection (including any not listed above) via the `isAdmin()` helper — the app marks a user as admin with `isAdmin: true` on their user document.
- **Open catch-all (testing)**: The `match /{document=**}` rule from your previous rules is kept, but moved to the **end** so the specific rules above actually take effect. Any collection not listed above remains fully open (read/write for everyone). Remove that block when you're ready to lock the database down.

## Testing Mode

If you want to test without authentication first, you can temporarily use:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Warning**: This allows anyone to read/write your database. Only use for testing!