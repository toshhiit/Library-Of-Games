
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { AVAILABLE_AVATARS } from '../constants';
import { Save, Lock, Check, AlertCircle, Coins, ArrowLeft } from 'lucide-react';

interface ProfileSettingsProps {
  user: UserProfile;
  coins: number;
  onUpdateUser: (updates: Partial<UserProfile>) => void;
  onSpendCoins: (amount: number) => boolean;
  onBack: () => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ 
  user, 
  coins, 
  onUpdateUser, 
  onSpendCoins, 
  onBack 
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
      // Free change
      onUpdateUser({ displayName: name, hasChangedName: true });
      setSuccessMsg('Имя успешно изменено (бесплатно)');
    } else {
      // Paid change
      if (onSpendCoins(5000)) {
        onUpdateUser({ displayName: name });
        setSuccessMsg('Имя успешно изменено (-5000 монет)');
      } else {
        setError('Недостаточно монет. Стоимость: 5000');
      }
    }
  };

  const handleAvatarSelect = (avatarId: string, url: string, price: number) => {
    setError(null);
    setSuccessMsg(null);

    if (user.unlockedAvatars.includes(avatarId)) {
      // Already unlocked, just switch
      onUpdateUser({ avatar: url });
    } else {
      // Need to buy
      if (onSpendCoins(price)) {
        onUpdateUser({ 
          avatar: url, 
          unlockedAvatars: [...user.unlockedAvatars, avatarId] 
        });
        setSuccessMsg(`Аватар куплен (-${price} монет)`);
      } else {
        setError(`Недостаточно монет. Стоимость: ${price}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">Настройки</h2>
      </div>

      <div className="space-y-8 overflow-y-auto pb-4 pr-2 custom-scrollbar">
        
        {/* Telegram Username */}
        <div className="space-y-2">
          <label className="text-xs text-textMuted font-bold uppercase">Telegram Username</label>
          <div className="w-full p-3 bg-white/5 border border-white/5 rounded-xl text-textMuted flex items-center justify-between">
            <span>{user.tgUsername}</span>
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded">TG</span>
          </div>
          <p className="text-[10px] text-textMuted">Берется из Telegram аккаунта, нельзя изменить.</p>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <label className="text-xs text-textMuted font-bold uppercase">Отображаемое имя</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 bg-panel border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors"
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

        {/* Avatar Selection */}
        <div className="space-y-3">
           <label className="text-xs text-textMuted font-bold uppercase">Аватар</label>
           <div className="grid grid-cols-3 gap-3">
              {AVAILABLE_AVATARS.map((av) => {
                const isUnlocked = user.unlockedAvatars.includes(av.id);
                const isSelected = user.avatar === av.url;

                return (
                  <button
                    key={av.id}
                    onClick={() => handleAvatarSelect(av.id, av.url, av.price)}
                    className={`
                      relative aspect-square rounded-xl overflow-hidden border-2 transition-all
                      ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-400/30' : 'border-transparent hover:border-white/20'}
                    `}
                  >
                    <img src={av.url} alt="avatar" className={`w-full h-full object-cover ${!isUnlocked ? 'grayscale opacity-50' : ''}`} />
                    
                    {/* Status Icons */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-yellow-400/20 flex items-center justify-center">
                         <div className="bg-yellow-400 text-black rounded-full p-1">
                           <Check size={16} strokeWidth={3} />
                         </div>
                      </div>
                    )}

                    {!isUnlocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-1">
                        <Lock size={16} className="text-textMuted mb-1" />
                        <div className="flex items-center gap-0.5 text-[10px] font-bold text-yellow-400 bg-black/50 px-1.5 py-0.5 rounded-full">
                           <Coins size={10} />
                           {av.price}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
           </div>
        </div>

        {/* Feedback Messages */}
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
