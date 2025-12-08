import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, MousePointer2, Timer, Crown, Flag, Bomb, Eraser, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeType } from '../types';

/* ==========================================
   GAME: 2048 (Scaled Up)
   ========================================== */
type Tile = {
  id: number;
  val: number;
  r: number;
  c: number;
  isNew?: boolean;
  isMerging?: boolean;
  toDelete?: boolean;
};

export const Game2048: React.FC<{theme?: ThemeType}> = ({theme = 'default'}) => {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const idCounter = useRef(1);
  const BOARD_SIZE = 4;
  
  const isSakura = theme === 'sakura';

  useEffect(() => { startNewGame(); }, []);

  const startNewGame = () => {
    setTiles([]);
    setScore(0);
    setGameOver(false);
    setHasWon(false);
    setKeepPlaying(false);
    setIsAnimating(false);
    idCounter.current = 1;
    setTimeout(() => {
        const t1 = createRandomTile([]);
        const t2 = createRandomTile([t1]);
        setTiles([t1, t2]);
    }, 50);
  };

  const createRandomTile = (currentTiles: Tile[]): Tile => {
    const emptyCells: {r: number, c: number}[] = [];
    for(let r=0; r<BOARD_SIZE; r++) {
      for(let c=0; c<BOARD_SIZE; c++) {
        if(!currentTiles.some(t => t.r === r && t.c === c && !t.toDelete)) {
          emptyCells.push({r, c});
        }
      }
    }
    if (emptyCells.length === 0) return { id: -1, val: 0, r: -1, c: -1 }; 

    const {r, c} = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    return {
      id: idCounter.current++,
      val: Math.random() < 0.9 ? 2 : 4,
      r,
      c,
      isNew: true
    };
  };

  const move = useCallback((direction: 'up'|'down'|'left'|'right') => {
    if (gameOver || (hasWon && !keepPlaying) || isAnimating) return;

    setTiles(prevTiles => {
      let newTiles = prevTiles.map(t => ({ ...t, isNew: false, isMerging: false }));
      let moved = false;
      let scoreAdd = 0;
      let won = false;

      const sortFn = (a: Tile, b: Tile) => {
        if (direction === 'left') return a.c - b.c;
        if (direction === 'right') return b.c - a.c;
        if (direction === 'up') return a.r - b.r;
        return b.r - a.r; 
      };
      
      const changes: Tile[] = []; 
      
      const processLine = (group: Tile[]) => {
         const stack: Tile[] = [];
         for (let tile of group) {
             const last = stack.length > 0 ? stack[stack.length - 1] : null;
             if (last && !last.isMerging && !last.toDelete && last.val === tile.val) {
                 tile.r = last.r;
                 tile.c = last.c;
                 tile.toDelete = true;
                 changes.push(tile); 
                 last.val *= 2;
                 last.isMerging = true;
                 scoreAdd += last.val;
                 if (last.val === 2048) won = true;
                 moved = true;
             } else {
                 let nextPos = stack.length;
                 if (direction === 'right' || direction === 'down') nextPos = 3 - stack.length;
                 const targetR = (direction === 'left' || direction === 'right') ? tile.r : nextPos;
                 const targetC = (direction === 'left' || direction === 'right') ? nextPos : tile.c;
                 if (tile.r !== targetR || tile.c !== targetC) {
                     tile.r = targetR;
                     tile.c = targetC;
                     moved = true;
                 }
                 stack.push(tile);
                 changes.push(tile);
             }
         }
      };

      if (direction === 'left' || direction === 'right') {
          for(let r=0; r<BOARD_SIZE; r++) processLine(newTiles.filter(t => t.r === r).sort(sortFn));
      } else {
          for(let c=0; c<BOARD_SIZE; c++) processLine(newTiles.filter(t => t.c === c).sort(sortFn));
      }

      if (moved) {
          setIsAnimating(true);
          setScore(s => s + scoreAdd);
          if (won && !hasWon) setHasWon(true);
          setTimeout(() => {
              setTiles(prev => {
                  const cleaned = prev.filter(t => !t.toDelete);
                  const withNew = [...cleaned, createRandomTile(cleaned)];
                  // Check game over
                  if (withNew.length === 16) {
                      // simple check
                      let canMove = false;
                      for(let r=0; r<4; r++) {
                          for(let c=0; c<4; c++) {
                             const curr = withNew.find(t=>t.r===r && t.c===c);
                             const right = withNew.find(t=>t.r===r && t.c===c+1);
                             const down = withNew.find(t=>t.r===r+1 && t.c===c);
                             if (curr && right && curr.val === right.val) canMove = true;
                             if (curr && down && curr.val === down.val) canMove = true;
                          }
                      }
                      if (!canMove) setGameOver(true);
                  }
                  return withNew;
              });
              setIsAnimating(false);
          }, 150); 
          return changes;
      }
      return prevTiles;
    });
  }, [gameOver, hasWon, keepPlaying, isAnimating]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD'].includes(code)) {
        e.preventDefault();
      }

      if (code === 'ArrowUp' || code === 'KeyW') move('up');
      if (code === 'ArrowDown' || code === 'KeyS') move('down');
      if (code === 'ArrowLeft' || code === 'KeyA') move('left');
      if (code === 'ArrowRight' || code === 'KeyD') move('right');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  const getTileColor = (val: number) => {
    // Sakura Theme Override
    if (isSakura) {
        const sakuraColors: {[key:number]:string} = {
            2: 'bg-pink-100 text-pink-800', 4: 'bg-pink-200 text-pink-800',
            8: 'bg-pink-300 text-white', 16: 'bg-pink-400 text-white',
            32: 'bg-rose-400 text-white', 64: 'bg-rose-500 text-white',
            128: 'bg-rose-600 text-white', 256: 'bg-red-400 text-white',
            512: 'bg-red-500 text-white', 1024: 'bg-red-600 text-white', 2048: 'bg-yellow-400 text-white'
        };
        return sakuraColors[val] || 'bg-black text-white';
    }

    const colors: {[key:number]:string} = {
      2: 'bg-[#eee4da] text-[#776e65]', 4: 'bg-[#ede0c8] text-[#776e65]',
      8: 'bg-[#f2b179] text-white', 16: 'bg-[#f59563] text-white', 32: 'bg-[#f67c5f] text-white', 64: 'bg-[#f65e3b] text-white',
      128: 'bg-[#edcf72] text-white', 256: 'bg-[#edcc61] text-white', 512: 'bg-[#edc850] text-white', 1024: 'bg-[#edc53f] text-white', 2048: 'bg-[#edc22e] text-white'
    };
    return colors[val] || 'bg-[#3c3a32] text-white';
  };

  const getPosition = (index: number) => `calc(1.5% + ${index * 24.625}%)`;

  return (
    <div className="flex flex-col items-center w-full max-w-[500px] px-4 select-none relative">
      <div className="w-full flex justify-between items-center mb-6">
        <div className={`px-6 py-3 rounded-xl border shadow-lg ${isSakura ? 'bg-pink-900/50 border-pink-500/30' : 'bg-panel border-white/5'}`}>
           <span className={`text-xs font-bold uppercase tracking-wider block mb-1 ${isSakura ? 'text-pink-300' : 'text-textMuted'}`}>Score</span>
           <span className="text-2xl font-bold text-white">{score}</span>
        </div>
        <button onClick={startNewGame} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-4 py-3 rounded-xl transition-colors flex items-center gap-2">
          <RefreshCw size={20}/>
        </button>
      </div>

      <div className={`relative rounded-xl w-full aspect-square overflow-hidden shadow-2xl ${isSakura ? 'bg-pink-200' : 'bg-[#bbada0]'}`}>
        <div className="absolute inset-0 p-[1.5%] grid grid-cols-4 grid-rows-4 gap-[1.5%]">
            {Array.from({length: 16}).map((_, i) => (
                <div key={i} className={`rounded-lg w-full h-full ${isSakura ? 'bg-pink-300/50' : 'bg-[#cdc1b4]'}`} />
            ))}
        </div>
        <AnimatePresence>
            {tiles.map(tile => (
                <motion.div
                    key={`${tile.id}`} 
                    initial={tile.isNew ? { scale: 0, opacity: 0 } : false}
                    animate={{ 
                        left: getPosition(tile.c),
                        top: getPosition(tile.r),
                        scale: tile.isMerging ? [1, 1.15, 1] : 1,
                        opacity: tile.toDelete ? 0 : 1, 
                        zIndex: tile.toDelete ? 0 : 10 
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 35, duration: 0.15 }}
                    className={`absolute w-[23.125%] h-[23.125%] rounded-lg flex items-center justify-center font-bold text-3xl md:text-4xl shadow-sm ${getTileColor(tile.val)}`}
                >
                    {tile.val}
                </motion.div>
            ))}
        </AnimatePresence>
        {(gameOver || (hasWon && !keepPlaying)) && (
            <div className="absolute inset-0 bg-[#edc22e]/90 z-20 flex flex-col items-center justify-center text-white animate-in fade-in duration-300 backdrop-blur-sm">
                <h2 className="text-4xl font-bold mb-4 drop-shadow-md">{hasWon ? 'You Won!' : 'Game Over'}</h2>
                <div className="flex gap-4">
                     <button onClick={startNewGame} className="px-6 py-3 bg-white text-[#776e65] font-bold rounded-lg shadow-lg hover:scale-105 transition-transform">Try Again</button>
                     {hasWon && (
                        <button onClick={() => setKeepPlaying(true)} className="px-6 py-3 border-2 border-white font-bold rounded-lg hover:bg-white/10 transition-colors">Continue</button>
                     )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

/* ==========================================
   GAME: Snake (Scaled Up)
   ========================================== */
export const SnakeGame: React.FC<{theme?: ThemeType}> = ({theme = 'default'}) => {
    const GRID_SIZE = 20;
    const [snake, setSnake] = useState<{x:number,y:number}[]>([
        {x:10,y:10}, {x:9,y:10}, {x:8,y:10}, {x:7,y:10}
    ]);
    const [food, setFood] = useState({x:15, y:15});
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [isPaused, setIsPaused] = useState(true);
    
    const directionRef = useRef({x:1, y:0});
    const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isSakura = theme === 'sakura';

    const spawnFood = useCallback(() => {
        let newFood = { x: 0, y: 0 }; // Исправлено: инициализация переменной
        while(true) {
            newFood = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE)
            };
            // eslint-disable-next-line
            if (!snake.some(s => s.x === newFood.x && s.y === newFood.y)) break;
        }
        setFood(newFood);
    }, [snake]);

    const resetGame = () => {
        setSnake([{x:10,y:10}, {x:9,y:10}, {x:8,y:10}, {x:7,y:10}]);
        directionRef.current = {x:1, y:0};
        setScore(0);
        setGameOver(false);
        setIsPaused(false);
        spawnFood();
    };

    const moveSnake = useCallback(() => {
        if (gameOver || isPaused) return;
        if (directionRef.current.x === 0 && directionRef.current.y === 0) return;

        setSnake(prev => {
            const head = { ...prev[0] };
            head.x += directionRef.current.x;
            head.y += directionRef.current.y;

            if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
                setGameOver(true);
                return prev;
            }
            if (prev.some(s => s.x === head.x && s.y === head.y)) {
                setGameOver(true);
                return prev;
            }

            const newSnake = [head, ...prev];
            if (head.x === food.x && head.y === food.y) {
                setScore(s => s + 1);
                spawnFood();
            } else {
                newSnake.pop();
            }
            return newSnake;
        });
    }, [food, gameOver, isPaused, spawnFood]);

    useEffect(() => {
        if (!isPaused && !gameOver) {
            gameLoopRef.current = setInterval(moveSnake, 130);
        } else if (gameLoopRef.current) {
            clearInterval(gameLoopRef.current);
        }
        return () => {
            if (gameLoopRef.current) clearInterval(gameLoopRef.current);
        };
    }, [moveSnake, isPaused, gameOver]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            const code = e.code;
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyS','KeyA','KeyD'].includes(code)) {
                e.preventDefault();
            }

            const cur = directionRef.current;
            if (code === 'ArrowUp' || code === 'KeyW') { if(cur.y !== 1) directionRef.current = {x:0, y:-1}; setIsPaused(false); }
            if (code === 'ArrowDown' || code === 'KeyS') { if(cur.y !== -1) directionRef.current = {x:0, y:1}; setIsPaused(false); }
            if (code === 'ArrowLeft' || code === 'KeyA') { if(cur.x !== 1) directionRef.current = {x:-1, y:0}; setIsPaused(false); }
            if (code === 'ArrowRight' || code === 'KeyD') { if(cur.x !== -1) directionRef.current = {x:1, y:0}; setIsPaused(false); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    const getHeadRotation = () => {
        const d = directionRef.current;
        if(d.y === -1) return '0deg';
        if(d.x === 1) return '90deg';
        if(d.y === 1) return '180deg';
        if(d.x === -1) return '-90deg';
        return '90deg';
    };

    return (
        <div className="flex flex-col items-center w-full max-w-[550px]">
            <div className="w-full flex justify-between items-center mb-4 px-4">
                <div className="flex flex-col">
                    <span className="text-xs text-textMuted font-bold uppercase">Score</span>
                    <span className="text-2xl font-bold text-white">{score}</span>
                </div>
                <button onClick={resetGame} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><RefreshCw size={20}/></button>
            </div>
            <div className={`relative border-2 rounded-xl overflow-hidden shadow-2xl aspect-square w-full ${isSakura ? 'bg-pink-50 border-pink-300' : 'bg-[#1a1c29] border-[#373952]'}`}>
                <div 
                    className="w-full h-full grid opacity-10"
                    style={{ 
                        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                        gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
                    }}
                >
                    {Array.from({length: GRID_SIZE*GRID_SIZE}).map((_, i) => (
                        <div key={i} className={`border-[0.5px] border-white/5 ${(Math.floor(i/GRID_SIZE)+i)%2===0 ? (isSakura ? 'bg-pink-400/10' : 'bg-white/5') : ''}`} />
                    ))}
                </div>
                
                {snake.map((segment, i) => {
                    const isHead = i === 0;
                    return (
                        <div 
                            key={i}
                            className={`absolute ${isHead ? 'z-20' : 'z-10'}`}
                            style={{
                                left: `${(segment.x / GRID_SIZE) * 100}%`,
                                top: `${(segment.y / GRID_SIZE) * 100}%`,
                                width: `${100/GRID_SIZE}%`,
                                height: `${100/GRID_SIZE}%`,
                            }}
                        >
                            <div className={`w-[90%] h-[90%] m-[5%] rounded-md shadow-sm relative ${
                                isHead 
                                    ? (isSakura ? 'bg-pink-500' : 'bg-green-400') 
                                    : (isSakura ? 'bg-pink-400' : 'bg-green-600')
                                }`}>
                                {isHead && (
                                    <div 
                                        className="absolute inset-0 flex justify-around items-start pt-[10%]" 
                                        style={{ transform: `rotate(${getHeadRotation()})` }}
                                    >
                                        <div className="w-[20%] h-[20%] bg-black rounded-full" />
                                        <div className="w-[20%] h-[20%] bg-black rounded-full" />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                <div 
                    className="absolute z-10 flex items-center justify-center"
                    style={{
                        left: `${(food.x / GRID_SIZE) * 100}%`,
                        top: `${(food.y / GRID_SIZE) * 100}%`,
                        width: `${100/GRID_SIZE}%`,
                        height: `${100/GRID_SIZE}%`,
                    }}
                >
                    <div className="w-[80%] h-[80%] bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.6)] relative">
                         <div className="absolute -top-[15%] left-1/2 w-[2px] h-[30%] bg-amber-800 -rotate-12 origin-bottom"/>
                         <div className="absolute -top-[5%] left-[60%] w-[40%] h-[20%] bg-green-500 rounded-full -rotate-45"/>
                    </div>
                </div>

                {gameOver && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 backdrop-blur-sm animate-in fade-in">
                        <h2 className="text-3xl font-bold text-red-500 mb-2">Game Over</h2>
                        <div className="text-xl text-white mb-6">Score: {score}</div>
                        <button onClick={resetGame} className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:scale-105 transition-transform shadow-lg">Try Again</button>
                    </div>
                )}
                {isPaused && !gameOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/20">
                        <div className="px-4 py-2 bg-black/50 rounded-lg backdrop-blur text-white/90 text-sm font-bold uppercase tracking-widest border border-white/10">
                            Press Arrows / WASD to Start
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ==========================================
   GAME: Dino Run (Authentic Blocky Style)
   ========================================== */
export const DinoGame: React.FC<{theme?: ThemeType}> = ({theme = 'default'}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameState = useRef({
      isPlaying: false,
      gameSpeed: 4,
      score: 0,
      dino: { x: 50, y: 0, vy: 0, w: 40, h: 44, grounded: true, ducking: false, legOffset: 0 },
      obstacles: [] as {x:number, y:number, w:number, h:number, type: 'cactus'|'bird'}[]
  });
  const reqRef = useRef<number>(0);
  const isSakura = theme === 'sakura';

  const drawDino = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ducking: boolean, legOffset: number) => {
     ctx.fillStyle = isSakura ? '#be185d' : '#535353'; // Pink or Dark Grey

     // "Pixel" size helper
     const p = 4; 

     if (ducking) {
         // DUCKING SPRITE (Flatter)
         // Body (Long horizontal)
         ctx.fillRect(x, y + 20, 50, 15);
         
         // Head (Lowered, sticking out)
         ctx.fillRect(x + 50, y + 20, 16, 15);
         // Jaw gap
         ctx.clearRect(x + 50, y + 28, 8, 2);

         // Eye (White hole)
         ctx.fillStyle = isSakura ? '#fce7f3' : '#1a1c29'; 
         ctx.fillRect(x + 54, y + 22, 2, 2);
         ctx.fillStyle = isSakura ? '#be185d' : '#535353';
         
         // Feet Animation
         const tick = Math.floor(legOffset / 6) % 2 === 0;
         if (tick) ctx.fillRect(x + 15, y + 35, 10, 4);
         else ctx.fillRect(x + 35, y + 35, 10, 4);

     } else {
         // STANDING T-REX SPRITE (Authentic Blocky Construction)

         // 1. Head (Top Box)
         ctx.fillRect(x + 20, y, 20, 12); // Skull
         ctx.fillRect(x + 20, y + 12, 12, 8); // Cheek
         ctx.fillRect(x + 32, y + 16, 8, 4); // Lower Jaw

         // Eye (White pixel)
         ctx.fillStyle = isSakura ? '#fce7f3' : '#1a1c29';
         ctx.fillRect(x + 24, y + 4, 4, 4);
         ctx.fillStyle = isSakura ? '#be185d' : '#535353';

         // 2. Neck
         ctx.fillRect(x + 16, y + 14, 4, 10);

         // 3. Body (Main Block)
         ctx.fillRect(x, y + 20, 24, 18);
         // Chest Bump
         ctx.fillRect(x + 20, y + 24, 4, 8);

         // 4. Tail (Stepped back)
         ctx.fillRect(x - 4, y + 16, 4, 12);
         ctx.fillRect(x - 8, y + 12, 4, 8);
         ctx.fillRect(x - 12, y + 8, 4, 6);

         // 5. Arm (Tiny block)
         ctx.fillRect(x + 26, y + 26, 4, 2);
         ctx.fillRect(x + 30, y + 28, 2, 2);

         // 6. Legs (Animated)
         const tick = Math.floor(legOffset / 6) % 2 === 0;
         
         // Left Leg
         if (tick) {
             ctx.fillRect(x + 4, y + 38, 4, 6); 
             ctx.fillRect(x + 4, y + 44, 6, 2); // Foot
         } else {
             ctx.fillRect(x + 4, y + 36, 4, 4); // Raised
         }
         
         // Right Leg
         if (!tick) {
             ctx.fillRect(x + 18, y + 38, 4, 6); 
             ctx.fillRect(x + 18, y + 44, 6, 2); // Foot
         } else {
             ctx.fillRect(x + 18, y + 36, 4, 4); // Raised
         }
     }
  };

  const drawCactus = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
     ctx.fillStyle = isSakura ? '#064e3b' : '#535353'; 
     // Main stem
     ctx.fillRect(x + w/3, y, w/3, h);
     // Arms (Blocky)
     ctx.fillRect(x, y + h/3, w/3, 4);
     ctx.fillRect(x, y + h/6, 4, h/6 + 4);
     
     ctx.fillRect(x + 2*w/3, y + h/2, w/3, 4);
     ctx.fillRect(x + w - 4, y + h/4, 4, h/4 + 4);
  };

  const start = () => {
      const groundY = 250 - 20; 
      gameState.current = {
        isPlaying: true,
        gameSpeed: 4,
        score: 0,
        dino: { x: 50, y: groundY - 44, vy: 0, w: 40, h: 44, grounded: true, ducking: false, legOffset: 0 },
        obstacles: []
      };
      cancelAnimationFrame(reqRef.current);
      reqRef.current = requestAnimationFrame(loop);
  };

  const loop = (time: number) => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      if (!gameState.current.isPlaying) return;

      const state = gameState.current;
      state.score += 0.1;
      state.gameSpeed += 0.001;
      state.dino.legOffset++;
      
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;
      const groundLevel = height - 20;

      ctx.fillStyle = isSakura ? '#fce7f3' : '#1a1c29'; // Background
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = isSakura ? '#db2777' : '#535353'; // Ground
      ctx.fillRect(0, groundLevel, width, 2); 

      const dino = state.dino;
      if (!dino.grounded) {
          dino.vy += 0.6;
          dino.y += dino.vy;
      }
      
      const dinoBottom = groundLevel - (dino.ducking ? 25 : dino.h);
      
      if (dino.y >= dinoBottom) {
          dino.y = dinoBottom;
          dino.vy = 0;
          dino.grounded = true;
      } else {
          dino.grounded = false; 
      }

      drawDino(ctx, dino.x, dino.y, dino.w, dino.h, dino.ducking, dino.legOffset);

      if (Math.random() < 0.015 && (state.obstacles.length === 0 || width - state.obstacles[state.obstacles.length-1].x > 400)) {
          const isBird = Math.random() > 0.85 && state.score > 50; 
          state.obstacles.push({
              x: width,
              y: isBird ? groundLevel - 50 : groundLevel - (30 + Math.random() * 15),
              w: isBird ? 30 : 20 + Math.random() * 15,
              h: isBird ? 20 : 30 + Math.random() * 20,
              type: isBird ? 'bird' : 'cactus'
          });
      }

      for (let i = 0; i < state.obstacles.length; i++) {
          let obs = state.obstacles[i];
          obs.x -= state.gameSpeed;
          
          if (obs.type === 'bird') {
              ctx.fillStyle = isSakura ? '#be185d' : '#535353';
              // Blocky Bird
              ctx.fillRect(obs.x, obs.y + 10, obs.w, 10); // Body
              ctx.fillRect(obs.x + 10, obs.y, 10, 20); // Wings
          } else {
              drawCactus(ctx, obs.x, obs.y, obs.w, obs.h);
          }

          const dinoBox = {
              x: dino.x + 10,
              y: dino.ducking ? dino.y + 15 : dino.y + 5,
              w: dino.ducking ? 40 : dino.w - 15,
              h: dino.ducking ? 20 : dino.h - 10
          };

          if (
              dinoBox.x < obs.x + obs.w &&
              dinoBox.x + dinoBox.w > obs.x &&
              dinoBox.y < obs.y + obs.h &&
              dinoBox.y + dinoBox.h > obs.y
          ) {
              state.isPlaying = false;
              ctx.fillStyle = 'rgba(0,0,0,0.7)';
              ctx.fillRect(0,0,width,height);
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 30px monospace';
              ctx.fillText("GAME OVER", width/2 - 90, height/2);
              ctx.font = '16px monospace';
              ctx.fillText("Press Space to Restart", width/2 - 95, height/2 + 35);
              return;
          }
      }
      state.obstacles = state.obstacles.filter(o => o.x + o.w > 0);
      
      ctx.fillStyle = isSakura ? '#be185d' : '#fff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`HI ${Math.floor(state.score).toString().padStart(5, '0')}`, width - 150, 40);

      reqRef.current = requestAnimationFrame(loop);
  };
  
  const jump = () => {
      const dino = gameState.current.dino;
      if (dino.grounded) {
          dino.vy = -12; 
          dino.grounded = false;
      }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
        const code = e.code;
        if (['ArrowUp','ArrowDown','Space','KeyW','KeyS'].includes(code)) e.preventDefault();

        if ((code === 'Space' || code === 'ArrowUp' || code === 'KeyW') && !gameState.current.isPlaying) {
             start();
             return;
        }
        if (!gameState.current.isPlaying) {
            if (code === 'KeyR') start();
            return;
        }

        if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') jump();
        if (code === 'ArrowDown' || code === 'KeyS') gameState.current.dino.ducking = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        const code = e.code;
        if (code === 'ArrowDown' || code === 'KeyS') gameState.current.dino.ducking = false;
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    
    setTimeout(() => {
        if(canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if(ctx) {
                ctx.fillStyle = isSakura ? '#fce7f3' : '#1a1c29';
                ctx.fillRect(0,0,canvasRef.current.width, canvasRef.current.height);
                ctx.fillStyle = isSakura ? '#be185d' : '#fff';
                ctx.font = '20px monospace';
                ctx.fillText("Press SPACE to Jump", 200, 130);
                drawDino(ctx, 50, 250 - 20 - 44, 40, 44, false, 0);
                ctx.fillStyle = isSakura ? '#db2777' : '#535353';
                ctx.fillRect(0, 250 - 20, 600, 2);
            }
        }
    }, 100);

    return () => {
        window.removeEventListener('keydown', handleKey);
        window.removeEventListener('keyup', handleKeyUp);
        cancelAnimationFrame(reqRef.current);
    };
  }, [theme]);

  return (
    <canvas 
        ref={canvasRef} 
        width={600} 
        height={250} 
        className={`rounded-xl border shadow-2xl cursor-pointer w-full h-full object-contain max-w-[900px] ${isSakura ? 'border-pink-300 bg-pink-50' : 'border-white/10 bg-[#1a1c29]'}`}
        onClick={start}
    />
  );
};

/* ==========================================
   GAME: Clicker
   ========================================== */
export const ClickerGame: React.FC<{onEarnCoins: (amount: number) => void}> = ({onEarnCoins}) => {
  const [count, setCount] = useState(0);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [rank, setRank] = useState('Beginner');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
      return () => {
          if (timerRef.current) clearInterval(timerRef.current);
      };
  }, []);

  const startGame = () => {
      setCount(0);
      setLevel(1);
      setTimeLeft(60);
      setIsPlaying(true);
      setShowResult(false);
      setRank('Beginner');
      
      timerRef.current = setInterval(() => {
          setTimeLeft(prev => {
              if (prev <= 1) {
                  endGame();
                  return 0;
              }
              return prev - 1;
          });
      }, 1000);
  };

  const endGame = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
      setShowResult(true);
      
      // Calculate Reward
      let reward = 0;
      let finalRank = 'Начинающий';
      if (count > 100) { reward = 50; finalRank = 'Любитель'; }
      if (count > 300) { reward = 150; finalRank = 'Быстрые пальчики'; }
      if (count > 500) { reward = 300; finalRank = 'Бог клика'; }
      
      setRank(finalRank);
      if (reward > 0) onEarnCoins(reward);
  };
  
  const handleClick = () => {
      if (!isPlaying) return;
      setCount(prev => prev + 1);
  };

  if (showResult) {
      return (
          <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in">
              <h2 className="text-3xl font-bold text-yellow-400">Time's Up!</h2>
              <div className="text-xl">Total Clicks: <span className="font-bold text-white">{count}</span></div>
              <div className="text-lg text-textMuted">Rank: <span className="text-blue-400 font-bold">{rank}</span></div>
              <button 
                  onClick={startGame}
                  className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl shadow-lg transition-transform hover:scale-105"
              >
                  Play Again
              </button>
          </div>
      );
  }

  return (
      <div className="flex flex-col items-center gap-6">
          {!isPlaying ? (
              <div className="flex flex-col items-center gap-4">
                  <h2 className="text-2xl font-bold text-white">Ready?</h2>
                  <p className="text-textMuted text-center max-w-md">You have 60 seconds to click as fast as you can. Reach higher scores to earn coins!</p>
                  <button 
                      onClick={startGame}
                      className="px-8 py-4 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105"
                  >
                      START
                  </button>
              </div>
          ) : (
              <>
                <div className="flex justify-between w-full max-w-md px-4">
                    <div className="flex flex-col items-center">
                        <span className="text-xs text-textMuted uppercase">Time</span>
                        <span className={`text-2xl font-bold ${timeLeft < 10 ? 'text-red-500' : 'text-white'}`}>{timeLeft}s</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-xs text-textMuted uppercase">Clicks</span>
                        <span className="text-2xl font-bold text-white">{count}</span>
                    </div>
                </div>
                
                <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={handleClick}
                    className="w-48 h-48 rounded-full bg-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.5)] border-8 border-yellow-300 flex items-center justify-center text-4xl font-black text-yellow-900 active:bg-yellow-600 transition-colors select-none"
                >
                    CLICK!
                </motion.button>
              </>
          )}
      </div>
  );
};

/* ==========================================
   GAME: Minesweeper
   ========================================== */
export const MinesweeperGame: React.FC = () => {
  const ROWS = 10;
  const COLS = 10;
  const MINES = 15;
  
  type Cell = { r: number, c: number, isMine: boolean, isRevealed: boolean, isFlagged: boolean, neighborMines: number };
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [firstClick, setFirstClick] = useState(true);

  useEffect(() => { initGame(); }, []);

  const initGame = () => {
      let newGrid: Cell[][] = [];
      for(let r=0; r<ROWS; r++){
          const row: Cell[] = [];
          for(let c=0; c<COLS; c++){
              row.push({r,c,isMine:false,isRevealed:false,isFlagged:false,neighborMines:0});
          }
          newGrid.push(row);
      }
      // Note: Mines are now placed on first click to guarantee safety
      setGrid(newGrid);
      setGameOver(false);
      setWin(false);
      setFirstClick(true);
  };

  const reveal = (r: number, c: number) => {
      if(gameOver || win || grid[r][c].isFlagged || grid[r][c].isRevealed) return;
      
      const newGrid = grid.map(row => row.map(cell => ({...cell})));
      
      if (firstClick) {
          setFirstClick(false);
          // Place Mines now
          let minesPlaced = 0;
          while(minesPlaced < MINES) {
              const mr = Math.floor(Math.random() * ROWS);
              const mc = Math.floor(Math.random() * COLS);
              
              // Ensure safe zone (clicked cell + neighbors)
              if (Math.abs(mr - r) <= 1 && Math.abs(mc - c) <= 1) continue;

              if(!newGrid[mr][mc].isMine) {
                  newGrid[mr][mc].isMine = true;
                  minesPlaced++;
              }
          }

          // Calculate numbers
          for(let i=0; i<ROWS; i++){
              for(let j=0; j<COLS; j++){
                  if(newGrid[i][j].isMine) continue;
                  let count = 0;
                  for(let di=-1; di<=1; di++){
                      for(let dj=-1; dj<=1; dj++){
                          if(i+di>=0 && i+di<ROWS && j+dj>=0 && j+dj<COLS && newGrid[i+di][j+dj].isMine) count++;
                      }
                  }
                  newGrid[i][j].neighborMines = count;
              }
          }
      }

      if(newGrid[r][c].isMine) {
          newGrid[r][c].isRevealed = true;
          setGrid(newGrid);
          setGameOver(true);
          return;
      }

      const floodFill = (currR: number, currC: number) => {
          if(currR<0 || currR>=ROWS || currC<0 || currC>=COLS || newGrid[currR][currC].isRevealed || newGrid[currR][currC].isFlagged) return;
          newGrid[currR][currC].isRevealed = true;
          if(newGrid[currR][currC].neighborMines === 0) {
              for(let i=-1; i<=1; i++)
                  for(let j=-1; j<=1; j++)
                      floodFill(currR+i, currC+j);
          }
      };
      
      floodFill(r,c);
      setGrid(newGrid);

      // Check Win
      const unrevealedSafe = newGrid.flat().filter(cell => !cell.isMine && !cell.isRevealed).length;
      if(unrevealedSafe === 0) setWin(true);
  };

  const toggleFlag = (e: React.MouseEvent, r: number, c: number) => {
      e.preventDefault();
      if(gameOver || win || grid[r][c].isRevealed) return;
      const newGrid = [...grid.map(row => [...row])];
      newGrid[r][c].isFlagged = !newGrid[r][c].isFlagged;
      setGrid(newGrid);
  }

  return (
      <div className="flex flex-col items-center">
          <div className="mb-4 flex gap-4">
               <button onClick={initGame} className="p-2 bg-white/10 rounded-full"><RefreshCw size={20}/></button>
               {gameOver && <span className="text-red-500 font-bold text-xl drop-shadow-md">GAME OVER</span>}
               {win && <span className="text-green-500 font-bold text-xl drop-shadow-md">YOU WIN!</span>}
          </div>
          <div className="grid gap-[2px] bg-black/40 p-[4px] rounded-lg border-4 border-slate-700 shadow-2xl" style={{ gridTemplateColumns: `repeat(${COLS}, 40px)` }}>
              {grid.map((row, r) => row.map((cell, c) => (
                  <div 
                      key={`${r}-${c}`}
                      onClick={() => reveal(r,c)}
                      onContextMenu={(e) => toggleFlag(e,r,c)}
                      className={`
                          w-[40px] h-[40px] flex items-center justify-center font-black cursor-pointer select-none transition-all duration-75
                          ${cell.isRevealed 
                              ? (cell.isMine ? 'bg-red-500 border border-red-700 shadow-inner' : 'bg-[#e2e8f0] border border-[#cbd5e1]') 
                              : 'bg-slate-600 border-t-4 border-l-4 border-slate-500 border-b-4 border-r-4 border-slate-800 hover:bg-slate-500 shadow-sm active:border-none active:bg-slate-700'}
                          ${!cell.isRevealed ? 'text-white' : 'text-2xl'}
                      `}
                  >
                      {cell.isRevealed && cell.isMine && <Bomb size={28} className="text-black drop-shadow-md"/>}
                      {cell.isRevealed && !cell.isMine && cell.neighborMines > 0 && <span className="drop-shadow-sm" style={{color: ['#2563eb','#16a34a','#dc2626','#9333ea','#ea580c', '#0891b2', '#000'][cell.neighborMines-1] || 'black'}}>{cell.neighborMines}</span>}
                      {!cell.isRevealed && cell.isFlagged && <Flag size={24} className="text-red-500 fill-red-500 drop-shadow-md"/>}
                  </div>
              )))}
          </div>
      </div>
  );
};

/* ==========================================
   GAME: Checkers (Simple Version)
   ========================================== */
export const CheckersGame: React.FC = () => {
    // 8x8 Board
    // 0: empty, 1: red, 2: white, 3: red king, 4: white king
    // Black cells are where pieces go.
    
    type Piece = { player: 'red' | 'white', isKing: boolean } | null;
    type Board = (Piece)[][];

    const [board, setBoard] = useState<Board>([]);
    const [turn, setTurn] = useState<'red'|'white'>('red');
    const [selected, setSelected] = useState<{r:number, c:number} | null>(null);
    const [validMoves, setValidMoves] = useState<{r:number, c:number, isCapture: boolean, mid?: {r:number, c:number}}[]>([]);
    const [mustCaptureWith, setMustCaptureWith] = useState<{r:number, c:number} | null>(null);

    useEffect(() => { initGame(); }, []);

    const initGame = () => {
        const b: Board = Array(8).fill(null).map(() => Array(8).fill(null));
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                if((r+c)%2===1) {
                    if(r<3) b[r][c] = {player: 'white', isKing: false};
                    else if(r>4) b[r][c] = {player: 'red', isKing: false};
                }
            }
        }
        setBoard(b);
        setTurn('red');
        setSelected(null);
        setValidMoves([]);
        setMustCaptureWith(null);
    };

    const getValidMoves = (b: Board, r: number, c: number, piece: Piece) => {
        const moves: {r:number, c:number, isCapture: boolean, mid?: {r:number, c:number}}[] = [];
        if(!piece) return [];
        
        // Directions: Red (-1), White (+1), King (both)
        const dirs = piece.isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : piece.player==='red' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
        // Backward capture for regular pieces
        const capDirs = piece.isKing ? dirs : [[-1,-1],[-1,1],[1,-1],[1,1]];

        // Regular Moves (Only if not in multi-jump sequence)
        if (!mustCaptureWith) {
             dirs.forEach(([dr, dc]) => {
                const nr = r + dr;
                const nc = c + dc;
                if(nr>=0 && nr<8 && nc>=0 && nc<8 && !b[nr][nc]) {
                    moves.push({r:nr, c:nc, isCapture: false});
                }
             });
        }

        // Capture Moves
        capDirs.forEach(([dr, dc]) => {
            const jr = r + dr*2;
            const jc = c + dc*2;
            const mr = r + dr;
            const mc = c + dc;
            
            if(jr>=0 && jr<8 && jc>=0 && jc<8 && !b[jr][jc]) {
                const mid = b[mr][mc];
                if(mid && mid.player !== piece.player) {
                    moves.push({r:jr, c:jc, isCapture: true, mid: {r:mr, c:mc}});
                }
            }
        });

        return moves;
    };

    const handleClick = (r: number, c: number) => {
        const clickedPiece = board[r][c];

        // 1. SELECT PIECE
        if(clickedPiece?.player === turn) {
            // If we are in a multi-jump sequence, only allow selecting the specific piece
            if (mustCaptureWith && (mustCaptureWith.r !== r || mustCaptureWith.c !== c)) return;

            const moves = getValidMoves(board, r, c, clickedPiece);
            
            // If multijump, filter only captures
            if (mustCaptureWith) {
                const captures = moves.filter(m => m.isCapture);
                if (captures.length > 0) {
                    setSelected({r,c});
                    setValidMoves(captures);
                }
            } else {
                setSelected({r,c});
                setValidMoves(moves);
            }
            return;
        }
        
        // 2. MOVE PIECE
        const move = validMoves.find(m => m.r===r && m.c===c);
        if(selected && move) {
            const newBoard = board.map(row => [...row]);
            const piece = newBoard[selected.r][selected.c]!;
            
            // Execute Move
            newBoard[r][c] = piece;
            newBoard[selected.r][selected.c] = null;
            
            // Remove captured
            if (move.isCapture && move.mid) {
                newBoard[move.mid.r][move.mid.c] = null;
            }

            // Promote King
            let promoted = false;
            if(!piece.isKing && ((piece.player==='red' && r===0) || (piece.player==='white' && r===7))) {
                piece.isKing = true;
                promoted = true;
            }

            // Check Multi-Jump
            let canContinue = false;
            if (move.isCapture && !promoted) {
                 const followUpMoves = getValidMoves(newBoard, r, c, piece);
                 if (followUpMoves.some(m => m.isCapture)) {
                     canContinue = true;
                     setBoard(newBoard);
                     setMustCaptureWith({r,c});
                     setSelected({r,c});
                     setValidMoves(followUpMoves.filter(m => m.isCapture));
                     return; // Turn does not change
                 }
            }
            
            // End Turn
            setBoard(newBoard);
            setTurn(turn === 'red' ? 'white' : 'red');
            setSelected(null);
            setValidMoves([]);
            setMustCaptureWith(null);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <div className="mb-4 flex justify-between w-[400px]">
                <span className={`font-bold text-xl ${turn==='red' ? 'text-red-500' : 'text-textMuted'}`}>Red's Turn</span>
                <span className={`font-bold text-xl ${turn==='white' ? 'text-white' : 'text-textMuted'}`}>White's Turn</span>
                <button onClick={initGame}><RefreshCw size={18}/></button>
            </div>
            <div className="grid grid-cols-8 border-[8px] border-[#4a3627] shadow-2xl rounded-sm">
                {board.map((row, r) => row.map((cell, c) => {
                    const isBlack = (r+c)%2===1;
                    const isSelected = selected?.r===r && selected?.c===c;
                    const isValid = validMoves.some(m => m.r===r && m.c===c);
                    
                    return (
                        <div 
                            key={`${r}-${c}`}
                            onClick={() => isBlack && handleClick(r,c)}
                            className={`
                                w-12 h-12 md:w-16 md:h-16 flex items-center justify-center relative
                                ${isBlack ? 'bg-[#704d33]' : 'bg-[#eecfa1]'}
                                ${isValid ? 'after:content-[""] after:absolute after:w-4 after:h-4 after:bg-green-500/80 after:rounded-full after:shadow-[0_0_10px_lime]' : ''}
                            `}
                        >
                            {cell && (
                                <div className={`
                                    w-[80%] h-[80%] rounded-full shadow-[0_4px_6px_rgba(0,0,0,0.6),inset_0_-4px_4px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.3)] 
                                    flex items-center justify-center
                                    ${cell.player === 'red' 
                                        ? 'bg-gradient-to-br from-red-500 to-red-700 ring-1 ring-red-900' 
                                        : 'bg-gradient-to-br from-slate-100 to-slate-300 ring-1 ring-slate-400'}
                                    ${isSelected ? 'ring-4 ring-yellow-400 scale-105 transition-transform' : ''}
                                `}>
                                    {cell.isKing && <Crown size={20} className={cell.player==='red'?'text-red-950':'text-slate-800'} strokeWidth={2.5}/>}
                                </div>
                            )}
                        </div>
                    );
                }))}
            </div>
        </div>
    );
};

/* ==========================================
   GAME: Paint
   ========================================== */
export const PaintGame: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [color, setColor] = useState('#ffffff');
    const [size, setSize] = useState(5);
    const [tool, setTool] = useState<'brush'|'eraser'>('brush');

    const startDraw = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if(!ctx) return;
        
        ctx.beginPath();
        const rect = canvas.getBoundingClientRect();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        
        const draw = (ev: MouseEvent) => {
            ctx.lineTo(ev.clientX - rect.left, ev.clientY - rect.top);
            ctx.strokeStyle = tool === 'eraser' ? '#151621' : color; // Match bg color
            ctx.lineWidth = size;
            ctx.lineCap = 'round';
            ctx.stroke();
        };
        
        const stop = () => {
            window.removeEventListener('mousemove', draw);
            window.removeEventListener('mouseup', stop);
        };
        
        window.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', stop);
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if(!ctx) return;
        ctx.fillStyle = '#151621';
        ctx.fillRect(0,0,canvas.width, canvas.height);
    }

    useEffect(() => {
        clear(); // init bg
    }, []);

    return (
        <div className="flex flex-col items-center gap-4 w-full h-full p-4">
            <div className="flex gap-4 p-2 bg-panel rounded-xl border border-white/10">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer"/>
                <input type="range" min="1" max="20" value={size} onChange={e => setSize(Number(e.target.value))} className="w-24"/>
                <button onClick={() => setTool('brush')} className={`p-1.5 rounded ${tool==='brush' ? 'bg-white/20' : ''}`}><MousePointer2 size={18}/></button>
                <button onClick={() => setTool('eraser')} className={`p-1.5 rounded ${tool==='eraser' ? 'bg-white/20' : ''}`}><Eraser size={18}/></button>
                <button onClick={clear} className="p-1.5 hover:bg-red-500/20 rounded hover:text-red-400"><Trash2 size={18}/></button>
            </div>
            <canvas 
                ref={canvasRef} 
                width={800} 
                height={450} 
                onMouseDown={startDraw}
                className="bg-[#151621] border border-white/10 shadow-xl rounded-xl cursor-crosshair w-full max-w-[800px] touch-none"
            />
        </div>
    );
};

/* ==========================================
   GAME: Tetris (Full Logic Restored)
   ========================================== */
export const TetrisGame: React.FC = () => {
    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 30;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scoreRef = useRef(0);
    
    // Tetromino definitions
    const SHAPES = [
        [[1,1,1,1]], // I
        [[1,1],[1,1]], // O
        [[0,1,1],[1,1,0]], // S
        [[1,1,0],[0,1,1]], // Z
        [[1,0,0],[1,1,1]], // J
        [[0,0,1],[1,1,1]], // L
        [[0,1,0],[1,1,1]], // T
    ];
    const COLORS = ['#06b6d4', '#facc15', '#22c55e', '#ef4444', '#3b82f6', '#f97316', '#a855f7'];

    const gameState = useRef({
        grid: Array(ROWS).fill(null).map(() => Array(COLS).fill(0)),
        piece: { shape: [] as number[][], x: 0, y: 0, color: '' },
        gameOver: false,
        lastTime: 0,
        dropInterval: 500,
        isPaused: false,
        isRunning: false,
        isSoftDrop: false
    });
    
    const reqRef = useRef(0);

    const initPiece = () => {
        const typeIdx = Math.floor(Math.random() * SHAPES.length);
        const shape = SHAPES[typeIdx];
        gameState.current.piece = {
            shape,
            x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
            y: 0,
            color: COLORS[typeIdx]
        };
        // Check immediate collision (Game Over)
        if (checkCollision(0, 0, shape)) {
            gameState.current.gameOver = true;
            gameState.current.isRunning = false;
        }
    };

    const checkCollision = (offX: number, offY: number, shape: number[][]) => {
        const { grid, piece } = gameState.current;
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    const newX = piece.x + x + offX;
                    const newY = piece.y + y + offY;
                    if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && grid[newY][newX])) {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const rotate = () => {
        const { piece } = gameState.current;
        const newShape = piece.shape[0].map((_, i) => piece.shape.map(row => row[i]).reverse());
        if (!checkCollision(0, 0, newShape)) {
            piece.shape = newShape;
        }
    };

    const merge = () => {
        const { grid, piece } = gameState.current;
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    if (piece.y + y >= 0) {
                       grid[piece.y + y][piece.x + x] = piece.color;
                    }
                }
            }
        }
        // Clear lines
        for (let y = ROWS - 1; y >= 0; y--) {
            if (grid[y].every(cell => cell !== 0)) {
                grid.splice(y, 1);
                grid.unshift(Array(COLS).fill(0));
                scoreRef.current += 100;
                y++; 
            }
        }
        initPiece();
    };

    const drop = () => {
        if (checkCollision(0, 1, gameState.current.piece.shape)) {
            merge();
        } else {
            gameState.current.piece.y++;
        }
    };

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Bg
        ctx.fillStyle = '#1a1c29';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid
        const { grid, piece } = gameState.current;
        
        // Draw Stack
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                if (grid[y][x]) {
                    drawBlock(ctx, x, y, grid[y][x]);
                }
            }
        }

        // Draw Ghost Piece
        let ghostY = piece.y;
        while(!checkCollision(0, ghostY - piece.y + 1, piece.shape)) {
            ghostY++;
        }
        ctx.globalAlpha = 0.2;
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    drawBlock(ctx, piece.x + x, ghostY + y, piece.color);
                }
            }
        }
        ctx.globalAlpha = 1.0;

        // Draw Active Piece
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    drawBlock(ctx, piece.x + x, piece.y + y, piece.color);
                }
            }
        }

        if (gameState.current.gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 30px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2);
            ctx.font = '16px sans-serif';
            ctx.fillText("Press R to Restart", canvas.width/2, canvas.height/2 + 30);
        }

        // Score
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${scoreRef.current}`, 20, 30);
    };

    const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
        const bs = BLOCK_SIZE;
        ctx.fillStyle = color;
        ctx.fillRect(x * bs, y * bs, bs, bs);
        
        // Bevel
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x * bs, y * bs, bs, 4);
        ctx.fillRect(x * bs, y * bs, 4, bs);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x * bs + bs - 4, y * bs, 4, bs);
        ctx.fillRect(x * bs, y * bs + bs - 4, bs, 4);
    };

    const loop = (time: number) => {
        if (!gameState.current.isRunning) return;
        
        const delta = time - gameState.current.lastTime;
        const interval = gameState.current.isSoftDrop ? 50 : gameState.current.dropInterval;

        if (delta > interval) {
            drop();
            gameState.current.lastTime = time;
        }

        draw();
        reqRef.current = requestAnimationFrame(loop);
    };

    const startGame = () => {
        gameState.current.grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
        scoreRef.current = 0;
        gameState.current.gameOver = false;
        gameState.current.isRunning = true;
        gameState.current.dropInterval = 500;
        gameState.current.lastTime = performance.now();
        initPiece();
        cancelAnimationFrame(reqRef.current);
        reqRef.current = requestAnimationFrame(loop);
    };

    useEffect(() => {
        startGame();

        const handleKeyDown = (e: KeyboardEvent) => {
            const code = e.code;
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyS','KeyA','KeyD'].includes(code)) {
                e.preventDefault();
            }

            if (gameState.current.gameOver) {
                if (code === 'KeyR') startGame();
                return;
            }

            if (code === 'ArrowLeft' || code === 'KeyA') {
                if (!checkCollision(-1, 0, gameState.current.piece.shape)) gameState.current.piece.x--;
            }
            if (code === 'ArrowRight' || code === 'KeyD') {
                if (!checkCollision(1, 0, gameState.current.piece.shape)) gameState.current.piece.x++;
            }
            if (code === 'ArrowUp' || code === 'KeyW') {
                rotate();
            }
            if (code === 'ArrowDown' || code === 'KeyS') {
                gameState.current.isSoftDrop = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
             const code = e.code;
             if (code === 'ArrowDown' || code === 'KeyS') {
                 gameState.current.isSoftDrop = false;
             }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            cancelAnimationFrame(reqRef.current);
            gameState.current.isRunning = false;
        };
    }, []);

    return (
        <canvas 
            ref={canvasRef} 
            width={COLS * BLOCK_SIZE} 
            height={ROWS * BLOCK_SIZE} 
            className="rounded-lg shadow-2xl border border-white/10"
        />
    );
};

/* ==========================================
   GAME: Solitaire (Klondike)
   ========================================== */
type Card = { suit: 'h'|'d'|'c'|'s', val: number, faceUp: boolean, color: 'red'|'black', id: string };
type Stack = Card[];

export const SolitaireGame: React.FC = () => {
    const [deck, setDeck] = useState<Stack>([]);
    const [waste, setWaste] = useState<Stack>([]);
    const [foundations, setFoundations] = useState<Stack[]>([[],[],[],[]]); // 4 foundations
    const [tableau, setTableau] = useState<Stack[]>([[],[],[],[],[],[],[]]); // 7 cols
    const [selected, setSelected] = useState<{type: 'tableau'|'waste', idx: number, cardIdx?: number} | null>(null);

    useEffect(() => { deal(); }, []);

    const createDeck = () => {
        const suits: ('h'|'d'|'c'|'s')[] = ['h','d','c','s'];
        const d: Stack = [];
        suits.forEach(s => {
            for(let v=1; v<=13; v++) {
                d.push({
                    suit: s, val: v, faceUp: false,
                    color: (s==='h'||s==='d')?'red':'black',
                    id: `${s}${v}`
                });
            }
        });
        // Shuffle
        for(let i=d.length-1; i>0; i--) {
            const j = Math.floor(Math.random()*(i+1));
            [d[i], d[j]] = [d[j], d[i]];
        }
        return d;
    };

    const deal = () => {
        const d = createDeck();
        const t: Stack[] = [[],[],[],[],[],[],[]];
        for(let i=0; i<7; i++) {
            for(let j=0; j<=i; j++) {
                const c = d.pop()!;
                if (j===i) c.faceUp = true;
                t[i].push(c);
            }
        }
        setDeck(d);
        setWaste([]);
        setFoundations([[],[],[],[]]);
        setTableau(t);
        setSelected(null);
    };

    const drawCard = () => {
        if (deck.length === 0) {
            // Recycle waste
            const newDeck = waste.reverse().map(c => ({...c, faceUp: false}));
            setDeck(newDeck);
            setWaste([]);
        } else {
            const c = deck[deck.length-1];
            const newDeck = deck.slice(0, -1);
            const newWaste = [...waste, {...c, faceUp: true}];
            setDeck(newDeck);
            setWaste(newWaste);
        }
        setSelected(null);
    };

    const handleCardClick = (type: 'tableau'|'waste'|'foundation', idx: number, cardIdx?: number) => {
        // SELECT SOURCE
        if (!selected) {
            if (type === 'waste') {
                if (waste.length > 0) setSelected({type: 'waste', idx: 0});
            } else if (type === 'tableau') {
                const stack = tableau[idx];
                if (stack.length > 0 && cardIdx !== undefined) {
                    if (stack[cardIdx].faceUp) setSelected({type: 'tableau', idx, cardIdx});
                    else if (cardIdx === stack.length-1) {
                         // Flip top card if needed (should be auto handled, but just in case)
                         const newTab = [...tableau];
                         newTab[idx][cardIdx].faceUp = true;
                         setTableau(newTab);
                    }
                }
            }
            return;
        }

        // MOVE LOGIC
        if (selected.type === 'waste') {
             const card = waste[waste.length-1];
             if (type === 'tableau') {
                 // Try move waste to tableau
                 const targetStack = tableau[idx];
                 const targetCard = targetStack.length > 0 ? targetStack[targetStack.length-1] : null;
                 
                 if ((!targetCard && card.val === 13) || (targetCard && targetCard.color !== card.color && targetCard.val === card.val + 1)) {
                      setTableau(prev => {
                          const n = [...prev];
                          n[idx].push(card);
                          return n;
                      });
                      setWaste(prev => prev.slice(0, -1));
                      setSelected(null);
                 } else {
                      setSelected(null); // Invalid move deselects
                 }
             } else if (type === 'foundation') {
                 // Try move waste to foundation
                 const targetStack = foundations[idx];
                 const targetCard = targetStack.length > 0 ? targetStack[targetStack.length-1] : null;
                 if ((!targetCard && card.val === 1) || (targetCard && targetCard.suit === card.suit && targetCard.val === card.val - 1)) {
                     setFoundations(prev => {
                         const n = [...prev];
                         n[idx].push(card);
                         return n;
                         });
                     setWaste(prev => prev.slice(0, -1));
                     setSelected(null);
                 } else {
                     setSelected(null);
                 }
             }
        } else if (selected.type === 'tableau') {
             // Moving from Tableau to Tableau
             if (type === 'tableau' && selected.idx !== idx) {
                 const sourceStack = tableau[selected.idx];
                 const movingCards = sourceStack.slice(selected.cardIdx!);
                 const card = movingCards[0];
                 const targetStack = tableau[idx];
                 const targetCard = targetStack.length > 0 ? targetStack[targetStack.length-1] : null;

                 if ((!targetCard && card.val === 13) || (targetCard && targetCard.color !== card.color && targetCard.val === card.val + 1)) {
                     setTableau(prev => {
                         const n = [...prev];
                         n[idx] = [...n[idx], ...movingCards];
                         n[selected.idx] = n[selected.idx].slice(0, selected.cardIdx);
                         if (n[selected.idx].length > 0) n[selected.idx][n[selected.idx].length-1].faceUp = true;
                         return n;
                     });
                     setSelected(null);
                 } else {
                     setSelected(null);
                 }
             }
             // Moving Tableau to Foundation (Only one card allowed)
             else if (type === 'foundation') {
                 const sourceStack = tableau[selected.idx];
                 if (selected.cardIdx === sourceStack.length - 1) { // Only top card
                     const card = sourceStack[sourceStack.length-1];
                     const targetStack = foundations[idx];
                     const targetCard = targetStack.length > 0 ? targetStack[targetStack.length-1] : null;

                     if ((!targetCard && card.val === 1) || (targetCard && targetCard.suit === card.suit && targetCard.val === card.val - 1)) {
                         setFoundations(prev => {
                             const n = [...prev];
                             n[idx].push(card);
                             return n;
                         });
                         setTableau(prev => {
                             const n = [...prev];
                             n[selected.idx].pop();
                             if (n[selected.idx].length > 0) n[selected.idx][n[selected.idx].length-1].faceUp = true;
                             return n;
                         });
                         setSelected(null);
                     } else {
                         setSelected(null);
                     }
                 } else {
                     setSelected(null);
                 }
             } else {
                 setSelected(null); // Clicked same stack or invalid
             }
        }
    };

    const renderCard = (c: Card, onClick?: () => void, isSelected?: boolean) => (
        <div 
            onClick={onClick}
            className={`
                w-[50px] h-[75px] md:w-[60px] md:h-[90px] rounded border border-gray-300 shadow-sm flex items-center justify-center select-none cursor-pointer relative bg-white
                ${isSelected ? 'ring-2 ring-yellow-400 transform -translate-y-2' : ''}
            `}
        >
            {c.faceUp ? (
                <div className={`text-xl font-bold ${c.color === 'red' ? 'text-red-600' : 'text-black'}`}>
                    {['A','2','3','4','5','6','7','8','9','10','J','Q','K'][c.val-1]}
                    <span className="text-sm ml-0.5">
                       {c.suit === 'h' ? '♥' : c.suit === 'd' ? '♦' : c.suit === 'c' ? '♣' : '♠'}
                    </span>
                </div>
            ) : (
                <div className="w-full h-full bg-blue-800 border-2 border-white rounded opacity-90 pattern-grid-lg"></div>
            )}
        </div>
    );

    return (
        <div className="w-full max-w-[700px] flex flex-col items-center">
            <div className="flex justify-between w-full mb-6 px-4">
                <div className="flex gap-4">
                    {/* Deck */}
                    <div onClick={drawCard} className="w-[50px] h-[75px] md:w-[60px] md:h-[90px] border-2 border-dashed border-white/20 rounded flex items-center justify-center cursor-pointer hover:bg-white/5">
                        {deck.length > 0 ? <div className="w-full h-full bg-blue-800 rounded border border-white"></div> : <RefreshCw className="text-white/50"/>}
                    </div>
                    {/* Waste */}
                    <div className="w-[50px] h-[75px] md:w-[60px] md:h-[90px]">
                        {waste.length > 0 && renderCard(waste[waste.length-1], () => handleCardClick('waste', 0), selected?.type === 'waste')}
                    </div>
                </div>
                {/* Foundations */}
                <div className="flex gap-2">
                    {foundations.map((f, i) => (
                        <div key={i} onClick={() => handleCardClick('foundation', i)} className="w-[50px] h-[75px] md:w-[60px] md:h-[90px] border border-white/20 rounded bg-white/5 flex items-center justify-center">
                            {f.length > 0 ? renderCard(f[f.length-1]) : <span className="text-white/20 text-xl">A</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Tableau */}
            <div className="flex justify-between w-full px-2 gap-1">
                {tableau.map((stack, i) => (
                    <div key={i} className="flex flex-col relative min-h-[150px] w-[50px] md:w-[60px]">
                        {stack.length === 0 ? (
                            <div onClick={() => handleCardClick('tableau', i)} className="w-full h-[75px] md:h-[90px] rounded border border-white/10 bg-white/5"></div>
                        ) : (
                            stack.map((c, ci) => (
                                <div key={c.id} className="absolute" style={{ top: `${ci * 25}px` }}>
                                    {renderCard(c, () => handleCardClick('tableau', i, ci), selected?.type==='tableau' && selected.idx===i && selected.cardIdx===ci)}
                                </div>
                            ))
                        )}
                    </div>
                ))}
            </div>
            
            <div className="mt-8">
                <button onClick={deal} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                    <RefreshCw size={16}/> New Deal
                </button>
            </div>
        </div>
    );
};
