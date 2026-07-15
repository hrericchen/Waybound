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
  activities: any[];
};
