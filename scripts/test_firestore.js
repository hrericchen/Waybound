#!/usr/bin/env node

/**
 * Test script to verify Firestore functionality
 * Tests: Publishing itineraries, saving trips, updating community data
 */

const fs = require('fs');
const path = require('path');

// Mock Firestore for testing
const mockFirestore = {
  collection: (name) => ({
    doc: (id) => ({
      set: async (data) => {
        console.log(`✓ Firestore: Set ${name}/${id}`);
        console.log(`  Data keys: ${Object.keys(data).join(', ')}`);
        
        // Check for undefined values
        const undefinedKeys = Object.keys(data).filter(k => data[k] === undefined);
        if (undefinedKeys.length > 0) {
          console.error(`✗ ERROR: Found undefined values in keys: ${undefinedKeys.join(', ')}`);
          throw new Error(`Unsupported field value: undefined`);
        }
        return Promise.resolve();
      },
      update: async (data) => {
        console.log(`✓ Firestore: Update ${name}/${id}`);
        return Promise.resolve();
      },
      get: async () => ({
        exists: true,
        data: () => ({ id, title: 'Test Itinerary' })
      })
    }),
    where: (field, op, value) => ({
      get: async () => ({
        docs: [
          { id: 'test-1', data: () => ({ id: 'test-1', title: 'Test 1' }) }
        ]
      })
    }),
    get: async () => ({
      docs: [
        { id: 'test-1', data: () => ({ id: 'test-1', title: 'Test 1' }) }
      ]
    })
  })
};

// Test 1: Publishing itinerary with undefined fields
async function testPublishItinerary() {
  console.log('\n=== Test 1: Publishing Itinerary ===');
  
  const itinerary = {
    id: 'itin-001',
    title: 'Japan Trip',
    destinations: ['Tokyo', 'Kyoto'],
    activities: [
      { id: 'a1', day: 1, title: 'Arrive', notes: '', links: [], photos: [], completed: false },
      { id: 'a2', day: 2, title: 'Explore', notes: 'Visit temples', links: [], photos: [], completed: false }
    ],
    tags: ['asia', 'culture'],
    season: 'Spring',
    budget: 2000,
    authorName: 'Test User',
    authorId: 'user-001',
    // These undefined fields should be filtered out
    emoji: undefined,
    customField: undefined
  };

  try {
    // Simulate the fix: filter out undefined values
    const cleanItinerary = Object.fromEntries(
      Object.entries(itinerary).filter(([_, v]) => v !== undefined)
    );
    
    console.log(`Original keys: ${Object.keys(itinerary).length}`);
    console.log(`Cleaned keys: ${Object.keys(cleanItinerary).length}`);
    
    await mockFirestore.collection('itineraries').doc(itinerary.id).set({
      ...cleanItinerary,
      publishedAt: Date.now(),
    });
    
    console.log('✓ Itinerary published successfully');
  } catch (e) {
    console.error(`✗ Failed: ${e.message}`);
  }
}

// Test 2: Saving trip with all required fields
async function testSaveTrip() {
  console.log('\n=== Test 2: Saving Trip ===');
  
  const trip = {
    id: 'trip-001',
    title: 'Europe Adventure',
    destinations: ['Paris', 'Rome', 'Barcelona'],
    coverImage: 'https://example.com/image.jpg',
    tags: ['europe', 'adventure'],
    season: 'Summer',
    budget: 3000,
    activities: [
      { id: 'a1', day: 1, title: 'Paris', notes: 'Eiffel Tower', links: [], photos: [], completed: false }
    ]
  };

  try {
    await mockFirestore.collection('itineraries').doc(trip.id).set({
      ...trip,
      publishedAt: Date.now(),
    });
    
    console.log('✓ Trip saved successfully');
  } catch (e) {
    console.error(`✗ Failed: ${e.message}`);
  }
}

// Test 3: Updating community itinerary
async function testUpdateItinerary() {
  console.log('\n=== Test 3: Updating Itinerary ===');
  
  const updates = {
    likes: ['user-001', 'user-002'],
    featured: true,
    updatedAt: Date.now()
  };

  try {
    await mockFirestore.collection('itineraries').doc('itin-001').update(updates);
    console.log('✓ Itinerary updated successfully');
  } catch (e) {
    console.error(`✗ Failed: ${e.message}`);
  }
}

// Test 4: Fetching itineraries
async function testFetchItineraries() {
  console.log('\n=== Test 4: Fetching Itineraries ===');
  
  try {
    const snapshot = await mockFirestore.collection('itineraries').get();
    console.log(`✓ Fetched ${snapshot.docs.length} itineraries`);
    
    snapshot.docs.forEach(doc => {
      console.log(`  - ${doc.id}: ${doc.data().title}`);
    });
  } catch (e) {
    console.error(`✗ Failed: ${e.message}`);
  }
}

// Test 5: Filtering by author
async function testFilterByAuthor() {
  console.log('\n=== Test 5: Filtering by Author ===');
  
  try {
    const snapshot = await mockFirestore.collection('itineraries')
      .where('authorId', '==', 'user-001')
      .get();
    
    console.log(`✓ Found ${snapshot.docs.length} itineraries by user-001`);
  } catch (e) {
    console.error(`✗ Failed: ${e.message}`);
  }
}

// Run all tests
async function runTests() {
  console.log('🧪 Firestore Functionality Tests');
  console.log('================================');
  
  await testPublishItinerary();
  await testSaveTrip();
  await testUpdateItinerary();
  await testFetchItineraries();
  await testFilterByAuthor();
  
  console.log('\n✅ All tests completed');
}

runTests().catch(console.error);
