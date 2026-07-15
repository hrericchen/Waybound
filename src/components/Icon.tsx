import React from 'react';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { colors } from '../theme/theme';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
};

const materialMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  home: 'home',
  plus: 'add',
  bookmark: 'bookmark-border',
  user: 'person-outline',
  itinerary: 'map',
  information: 'info-outline',
  profile: 'person-outline',
  search: 'search',
  bell: 'notifications-none',
  calendar: 'event',
  location: 'place',
  restaurant: 'restaurant',
  flight: 'flight',
  hotel: 'hotel',
  back: 'arrow-back',
  chevronLeft: 'chevron-left',
  chevronRight: 'chevron-right',
  close: 'close',
  delete: 'delete-outline',
  edit: 'edit',
  theme: 'brightness-6',
  demo: 'play-circle-outline',
  logout: 'logout',
  google: 'g-translate',
  mic: 'mic-none',
  time: 'access-time',
  map: 'map',
  save: 'bookmark',
  check: 'check',
};

export const Icon: React.FC<IconProps> = ({ name, size = 22, color = colors.primary }) => {
  if (name === 'plane') {
    return <Ionicons name="airplane" size={size} color={color} />;
  }
  if (name === 'globe') {
    return <Feather name="globe" size={size} color={color} />;
  }
  const iconName = materialMap[name] || 'help-outline';
  return <MaterialIcons name={iconName} size={size} color={color} />;
};

export default Icon;
