import type { TourStep } from '../context/TourContext';

// First-run tour that plays on the Home screen before the intro paywall.
// Highlight targets are registered by screens via useTour().registerTarget(id, ref).
export const HOME_TOUR: TourStep[] = [
  {
    id: 'home-welcome',
    title: 'Welcome to Waybound! 👋',
    description:
      'This quick tour shows you around the app. Tap Next to keep going, or Skip if you want to explore on your own.',
  },
  {
    id: 'home-profile',
    target: 'home-profile',
    title: 'Your profile',
    description: 'Tap your avatar to manage your account, your traveler tag, and your settings.',
  },
  {
    id: 'home-upgrade',
    target: 'home-upgrade',
    title: 'Go Pro',
    description:
      'Unlock exports, unlimited itineraries, no ads and more. Tap the Upgrade button anytime to see what’s included.',
    condition: ({ isPro }) => !isPro,
  },
  {
    id: 'home-search',
    target: 'home-search',
    title: 'Find inspiration',
    description: 'Search destinations here, or scroll down to browse featured trips from around the world.',
  },
  {
    id: 'home-create-card',
    target: 'home-create-card',
    title: 'Start planning',
    description:
      'Tap this card to open your trip — or to create your first itinerary if you don’t have one yet.',
  },
  {
    id: 'home-fab',
    target: 'tab-Create',
    title: 'The + button',
    description: 'Tap + to create something new — a trip, a travel guide, or import an existing plan.',
  },
  {
    id: 'home-library',
    target: 'tab-Library',
    title: 'Your Library',
    description:
      'Every itinerary you save lands here. Long-press a trip to set it active, export it, or delete it.',
  },
  {
    id: 'home-community',
    target: 'tab-Community',
    title: 'Community',
    description: 'Discover itineraries shared by travelers around the world — like and save the ones you love.',
  },
  {
    id: 'home-profile-tab',
    target: 'tab-Profile',
    title: 'Profile',
    description: 'Manage your account, view your Trip Recaps, and find pro tools from your profile.',
  },
  {
    id: 'home-done',
    title: 'You’re all set! 🎉',
    description: 'Go explore, plan your next adventure, and happy travels!',
  },
];

// Second tour: runs the first time you enter the Create Itinerary page.
// The `tab` field makes the tour actually switch tabs for you and show you around.
export const CREATE_TOUR: TourStep[] = [
  {
    id: 'create-title',
    target: 'create-title',
    title: 'Name your trip',
    description: 'Give your trip a title — "Tokyo Adventure", "Euro Trip 2026", anything!',
  },
  {
    id: 'create-dest',
    target: 'create-dest',
    title: 'Add destinations',
    description: 'Add the cities you’re visiting. They’ll show up on your itinerary and your map.',
  },
  {
    id: 'create-tabs',
    target: 'create-tabs',
    scrollTarget: 'create-scroll',
    title: 'Two ways to plan',
    description:
      'Itinerary is your day-by-day plan. Overview lets you write a travel-guide-style summary of the whole trip.',
  },
  {
    id: 'create-day',
    target: 'create-day',
    scrollTarget: 'create-scroll',
    title: 'Plan by days',
    description:
      'Switch between days with the chips, tap + to add a new day, then fill each day with activities.',
  },
  {
    id: 'create-photos',
    target: 'create-activity-photos',
    scrollTarget: 'create-scroll',
    title: 'Add photos 📸',
    description:
      'Tap the camera on any activity to add photos. They automatically build a beautiful photo timeline in Trip Recaps (Profile → Trip Recaps).',
  },
  {
    id: 'create-library',
    tab: 'Library',
    target: 'library-header',
    title: 'Your Library',
    description:
      'Hit Save Itinerary and it lands here — your home for every trip you’ve planned. We just switched you over!',
  },
  {
    id: 'create-community',
    tab: 'Community',
    target: 'community-header',
    title: 'Get inspired',
    description:
      'Browse trips from other travelers, search for destinations, and save the ones you love. Switching tabs for you again!',
  },
  {
    id: 'create-back',
    tab: 'Create',
    target: 'tab-Create',
    title: 'You got this! 🚀',
    description:
      'Back to your trip — we switched you back to the + button. Start building your first itinerary whenever you’re ready.',
  },
];

// Third tour: runs the first time you open the Profile tab (once the home tour
// has been seen). Shows you how to customize your profile — photo, name, and
// Traveler Tag — using the same rules and overlay as the other tutorials.
export const PROFILE_TOUR: TourStep[] = [
  {
    id: 'profile-welcome',
    title: 'Make it yours ✨',
    description:
      'Welcome to your profile! This is where you customize how the community sees you — your photo, your name, and your Traveler Tag.',
  },
  {
    id: 'profile-card',
    target: 'profile-card',
    title: 'Your profile card',
    description:
      'Tap your card to open Profile Settings, where you can change your profile picture, rename yourself, and manage your account.',
  },
  {
    id: 'profile-tag',
    target: 'profile-tag',
    scrollTarget: 'profile-scroll',
    title: 'Your Traveler Tag 🏷️',
    description:
      'This badge shows your travel style to the community. In Profile Settings → Choose Traveler Tag you can pick from 16 tags like Trekker, Voyager, or Nomad.',
  },
  {
    id: 'profile-privacy',
    target: 'profile-privacy',
    scrollTarget: 'profile-scroll',
    title: 'Profile Privacy',
    description:
      'Control who sees your recaps. Public shares them with everyone; Private shows them to friends only.',
  },
  {
    id: 'profile-recaps',
    target: 'profile-recaps',
    scrollTarget: 'profile-scroll',
    title: 'Trip Recaps',
    description:
      'Every trip you take becomes a beautiful photo recap automatically. Open Trip Recaps to relive them anytime.',
  },
  {
    id: 'profile-done',
    title: 'You’re all set! 🎉',
    description:
      'Your profile is ready to show the world. Go explore, and happy travels!',
  },
];
