# Firestore Security Rules

Copy these rules into Firebase Console → Firestore Database → Rules tab:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if true; // Anyone can view users
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Users can only update their own profile
      allow update: if request.auth != null && request.auth.uid == userId;
    }

    // Itineraries collection
    match /itineraries/{itineraryId} {
      allow read: if true; // Anyone can view itineraries
      allow create: if request.auth != null; // Must be logged in to publish
      allow update: if request.auth != null && 
        (resource.data.authorId == request.auth.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true);
      allow delete: if request.auth != null && 
        (resource.data.authorId == request.auth.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true);
    }

    // Friend requests
    match /friendRequests/{requestId} {
      allow read: if request.auth != null && 
        (resource.data.fromUserId == request.auth.uid || 
         resource.data.toUserId == request.auth.uid);
      allow create: if request.auth != null && request.auth.uid == request.resource.data.fromUserId;
      allow update: if request.auth != null && request.auth.uid == resource.data.toUserId;
      allow delete: if request.auth != null && 
        (resource.data.fromUserId == request.auth.uid || 
         resource.data.toUserId == request.auth.uid);
    }

    // Friendships
    match /friendships/{friendshipId} {
      allow read: if request.auth != null && 
        (resource.data.userId1 == request.auth.uid || 
         resource.data.userId2 == request.auth.uid);
      allow create: if request.auth != null;
      allow delete: if request.auth != null && 
        (resource.data.userId1 == request.auth.uid || 
         resource.data.userId2 == request.auth.uid);
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

- **Users**: Anyone can view users, but users can only edit their own profile
- **Itineraries**: Anyone can view, logged-in users can publish, only author or admin can edit/delete
- **Friend Requests**: Users can only see their own requests, send requests as themselves, accept/decline requests sent to them
- **Friendships**: Users can only see their own friendships

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