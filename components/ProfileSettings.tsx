import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Save, Check, AlertCircle, Coins, ArrowLeft, Trophy, Lock, Star } from 'lucide-react'; 
import { ACHIEVEMENTS_LIST } from '../constants'; 
import { motion } from 'framer-motion';

interface ProfileSettingsProps {
  user: UserProfile;
  coins: number;
  onUpdateUser: (updates: Partial<UserProfile>) => void;
  onSpendCoins: (amount: number) => boolean;
  onBack: () => void;
  isSakura?: boolean; // Добавили поддержку темы
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ 
  user, 
  onUpdateUser, 
  onSpendCoins, 
  onBack,
  isSakura
}) => {
  const [name, setName] = useState(user.displayName);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSaveName = () => {
    setError(null);
    setSuccessMsg(null);

    if (name.trim() === user.displayName) return;
    if (name.trim().length < 3) {
      setError('Имя должно быть длиннее 3 символов');
      return;
    }

    if (!user.hasChangedName) {
      onUpdateUser({ displayName: name, hasChangedName: true });
      setSuccessMsg('Имя успешно изменено (бесплатно)');
    } else {
      if (onSpendCoins(5000)) {
        onUpdateUser({ displayName: name });
        setSuccessMsg('Имя успешно изменено (-5000 монет)');
      } else {
        setError('Недостаточно монет. Стоимость: 5000');
      }
    }
  };

  // Расчет уровня
  const currentLevel = user.level || 1;
  const currentXp = user.xp || 0;
  const xpForNextLevel = currentLevel * 1000;
  const progressPercent = Math.min((currentXp / xpForNextLevel) * 100, 100);

  const bgClass = isSakura ? 'bg-pink-900/40 border-pink-500/20' : 'bg-white/5 border-white/5';
  const inputClass = isSakura ? 'bg-pink-900/60 border-pink-500/30 focus:border-pink-400' : 'bg-panel border-white/10 focus:border-yellow-400';

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">Настройки</h2>
      </div>

      <div className="space-y-8 overflow-y-auto pb-4 pr-2 custom-scrollbar">
        
        {/* --- LEVEL PROGRESS BAR --- */}
        <div className={`p-4 rounded-xl border ${bgClass}`}>
             <div className="flex justify-between items-center mb-2">
                 <div className="flex items-center gap-2">
                     <Star size={18} className="text-yellow-400 fill-yellow-400" />
                     <span className="font-bold">Уровень {currentLevel}</span>
                 </div>
                 <span className="text-xs text-textMuted">{currentXp} / {xpForNextLevel} XP</span>
             </div>
             
             <div className="h-3 w-full bg-black/30 rounded-full overflow-hidden border border-white/5">
                 <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full ${isSakura ? 'bg-gradient-to-r from-pink-400 to-rose-500' : 'bg-gradient-to-r from-blue-400 to-purple-500'}`}
                 />
             </div>
             <p className="text-[10px] text-textMuted mt-2 text-center">Играйте в игры, чтобы повышать уровень!</p>
        </div>

        {/* Telegram Username */}
        <div className="space-y-2">
          <label className="text-xs text-textMuted font-bold uppercase">Telegram Username</label>
          <div className={`w-full p-3 rounded-xl text-textMuted flex items-center justify-between border ${bgClass}`}>
            <span>{user.tgUsername}</span>
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded">TG</span>
          </div>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <label className="text-xs text-textMuted font-bold uppercase">Отображаемое имя</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`flex-1 border rounded-xl px-4 py-3 focus:outline-none transition-colors ${inputClass}`}
            />
            <button 
              onClick={handleSaveName}
              disabled={name === user.displayName}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-black p-3 rounded-xl transition-colors font-bold"
            >
              <Save size={20} />
            </button>
          </div>
          <div className="flex justify-between items-center text-xs">
            {user.hasChangedName ? (
               <span className="text-yellow-400 flex items-center gap-1">
                 <Coins size={12} /> Стоимость: 5000
               </span>
            ) : (
               <span className="text-green-400">Первое изменение бесплатно</span>
            )}
            <span className="text-textMuted">{name.length}/20</span>
          </div>
        </div>

        {/* Avatar Display */}
        <div className="space-y-3">
           <label className="text-xs text-textMuted font-bold uppercase">Аватар</label>
           <div className={`p-4 rounded-xl flex items-center gap-4 border ${bgClass}`}>
              <img 
                src={user.avatar} 
                alt="Current Avatar" 
                className="w-16 h-16 rounded-full object-cover border-2 border-yellow-400/50" 
                onError={(e) => { e.currentTarget.src = "/assets/images/default.png"; }} 
              />
              <div className="flex flex-col">
                  <span className="font-bold text-sm">Фото профиля</span>
                  <span className="text-xs text-textMuted">Используется ваше фото из Telegram.</span>
              </div>
           </div>
        </div>

        {/* --- ACHIEVEMENTS --- */}
        <div className="space-y-3 pt-4 border-t border-white/10">
           <label className="text-xs text-textMuted font-bold uppercase flex items-center gap-2">
              <Trophy size={14} className="text-yellow-500" />
              Достижения ({user.achievements?.length || 0} / {ACHIEVEMENTS_LIST.length})
           </label>
           
           <div className="grid grid-cols-1 gap-2">
              {ACHIEVEMENTS_LIST.map(ach => {
                  const isUnlocked = user.achievements?.includes(ach.id);
                  return (
                      <div 
                        key={ach.id} 
                        className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
                            isUnlocked 
                                ? (isSakura ? 'bg-pink-500/10 border-pink-500/20' : 'bg-yellow-500/10 border-yellow-500/20')
                                : 'bg-white/5 border-white/5 opacity-50'
                        }`}
                      >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-inner ${
                              isUnlocked ? 'bg-[#0C0D14]' : 'bg-black/20'
                          }`}>
                              {isUnlocked ? ach.icon : <Lock size={16} />}
                          </div>
                          
                          <div className="flex-1">
                              <div className={`font-bold text-sm ${isUnlocked ? 'text-white' : 'text-textMuted'}`}>
                                  {ach.name}
                              </div>
                              <div className="text-xs text-textMuted leading-tight">
                                  {ach.description}
                              </div>
                          </div>
                      </div>
                  );
              })}
           </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2 text-green-400 text-sm">
            <Check size={16} />
            {successMsg}
          </div>
        )}

      </div>
    </div>
  );
};

export default ProfileSettings;
