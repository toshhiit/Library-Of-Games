
export interface Game {
  id: string;
  name: string;
  image: string;
  category: 'single' | 'multi';
  description: string;
}

export type FilterType = 'all' | 'single' | 'multi' | 'favorites';

export interface AvatarItem {
  id: string;
  url: string;
  price: number;
}

export type ThemeType = 'default' | 'sakura';

export type ShopItemType = 'boost' | 'theme';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: ShopItemType;
  value: string | number;
  image?: string;
}

export interface UserProfile {
  tgUsername: string;
  displayName: string;
  avatar: string;
  unlockedAvatars: string[]; // IDs of unlocked avatars
  inventory: string[]; // IDs of bought shop items (themes, etc)
  activeTheme: ThemeType;
  activeBoosts: string[]; // IDs of active boosts
  hasChangedName: boolean;
}
