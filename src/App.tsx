import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sword, Shield, Zap, Info, Target, RefreshCw, ChevronRight, Filter, Layers, Share2, Copy, Check, History } from 'lucide-react';
import { HERO_DATA, SEASONS, ENEMY_TYPES } from './constants';
import { getEquipmentRecommendation } from './services/gemini';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
  });
}

interface Recommendation {
  name: string;
  reason: string;
}

interface AIResult {
  recommendations: Recommendation[];
  strategy: string;
  counter_tip: string;
  error?: string;
}

export default function App() {
  // Load initial state from LocalStorage
  const [selectedSeason, setSelectedSeason] = useState(() => localStorage.getItem('tft_season') || SEASONS[0]);
  const [selectedHeroName, setSelectedHeroName] = useState(() => localStorage.getItem('tft_hero') || (HERO_DATA.find(h => h.season === (localStorage.getItem('tft_season') || SEASONS[0]))?.name || ''));
  
  const [enemyContext, setEnemyContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('tft_season', selectedSeason);
    localStorage.setItem('tft_hero', selectedHeroName);
  }, [selectedSeason, selectedHeroName]);

  const filteredHeroes = useMemo(() => HERO_DATA.filter(hero => hero.season === selectedSeason), [selectedSeason]);
  const currentHero = useMemo(() => HERO_DATA.find(h => h.name === selectedHeroName) || filteredHeroes[0], [selectedHeroName, filteredHeroes]);

  const handleFetchRecommendation = async () => {
    if (!currentHero) return;
    setLoading(true);
    const data = await getEquipmentRecommendation(currentHero.name, currentHero.traits, enemyContext);
    setResult(data);
    setLoading(false);
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: document.getElementById('results-section')?.offsetTop || 0, behavior: 'smooth' });
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `【${currentHero.name}】出装建议：\n1. ${result.recommendations[0].name}\n2. ${result.recommendations[1].name}\n3. ${result.recommendations[2].name}\n策略：${result.strategy}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-tft-bg text-white pb-24 lg:pb-8">
      {/* App Header */}
      <nav className="sticky top-0 z-50 glass-panel border-b border-tft-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-tft-accent rounded-lg flex items-center justify-center text-black font-black italic">T</div>
          <span className="font-black tracking-tighter text-lg italic">TFT INTEL</span>
        </div>
        <div className="text-[10px] text-tft-accent font-bold border border-tft-accent/30 px-2 py-0.5 rounded uppercase">Live v2.1</div>
      </nav>

      <main className="p-4 md:p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Controls */}
        <section className="lg:col-span-5 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
              <Filter size={12} /> 配置战术环境
            </h3>
            
            {/* Season Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {SEASONS.map(season => (
                <button
                  key={season}
                  onClick={() => {
                    setSelectedSeason(season);
                    const first = HERO_DATA.find(h => h.season === season);
                    if (first) setSelectedHeroName(first.name);
                  }}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                    selectedSeason === season 
                      ? 'bg-tft-accent text-black border-tft-accent' 
                      : 'bg-tft-card border-tft-border text-gray-400'
                  }`}
                >
                  {season.split(':')[0]}
                </button>
              ))}
            </div>

            {/* Hero Card Selection */}
            <div className="glass-panel p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-tft-accent uppercase tracking-widest">当前英雄</span>
                <Sword size={16} className="text-tft-accent opacity-50" />
              </div>
              <select 
                value={selectedHeroName}
                onChange={(e) => setSelectedHeroName(e.target.value)}
                className="w-full bg-tft-bg/80 border border-tft-border p-4 rounded-xl text-lg font-bold text-white focus:border-tft-accent outline-none appearance-none cursor-pointer"
              >
                {filteredHeroes.map(hero => (
                  <option key={hero.name} value={hero.name}>{hero.name}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                {currentHero?.traits.map(trait => (
                  <span key={trait} className="text-[10px] bg-tft-blue/10 text-tft-blue border border-tft-blue/20 px-3 py-1 rounded-full font-bold uppercase">
                    {trait}
                  </span>
                ))}
              </div>
            </div>

            {/* Enemy Targets */}
            <div className="glass-panel p-5 rounded-2xl space-y-4">
              <span className="text-xs font-bold text-tft-accent uppercase tracking-widest block">侦察敌方阵容</span>
              <div className="grid grid-cols-1 gap-2">
                {ENEMY_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setEnemyContext(prev => prev === type.label ? '' : type.label)}
                    className={`text-left p-4 rounded-xl text-xs transition-all border flex items-center justify-between group ${
                      enemyContext === type.label 
                        ? 'bg-tft-accent/10 border-tft-accent text-tft-accent' 
                        : 'bg-tft-bg/40 border-tft-border text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {type.label}
                    {enemyContext === type.label && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop Button */}
          <button
            onClick={handleFetchRecommendation}
            disabled={loading}
            className="hidden lg:flex w-full bg-tft-accent hover:bg-yellow-600 disabled:bg-gray-700 text-black font-black py-5 rounded-2xl transition-all items-center justify-center gap-3 shadow-[0_10px_30px_rgba(200,155,60,0.3)] uppercase italic"
          >
            {loading ? <RefreshCw className="animate-spin" /> : <>计算神装方案 <ChevronRight size={20} /></>}
          </button>
        </section>

        {/* Right: Results Display */}
        <section id="results-section" className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {!result && !loading ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="h-full min-h-[400px] glass-panel rounded-3xl border-dashed border-2 border-tft-border flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="w-20 h-20 bg-tft-accent/10 rounded-full flex items-center justify-center mb-6">
                  <Zap size={32} className="text-tft-accent" />
                </div>
                <h4 className="text-xl font-bold mb-2">准备就绪</h4>
                <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
                  选择赛季英雄并点击计算按钮，AI 将为您实时生成当前版本的最佳出装逻辑。
                </p>
              </motion.div>
            ) : loading ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-6"
              >
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-tft-accent/20 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-20 h-20 border-4 border-tft-accent border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="text-center">
                  <p className="text-tft-accent font-black tracking-[0.3em] animate-pulse">ANALYZING META</p>
                  <p className="text-[10px] text-gray-500 mt-2 uppercase">Fetching latest set data...</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Result Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-tft-accent rounded-xl flex items-center justify-center text-black font-black text-xl italic">
                      {currentHero.name[0]}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black italic">{currentHero.name}</h2>
                      <p className="text-[10px] text-tft-accent font-bold uppercase tracking-widest">{selectedSeason}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleCopy}
                    className="p-3 bg-tft-card border border-tft-border rounded-xl text-gray-400 hover:text-tft-accent transition-colors flex items-center gap-2 text-xs font-bold"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copied ? '已复制' : '复制方案'}
                  </button>
                </div>

                {/* Equipment Grid */}
                <div className="grid grid-cols-1 gap-3">
                  {result.recommendations.map((item, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="glass-panel p-4 rounded-2xl border-l-4 border-l-tft-accent group hover:bg-white/5 transition-all flex items-start gap-4"
                    >
                      <div className="w-16 h-16 bg-tft-bg rounded-xl border border-tft-border flex-shrink-0 flex items-center justify-center overflow-hidden relative group-hover:border-tft-accent transition-colors">
                        <img 
                          src={`https://picsum.photos/seed/${item.name}/64/64`} 
                          alt={item.name} 
                          className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-1">
                          <span className="text-[8px] font-black text-tft-accent italic">ITEM</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-white group-hover:text-tft-accent transition-colors">{item.name}</h3>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">{item.reason}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-tft-blue/5 border border-tft-blue/20 p-6 rounded-3xl">
                    <h4 className="flex items-center gap-2 text-tft-blue font-black text-[10px] uppercase mb-4 tracking-widest">
                      <Info size={14} /> 战术核心思路
                    </h4>
                    <p className="text-sm leading-relaxed text-blue-100/70 italic">
                      "{result.strategy}"
                    </p>
                  </div>
                  <div className="bg-red-900/5 border border-red-900/20 p-6 rounded-3xl">
                    <h4 className="flex items-center gap-2 text-red-400 font-black text-[10px] uppercase mb-4 tracking-widest">
                      <Shield size={14} /> 针对性克制
                    </h4>
                    <p className="text-sm leading-relaxed text-red-100/70">
                      {result.counter_tip}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Mobile Floating Action Button */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-tft-bg via-tft-bg to-transparent">
        <button
          onClick={handleFetchRecommendation}
          disabled={loading}
          className="w-full bg-tft-accent active:scale-95 disabled:bg-gray-700 text-black font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-[0_10px_40px_rgba(200,155,60,0.4)] uppercase italic"
        >
          {loading ? <RefreshCw className="animate-spin" /> : <>即刻生成 AI 战术方案 <ChevronRight size={20} /></>}
        </button>
      </div>
    </div>
  );
}
