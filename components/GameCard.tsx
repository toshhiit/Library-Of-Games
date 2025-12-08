
import React from 'react';
import { motion } from 'framer-motion';
import { Game } from '../types';
import { Play, Heart } from 'lucide-react';

interface GameCardProps {
  game: Game;
  index: number;
  isFavorite: boolean;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

const GameCard: React.FC<GameCardProps> = ({ game, index, isFavorite, onClick, onToggleFavorite }) => {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ 
        scale: 1.03, 
        y: -6,
        boxShadow: "0 24px 40px rgba(0, 0, 0, 0.85)",
        borderColor: "rgba(244, 180, 0, 0.5)" 
      }}
      onClick={onClick}
      className="bg-card border border-white/5 rounded-[18px] p-[18px] relative overflow-hidden cursor-pointer shadow-card group"
    >
      <div className="bg-[#101118] rounded-xl h-[150px] flex items-center justify-center relative overflow-hidden">
        <img 
          src={game.image} 
          alt={game.name} 
          className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:saturate-[1.1]"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <Play className="text-white w-12 h-12 fill-white" />
        </div>
        
        {/* Favorite Button */}
        <button 
          onClick={onToggleFavorite}
          className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition-colors z-20 group/fav"
        >
          <Heart 
            size={18} 
            className={`transition-colors ${isFavorite ? 'text-red-500 fill-red-500' : 'text-white group-hover/fav:text-red-400'}`} 
          />
        </button>
      </div>
      <div className="mt-[10px] flex justify-between items-start">
        <div>
          <h3 className="text-[15px] font-medium text-textMain tracking-wide group-hover:text-yellow-400 transition-colors">
            {game.name}
          </h3>
          <p className="text-xs text-textMuted mt-1">{game.category === 'single' ? 'Одиночная' : 'Для двоих'}</p>
        </div>
      </div>
    </motion.article>
  );
};

export default GameCard;
