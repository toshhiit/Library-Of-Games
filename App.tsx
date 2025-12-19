import React, { useState, useEffect } from 'react';
import { 
  Menu, Search, Plus, Heart, User, Gamepad2, Users, CheckCircle2, Send, Settings, ShoppingBag, Trophy 
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
    achievements: [], 
    xp: 0,
    level: 1 
  } as UserProfile);
  
  const [coins, setCoins] = useState(10000); 
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [achievementNotification, setAchievementNotification] = useState<{name: string, desc: string} | null>(null);
  const [rewardNotification, setRewardNotification] = useState<{coins: number, xp: number} | null>(null);
  const [levelUpNotification, setLevelUpNotification] = useState<number | null>(null); // Уведомление об уровне
  
  const [isSettingsMode, setIsSettingsMode] = useState(false); 
  const [isShopMode, setIsShopMode] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // --- API HELPER ---
  const callUpdateApi = async (action: string, payload: any) => {
      const sessionId = localStorage.getItem('session_id');
      if (!sessionId) return false;
      try {
          const res = await fetch("/api/user/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session: sessionId, action, payload })
          });
          const data = await res.json();
          if (data.success && data.coins !== undefined) {
              setCoins(data.coins);
          }
          return data.success;
      } catch (e) {
          console.error("Sync error:", e);
          return false;
      }
  };

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
              achievements: data.achievements || [],
              xp: data.xp || 0,
              level: data.level || 1,
              avatar: data.avatar_url || prev.avatar,
              inventory: data.inventory || [],
              activeTheme: data.active_theme || 'default',
              hasChangedName: data.has_changed_name || false
            }));
            if (data.coins !== undefined) setCoins(data.coins);
          }
        });
    }

    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        try { tg.headerColor = '#212233'; tg.backgroundColor = '#0C0D14'; } catch (e) {}
        const tgUser = tg.initDataUnsafe?.user;
        if (tgUser) {
            setUser(prev => ({
                ...prev,
                tgId: tgUser.id,
                tgUsername: tgUser.username ? `@${tgUser.username}` : 'No Username',
                avatar: tgUser.photo_url || prev.avatar, 
            }));
            if (!sessionId) {
                setUser(prev => ({ ...prev, displayName: tgUser.first_name }));
            }
        }
    }
  }, []);

  const filteredGames = GAMES.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' ? true : filter === 'single' ? game.category === 'single' : filter === 'multi' ? game.category === 'multi' : favorites.has(game.id);
    return matchesSearch && matchesFilter;
  });

  const isSakura = user.activeTheme === 'sakura';

  const handleAddCoins = (amount: number) => {
      setCoins(prev => prev + amount);
  };
  
  const handleSpendCoins = (amount: number, itemId?: string, type?: 'theme' | 'item' | 'name', newVal?: string): boolean => {
    if (coins < amount) {
        if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        return false;
    }
    setCoins(prev => prev - amount);
    if (type === 'item' && itemId) {
        callUpdateApi('buy', { item_id: itemId, price: amount }).then(success => {
             if (success) setUser(prev => ({ ...prev, inventory: [...prev.inventory, itemId] }));
             else setCoins(prev => prev + amount);
        });
    } else if (type === 'name' && newVal) {
        callUpdateApi('change_name', { name: newVal, price: amount });
    }
    if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.selectionChanged();
    return true;
  };

  const handleUpdateUserWrapper = (updates: Partial<UserProfile>) => {
      if (updates.activeTheme) callUpdateApi('set_theme', { theme: updates.activeTheme });
      setUser(prev => ({ ...prev, ...updates }));
  };

  const handleFilterChange = (newFilter: FilterType) => { setFilter(newFilter); setIsMenuOpen(false); };
  const handleGameSelect = (game: Game) => { setSelectedGame(game); setShowSearchResults(false); setSearchQuery(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleBackToGrid = () => { setSelectedGame(null); };
  const toggleFavorite = (e: React.MouseEvent, gameId: string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId); else next.add(gameId);
      return next;
    });
  };
  
  const handleSaveScore = async (gameId: string, score: number) => {
    const sessionId = localStorage.getItem('session_id');
    if (!sessionId || !user.tgId) return;

    try {
        const res = await fetch("/api/game/score", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session: sessionId, game_id: gameId, score: score })
        });
        const data = await res.json();
        if (data.success) {
            // Обновляем монеты
            if (data.earned_coins) setCoins(prev => prev + data.earned_coins);
            
            // Обновляем XP и Level
            setUser(prev => {
                const newLvl = data.new_level || prev.level;
                if (newLvl > prev.level) setLevelUpNotification(newLvl); // Показываем нотификацию
                return { 
                    ...prev, 
                    xp: data.current_xp !== undefined ? data.current_xp : (prev.xp + (data.earned_xp || 0)),
                    level: newLvl
                };
            });

            if (data.earned_coins > 0 || data.earned_xp > 0) {
                 setRewardNotification({ coins: data.earned_coins, xp: data.earned_xp });
                 setTimeout(() => setRewardNotification(null), 3000);
            }
            if (data.new_achievements?.length > 0) {
                const newAch = data.new_achievements[0];
                setUser(prev => ({ ...prev, achievements: [...(prev.achievements || []), newAch.id] }));
                setAchievementNotification({ name: newAch.name, desc: newAch.desc });
                setTimeout(() => setAchievementNotification(null), 4000);
            }
        }
    } catch (err) { console.error("Error saving score:", err); }
  };

  return (
    <div className={`min-h-screen flex flex-col relative font-sans text-textMain selection:bg-yellow-500/30 transition-colors duration-500 ${isSakura ? 'bg-pink-950' : 'bg-main'}`}>
      
      {isSakura && (
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=2076&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-screen"></div>
              <div className="absolute top-[-10%] left-[10%] w-4 h-4 bg-pink-300 rounded-full blur-[1px] animate-[bounce_5s_infinite] opacity-60"></div>
          </div>
      )}

      <header className={`sticky top-0 z-50 px-6 py-3 flex items-center shadow-header transition-all duration-300 ${isSakura ? 'bg-pink-900/80 backdrop-blur-md' : 'bg-header'}`}>
        <div className="w-full max-w-[1360px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0 mr-5">
            <button onClick={() => setIsMenuOpen(true)} className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-textMain shadow-lg ${isSakura ? 'bg-pink-800' : 'bg-panel'}`}>
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2.5 cursor-pointer group" onClick={handleBackToGrid}>
              <div className={`w-[50px] h-[50px] rounded-[14px] shadow-lg flex items-center justify-center ${isSakura ? 'bg-gradient-to-br from-pink-400 to-rose-500' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                <Gamepad2 size={28} className="text-white" />
              </div>
              <div className="hidden sm:flex flex-col leading-none">
                <span className="text-[16px] font-semibold text-textMain group-hover:text-yellow-400 transition-colors">Library Of</span>
                <span className="text-[16px] font-bold text-textMain">Games</span>
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-[520px] relative mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`relative rounded-full h-[40px] flex items-center px-[18px] transition-shadow ${isSakura ? 'bg-pink-800/50 border border-pink-500/20' : 'bg-panel'}`}>
              <input
                type="text" placeholder="Поиск игр..."
                className="w-full bg-transparent border-none outline-none text-sm text-textMain placeholder-textMuted h-full"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
                onFocus={() => setShowSearchResults(true)}
              />
              <Search className={`absolute right-3.5 pointer-events-none ${isSakura ? 'text-pink-300' : 'text-textMuted'}`} size={18} />
            </div>
            <AnimatePresence>
              {showSearchResults && searchQuery && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl border overflow-hidden max-h-[300px] overflow-y-auto z-[100] ${isSakura ? 'bg-pink-900' : 'bg-panel'}`}>
                  {filteredGames.map(game => (
                      <div key={game.id} className="flex items-center p-3 hover:bg-white/5 cursor-pointer border-b border-white/5" onClick={() => handleGameSelect(game)}>
                        <img src={game.image} alt={game.name} className="w-10 h-10 rounded-lg object-cover mr-3" />
                        <span className="text-sm font-medium">{game.name}</span>
                      </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-5">
            <div className={`hidden sm:flex px-3 py-1.5 rounded-full items-center gap-2 shadow-lg min-w-[110px] ${isSakura ? 'bg-pink-800' : 'bg-panel'}`}>
              <div className="w-6 h-6 rounded-full bg-yellow-400 border-2 border-yellow-600 flex items-center justify-center text-[10px] font-bold text-yellow-900">$</div>
              <span className="font-semibold text-[16px] min-w-[20px] text-right">{coins}</span>
              <button onClick={() => handleAddCoins(10)} className="w-[30px] h-[30px] rounded-full bg-green-500 flex items-center justify-center text-white ml-auto"><Plus size={18}/></button>
            </div>
            <button onClick={() => setIsProfileOpen(true)} className={`w-[38px] h-[38px] rounded-full overflow-hidden border-2 border-transparent hover:border-yellow-400 transition-all shadow-lg ${isSakura ? 'bg-pink-800' : 'bg-panel'}`}>
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = "/assets/images/default.png"; }} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1360px] mx-auto pt-7 pb-10 px-6 flex flex-col relative z-10">
        {selectedGame ? (
           <GamePage 
              game={selectedGame} theme={user.activeTheme}
              onBack={handleBackToGrid} 
              onEarnCoins={handleAddCoins}
              onSpendCoins={(amount) => handleSpendCoins(amount)}
              onSaveScore={handleSaveScore}
            />
        ) : (
          <>
            <div className="flex justify-between items-end mb-7">
              <h1 className="text-[32px] md:text-[42px] font-bold tracking-tight">МИНИ ИГРЫ</h1>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[26px]">
                {filteredGames.map((game, index) => (
                  <GameCard key={game.id} game={game} index={index} isFavorite={favorites.has(game.id)} onClick={() => handleGameSelect(game)} onToggleFavorite={(e) => toggleFavorite(e, game.id)}/>
                ))}
            </div>
          </>
        )}
      </main>

      <Drawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} position="left" title={isShopMode ? "" : "Меню"} isSakura={isSakura}>
        {isShopMode ? (
          <Shop 
             user={user} coins={coins}
             onSpendCoins={(amount, itemId) => handleSpendCoins(amount, itemId, 'item')}
             onUpdateUser={handleUpdateUserWrapper}
             onBack={() => setIsShopMode(false)}
          />
        ) : (
          <div className="space-y-6 flex flex-col h-full animate-in slide-in-from-left">
            <div className="space-y-2">
              <label className="text-xs font-bold text-textMuted uppercase">Категории</label>
              {['all', 'single', 'multi', 'favorites'].map(t => (
                  <button key={t} onClick={() => handleFilterChange(t as FilterType)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${filter === t ? 'bg-yellow-500/20 text-yellow-400' : 'hover:bg-white/5 text-textMuted'}`}>
                    {t === 'all' ? <Gamepad2 size={20} /> : t === 'single' ? <User size={20} /> : t === 'multi' ? <Users size={20} /> : <Heart size={20} />}
                    <span className="font-medium capitalize">{t === 'all' ? 'Все игры' : t === 'single' ? 'Одиночные' : t === 'multi' ? 'Для двоих' : 'Избранное'}</span>
                    {filter === t && <CheckCircle2 size={16} className="ml-auto" />}
                  </button>
              ))}
            </div>
            <div className="mt-auto">
               <button onClick={() => setIsShopMode(true)} className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold p-3 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                  <ShoppingBag size={20} /> Магазин
               </button>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} position="right" title={isSettingsMode ? "" : "Профиль"} isSakura={isSakura}>
        {isSettingsMode ? (
          <ProfileSettings 
            user={user} coins={coins}
            onUpdateUser={handleUpdateUserWrapper}
            onSpendCoins={(amount) => handleSpendCoins(amount, undefined, 'name', user.displayName)}
            onBack={() => setIsSettingsMode(false)}
            isSakura={isSakura}
          />
        ) : (
          <div className="flex flex-col h-full animate-in slide-in-from-right">
            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 rounded-full p-1 border-2 border-yellow-400/50 mb-4 relative">
                <img src={user.avatar} alt="User" className="w-full h-full rounded-full object-cover" onError={(e) => { e.currentTarget.src = "/assets/images/default.png"; }} />
              </div>
              <h3 className="text-2xl font-bold">{user.displayName}</h3>
              <p className="text-textMuted">{user.tgUsername}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-8">
               <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center"><span className="text-2xl font-bold text-yellow-400">{coins}</span><span className="text-xs text-textMuted uppercase">Монеты</span></div>
               <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center"><span className="text-2xl font-bold text-blue-400">{user.level}</span><span className="text-xs text-textMuted uppercase">Уровень</span></div>
            </div>
            <div className="space-y-2">
               <button onClick={() => setIsSettingsMode(true)} className="w-full bg-white/5 hover:bg-white/10 p-3 rounded-xl flex items-center gap-3 transition-colors"><Settings size={18} className="text-blue-400" /><span>Настройки аккаунта</span></button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Уведомление о повышении уровня */}
      <AnimatePresence>
        {levelUpNotification && (
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center z-[200] pointer-events-none">
             <div className="bg-black/90 p-8 rounded-3xl border-2 border-yellow-400 flex flex-col items-center text-center shadow-[0_0_50px_rgba(250,204,21,0.5)]">
                 <Trophy size={64} className="text-yellow-400 mb-4 animate-bounce" />
                 <h2 className="text-3xl font-bold text-white mb-2">НОВЫЙ УРОВЕНЬ!</h2>
                 <p className="text-xl text-yellow-400 font-bold">Уровень {levelUpNotification}</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {achievementNotification && (
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.8 }} className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[320px]">
            <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 p-[2px] rounded-2xl shadow-2xl">
              <div className="bg-[#1a1b26] rounded-[14px] p-4 flex items-center gap-4 relative overflow-hidden">
                <Trophy className="text-yellow-400" size={24} />
                <div><h4 className="font-bold text-yellow-400 text-sm uppercase">Достижение!</h4><div className="font-bold text-white leading-tight">{achievementNotification.name}</div></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {rewardNotification && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
             <span className="text-yellow-400 font-bold">+{rewardNotification.coins} $</span>
             <span className="text-blue-400 font-bold">+{rewardNotification.xp} XP</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
