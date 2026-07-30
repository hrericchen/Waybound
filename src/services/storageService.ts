import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  USER: 'WB_USER',
  ITINERARIES: 'WB_ITINERARIES',
  FAVORITES: 'WB_FAVORITES',
  SETTINGS: 'WB_SETTINGS',
  NOTIFICATIONS: 'WB_NOTIFICATIONS',
  USER_DATA: 'WB_USER_DATA',
  COMMUNITY_USERS: 'COMMUNITY_USERS',
  COMMUNITY_ITINERARIES: 'COMMUNITY_ITINERARIES',
};

const storageService = {
  async save(key: string, value: any) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async load(key: string) {
    const v = await AsyncStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  },
  STORAGE_KEYS,
};

export default storageService;
