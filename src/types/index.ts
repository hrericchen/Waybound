export type User = {
  id: string;
  name?: string;
  email: string;
};

export type Trip = {
  id: string;
  title: string;
  country: string;
  description: string;
  budget: string;
  season: string;
  image: string;
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
  isActive?: boolean;
};

export type Activity = {
  id: string;
  day: number;
  title: string;
  emoji?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  links?: ActivityLink[];
  photos?: ActivityPhoto[];
  completed?: boolean;
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
  isPublic: boolean;
  isAdmin?: boolean;
};
