
import React, { useState } from 'react';
import { ShopItem, UserProfile } from '../types';
import { SHOP_ITEMS } from '../constants';
import { Coins, Check, AlertCircle, ShoppingBag, Zap, Palette, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface ShopProps {
  user: UserProfile;
  coins: number;
  onSpendCoins: (amount: number) => boolean;
  onUpdateUser: (updates: Partial<UserProfile>) => void;
  onBack: () => void;
}

const Shop: React.FC<ShopProps> = ({ user, coins, onSpendCoins, onUpdateUser, onBack }) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePurchase = (item: ShopItem) => {
    setError(null);
    setSuccess(null);

    // Check if theme is already owned
    if (item.type === 'theme' && user.inventory.includes(item.id)) {
      // Toggle Theme
      if (user.activeTheme === item.value) {
        onUpdateUser({ activeTheme: 'default' });
        setSuccess('Тема отключена');
      } else {
        onUpdateUser({ activeTheme: item.value as 'default' | 'sakura' });
        setSuccess('Тема применена!');
      }
      return;
    }

    // Purchase logic
    if (coins >= item.price) {
      if (onSpendCoins(item.price)) {
        if (item.type === 'theme') {
           onUpdateUser({ 
             inventory: [...user.inventory, item.id],
             activeTheme: item.value as 'default' | 'sakura'
           });
           setSuccess(`"${item.name}" куплено и применено!`);
        } else if (item.type === 'boost') {
           onUpdateUser({ activeBoosts: [...user.activeBoosts, item.id] });
           setSuccess(`"${item.name}" активировано!`);
        }
      }
    } else {
      setError(`Недостаточно монет. Нужно еще ${item.price - coins}.`);
    }
  };

  const isOwned = (itemId: string) => user.inventory.includes(itemId);
  const isActive = (item: ShopItem) => {
      if (item.type === 'theme') return user.activeTheme === item.value;
      if (item.type === 'boost') return user.activeBoosts.includes(item.id);
      return false;
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-left duration-300">
       <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
           <ShoppingBag className="text-yellow-400" />
           <h2 className="text-xl font-bold">Магазин</h2>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-yellow-500/10 p-3 rounded-xl mb-6 border border-yellow-500/20">
         <Coins className="text-yellow-400" size={20} />
         <span className="font-bold text-lg">{coins}</span>
      </div>

      <div className="space-y-4 overflow-y-auto pb-4 pr-2 custom-scrollbar">
          {SHOP_ITEMS.map((item, idx) => {
              const owned = isOwned(item.id);
              const active = isActive(item);

              return (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`bg-white/5 border rounded-xl p-3 flex gap-3 ${active ? 'border-yellow-400/50 bg-yellow-400/5' : 'border-white/5'}`}
                  >
                      <div className="w-16 h-16 rounded-lg bg-black/20 shrink-0 overflow-hidden relative">
                           <img src={item.image} alt={item.name} className="w-full h-full object-cover opacity-80" />
                           {item.type === 'boost' && <div className="absolute inset-0 flex items-center justify-center"><Zap className="text-yellow-400 drop-shadow-md" /></div>}
                           {item.type === 'theme' && <div className="absolute inset-0 flex items-center justify-center"><Palette className="text-pink-400 drop-shadow-md" /></div>}
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-between">
                          <div>
                              <div className="flex justify-between items-start">
                                  <h3 className="font-bold text-sm">{item.name}</h3>
                                  {active && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase">Активно</span>}
                              </div>
                              <p className="text-[11px] text-textMuted leading-tight mt-1">{item.description}</p>
                          </div>
                          
                          <div className="mt-2 flex justify-between items-end">
                              <span className="text-xs font-bold text-yellow-400 flex items-center gap-1">
                                  {!owned ? <><Coins size={12}/> {item.price}</> : (item.type === 'theme' ? 'Куплено' : '')}
                              </span>
                              
                              <button 
                                onClick={() => handlePurchase(item)}
                                className={`
                                    px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                    ${active 
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                        : owned && item.type === 'theme' 
                                            ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                            : 'bg-yellow-500 text-black hover:bg-yellow-400'
                                    }
                                `}
                              >
                                  {active ? 'Отключить' : (owned && item.type === 'theme' ? 'Применить' : 'Купить')}
                              </button>
                          </div>
                      </div>
                  </motion.div>
              )
          })}
      </div>

      {/* Messages */}
      {error && (
        <div className="mt-auto p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-bottom-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {success && (
        <div className="mt-auto p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2 text-green-400 text-sm animate-in fade-in slide-in-from-bottom-2">
          <Check size={16} />
          {success}
        </div>
      )}
    </div>
  );
};

export default Shop;
