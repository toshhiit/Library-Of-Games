import { Game, AvatarItem, ShopItem } from './types';

// Using local paths now
export const GAMES: Game[] = [
  { 
    id: '1', 
    name: '2048', 
    image: '/assets/images/2048.png', 
    category: 'single',
    description: 'Join the numbers and get to the 2048 tile!'
  },
  { 
    id: '2', 
    name: 'Snake', 
    image: '/assets/images/snake.png', 
    category: 'single',
    description: 'Classic snake game. Eat apples, grow longer.'
  },
  { 
    id: '3', 
    name: 'Dino Run', 
    image: '/assets/images/dino.png', 
    category: 'single',
    description: 'Run as far as you can without hitting obstacles.'
  },
  { 
    id: '4', 
    name: 'Clicker', 
    image: '/assets/images/clicker.png', 
    category: 'single',
    description: 'Click to earn points and upgrade.'
  },
  { 
    id: '5', 
    name: 'Шашки', 
    image: '/assets/images/checkers.png', 
    category: 'multi',
    description: 'Classic checkers board game for two players.'
  },
  { 
    id: '6', 
    name: 'Сапёр', 
    image: '/assets/images/saper.png', 
    category: 'single',
    description: 'Clear the board without detonating any mines.'
  },
  { 
    id: '7', 
    name: 'Пасьянс', 
    image: '/assets/images/pasyans.png', 
    category: 'single',
    description: 'Organize cards in specific order.'
  },
  { 
    id: '8', 
    name: 'Tetris', 
    image: '/assets/images/blockblast.png', 
    category: 'single',
    description: 'Fit blocks together to clear lines.'
  },
  { 
    id: '9', 
    name: 'Paint', 
    image: '/assets/images/paint.png', 
    category: 'multi',
    description: 'Draw together or compete in art challenges.'
  }
];

// ИСПРАВЛЕН ПУТЬ: удалено /avatars/
export const AVAILABLE_AVATARS: AvatarItem[] = [
  { id: 'default', url: '/assets/images/default.png', price: 0 }
];

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'boost_xp_1h',
    name: 'XP Бустер (1ч)',
    description: 'Удваивает получение опыта на 1 час.',
    price: 500,
    type: 'boost',
    value: 2,
    image: 'https://picsum.photos/seed/boostxp/200/200' 
  },
  {
    id: 'boost_coin_1h',
    name: 'Магнит Монет (1ч)',
    description: 'Удваивает заработок монет в играх.',
    price: 800,
    type: 'boost',
    value: 2,
    image: 'https://picsum.photos/seed/boostcoin/200/200'
  },
  {
    id: 'theme_sakura',
    name: 'Стиль Сакуры',
    description: 'Меняет дизайн сайта и игр на нежный стиль цветущей вишни.',
    price: 10000,
    type: 'theme',
    value: 'sakura',
    image: 'https://picsum.photos/seed/sakuratheme/200/200'
  }
];

// Achievements List for Frontend
import { Achievement } from './types';
export const ACHIEVEMENTS_LIST: Achievement[] = [
  { id: '2048_novice', name: 'Новичок 2048', description: 'Набрал 1000 очков в 2048', icon: '🧩' },
  { id: '2048_pro', name: 'Профи 2048', description: 'Набрал 5000 очков в 2048', icon: '🧠' },
  { id: 'snake_eater', name: 'Сытый удав', description: 'Съел 10 яблок в Змейке', icon: '🐍' },
  { id: 'dino_runner', name: 'Марафонец', description: 'Пробежал 500м в Дино', icon: '🦖' },
  { id: 'clicker_fast', name: 'Быстрые пальцы', description: '200 кликов за минуту', icon: '⚡' },
];
