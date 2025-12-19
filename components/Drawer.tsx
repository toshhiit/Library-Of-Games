import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position: 'left' | 'right';
  title?: string;
  children: React.ReactNode;
  isSakura?: boolean; // Добавили проп темы
}

const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, position, title, children, isSakura }) => {
  const isLeft = position === 'left';
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: isLeft ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: isLeft ? '-100%' : '100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`fixed top-0 bottom-0 ${isLeft ? 'left-0' : 'right-0'} w-[85vw] sm:w-[350px] shadow-2xl z-[70] border-l flex flex-col transition-colors duration-300 ${
                isSakura 
                    ? 'bg-pink-900 border-pink-500/30' 
                    : 'bg-header border-white/5'
            }`}
          >
            <div className={`p-5 border-b flex justify-between items-center ${isSakura ? 'border-pink-500/20' : 'border-white/5'}`}>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-textMuted hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 flex flex-col custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Drawer;
