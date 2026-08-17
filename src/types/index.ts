export type User = {
  id: string;
  name?: string;
  email: string;
  tag?: string;        // Traveler tag ID (e.g., 'trekker', 'voyager', etc.)
  avatarUrl?: string;  // Profile picture URL
  isPro?: boolean;     // Gifted pro status (without admin)
  suspendedUntil?: number; // Timestamp until which the account is suspended (moderation)
  deleted?: boolean;   // Set to true when an admin permanently closes the account
};

export type Trip = {
  id: string;
  title: string;
  country: string;
  description: string;
  budget: string;
  season: string;
  image: string;
  coverImage?: string;
  days: any[];
  highlights: string[];
  packing: string[];
  tags: string[];
  coords?: { lat: number; lng: number };
};

export type Itinerary = {
  id: string;
  title: string;
  destinations: string[];
  startDate?: string;
  endDate?: string;
  color?: string;
  coverImage?: string;
  activities: Activity[];
  dayNotes?: Record<number, string>;
  expenses?: Expense[];
  budgetCurrency?: string;
  isActive?: boolean;
  createdAt?: number;
  authorName?: string;
  authorId?: string;
  authorAvatar?: string;
};

export type Activity = {
  id: string;
  day: number;
  title: string;
  emoji?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  address?: string;
  links?: ActivityLink[];
  photos?: ActivityPhoto[];
  completed?: boolean;
};

export type ExpenseCategory = 'transportation' | 'stays' | 'dining' | 'experiences' | 'other';

export type Expense = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  notes?: string;
  timestamp: number;
};

export type ActivityLink = {
  id: string;
  title: string;
  url: string;
};

export type ActivityPhoto = {
  id: string;
  uri: string;
  base64?: string;
  timestamp: string;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  tag?: string;        // Traveler tag ID
  isPublic: boolean;
  isAdmin?: boolean;
};

// Forum types
export type ForumPostTag = 'tips' | 'etiquette' | 'other';

export type ForumComment = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: number;
};

export type ForumPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorTag?: string;
  title: string;
  content: string;
  tag: ForumPostTag;
  images?: string[];       // Array of image URLs (server-side)
  upvotes: string[];       // array of user IDs who upvoted
  comments: ForumComment[];
  createdAt: number;
  updatedAt?: number;
};