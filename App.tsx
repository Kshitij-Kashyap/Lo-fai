
import React, { useState, useEffect, useRef } from 'react';
import { MoodPreset, TrackMetadata } from './types';
import { generateTrackConcept, generateVoiceIntro } from './services/geminiService';
import { audioEngine } from './services/audioEngine';
import { 
  Play, Pause, SkipForward, Volume2, Search, Music, 
  Heart, Key, Zap, Moon, Sun, CloudRain, Wind, Waves, Bird,
  Mic, MicOff, Menu, History, SlidersHorizontal, X
} from 'lucide-react';

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [currentTrack, setCurrentTrack] = useState<TrackMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isNarrationEnabled, setIsNarrationEnabled] = useState(true);
  const [history, setHistory] = useState<TrackMetadata[]>([]);
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  
  // Sheet States
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isVibeSheetOpen, setIsVibeSheetOpen] = useState(false);
  
  const [ambient, setAmbient] = useState({
    rain: 0,
    wind: 0,
    beach: 0,
    birds: 0
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (volumeRef.current && !volumeRef.current.contains(event.target as Node)) {
        setShowVolumeSlider(false);
      }
    };
    if (showVolumeSlider) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVolumeSlider]);

  useEffect(() => {
    if (currentTrack) {
      const alpha = isDarkMode ? '44' : '66';
      document.documentElement.style.setProperty('--theme-bg', `${currentTrack.color}${alpha}`);
      document.documentElement.style.setProperty('--theme-accent', currentTrack.color);
    }
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [currentTrack, isDarkMode]);

  useEffect(() => {
    handleGenerate(undefined, MoodPreset.CHILL);
  }, []);

  const handleGenerate = async (customPrompt?: string, preset?: MoodPreset) => {
    if (isLoading) return;
    setIsLoading(true);
    setIsVibeSheetOpen(false); // Close mobile sheet on selection
    
    try {
      const track = await generateTrackConcept(customPrompt || prompt, preset);
      setCurrentTrack(track);
      setHistory(prev => {
        if (prev[0]?.id === track.id) return prev;
        return [track, ...prev.slice(0, 15)];
      });
      
      audioEngine.stop();
      audioEngine.setTrack(track);
      
      if (isNarrationEnabled) {
        const introAudio = await generateVoiceIntro(track.introText);
        if (introAudio) audioEngine.playIntro(introAudio);
      }
      
      if (isPlaying) audioEngine.start();
    } catch (error) {
      console.error("Failed to generate track:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
    } else {
      audioEngine.start();
      setIsPlaying(true);
    }
  };

  const updateAmbientVolume = (type: string, value: number) => {
    setAmbient(prev => ({ ...prev, [type]: value }));
    audioEngine.setAmbientVolume(type, value);
  };

  const openKeySelector = async () => {
    try {
      const anyWindow: any = window as any;
      if (anyWindow.aistudio && typeof anyWindow.aistudio.openSelectKey === 'function') {
        await anyWindow.aistudio.openSelectKey();
        return;
      }
    } catch (e) {
      // fallthrough to modal
    }
    const existing = typeof window !== 'undefined' ? window.localStorage.getItem('gemini_api_key') || '' : '';
    setGeminiKeyInput(existing);
    setShowGeminiModal(true);
  };

  useEffect(() => {
    try {
      const k = window.localStorage.getItem('gemini_api_key');
      if (k) setGeminiKeyInput(k);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      const data = audioEngine.getFrequencyData();
      const avgFreq = data.length ? data.reduce((a, b) => a + b) / data.length : 0;
      const intensity = isPlaying ? (avgFreq / 255) : 0;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const cy = h / 2;

      phase += 0.05 + intensity * 0.1;

      const drawWave = (amplitude: number, frequency: number, opacity: number, color: string, offset: number) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = 2 + intensity * 5;
        for (let x = 0; x <= w; x += 2) {
          const normalizedX = x / w;
          const envelope = Math.sin(normalizedX * Math.PI); 
          const y = cy + Math.sin(x * frequency + phase + offset) * amplitude * envelope * (0.5 + intensity * 2);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      const baseColor = currentTrack?.color || '#ff7a7a';
      drawWave(20, 0.01, 0.1, baseColor, 0);
      drawWave(15, 0.015, 0.2, baseColor, 1.2);
      drawWave(25, 0.008, 0.15, isDarkMode ? '#8888aa' : '#3d2e4f', 2.5);
      drawWave(30, 0.005, 0.05, isDarkMode ? '#ffffff' : '#000000', 0.5);
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, currentTrack, isDarkMode]);

  const IOSSlider = ({ value, onChange, icon: Icon, label, accentColor }: { value: number, onChange: (v: number) => void, icon: any, label: string, accentColor?: string }) => {
    const sliderRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
      const relativeY = clientY - rect.top;
      const newValue = Math.max(0, Math.min(1, 1 - (relativeY / rect.height)));
      onChange(newValue);
    };

    return (
      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
        <div 
          ref={sliderRef}
          onMouseDown={(e) => { setIsDragging(true); handleInteraction(e); }}
          onMouseMove={(e) => isDragging && handleInteraction(e)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onTouchStart={(e) => { setIsDragging(true); handleInteraction(e); }}
          onTouchMove={(e) => isDragging && handleInteraction(e)}
          onTouchEnd={() => setIsDragging(false)}
          className="relative w-full h-24 glass rounded-[20px] overflow-hidden cursor-pointer group touch-none select-none border border-white/5"
        >
          <div className="absolute bottom-0 left-0 right-0 bg-white/30 transition-all duration-150 ease-out"
            style={{ height: `${value * 100}%`, backgroundColor: value > 0 ? (accentColor || 'rgba(255,255,255,0.4)') : 'rgba(255,255,255,0.1)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Icon className={`w-4 h-4 transition-all duration-300 ${value > 0 ? 'opacity-100 scale-110 text-white' : 'opacity-20 scale-90'}`} />
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest opacity-30 truncate w-full text-center">{label}</span>
      </div>
    );
  };

  const HistoryPanel = () => (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6 px-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">Library</h3>
        <button onClick={() => setIsHistoryOpen(false)} className="lg:hidden p-2 glass rounded-full opacity-60"><X size={16}/></button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pt-1">
        {history.length === 0 && <p className="text-xs opacity-20 italic p-4 text-center">No tracks yet...</p>}
        {history.map((h, i) => (
          <div key={h.id + i} 
            onClick={() => { if (isLoading) return; setCurrentTrack(h); audioEngine.setTrack(h); }}
            className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all ${currentTrack?.id === h.id ? 'bg-white/10 ring-1 ring-white/10' : 'hover:bg-white/5'}`}>
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0 shadow-sm" style={{ color: h.color }}><Zap className="w-4 h-4 fill-current" /></div>
            <div className="truncate flex-1">
              <p className="text-sm font-bold truncate leading-tight">{h.name}</p>
              <p className="text-[9px] opacity-30 uppercase font-bold tracking-wider">{h.mood.split(' ')[0]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const VibePanel = () => (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-8 px-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">Vibe Controls</h3>
        <button onClick={() => setIsVibeSheetOpen(false)} className="lg:hidden p-2 glass rounded-full opacity-60"><X size={16}/></button>
      </div>
      
      <div className="mb-8 relative">
        <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          placeholder="Describe your vibe..."
          className="w-full glass pill-shape border-none py-3 pl-5 pr-12 text-xs font-bold focus:ring-1 focus:ring-white/10 outline-none transition-all placeholder:opacity-20" />
        <button onClick={() => handleGenerate()} disabled={isLoading} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-40 hover:opacity-100 disabled:opacity-10"><Search className="w-4 h-4" /></button>
      </div>

      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-30 mb-4 px-2">Moods</h3>
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pt-1 pb-6 pr-2">
        {Object.values(MoodPreset).map((preset) => (
          <button key={preset} disabled={isLoading} onClick={() => handleGenerate(undefined, preset)}
            className={`flex items-center gap-4 p-4 rounded-3xl transition-all text-left w-full group border ${currentTrack?.mood === preset ? 'bg-white/10 border-white/10' : 'hover:bg-white/5 border-transparent'} ${isLoading ? 'opacity-40 cursor-wait' : ''}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-white/10">
              <div className={`w-1.5 h-1.5 rounded-full ${currentTrack?.mood === preset ? 'animate-pulse' : 'opacity-20 bg-white'}`} style={{ backgroundColor: currentTrack?.mood === preset ? currentTrack.color : '' }}></div>
            </div>
            <p className={`text-xs font-bold truncate leading-none ${currentTrack?.mood === preset ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}>{preset}</p>
          </button>
        ))}
      </div>
      
      <div className="pt-6 border-t border-white/5 shrink-0">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-30 mb-4 px-2">Ambient Mixer</h3>
        <div className="flex gap-3 px-1">
          <IOSSlider label="Rain" icon={CloudRain} value={ambient.rain} onChange={(v) => updateAmbientVolume('rain', v)} />
          <IOSSlider label="Wind" icon={Wind} value={ambient.wind} onChange={(v) => updateAmbientVolume('wind', v)} />
          <IOSSlider label="Tides" icon={Waves} value={ambient.beach} onChange={(v) => updateAmbientVolume('beach', v)} />
          <IOSSlider label="Birds" icon={Bird} value={ambient.birds} onChange={(v) => updateAmbientVolume('birds', v)} />
        </div>
      </div>
    </div>
  );

  return (
    <div className={`app-container p-4 md:p-6 lg:p-8 ${isDarkMode ? 'dark' : ''}`}>
      
      {/* Background Orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute -top-20 -left-20 w-[40vw] h-[40vw] rounded-full blur-[120px] transition-all duration-1000" style={{ backgroundColor: currentTrack?.color || '#ff7a7a' }} />
        <div className="absolute -bottom-20 -right-20 w-[50vw] h-[50vw] rounded-full blur-[150px] transition-all duration-1000" style={{ backgroundColor: isDarkMode ? '#22233' : '#3d2e4f' }} />
      </div>

      <header className="flex justify-between items-center mb-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 glass rounded-2xl flex items-center justify-center"><Music className="w-6 h-6" style={{ color: currentTrack?.color }} /></div>
          <h1 className="text-xl font-bold tracking-tight">Lo-fAI</h1>
        </div>
        
        <div className="flex items-center gap-2">
           <button onClick={() => setIsHistoryOpen(true)} className="lg:hidden w-10 h-10 glass rounded-full flex items-center justify-center hover:bg-white/20 transition-all"><History className="w-5 h-5 opacity-60" /></button>
           <button onClick={() => setIsVibeSheetOpen(true)} className="lg:hidden w-10 h-10 glass rounded-full flex items-center justify-center hover:bg-white/20 transition-all"><SlidersHorizontal className="w-5 h-5 opacity-60" /></button>
           <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 glass rounded-full flex items-center justify-center hover:bg-white/20 transition-all">
             {isDarkMode ? <Sun className="w-5 h-5 text-yellow-200" /> : <Moon className="w-5 h-5" />}
           </button>
        </div>
      </header>

      {/* Main Unified Container */}
      <div className="flex-1 min-h-0 glass rounded-[48px] overflow-hidden flex relative animate-scale-in">
        
        {/* Mobile Left Sheet (History) */}
        <div className={`fixed inset-0 z-[60] lg:hidden transition-opacity duration-300 ${isHistoryOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)} />
          <div className={`absolute left-0 top-0 bottom-0 w-80 glass ${isDarkMode ? 'bg-[#0b0b0e]/95' : 'bg-[#f3e9dc]/95'} border-r border-white/10 p-8 transform transition-transform duration-500 ease-out ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <HistoryPanel />
          </div>
        </div>

        {/* Mobile Left Sheet (Vibe Controls) */}
        <div className={`fixed inset-0 z-[60] lg:hidden transition-opacity duration-300 ${isVibeSheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsVibeSheetOpen(false)} />
          <div className={`absolute left-0 top-0 bottom-0 w-80 glass ${isDarkMode ? 'bg-[#0b0b0e]/95' : 'bg-[#f3e9dc]/95'} border-r border-white/10 p-8 transform transition-transform duration-500 ease-out ${isVibeSheetOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <VibePanel />
          </div>
        </div>

        {/* Desktop Sidebar: History */}
        <aside className="hidden lg:flex w-72 border-r border-white/5 flex-col p-8 min-h-0"><HistoryPanel /></aside>

        {/* Center: Main Player (Moves to bottom visually on mobile) */}
        <main className="flex-1 flex flex-col relative min-h-0">
          
          {/* Visualizer Area */}
          <div className="flex-1 flex flex-col items-center justify-center relative p-8">
            <div className="absolute top-8 left-8 right-8 flex justify-between items-center text-[10px] font-bold uppercase opacity-30 tracking-widest px-4">
               <span>Procedural Engine</span>
               <span>{currentTrack?.bpm || 80} BPM</span>
            </div>

            <canvas ref={canvasRef} width={800} height={400} className="absolute inset-0 w-full h-full pointer-events-none opacity-60" />
            
            <div className="z-10 text-center px-4 max-w-2xl">
               <h2 className="serif text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 transition-colors duration-1000 leading-tight" style={{ color: currentTrack?.color }}>
                  {isLoading ? "Synthesizing..." : (currentTrack?.name || "Ready")}
               </h2>
               <p className="text-sm lg:text-lg font-medium opacity-40 italic mx-auto line-clamp-2 leading-relaxed min-h-[3rem]">
                 {isLoading ? "" : currentTrack?.introText}
               </p>
            </div>
          </div>

          {/* Persistent Player Control Bar - Positioned at bottom for touch accessibility */}
          <div className="w-full flex justify-center pb-12 pt-4 px-4 sm:px-8 shrink-0">
            <div className="flex items-center gap-3 sm:gap-6 px-6 sm:px-10 py-4 glass pill-shape shadow-2xl scale-95 sm:scale-100">
               <button onClick={() => setIsNarrationEnabled(!isNarrationEnabled)} className={`w-10 h-10 flex items-center justify-center transition-all ${!isNarrationEnabled ? 'opacity-20' : 'opacity-60 hover:opacity-100'}`}>
                 {isNarrationEnabled ? <Mic size={18} /> : <MicOff size={18} />}
               </button>
               <button className="w-10 h-10 flex items-center justify-center opacity-30 hover:opacity-100 transition-all"><Heart size={18} /></button>

               <button onClick={togglePlay} className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 transform ${isLoading ? 'opacity-30 pointer-events-none' : 'hover:scale-105'}`}
                 style={{ backgroundColor: currentTrack?.color || '#ff7a7a' }}>
                 {isPlaying ? <Pause className="w-8 h-8 text-white fill-current" /> : <Play className="w-8 h-8 text-white fill-current translate-x-0.5" />}
               </button>

               <button onClick={() => handleGenerate()} disabled={isLoading} className="w-10 h-10 flex items-center justify-center opacity-30 hover:opacity-100 transition-all disabled:opacity-5"><SkipForward size={18} /></button>

               <div className="relative" ref={volumeRef}>
                 <button onClick={() => setShowVolumeSlider(!showVolumeSlider)} className={`w-10 h-10 flex items-center justify-center transition-all ${showVolumeSlider ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}><Volume2 size={18} /></button>
                 {showVolumeSlider && (
                   <div className="absolute bottom-full mb-6 left-1/2 -translate-x-1/2 glass p-4 rounded-[32px] w-14 h-48 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
                      <IOSSlider label="" value={volume / 100} onChange={(v) => setVolume(v * 100)} icon={Volume2} accentColor={currentTrack?.color} />
                   </div>
                 )}
               </div>
            </div>
          </div>
        </main>

        {/* Desktop Sidebar: Controls */}
        <aside className="hidden lg:flex w-80 border-l border-white/5 flex-col p-8 min-h-0 bg-black/5"><VibePanel /></aside>

      </div>

      <footer className="mt-6 flex justify-between items-center shrink-0 px-2 pb-2">
        <button onClick={openKeySelector} className="flex items-center gap-2 group p-2 hover:bg-white/5 rounded-2xl transition-all">
          <div className="w-8 h-8 glass rounded-xl flex items-center justify-center group-hover:bg-white/10"><Key size={14} className="opacity-40" /></div>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-30 group-hover:opacity-100 transition-opacity">Configure Gemini Key</span>
        </button>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase opacity-30 tracking-[0.2em]"><Zap size={12} className="fill-current" /> Procedural Stream</div>
      </footer>

      {showGeminiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowGeminiModal(false)}></div>
          <div className="relative glass rounded-3xl p-8 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-3">Configure Gemini API Key</h3>
            <p className="text-xs opacity-60 mb-6">Paste your Gemini API key below. Stored locally in your browser for security.</p>
            <input
              type="password"
              value={geminiKeyInput}
              onChange={(e) => setGeminiKeyInput(e.target.value)}
              placeholder="Enter your Gemini API key"
              className="w-full glass p-3 rounded-xl mb-6 outline-none text-sm"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowGeminiModal(false)} 
                className="px-4 py-2 rounded-lg glass hover:bg-white/20 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  try {
                    window.localStorage.setItem('gemini_api_key', geminiKeyInput);
                  } catch (e) {}
                  setShowGeminiModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-white/20 font-medium text-sm hover:bg-white/30"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
