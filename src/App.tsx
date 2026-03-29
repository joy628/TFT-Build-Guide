import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sword, Shield, Zap, Info, Target, RefreshCw, ChevronRight, Filter, Layers, Share2, Copy, Check, History, LogIn, LogOut, Plus, MessageSquare, ChevronDown, X } from 'lucide-react';
import { HERO_DATA, SEASONS, Hero } from './constants';
import { getEquipmentRecommendation, analyzeHero } from './services/gemini';
import { auth, loginWithGoogle, logout, addGuide, getGuidesForHero, Guide, getAllHeroes, seedHeroes } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

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
  const [allHeroes, setAllHeroes] = useState<Hero[]>(HERO_DATA);
  const [selectedSeason, setSelectedSeason] = useState(() => localStorage.getItem('tft_season') || SEASONS[0]);
  const [selectedCost, setSelectedCost] = useState<number | 'all'>('all');
  const [selectedOrigin, setSelectedOrigin] = useState<string | 'all'>('all');
  const [selectedJob, setSelectedJob] = useState<string | 'all'>('all');
  const [selectedHeroNames, setSelectedHeroNames] = useState<string[]>(() => {
    const saved = localStorage.getItem('tft_heroes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    const legacy = localStorage.getItem('tft_hero');
    return legacy ? [legacy] : [];
  });
  
  // Enemy Selection State
  const [enemySelectedCost, setEnemySelectedCost] = useState<number | 'all'>('all');
  const [enemySelectedOrigin, setEnemySelectedOrigin] = useState<string | 'all'>('all');
  const [enemySelectedJob, setEnemySelectedJob] = useState<string | 'all'>('all');
  const [enemySelectedHeroNames, setEnemySelectedHeroNames] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Firebase State
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [heroGuides, setHeroGuides] = useState<Guide[]>([]);
  const [showGuideForm, setShowGuideForm] = useState(false);
  const [newGuide, setNewGuide] = useState({ title: '', content: '' });
  const [isSubmittingGuide, setIsSubmittingGuide] = useState(false);
  
  // Crawler State
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);

  // New states for Navigation and Hero Analysis
  const [activeTab, setActiveTab] = useState<'strategy' | 'analysis'>('strategy');
  const [analyzingHeroName, setAnalyzingHeroName] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Fetch Heroes from Firestore on mount
  useEffect(() => {
    getAllHeroes().then(heroes => {
      if (heroes.length > 0) {
        setAllHeroes(heroes);
      }
    });
  }, []);

  // Fetch Guides when hero changes
  useEffect(() => {
    if (selectedHeroNames.length > 0) {
      // Fetch guides for all selected heroes and combine them
      Promise.all(selectedHeroNames.map(name => getGuidesForHero(name)))
        .then(results => {
          const combined = results.flat();
          // Remove duplicates if any
          const unique = Array.from(new Map(combined.map(g => [g.id, g])).values());
          setHeroGuides(unique);
        });
    } else {
      setHeroGuides([]);
    }
  }, [selectedHeroNames]);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('tft_season', selectedSeason);
    localStorage.setItem('tft_heroes', JSON.stringify(selectedHeroNames));
  }, [selectedSeason, selectedHeroNames]);

  const filteredHeroes = useMemo(() => {
    return allHeroes.filter(hero => {
      const seasonMatch = hero.season === selectedSeason;
      const costMatch = selectedCost === 'all' || hero.cost === selectedCost;
      const originMatch = selectedOrigin === 'all' || hero.origin.includes(selectedOrigin);
      const jobMatch = selectedJob === 'all' || hero.job.includes(selectedJob);
      return seasonMatch && costMatch && originMatch && jobMatch;
    });
  }, [selectedSeason, selectedCost, selectedOrigin, selectedJob, allHeroes]);

  const S16_CONFIG = {
    costs: [1, 2, 3, 4, 5, 7],
    origins: ["以绪塔尔", "弗雷尔卓德", "艾欧尼亚", "诺克萨斯", "暗影岛", "恕瑞玛", "巨神峰", "虚空", "约德尔人", "祖安"],
    jobs: ["斗士", "护卫", "枪手", "神谕者", "主宰", "狙神", "耀光使", "迅击战士", "裁决战士", "法师", "征服者", "神盾使"]
  };

  const S45_CONFIG = {
    costs: [1, 2, 3, 4, 5],
    origins: ["腥红之月", "天神", "永恒之森", "玉剑仙", "山海绘卷", "福星", "忍者", "灵魂莲华明昼", "三国猛将"],
    jobs: ["宗师", "刺客", "斗士", "决斗大师", "裁决使", "神盾使", "魔法师", "秘术师", "神射手", "战神", "摄魂使", "重装战士"]
  };

  const currentConfig = selectedSeason.includes("S16") ? S16_CONFIG : S45_CONFIG;

  const enemyFilteredHeroes = useMemo(() => {
    return allHeroes.filter(hero => {
      const seasonMatch = hero.season === selectedSeason;
      const costMatch = enemySelectedCost === 'all' || hero.cost === enemySelectedCost;
      const originMatch = enemySelectedOrigin === 'all' || hero.origin.includes(enemySelectedOrigin);
      const jobMatch = enemySelectedJob === 'all' || hero.job.includes(enemySelectedJob);
      return seasonMatch && costMatch && originMatch && jobMatch;
    });
  }, [selectedSeason, enemySelectedCost, enemySelectedOrigin, enemySelectedJob, allHeroes]);

  const currentHeroes = useMemo(() => {
    return selectedHeroNames.map(name => allHeroes.find(h => h.name === name)).filter(Boolean) as Hero[];
  }, [selectedHeroNames, allHeroes]);

  // Dropdown Component
  const FilterDropdown = ({ 
    label, 
    value, 
    options, 
    onChange, 
    icon: Icon 
  }: { 
    label: string, 
    value: string | number, 
    options: { label: string, value: string | number }[], 
    onChange: (val: any) => void,
    icon?: any
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(o => o.value === value);

    return (
      <div className="relative flex-1 min-w-0">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-tft-bg/50 border border-tft-border rounded-xl hover:border-tft-accent transition-all text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon size={12} className="text-tft-accent shrink-0" />}
            <div className="truncate">
              <p className="text-[8px] text-gray-500 uppercase font-bold leading-none mb-0.5">{label}</p>
              <p className="text-[10px] font-bold text-white truncate">{selectedOption?.label || '全部'}</p>
            </div>
          </div>
          <ChevronDown size={12} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-0 right-0 mt-2 bg-tft-card border border-tft-border rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto no-scrollbar py-1"
              >
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold transition-colors hover:bg-white/5 ${
                      value === opt.value ? 'text-tft-accent bg-tft-accent/5' : 'text-gray-400'
                    }`}
                  >
                    {opt.label}
                    {value === opt.value && <Check size={10} />}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const handleFetchRecommendation = async () => {
    if (currentHeroes.length === 0) return;
    setLoading(true);
    
    const heroNames = currentHeroes.map(h => h.name).join(', ');
    const allTraits: string[] = Array.from(new Set(currentHeroes.flatMap(h => [...h.origin, ...h.job])));
    
    // Construct enemy context from selections
    let context = "";
    if (enemySelectedHeroNames.length > 0) {
      context += `敌方核心英雄: ${enemySelectedHeroNames.join(', ')} `;
    }
    if (enemySelectedOrigin !== 'all') {
      context += `敌方核心特质: ${enemySelectedOrigin} `;
    }
    if (enemySelectedJob !== 'all') {
      context += `敌方核心职业: ${enemySelectedJob} `;
    }
    if (enemySelectedCost !== 'all') {
      context += `敌方主要费用: ${enemySelectedCost}金币 `;
    }
    
    const data = await getEquipmentRecommendation(heroNames, allTraits, context, heroGuides);
    setResult(data);
    setLoading(false);
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: document.getElementById('results-section')?.offsetTop || 0, behavior: 'smooth' });
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        // User cancelled or closed the popup, ignore
        console.log("Login cancelled by user");
      } else {
        alert("登录失败: " + err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAddGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetHeroName = selectedHeroNames[0];
    if (!user || !newGuide.title || !newGuide.content || !targetHeroName) return;
    
    setIsSubmittingGuide(true);
    try {
      await addGuide({
        title: newGuide.title,
        content: newGuide.content,
        heroName: targetHeroName,
        authorUid: user.uid,
        authorName: user.displayName || '匿名玩家',
        authorPhoto: user.photoURL || undefined
      });
      setNewGuide({ title: '', content: '' });
      setShowGuideForm(false);
      // Refresh guides
      const updated = await getGuidesForHero(targetHeroName);
      setHeroGuides(updated);
    } catch (err) {
      console.error("Failed to add guide:", err);
    } finally {
      setIsSubmittingGuide(false);
    }
  };

  const handleCrawl = async () => {
    if (!crawlUrl || !user) return;
    setIsCrawling(true);
    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: crawlUrl })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      // Auto-fill form with crawled data
      setNewGuide({ title: data.title, content: data.content });
      if (data.heroName) {
        const found = HERO_DATA.find(h => h.name.includes(data.heroName) || data.heroName.includes(h.name));
        if (found) {
          setSelectedSeason(found.season);
          setSelectedHeroNames([found.name]);
        }
      }
      setCrawlUrl('');
    } catch (err) {
      alert("抓取失败: " + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setIsCrawling(false);
    }
  };

  const handleCopy = () => {
    if (!result || currentHeroes.length === 0) return;
    const heroNames = currentHeroes.map(h => h.name).join(', ');
    const text = `【${heroNames}】出装建议：\n1. ${result.recommendations[0].name}\n2. ${result.recommendations[1].name}\n3. ${result.recommendations[2].name}\n策略：${result.strategy}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAnalyzeHero = async (hero: Hero) => {
    setAnalyzingHeroName(hero.name);
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setActiveTab('analysis'); // Switch to analysis tab when a hero is selected for analysis
    
    try {
      const data = await analyzeHero(hero, selectedSeason);
      setAnalysisResult(data);
    } catch (error) {
      console.error("Analysis Error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSeedData = async () => {
    if (!user || user.email !== 'sunjoy628@gmail.com') return;
    
    setSyncStatus('syncing');
    setSyncError(null);
    console.log("Starting hero data sync...");
    
    try {
      await seedHeroes(HERO_DATA);
      console.log("Hero data sync successful.");
      setSyncStatus('success');
      const updated = await getAllHeroes();
      setAllHeroes(updated);
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err: any) {
      console.error("Hero data sync failed:", err);
      setSyncStatus('error');
      setSyncError(err.message || String(err));
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-tft-bg text-white pb-24 lg:pb-8">
      {/* App Header */}
      <nav className="sticky top-0 z-50 glass-panel border-b border-tft-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Main Navigation Tabs */}
          <div className="flex items-center gap-1 bg-tft-bg/50 p-1 rounded-xl border border-tft-border">
            <button
              onClick={() => setActiveTab('strategy')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'strategy' ? 'bg-tft-accent text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sword size={14} /> 战术攻略
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'analysis' ? 'bg-tft-accent text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Zap size={14} /> 英雄分析
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-2">
              {user.email === 'sunjoy628@gmail.com' && (
                <button 
                  onClick={handleSeedData}
                  disabled={syncStatus === 'syncing'}
                  className={`text-[10px] px-2 py-1 rounded border transition-all mr-2 flex items-center gap-1 ${
                    syncStatus === 'syncing' ? 'bg-gray-700 text-gray-400 border-gray-600' :
                    syncStatus === 'success' ? 'bg-green-500/20 text-green-500 border-green-500/30' :
                    syncStatus === 'error' ? 'bg-red-500/20 text-red-500 border-red-500/30' :
                    'bg-tft-accent/10 text-tft-accent border-tft-accent/20 hover:bg-tft-accent/20'
                  }`}
                >
                  {syncStatus === 'syncing' ? <RefreshCw size={10} className="animate-spin" /> : null}
                  {syncStatus === 'syncing' ? '同步中...' : 
                   syncStatus === 'success' ? '同步成功' : 
                   syncStatus === 'error' ? '同步失败' : '同步英雄库'}
                </button>
              )}
              <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-6 h-6 rounded-full border border-tft-accent/50" />
              <button onClick={logout} className="text-[10px] text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                <LogOut size={12} /> 退出
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin} 
              disabled={isLoggingIn}
              className="text-[10px] text-tft-accent font-bold flex items-center gap-1 hover:underline disabled:opacity-50"
            >
              {isLoggingIn ? <RefreshCw size={12} className="animate-spin" /> : <LogIn size={12} />}
              {isLoggingIn ? '登录中...' : '登录同步攻略'}
            </button>
          )}
          <div className="hidden sm:block text-[10px] text-tft-accent font-bold border border-tft-accent/30 px-2 py-0.5 rounded uppercase tracking-tighter">Live v2.2 (RAG)</div>
        </div>
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
                    setSelectedCost('all');
                    setSelectedOrigin('all');
                    setSelectedJob('all');
                    setEnemySelectedCost('all');
                    setEnemySelectedOrigin('all');
                    setEnemySelectedJob('all');
                    setEnemySelectedHeroNames([]);
                    setSelectedHeroNames([]);
                  }}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                    selectedSeason === season 
                      ? 'bg-tft-accent text-black border-tft-accent' 
                      : 'bg-tft-card border-tft-border text-gray-400'
                  }`}
                >
                  {season.includes(' (') ? season.split(' (')[0] : season}
                </button>
              ))}
            </div>

            {/* Hero Selection Filters */}
            <div className="glass-panel p-4 rounded-2xl space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-black text-tft-accent uppercase tracking-widest">
                  {activeTab === 'strategy' ? '选择阵容英雄 (最多10个)' : '选择分析英雄 (单选)'}
                </h4>
              </div>
              <div className="flex gap-2">
                <FilterDropdown 
                  label="费用"
                  value={selectedCost}
                  onChange={setSelectedCost}
                  options={[
                    { label: '全部费用', value: 'all' },
                    ...currentConfig.costs.map(c => ({ label: `${c} 费`, value: c }))
                  ]}
                />
                <FilterDropdown 
                  label="特质"
                  value={selectedOrigin}
                  onChange={setSelectedOrigin}
                  options={[
                    { label: '全部特质', value: 'all' },
                    ...currentConfig.origins.map(o => ({ label: o, value: o }))
                  ]}
                />
                <FilterDropdown 
                  label="职业"
                  value={selectedJob}
                  onChange={setSelectedJob}
                  options={[
                    { label: '全部职业', value: 'all' },
                    ...currentConfig.jobs.map(j => ({ label: j, value: j }))
                  ]}
                />
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[200px] overflow-y-auto no-scrollbar p-1 border-t border-tft-border pt-4">
                {filteredHeroes.map(hero => (
                  <button
                    key={hero.name}
                    onClick={() => {
                      if (activeTab === 'analysis') {
                        handleAnalyzeHero(hero);
                        return;
                      }
                      setSelectedHeroNames(prev => {
                        if (prev.includes(hero.name)) {
                          return prev.filter(n => n !== hero.name);
                        }
                        if (prev.length >= 10) return prev;
                        return [...prev, hero.name];
                      });
                    }}
                    className={`relative group aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      (activeTab === 'analysis' ? analyzingHeroName === hero.name : selectedHeroNames.includes(hero.name)) 
                        ? 'border-tft-accent scale-105 shadow-[0_0_15px_rgba(200,155,60,0.5)]' 
                        : 'border-tft-border grayscale hover:grayscale-0'
                    }`}
                  >
                    <img src={hero.avatar} alt={hero.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 py-0.5 text-[8px] font-bold text-center truncate px-1">
                      {hero.name}
                    </div>
                    {activeTab === 'strategy' && selectedHeroNames.includes(hero.name) && (
                      <div className="absolute top-0 left-0 bg-tft-accent text-black text-[8px] font-black px-1 rounded-br-lg">
                        {selectedHeroNames.indexOf(hero.name) + 1}
                      </div>
                    )}
                    {activeTab === 'analysis' && analyzingHeroName === hero.name && (
                      <div className="absolute top-0 left-0 bg-tft-accent text-black p-1 rounded-br-lg">
                        <Zap size={8} className="fill-current" />
                      </div>
                    )}
                    <div className={`absolute top-0 right-0 w-4 h-4 flex items-center justify-center text-[8px] font-black rounded-bl-lg ${
                      hero.cost === 5 ? 'bg-orange-500' : hero.cost === 4 ? 'bg-purple-500' : hero.cost === 3 ? 'bg-blue-500' : hero.cost === 2 ? 'bg-green-500' : 'bg-gray-500'
                    }`}>
                      {hero.cost}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Current Hero Info */}
            {activeTab === 'strategy' && currentHeroes.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-tft-border/30">
                {currentHeroes.map(hero => (
                  <div key={`selected-tag-${hero.name}`} className="flex items-center gap-1 bg-tft-bg/60 border border-tft-border px-2 py-1 rounded-lg">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      hero.cost === 5 ? 'bg-orange-500' : hero.cost === 4 ? 'bg-purple-500' : hero.cost === 3 ? 'bg-blue-500' : hero.cost === 2 ? 'bg-green-500' : 'bg-gray-400'
                    }`}></span>
                    <span className="text-[10px] font-bold text-gray-300">{hero.name}</span>
                    <button 
                      onClick={() => setSelectedHeroNames(prev => prev.filter(n => n !== hero.name))}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <LogOut size={8} className="rotate-180" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between w-full mt-1">
                  <span className="text-[8px] text-tft-accent font-black uppercase tracking-widest">已选阵容 ({currentHeroes.length}/10)</span>
                  <button 
                    onClick={() => setSelectedHeroNames([])}
                    className="text-[8px] text-gray-600 hover:text-white underline"
                  >
                    清空全部
                  </button>
                </div>
              </div>
            )}

            {/* Enemy Targets */}
            {activeTab === 'strategy' && (
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <span className="text-xs font-bold text-tft-accent uppercase tracking-widest block">侦察敌方阵容 ({selectedSeason.includes('S16') ? 'S16' : 'S4.5'})</span>
                
                <div className="flex gap-2">
                  <FilterDropdown 
                    label="敌方费用"
                    value={enemySelectedCost}
                    onChange={setEnemySelectedCost}
                    options={[
                      { label: '全部费用', value: 'all' },
                      ...currentConfig.costs.map(c => ({ label: `${c} 费`, value: c }))
                    ]}
                  />
                  <FilterDropdown 
                    label="敌方特质"
                    value={enemySelectedOrigin}
                    onChange={setEnemySelectedOrigin}
                    options={[
                      { label: '全部特质', value: 'all' },
                      ...currentConfig.origins.map(o => ({ label: o, value: o }))
                    ]}
                  />
                  <FilterDropdown 
                    label="敌方职业"
                    value={enemySelectedJob}
                    onChange={setEnemySelectedJob}
                    options={[
                      { label: '全部职业', value: 'all' },
                      ...currentConfig.jobs.map(j => ({ label: j, value: j }))
                    ]}
                  />
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[150px] overflow-y-auto no-scrollbar p-1 border-t border-tft-border pt-4">
                  {enemyFilteredHeroes.map(hero => (
                    <button
                      key={`enemy-${hero.name}`}
                      onClick={() => {
                        setEnemySelectedHeroNames(prev => {
                          if (prev.includes(hero.name)) {
                            return prev.filter(n => n !== hero.name);
                          }
                          if (prev.length >= 10) return prev;
                          return [...prev, hero.name];
                        });
                      }}
                      className={`relative group aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        enemySelectedHeroNames.includes(hero.name) ? 'border-tft-accent scale-105 shadow-[0_0_15px_rgba(200,155,60,0.5)]' : 'border-tft-border grayscale hover:grayscale-0'
                      }`}
                    >
                      <img src={hero.avatar} alt={hero.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/80 py-0.5 text-[8px] font-bold text-center truncate px-1">
                        {hero.name}
                      </div>
                      {enemySelectedHeroNames.includes(hero.name) && (
                        <div className="absolute top-0 left-0 bg-tft-accent text-black text-[8px] font-black px-1 rounded-br-lg">
                          {enemySelectedHeroNames.indexOf(hero.name) + 1}
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Selected Enemy Heroes Display */}
                {enemySelectedHeroNames.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-tft-border/30">
                    {enemySelectedHeroNames.map(name => {
                      const hero = allHeroes.find(h => h.name === name);
                      return (
                        <div key={`enemy-tag-${name}`} className="flex items-center gap-1 bg-tft-bg/60 border border-tft-border px-2 py-1 rounded-lg">
                          <span className="text-[10px] font-bold text-gray-300">{name}</span>
                          <button 
                            onClick={() => setEnemySelectedHeroNames(prev => prev.filter(n => n !== name))}
                            className="text-gray-500 hover:text-red-400"
                          >
                            <LogOut size={8} className="rotate-180" />
                          </button>
                        </div>
                      );
                    })}
                    <button 
                      onClick={() => setEnemySelectedHeroNames([])}
                      className="text-[8px] text-gray-600 hover:text-white underline ml-auto"
                    >
                      清空敌方
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Community Guides (RAG Context) */}
            {activeTab === 'strategy' && (
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-tft-accent uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={14} /> 独家攻略库 ({heroGuides.length})
                  </span>
                  {user && (
                    <button 
                      onClick={() => setShowGuideForm(!showGuideForm)}
                      className="p-1 bg-tft-accent/10 text-tft-accent rounded-md hover:bg-tft-accent/20 transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>

                {showGuideForm && (
                  <motion.form 
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    onSubmit={handleAddGuide}
                    className="space-y-3 bg-tft-bg/50 p-4 rounded-xl border border-tft-accent/20"
                  >
                    {/* Crawler Input */}
                    <div className="flex gap-2 mb-2">
                      <input 
                        type="url" 
                        placeholder="粘贴攻略网址 (如: 某扑、某站攻略)" 
                        value={crawlUrl}
                        onChange={e => setCrawlUrl(e.target.value)}
                        className="flex-1 bg-tft-bg/80 border border-tft-border p-2 rounded-lg text-[10px] outline-none focus:border-tft-accent"
                      />
                      <button 
                        type="button"
                        onClick={handleCrawl}
                        disabled={isCrawling || !crawlUrl}
                        className="px-3 bg-tft-blue text-white text-[10px] font-bold rounded-lg disabled:opacity-50 flex items-center gap-1"
                      >
                        {isCrawling ? <RefreshCw size={10} className="animate-spin" /> : <Layers size={10} />}
                        AI 抓取
                      </button>
                    </div>

                    <div className="h-px bg-tft-border/50 my-2"></div>

                    <input 
                      type="text" 
                      placeholder="攻略标题 (如: 暴力输出流)" 
                      value={newGuide.title}
                      onChange={e => setNewGuide({...newGuide, title: e.target.value})}
                      className="w-full bg-tft-bg border border-tft-border p-2 rounded-lg text-xs outline-none focus:border-tft-accent"
                      required
                    />
                    <textarea 
                      placeholder="详细心得..." 
                      value={newGuide.content}
                      onChange={e => setNewGuide({...newGuide, content: e.target.value})}
                      className="w-full bg-tft-bg border border-tft-border p-2 rounded-lg text-xs outline-none focus:border-tft-accent h-20 resize-none"
                      required
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowGuideForm(false)} className="px-3 py-1 text-[10px] text-gray-400">取消</button>
                      <button 
                        type="submit" 
                        disabled={isSubmittingGuide}
                        className="px-3 py-1 bg-tft-accent text-black text-[10px] font-bold rounded-lg disabled:opacity-50"
                      >
                        {isSubmittingGuide ? '提交中...' : '发布攻略'}
                      </button>
                    </div>
                  </motion.form>
                )}

                <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
                  {heroGuides.length > 0 ? (
                    heroGuides.map(guide => (
                      <div key={guide.id} className="p-3 bg-tft-bg/30 border border-tft-border rounded-xl">
                        <h5 className="text-[10px] font-bold text-tft-accent mb-1">{guide.title}</h5>
                        <p className="text-[10px] text-gray-400 line-clamp-2 italic">"{guide.content}"</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-gray-500 text-center py-4 italic">暂无攻略，登录后分享你的心得，AI 将学习你的打法！</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Button */}
          {activeTab === 'strategy' && (
            <button
              onClick={handleFetchRecommendation}
              disabled={loading}
              className="hidden lg:flex w-full bg-tft-accent hover:bg-yellow-600 disabled:bg-gray-700 text-black font-black py-5 rounded-2xl transition-all items-center justify-center gap-3 shadow-[0_10px_30px_rgba(200,155,60,0.3)] uppercase italic"
            >
              {loading ? <RefreshCw className="animate-spin" /> : <>计算神装方案 <ChevronRight size={20} /></>}
            </button>
          )}
        </section>

        {/* Right: Results Display */}
        <section id="results-section" className="lg:col-span-7 space-y-8 min-h-[600px]">
          <AnimatePresence mode="wait">
            {activeTab === 'strategy' ? (
              <motion.div
                key="strategy-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {!result && !loading ? (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="h-full min-h-[400px] glass-panel rounded-3xl border-dashed border-2 border-tft-border flex flex-col items-center justify-center p-12 text-center"
                  >
                    <div className="w-20 h-20 bg-tft-accent/10 rounded-full flex items-center justify-center mb-6">
                      <Sword size={32} className="text-tft-accent" />
                    </div>
                    <h4 className="text-xl font-bold mb-2 uppercase tracking-tighter italic">等待战术指令</h4>
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
                          <Zap size={24} className="fill-current" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black italic">{currentHeroes.map(h => h.name).join(' + ')}</h2>
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
                              src={item.id ? `https://game.gtimg.cn/images/jcc/setup/item/${item.id}.png` : `https://picsum.photos/seed/${item.name}/64/64`} 
                              alt={item.name} 
                              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.name}/64/64`;
                              }}
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
              </motion.div>
            ) : (
              <motion.div
                key="analysis-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {!analysisResult && !isAnalyzing ? (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="h-full min-h-[400px] glass-panel rounded-3xl border-dashed border-2 border-tft-border flex flex-col items-center justify-center p-12 text-center"
                  >
                    <div className="w-20 h-20 bg-tft-accent/10 rounded-full flex items-center justify-center mb-6">
                      <Zap size={32} className="text-tft-accent" />
                    </div>
                    <h4 className="text-xl font-bold mb-2 uppercase tracking-tighter italic">等待英雄分析</h4>
                    <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
                      在左侧选择一个英雄，AI 将为您进行深度数据分析与装备推荐。
                    </p>
                  </motion.div>
                ) : isAnalyzing ? (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-6"
                  >
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-tft-accent/20 rounded-full"></div>
                      <div className="absolute top-0 left-0 w-20 h-20 border-4 border-tft-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-tft-accent font-black tracking-[0.3em] animate-pulse">ANALYZING HERO</p>
                      <p className="text-[10px] text-gray-500 mt-2 uppercase">Processing mechanics & meta synergy...</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    {/* Analysis Header */}
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-tft-accent shadow-[0_0_30px_rgba(200,155,60,0.3)]">
                        <img 
                          src={allHeroes.find(h => h.name === analyzingHeroName)?.avatar} 
                          alt={analyzingHeroName || ''} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h2 className="text-3xl font-black italic uppercase tracking-tighter">{analyzingHeroName}</h2>
                          <span className="px-2 py-0.5 bg-tft-accent text-black text-[10px] font-black rounded uppercase tracking-widest">
                            {analysisResult.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-tft-accent font-bold uppercase tracking-widest">{selectedSeason}</p>
                      </div>
                    </div>

                    {/* Strengths & Synergy */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-tft-accent">
                        <h4 className="text-tft-accent font-black text-[10px] uppercase mb-2 tracking-widest flex items-center gap-2">
                          <Zap size={14} /> 核心优势分析
                        </h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{analysisResult.strengths}</p>
                      </div>
                      <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-tft-blue">
                        <h4 className="text-tft-blue font-black text-[10px] uppercase mb-2 tracking-widest flex items-center gap-2">
                          <Layers size={14} /> 阵容搭配建议
                        </h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{analysisResult.synergy_tips}</p>
                      </div>
                    </div>

                    {/* Equipment Recommendations */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
                        <Sword size={12} /> 推荐神装与深度解析
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        {analysisResult.recommendations.map((item: any, idx: number) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="glass-panel p-4 rounded-2xl border-l-4 border-l-tft-accent group hover:bg-white/5 transition-all flex items-start gap-4"
                          >
                            <div className="w-16 h-16 bg-tft-bg rounded-xl border border-tft-border flex-shrink-0 flex items-center justify-center overflow-hidden relative group-hover:border-tft-accent transition-colors">
                              <img 
                                src={item.id ? `https://game.gtimg.cn/images/jcc/setup/item/${item.id}.png` : `https://picsum.photos/seed/${item.name}/64/64`} 
                                alt={item.name} 
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.name}/64/64`;
                                }}
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-white group-hover:text-tft-accent transition-colors mb-1">{item.name}</h3>
                              <p className="text-xs text-gray-400 leading-relaxed">{item.reason}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Mobile Floating Action Button */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-tft-bg via-tft-bg to-transparent safe-pb">
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
