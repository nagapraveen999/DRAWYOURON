/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Pencil, 
  Eraser, 
  Trash2, 
  RotateCcw, 
  Maximize, 
  Download,
  Settings2,
  Circle
} from 'lucide-react';

// --- Types ---
interface Point {
  x: number;
  y: number;
  pressure: number;
}

interface Config {
  color: string;
  size: number;
  isEraser: boolean;
  symmetry: number; // 1 = none, 2+ = radial
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [config, setConfig] = useState<Config>({
    color: '#000000',
    size: 4,
    isEraser: false,
    symmetry: 8,
  });
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const lastPoint = useRef<Point | null>(null);
  const lastTime = useRef<number>(0);
  const currentVelocity = useRef<number>(0);

  // --- Canvas Setup & Resize ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      
      // Save content before resize
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCanvas.getContext('2d')?.drawImage(canvas, 0, 0);

      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.drawImage(tempCanvas, 0, 0);
      }
    };

    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  // --- Drawing Logic ---
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 1 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      pressure: 1 // Basic pressure for now
    };
  };

  const drawLine = (start: Point, end: Point, velocity: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    // Calculate dynamic width based on velocity (faster = thinner)
    const baseSize = config.size;
    const velocityFactor = Math.min(velocity * 1.5, baseSize * 0.8);
    const dynamicWidth = config.isEraser ? baseSize * 2 : Math.max(1, baseSize - velocityFactor);

    ctx.beginPath();
    ctx.strokeStyle = config.isEraser ? '#FFFFFF' : config.color;
    ctx.lineWidth = dynamicWidth;
    ctx.globalCompositeOperation = config.isEraser ? 'destination-out' : 'source-over';

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Symmetry Logic
    for (let i = 0; i < config.symmetry; i++) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((i * 2 * Math.PI) / config.symmetry);
      ctx.translate(-centerX, -centerY);

      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      
      // Mirroring within each slice for true Mandala feel
      ctx.translate(centerX, centerY);
      ctx.scale(1, -1);
      ctx.translate(-centerX, -centerY);
      
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      
      ctx.restore();
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    saveToHistory();
    setIsDrawing(true);
    lastPoint.current = getCoordinates(e);
    lastTime.current = Date.now();
    currentVelocity.current = 0;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPoint.current) return;
    
    const currentPoint = getCoordinates(e);
    const now = Date.now();
    
    // Calculate velocity
    const dist = Math.hypot(currentPoint.x - lastPoint.current.x, currentPoint.y - lastPoint.current.y);
    const time = now - lastTime.current;
    const velocity = dist / (time || 1);
    
    // Smooth velocity to avoid jitter
    currentVelocity.current = currentVelocity.current * 0.7 + velocity * 0.3;

    drawLine(lastPoint.current, currentPoint, currentVelocity.current);
    
    lastPoint.current = currentPoint;
    lastTime.current = now;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPoint.current = null;
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    setHistory(prev => [dataUrl, ...prev.slice(0, 9)]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const img = new Image();
    img.src = history[0];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setHistory(prev => prev.slice(1));
    };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'flux-artwork.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="relative w-full h-screen bg-[#F5F5F5] overflow-hidden font-sans selection:bg-none">
      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
      />

      {/* Symmetry Center */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-black/10 rounded-full pointer-events-none transition-opacity duration-500"
        style={{ opacity: isDrawing ? 0 : 1 }}
      />

      {/* Top Header */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-2xl font-light tracking-tighter text-black/80">
            FLUX<span className="font-bold">STUDIO</span>
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-black/40 font-medium">Generative Motion Canvas</p>
        </div>
        
        <div className="flex gap-2 pointer-events-auto">
          <button 
            onClick={undo}
            disabled={history.length === 0}
            className={`p-3 bg-white/80 backdrop-blur-md border border-black/5 rounded-full transition-all duration-300 shadow-sm ${history.length === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black hover:text-white'}`}
          >
            <RotateCcw size={18} />
          </button>
          <button 
            onClick={clearCanvas}
            className="p-3 bg-white/80 backdrop-blur-md border border-black/5 rounded-full hover:bg-black hover:text-white transition-all duration-300 shadow-sm"
          >
            <Trash2 size={18} />
          </button>
          <button 
            onClick={downloadImage}
            className="p-3 bg-white/80 backdrop-blur-md border border-black/5 rounded-full hover:bg-black hover:text-white transition-all duration-300 shadow-sm"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Floating Toolbar */}
      <motion.div 
        initial={{ y: 100, x: '-50%', opacity: 0 }}
        animate={{ y: 0, x: '-50%', opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="absolute bottom-8 left-1/2 flex items-center gap-4 p-2 bg-white/90 backdrop-blur-xl border border-black/5 rounded-3xl shadow-2xl shadow-black/10"
      >
        
        {/* Tool Selection */}
        <div className="flex bg-black/5 p-1 rounded-2xl">
          <button 
            onClick={() => setConfig(prev => ({ ...prev, isEraser: false }))}
            className={`p-3 rounded-xl transition-all ${!config.isEraser ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black'}`}
          >
            <Pencil size={20} />
          </button>
          <button 
            onClick={() => setConfig(prev => ({ ...prev, isEraser: true }))}
            className={`p-3 rounded-xl transition-all ${config.isEraser ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black'}`}
          >
            <Eraser size={20} />
          </button>
        </div>

        <div className="h-8 w-[1px] bg-black/10" />

        {/* Color Picker */}
        <div className="flex gap-2">
          {['#000000', '#FF3B30', '#34C759', '#007AFF', '#FFCC00'].map(c => (
            <button
              key={c}
              onClick={() => setConfig(prev => ({ ...prev, color: c, isEraser: false }))}
              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${config.color === c && !config.isEraser ? 'border-black scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="relative group">
            <input 
              type="color" 
              value={config.color}
              onChange={(e) => setConfig(prev => ({ ...prev, color: e.target.value, isEraser: false }))}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-black/20 flex items-center justify-center group-hover:border-black/40 transition-colors">
              <Settings2 size={14} className="text-black/40" />
            </div>
          </div>
        </div>

        <div className="h-8 w-[1px] bg-black/10" />

        {/* Size Slider */}
        <div className="flex items-center gap-3 px-2">
          <Circle size={config.size + 4} fill="currentColor" className="text-black" />
          <input 
            type="range" 
            min="1" 
            max="40" 
            value={config.size}
            onChange={(e) => setConfig(prev => ({ ...prev, size: parseInt(e.target.value) }))}
            className="w-24 accent-black"
          />
        </div>

        <div className="h-8 w-[1px] bg-black/10" />

        {/* Symmetry Toggle */}
        <div className="flex items-center gap-2 pr-2">
          <span className="text-[10px] font-bold text-black/40 uppercase">Symmetry</span>
          <select 
            value={config.symmetry}
            onChange={(e) => setConfig(prev => ({ ...prev, symmetry: parseInt(e.target.value) }))}
            className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
          >
            <option value={1}>Off</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
            <option value={8}>8x</option>
            <option value={12}>12x</option>
          </select>
        </div>
      </motion.div>

      {/* Hint */}
      <div className="absolute bottom-8 left-8 text-[10px] text-black/30 font-medium uppercase tracking-widest hidden md:block">
        Drag to create generative patterns
      </div>
    </div>
  );
}
