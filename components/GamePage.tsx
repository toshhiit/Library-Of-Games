import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Maximize2, Info, Keyboard, RotateCcw, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { Game, ThemeType } from '../types';
import { Game2048, SnakeGame, DinoGame, ClickerGame, MinesweeperGame, CheckersGame, PaintGame, TetrisGame, SolitaireGame } from './GameMechanics';

interface GamePageProps {
  game: Game;
  theme?: ThemeType;
  onBack: () => void;
  onEarnCoins: (amount: number) => void;
  onSpendCoins: (amount: number) => boolean; // Добавлено
  onSaveScore: (gameId: string, score: number) => void;
}

const GamePage: React.FC<GamePageProps> = ({ game, theme = 'default', onBack, onEarnCoins, onSpendCoins, onSaveScore }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const renderGame = () => {
    switch (game.name) {
      case '2048': return <Game2048 theme={theme} gameId={game.id} onSaveScore={onSaveScore} />;
      case 'Snake': return <SnakeGame theme={theme} gameId={game.id} onSaveScore={onSaveScore} />;
      case 'Dino Run': return <DinoGame theme={theme} gameId={game.id} onSaveScore={onSaveScore} />;
      case 'Clicker': return <ClickerGame onEarnCoins={onEarnCoins} gameId={game.id} onSaveScore={onSaveScore} />;
      case 'Сапёр': return <MinesweeperGame gameId={game.id} onSaveScore={onSaveScore} />;
      case 'Шашки': return <CheckersGame />;
      case 'Paint': return <PaintGame />;
      case 'Tetris': return <TetrisGame gameId={game.id} onSaveScore={onSaveScore} theme={theme} />;
      case 'Пасьянс': return <SolitaireGame onSpendCoins={onSpendCoins} />; // Передаем функцию списания
      default: return (
        <div className="flex flex-col items-center justify-center h-full text-textMuted">
          <p>Игра в разработке...</p>
        </div>
      );
    }
  };

  const isSakura = theme === 'sakura';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full"
    >
      {/* Navigation */}
      <button 
        onClick={onBack}
        className={`flex items-center gap-2 hover:text-white transition-colors mb-6 group ${isSakura ? 'text-pink-300' : 'text-textMuted'}`}
      >
        <div className={`p-2 rounded-full transition-colors ${isSakura ? 'bg-pink-500/20 group-hover:bg-pink-500/40' : 'bg-panel group-hover:bg-[#3f435e]'}`}>
          <ArrowLeft size={20} />
        </div>
        <span className="font-medium">Назад к списку</span>
      </button>

      {/* Game Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{game.name}</h1>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
              game.category === 'single' 
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            }`}>
              {game.category === 'single' ? 'Одиночная' : 'Для двоих'}
            </span>
            <span className="text-textMuted text-sm">Аркада • Популярное</span>
          </div>
        </div>
        {isPlaying && (
          <button 
            onClick={() => setIsPlaying(false)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
          >
            <RotateCcw size={16} />
            <span>Перезапустить</span>
          </button>
        )}
      </div>

      {/* Game Container */}
      <div className={`relative w-full ${isPlaying ? 'min-h-[500px] h-auto' : 'aspect-video'} rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border group mb-8 select-none ${isSakura ? 'bg-pink-900/20 border-pink-500/30' : 'bg-[#151621] border-white/10'}`}>
        
        {/* Decorative Glow */}
        <div className={`absolute -inset-1 bg-gradient-to-r rounded-2xl opacity-20 blur-lg pointer-events-none ${isSakura ? 'from-pink-500 to-rose-600' : 'from-blue-500 to-purple-600'}`}></div>
        
        {/* Active Game or Placeholder */}
        <div className="relative z-10 w-full h-full">
          {isPlaying ? (
            <div className={`w-full h-full flex flex-col items-center justify-center p-4 ${isSakura ? 'bg-black/40' : 'bg-[#0C0D14]'}`}>
              {renderGame()}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#151621] relative overflow-hidden">
                <img 
                    src={game.image} 
                    alt={game.name} 
                    className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm"
                />
                <div className="relative z-20 flex flex-col items-center">
                    <button 
                      onClick={() => setIsPlaying(true)}
                      className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all mb-4 group/play ${isSakura ? 'bg-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.4)]' : 'bg-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.4)]'}`}
                    >
                        <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-black border-b-[12px] border-b-transparent ml-1 group-hover/play:scale-110 transition-transform"></div>
                    </button>
                    <span className="text-lg font-medium text-white drop-shadow-md">Нажмите чтобы играть</span>
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Description & How to Play */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Main Description */}
        <div className="md:col-span-2 space-y-6">
            <div className={`rounded-2xl p-6 border ${isSakura ? 'bg-pink-900/10 border-pink-500/20' : 'bg-panel border-white/5'}`}>
                <div className="flex items-center gap-3 mb-4 text-white">
                    <Info size={24} className={isSakura ? 'text-pink-400' : 'text-yellow-400'} />
                    <h2 className="text-xl font-bold">Об игре</h2>
                </div>
                <p className={`${isSakura ? 'text-pink-200' : 'text-textMuted'} leading-relaxed text-lg`}>
                    {game.description} Используйте ваши навыки и реакцию, чтобы победить. Игра адаптирована для работы в браузере и на мобильных устройствах.
                </p>
            </div>

            <div className={`rounded-2xl p-6 border ${isSakura ? 'bg-pink-900/10 border-pink-500/20' : 'bg-panel border-white/5'}`}>
                <div className="flex items-center gap-3 mb-4 text-white">
                    <Keyboard size={24} className="text-blue-400" />
                    <h2 className="text-xl font-bold">Управление</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl flex items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded border border-white/20 flex items-center justify-center text-xs bg-white/5"><ArrowUp size={16}/></div>
                      <div className="flex gap-1">
                        <div className="w-8 h-8 rounded border border-white/20 flex items-center justify-center text-xs bg-white/5"><ArrowLeft size={16}/></div>
                        <div className="w-8 h-8 rounded border border-white/20 flex items-center justify-center text-xs bg-white/5"><ArrowDown size={16}/></div>
                        <div className="w-8 h-8 rounded border border-white/20 flex items-center justify-center text-xs bg-white/5"><ArrowRight size={16}/></div>
                      </div>
                    </div>
                    <span className="text-sm text-textMuted">Перемещение (ПК / Сенсор)</span>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl flex items-center gap-3">
                    <div className="h-8 px-3 rounded border border-white/20 flex items-center justify-center text-xs bg-white/5">Space</div>
                    <span className="text-sm text-textMuted">Действие / Прыжок</span>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl flex items-center gap-3">
                     <div className="w-8 h-8 rounded border border-white/20 flex items-center justify-center text-xs bg-white/5">🖱️</div>
                     <span className="text-sm text-textMuted">Взаимодействие</span>
                  </div>
                </div>
            </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
            <div className={`rounded-2xl p-5 border ${isSakura ? 'bg-pink-900/10 border-pink-500/20' : 'bg-card border-white/5'}`}>
                <h3 className={`text-sm font-bold uppercase mb-4 ${isSakura ? 'text-pink-300' : 'text-textMuted'}`}>Информация</h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                        <span className="text-textMuted">Рейтинг</span>
                        <span className="text-yellow-400 font-bold">4.8/5.0</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                        <span className="text-textMuted">Игроков</span>
                        <span className="text-white">12.5k</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-textMuted">Категория</span>
                        <span className="text-white capitalize">{game.category}</span>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </motion.div>
  );
};

export default GamePage;
