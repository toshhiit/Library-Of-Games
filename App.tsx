import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Search, 
  Plus, 
  Heart, 
  User, 
  Gamepad2, 
  Users, 
  CheckCircle2, 
  Send,
  Settings,
  ShoppingBag
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { GAMES, AVAILABLE_AVATARS } from './constants';
import { Game, FilterType, UserProfile } from './types';
import GameCard from './components/GameCard';
import Drawer from './components/Drawer';
import GamePage from './components/GamePage';
import ProfileSettings from './components/ProfileSettings';
import Shop from './components/Shop';

const App: React.FC = () => {
  // User State
  const [user, setUser] = useState<UserProfile>({
    tgId: undefined,
    tgUsername: '@loading...',
    displayName: 'Guest Player',
    avatar: AVAILABLE_AVATARS[0].url,
    unlockedAvatars: ['default'],
    inventory: [],
    activeTheme: 'default',
    activeBoosts: [],
    hasChangedName: false,
  });
  
  // ИЗМЕНЕНО: Начальное значение 1000 для новых пользователей
  const [coins, setCoins] = useState(1000); 
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // App State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Drawer View Modes
  const [isSettingsMode, setIsSettingsMode] = useState(false); 
  const [isShopMode, setIsShopMode] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // --- AUTH INITIALIZATION ---
  useEffect(() => {
    const sessionId = localStorage.getItem('session_id');
    if (sessionId) {
      fetch(`/api/user?session=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setUser(prev => ({
              ...prev,
              tgId: data.tg_id,
              tgUsername: data.username ? `@${data.username}` : 'Player',
              displayName: data.username || 'Player',
            }));
            // Если с сервера пришел 0 или другое число, ставим его. 
            // Если undefined (ошибка), останется 1000.
            if (data.coins !== undefined) setCoins(data.coins);
          }
        })
        .catch(err => console.error("API Auth Error:", err));
    }

    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        try {
           tg.headerColor = '#212233';
           tg.backgroundColor = '#0C0D14';
        } catch (e) {
            console.error("Error setting TG colors", e);
        }
        const tgUser = tg.initDataUnsafe?.user;
        if (tgUser && !sessionId) {
            setUser(prev => ({
                ...prev,
                tgId: tgUser.id,
                tgUsername: tgUser.username ? `@${tgUser.username}` : 'No Username',
                displayName: tgUser.first_name + (tgUser.last_name ? ` ${tgUser.last_name}` : ''),
            }));
        }
    }
  }, []);

  const filteredGames = GAMES.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' 
      ? true 
      : filter === 'single' 
        ? game.category === 'single' 
        : filter === 'multi'
            ? game.category === 'multi'
            : favorites.has(game.id);
    return matchesSearch && matchesFilter;
  });

  const isSakura = user.activeTheme === 'sakura';

  const handleAddCoins = (amount: number) => {
      setCoins(prev => prev + amount);
      if(window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
  };
  
  const handleSpendCoins = (amount: number): boolean => {
    if (coins >= amount) {
      setCoins(prev => prev - amount);
      if(window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
      return true;
    }
    if(window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
    }
    return false;
  };

  const handleUpdateUser = (updates: Partial<UserProfile>) => {
    setUser(prev => ({ ...prev, ...updates }));
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setIsMenuOpen(false);
  };

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game);
    setShowSearchResults(false);
    setSearchQuery(''); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if(window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
  };

  const handleBackToGrid = () => {
    setSelectedGame(null);
    if(window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
  };

  const toggleFavorite = (e: React.MouseEvent, gameId: string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
    if(window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
  };
  
  const handleSaveScore = async (gameId: string, score: number) => {
    const sessionId = localStorage.getItem('session_id');
    if (!sessionId || !user.tgId) return;

    try {
        await fetch("/api/game/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session: sessionId, game_id: gameId, score: score })
        });
        if(window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    } catch (err) {
        console.error("API Save Score Error:", err);
    }
  };

  useEffect(() => {
    if (!isProfileOpen) setTimeout(() => setIsSettingsMode(false), 300);
  }, [isProfileOpen]);

  useEffect(() => {
    if (!isMenuOpen) setTimeout(() => setIsShopMode(false), 300);
  }, [isMenuOpen]);

  useEffect(() => {
    const handleClickOutside = () => setShowSearchResults(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col relative font-sans text-textMain selection:bg-yellow-500/30 transition-colors duration-500 ${isSakura ? 'bg-pink-950' : 'bg-main'}`}>
      
      {isSakura && (
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=2076&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-screen"></div>
          </div>
      )}

      <header className={`sticky top-0 z-50 px-6 py-3 flex items-center shadow-header transition-all duration-300 ${isSakura ? 'bg-pink-900/80 backdrop-blur-md' : 'bg-header'}`}>
        <div className="w-full max-w-[1360px] mx-auto flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 shrink-0 mr-5">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-textMain hover:scale-110 transition-all duration-200 active:scale-95 shadow-lg ${isSakura ? 'bg-pink-800 hover:bg-pink-700' : 'bg-panel hover:bg-[#3f435e]'}`}
            >
              <Menu size={20} />
            </button>
            <div 
              className="flex items-center gap-2.5 cursor-pointer select-none group"
              onClick={handleBackToGrid}
            >
              <div className={`w-[50px] h-[50px] rounded-[14px] shadow-lg flex items-center justify-center ${isSakura ? 'bg-gradient-to-br from-pink-400 to-rose-500' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                <Gamepad2 size={28} className="text-white" />
              </div>
              <div className="hidden sm:flex flex-col leading-none">
                <span className="text-[16px] font-semibold text-textMain group-hover:text-yellow-400 transition-colors">Library Of</span>
                <span className="text-[16px] font-bold text-textMain">Games</span>
              </div>
            </div>
          </div>

          <div 
            className="flex-1 max-w-[520px] relative mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`relative rounded-full h-[40px] flex items-center px-[18px] focus-within:ring-2 focus-within:ring-yellow-500/70 transition-shadow ${isSakura ? 'bg-pink-800/50 border border-pink-500/20' : 'bg-panel'}`}>
              <input
                type="text"
                placeholder="Поиск игр..."
                className="w-full bg-transparent border-none outline-none text-sm text-textMain placeholder-textMuted h-full"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
              />
              <Search className={`absolute right-3.5 pointer-events-none ${isSakura ? 'text-pink-300' : 'text-textMuted'}`} size={18} />
            </div>

            <AnimatePresence>
              {showSearchResults && searchQuery && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl border overflow-hidden max-h-[300px] overflow-y-auto z-[100] ${isSakura ? 'bg-pink-900 border-pink-500/20' : 'bg-panel border-white/10'}`}
                >
                  {filteredGames.length > 0 ? (
                    filteredGames.map(game => (
                      <div 
                        key={game.id}
                        className="flex items-center p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors"
                        onClick={() => handleGameSelect(game)}
                      >
                        <img src={game.image} alt={game.name} className="w-10 h-10 rounded-lg object-cover mr-3" />
                        <span className="text-sm font-medium">{game.name}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-textMuted text-sm">Игры не найдены</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-5">
            {/* ИЗМЕНЕНО: убрал 'hidden sm:flex', теперь 'flex' */}
            <div className={`flex px-3 py-1.5 rounded-full items-center gap-2 shadow-lg min-w-[110px] ${isSakura ? 'bg-pink-800' : 'bg-panel'}`}>
              <div className="w-6 h-6 rounded-full bg-yellow-400 border-2 border-yellow-600 flex items-center justify-center text-[10px] font-bold text-yellow-900">
                $
              </div>
              <span className="font-semibold text-[16px] min-w-[20px] text-right">{coins}</span>
              <button 
                onClick={() => handleAddCoins(10)}
                className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white hover:scale-110 active:scale-90 transition-transform shadow-md ml-auto"
              >
                <Plus size={18} strokeWidth={3} />
              </button>
            </div>

            <button 
              onClick={() => setIsProfileOpen(true)}
              className={`w-[38px] h-[38px] rounded-full p-0 overflow-hidden border-2 border-transparent hover:border-yellow-400 transition-all shadow-lg ${isSakura ? 'bg-pink-800' : 'bg-panel'}`}
            >
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1360px] mx-auto pt-7 pb-10 px-6 flex flex-col relative z-10">
        {selectedGame ? (
           <GamePage 
              game={selectedGame} 
              theme={user.activeTheme}
              onBack={handleBackToGrid} 
              onEarnCoins={handleAddCoins}
              onSpendCoins={handleSpendCoins}
              onSaveScore={handleSaveScore}
            />
        ) : (
          <>
            <div className="flex justify-between items-end mb-7">
              <h1 className="text-[32px] md:text-[42px] font-bold tracking-tight">
                МИНИ ИГРЫ
              </h1>
              <div className="text-textMuted text-sm hidden md:block">
                Показано {filteredGames.length} игр
              </div>
            </div>

            {filteredGames.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[26px]">
                {filteredGames.map((game, index) => (
                  <GameCard 
                    key={game.id} 
                    game={game} 
                    index={index} 
                    isFavorite={favorites.has(game.id)}
                    onClick={() => handleGameSelect(game)}
                    onToggleFavorite={(e) => toggleFavorite(e, game.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-textMuted">
                <Gamepad2 size={64} className="mb-4 opacity-20" />
                <p className="text-xl">Игры не найдены</p>
                <p className="text-sm mt-2">Попробуйте изменить запрос или фильтры</p>
              </div>
            )}
          </>
        )}
      </main>

      <Drawer 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        position="left" 
        title={isShopMode ? "" : "Меню"}
      >
        {isShopMode ? (
          <Shop 
             user={user}
             coins={coins}
             onSpendCoins={handleSpendCoins}
             onUpdateUser={handleUpdateUser}
             onBack={() => setIsShopMode(false)}
          />
        ) : (
          <div className="space-y-6 flex flex-col h-full animate-in slide-in-from-left duration-300">
            <div className="space-y-2">
              <label className="text-xs font-bold text-textMuted uppercase tracking-wider">Категории</label>
              
              <button 
                onClick={() => handleFilterChange('all')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${filter === 'all' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'hover:bg-white/5 text-textMuted'}`}
              >
                <Gamepad2 size={20} />
                <span className="font-medium">Все игры</span>
                {filter === 'all' && <CheckCircle2 size={16} className="ml-auto" />}
              </button>

              <button 
                onClick={() => handleFilterChange('single')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${filter === 'single' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'hover:bg-white/5 text-textMuted'}`}
              >
                <User size={20} />
                <span className="font-medium">Одиночные</span>
                {filter === 'single' && <CheckCircle2 size={16} className="ml-auto" />}
              </button>

              <button 
                onClick={() => handleFilterChange('multi')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${filter === 'multi' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'hover:bg-white/5 text-textMuted'}`}
              >
                <Users size={20} />
                <span className="font-medium">Для двоих</span>
                {filter === 'multi' && <CheckCircle2 size={16} className="ml-auto" />}
              </button>

               <button 
                onClick={() => handleFilterChange('favorites')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${filter === 'favorites' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'hover:bg-white/5 text-textMuted'}`}
              >
                <Heart size={20} />
                <span className="font-medium">Избранное</span>
                {filter === 'favorites' && <CheckCircle2 size={16} className="ml-auto" />}
              </button>
            </div>

            <div className="mt-auto">
               <button 
                  onClick={() => setIsShopMode(true)}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold p-3 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
               >
                  <ShoppingBag size={20} />
                  Магазин
               </button>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        position="right" 
        title={isSettingsMode ? "" : "Профиль"}
      >
        {isSettingsMode ? (
          <ProfileSettings 
            user={user}
            coins={coins}
            onUpdateUser={handleUpdateUser}
            onSpendCoins={handleSpendCoins}
            onBack={() => setIsSettingsMode(false)}
          />
        ) : (
          <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 rounded-full p-1 border-2 border-yellow-400/50 mb-4 shadow-glow relative">
                <img src={user.avatar} alt="User" className="w-full h-full rounded-full object-cover" />
              </div>
              <h3 className="text-2xl font-bold">{user.displayName}</h3>
              <p className="text-textMuted">{user.tgUsername}</p>
              {user.tgId && <p className="text-xs text-textMuted/50 mt-1">ID: {user.tgId}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8">
               <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center">
                  <span className="text-2xl font-bold text-yellow-400">{coins}</span>
                  <span className="text-xs text-textMuted uppercase mt-1">Монеты</span>
               </div>
               <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-400">{favorites.size}</span>
                  <span className="text-xs text-textMuted uppercase mt-1">Избранное</span>
               </div>
            </div>

            <div className="space-y-2">
               <button 
                  onClick={() => { setIsProfileOpen(false); setIsMenuOpen(true); setFilter('favorites'); }}
                  className="w-full bg-white/5 hover:bg-white/10 p-3 rounded-xl flex items-center gap-3 transition-colors"
               >
                  <Heart size={18} className="text-red-400" />
                  <span>Мои избранные</span>
               </button>
               <button 
                  onClick={() => setIsSettingsMode(true)}
                  className="w-full bg-white/5 hover:bg-white/10 p-3 rounded-xl flex items-center gap-3 transition-colors group"
               >
                  <Settings size={18} className="text-blue-400 group-hover:rotate-90 transition-transform" />
                  <span>Настройки аккаунта</span>
               </button>
            </div>

            <div className="mt-auto pt-6">
              <div className={`bg-[#2AABEE]/10 border border-[#2AABEE]/30 rounded-2xl p-4 flex items-center gap-4 transition-opacity ${user.tgId ? 'opacity-100' : 'opacity-50'}`}>
                 <div className="w-10 h-10 rounded-full bg-[#2AABEE] flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                    <Send size={20} className="text-white ml-[-2px] mt-[1px]" />
                 </div>
                 <div>
                   <div className="text-xs text-[#2AABEE] font-bold uppercase tracking-wider mb-0.5">
                     {user.tgId ? 'Авторизован' : 'Демо режим'}
                   </div>
                   <div className="text-sm font-medium">через Telegram</div>
                 </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

    </div>
  );
};

export default App;
