// toshhiit/library-of-games/Library-Of-Games-main/types.ts

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// Добавляем новый интерфейс для управления
export interface GameControl {
  type: 'arrows' | 'space' | 'mouse' | 'click' | 'drag';
  description: string;
}

export interface Game {
  id: string;
  name: string;
  image: string;
  category: 'single' | 'multi';
  description: string;
  controls: GameControl[]; // <-- Новое поле
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
  tgId?: number;
  tgUsername: string;
  displayName: string;
  avatar: string;
  unlockedAvatars: string[]; 
  inventory: string[]; 
  activeTheme: ThemeType;
  activeBoosts: string[];
  hasChangedName: boolean;
  achievements: string[];
}

// Telegram Web App Types
export interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
}

export interface TelegramWebApp {
    initData: string;
    initDataUnsafe: {
        query_id?: string;
        user?: TelegramUser;
        auth_date?: string;
        hash?: string;
    };
    version: string;
    platform: string;
    colorScheme: 'light' | 'dark';
    themeParams: {
        bg_color?: string;
        text_color?: string;
        hint_color?: string;
        link_color?: string;
        button_color?: string;
        button_text_color?: string;
    };
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;
    headerColor: string;
    backgroundColor: string;
    expand: () => void;
    close: () => void;
    ready: () => void;
    MainButton: {
        text: string;
        color: string;
        textColor: string;
        isVisible: boolean;
        isActive: boolean;
        isProgressVisible: boolean;
        setText: (text: string) => void;
        onClick: (callback: () => void) => void;
        offClick: (callback: () => void) => void;
        show: () => void;
        hide: () => void;
        enable: () => void;
        disable: () => void;
    };
    HapticFeedback: {
        impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
        notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        selectionChanged: () => void;
    };
}

declare global {
    interface Window {
        Telegram: {
            WebApp: TelegramWebApp;
        };
    }
}
