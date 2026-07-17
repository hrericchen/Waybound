import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
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
  chevronDown: 'expand-more',
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
  image: 'image',
  camera: 'camera',
  upload: 'cloud-upload',
  link: 'link',
  currency: 'attach-money',
  checklist: 'check-circle',
  document: 'description',
  compass: 'explore',
  globe: 'public',
  heart: 'favorite-border',
  swap: 'swap-horiz',
  refresh: 'refresh',
  trash: 'delete',
  lock: 'lock',
  plane: 'flight',
  chevronUp: 'expand-less',
};

export const Icon: React.FC<IconProps> = ({ name, size = 22, color = colors.primary }) => {
  const iconName = materialMap[name];
  if (!iconName) {
    console.warn(`Icon "${name}" not found`);
    return <MaterialIcons name="help-outline" size={size} color={color} />;
  }
  return <MaterialIcons name={iconName} size={size} color={color} />;
};

export default Icon;
