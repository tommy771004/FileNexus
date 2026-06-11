import { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, CheckCircle2, Plus, Trash2, Box } from 'lucide-react';
import { storeService, Profile } from '../services/storeService';
import { LiquidExpandablePanel } from '../components/LiquidExpandablePanel';

export default function SettingsView() {
  const [pat, setPat] = useState('');
  
  // Profile State
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string>('default-profile');
  const [activeProfileId, setActiveProfileId] = useState<string>('default-profile');
  
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const currentProfile = profiles.find(p => p.id === currentProfileId) || profiles[0];

  const updateCurrentProfile = (updates: Partial<Profile>) => {
    setProfiles(prev => prev.map(p => 
      p.id === currentProfileId 
        ? { ...p, ...updates }
        : p
    ));
  };

  // Compute profile name validation error
  const nameError = (() => {
    if (!currentProfile) return null;
    const trimmed = currentProfile.name.trim();
    if (!trimmed) return '設定檔名稱不能為空字串。';
    
    // Check invalid path characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmed)) {
      return '名稱包含無效字元 (不能使用 < > : " / \\ | ? *)。';
    }
    
    // Check uniqueness (ignoring the current editing profile)
    const isDuplicate = profiles.some(
      p => p.id !== currentProfileId && p.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      return '名稱已經存在，請換一個不同的名稱。';
    }
    
    return null;
  })();

  useEffect(() => {
    const loadSettings = async () => {
      const savedPat = await storeService.get('github_pat');
      setPat(savedPat);
      
      const loadedProfiles = await storeService.getProfiles();
      
      let initializedProfiles = loadedProfiles;
      if (initializedProfiles.length === 0) {
        const defaultProfile: Profile = {
          id: 'default-profile',
          name: '預設設定檔',
          owner: '',
          repo: '',
          basePath: ''
        };
        initializedProfiles = [defaultProfile];
      }
      
      setProfiles(initializedProfiles);
      
      const savedActiveId = await storeService.getActiveProfileId();
      
      // Determine actual active profile (saved one, or default to the first one)
      let initialActiveId = savedActiveId;
      if (!initialActiveId || !initializedProfiles.find(p => p.id === initialActiveId)) {
        initialActiveId = initializedProfiles[0].id;
      }
      setActiveProfileId(initialActiveId);
      
      // Load the active profile into the UI
      const initial = initializedProfiles.find(p => p.id === initialActiveId) || initializedProfiles[0];
      setCurrentProfileId(initial.id);
    };
    loadSettings();
  }, []);

  const handleProfileSwitch = (id: string) => {
    if (id === currentProfileId) return;

    if (nameError) {
      alert(`暫時無法切換設定檔，請先修正目前的名稱錯誤：\n${nameError}`);
      return;
    }

    const target = profiles.find(p => p.id === id);
    if (target) {
      setCurrentProfileId(target.id);
    }
  };

  const handleAddProfile = () => {
    // If current draft has an error, block adding a new profile until fixed
    if (nameError) {
      alert(`無法新增設定檔，因為目前設定檔名稱有誤：\n${nameError}`);
      return;
    }

    const newId = `profile-${Date.now()}`;
    let suffix = 1;
    let newName = `新設定檔`;
    while (profiles.some(p => p.name.trim().toLowerCase() === newName.toLowerCase())) {
        suffix++;
        newName = `新設定檔 ${suffix}`;
    }

    const newProfile: Profile = {
      id: newId,
      name: newName,
      owner: '',
      repo: '',
      basePath: ''
    };
    
    setProfiles(prev => [...prev, newProfile]);
    setCurrentProfileId(newId);
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) {
      alert("必須保留至少一組設定檔。");
      return;
    }
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated);
    
    if (activeProfileId === id) {
      setActiveProfileId(updated[0].id);
    }

    if (currentProfileId === id) {
      setCurrentProfileId(updated[0].id);
    }
  };

  const handleSetAsActive = () => {
    setActiveProfileId(currentProfileId);
  };

  const handleSave = async () => {
    if (nameError) {
      alert(`無法儲存設定，因為目前設定檔名稱有誤：\n${nameError}`);
      return;
    }
    
    setIsSaving(true);
    await storeService.set('github_pat', pat);
    
    // Ensure all profiles have at least a default name if they were somehow left empty
    const finalProfiles = profiles.map(p => ({
        ...p,
        name: p.name.trim() || '未命名設定檔'
    }));
    setProfiles(finalProfiles);
    
    // Persist to store
    await storeService.setProfiles(finalProfiles);
    await storeService.setActiveProfileId(activeProfileId);
    
    // Get the actual active profile data for generic fallback
    const activeProfileData = finalProfiles.find(p => p.id === activeProfileId);
    if (activeProfileData) {
      await storeService.set('github_owner', activeProfileData.owner.trim());
      await storeService.set('github_repo', activeProfileData.repo.trim());
      await storeService.set('github_base_path', activeProfileData.basePath.trim());
      
      // Dispatch active profile change
      window.dispatchEvent(new CustomEvent('filenexus-profile-changed', {
        detail: { profile: activeProfileData }
      }));
    }
    
    // Dispatch refresh sidebar
    window.dispatchEvent(new CustomEvent('filenexus-refresh-sidebar'));
    
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!currentProfile) {
    return <div className="p-8 text-slate-500">載入設定檔中...</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090D16] overflow-hidden animate-fade-in relative">
      {/* Background radial highlight */}
      <div className="absolute top-10 right-10 w-[250px] height-[250px] rounded-full bg-hyper-500/5 blur-3xl pointer-events-none" />

      <div className="hidden md:flex h-16 items-center border-b border-white/5 px-8 bg-transparent shrink-0">
        <SettingsIcon className="mr-3 size-4 text-white/50" />
        <span className="text-sm font-medium text-white/60 tracking-wide">
          設定
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-8 relative flex flex-col">
        <div className="flex-1 flex flex-col w-full min-w-0 max-w-7xl mx-auto h-full space-y-6">
          <div className="flex-1 flex flex-col space-y-6 bg-white/5 backdrop-blur-md shadow-2xl border border-white/5 rounded-3xl p-6 sm:p-8">
            <LiquidExpandablePanel
              title="液態玻璃面板 (Liquid Glass) 特效測試"
              description="點擊展開以檢視此元件的實作細節與效果說明"
              icon={Box}
            >
              <div className="space-y-4 text-sm font-medium">
                <p>這是一個示範了「Liquid Glass UI (液態玻璃)」的展示面板：</p>
                <ul className="list-disc pl-5 space-y-2 text-white/70">
                  <li><strong>基礎玻璃質感 (Frosted Glass)：</strong>使用了 backdrop-filter (28px blur) 搭配低透明度背板，呈現柔和的磨砂玻璃感。</li>
                  <li><strong>立體厚度邊框與懸浮陰影：</strong>使用 box-shadow inset 製造內部白高光，另外附加高模糊陰影營造出深邃的懸浮感。</li>
                  <li><strong>邊緣掃光特效：</strong>面板上一道微弱的過度反光斜角掃過表面，如同 CC Light Sweep，讓面板看起來更有質感。</li>
                  <li><strong>液態過渡動畫：</strong>配合 Framer Motion 的 Spring Physics 打造成極具彈性的流暢 S 曲線。</li>
                </ul>
              </div>
            </LiquidExpandablePanel>

            <div>
              <h2 className="text-xl font-medium tracking-tight text-white/90">偏好設定</h2>
              <p className="text-sm text-white/60 mt-1">
                管理本地端的應用程式設定、金鑰憑證。
              </p>
            </div>
            
            <div className="space-y-6 border-t border-white/5 pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest font-mono">GitHub 設定檔</h3>
                <button
                  onClick={handleAddProfile}
                  className="flex items-center space-x-1.5 px-3.5 h-10 text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors justify-center"
                >
                  <Plus className="size-3.5 text-blue-400" />
                  <span>新增設定檔</span>
                </button>
              </div>
              
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
                <div className="w-full sm:w-1/3 space-y-2">
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono mb-1">所有設定檔</div>
                  <div className="flex flex-col space-y-1 bg-black/20 border border-white/5 rounded-xl p-1.5 min-h-[200px]">
                    {profiles.map(p => {
                      const isActive = activeProfileId === p.id;
                      const isEditing = currentProfileId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleProfileSwitch(p.id)}
                          className={`flex items-center justify-between text-left px-3.5 py-2.5 text-[12.5px] rounded-lg transition-all ${isEditing ? 'bg-white/10 text-white border border-white/10 font-medium' : 'text-white/50 hover:bg-white/5 hover:text-white/80 border border-transparent'}`}
                        >
                          <span className="truncate pr-2">{p.name || '未命名'}</span>
                          {isActive && <CheckCircle2 className={`size-4 shrink-0 text-blue-500`} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 space-y-4 bg-black/20 border border-white/5 rounded-xl p-5">
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center">
                      屬性
                      {activeProfileId === currentProfileId ? (
                        <span className="ml-3 px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">作用中</span>
                      ) : (
                        <button
                          onClick={handleSetAsActive}
                          className="ml-3 text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                        >
                          設為作用中
                        </button>
                      )}
                    </h4>
                    {profiles.length > 1 && (
                      <button 
                        onClick={() => handleDeleteProfile(currentProfileId)}
                        className="text-slate-500 hover:text-red-400 hover:bg-slate-800/40 p-1.5 rounded-lg transition-colors shrink-0"
                        title="刪除此設定檔"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 font-sans">
                    <label htmlFor="settings-profile-name" className="text-xs font-semibold text-white/60">設定檔名稱</label>
                    <input
                      id="settings-profile-name"
                      type="text"
                      className={`w-full rounded-lg border ${nameError ? 'border-red-500/50 focus:ring-red-500/25' : 'border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} bg-black/20 px-3.5 py-2 text-xs font-medium text-white/90 placeholder-white/30 focus:outline-none transition-all shadow-inner`}
                      placeholder="例：Frontend"
                      value={currentProfile.name}
                      onChange={(e) => updateCurrentProfile({ name: e.target.value })}
                    />
                    {nameError && (
                      <p className="text-xs font-semibold text-red-400 mt-1">{nameError}</p>
                    )}
                  </div>

                  <div className="space-y-1.5 font-sans">
                    <label htmlFor="settings-profile-owner" className="text-xs font-semibold text-white/60">GitHub 擁有者 (Owner/Organization)</label>
                    <input
                      id="settings-profile-owner"
                      type="text"
                      className="w-full rounded-lg border border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-black/20 px-3.5 py-2 text-xs font-medium text-white/90 placeholder-white/30 focus:outline-none transition-all shadow-inner font-mono"
                      placeholder="例：torvalds"
                      value={currentProfile.owner}
                      onChange={(e) => updateCurrentProfile({ owner: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-1.5 font-sans">
                    <label htmlFor="settings-profile-repo" className="text-xs font-semibold text-white/60">儲存庫名稱 (Repository)</label>
                    <input
                      id="settings-profile-repo"
                      type="text"
                      className="w-full rounded-lg border border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-black/20 px-3.5 py-2 text-xs font-medium text-white/90 placeholder-white/30 focus:outline-none transition-all shadow-inner font-mono"
                      placeholder="例：linux"
                      value={currentProfile.repo}
                      onChange={(e) => updateCurrentProfile({ repo: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5 font-sans">
                    <label htmlFor="settings-profile-basepath" className="text-xs font-semibold text-white/60">基準路徑 Base Path (選填)</label>
                    <input
                      id="settings-profile-basepath"
                      type="text"
                      className="w-full rounded-lg border border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-black/20 px-3.5 py-2 text-xs font-medium text-white/90 placeholder-white/30 focus:outline-none transition-all shadow-inner font-mono"
                      placeholder="例：src/ (會自動加入在檔案路徑前)"
                      value={currentProfile.basePath}
                      onChange={(e) => updateCurrentProfile({ basePath: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 border-t border-slate-900/60 pt-6">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest font-mono">全域金鑰設定</h3>
              <div className="space-y-4">
                <div className="space-y-1.5 font-sans">
                  <label htmlFor="settings-global-pat" className="text-xs font-semibold text-white/60">GitHub Personal Access Token (PAT) <span className="text-white/40 font-normal text-[11px] ml-2">(非必填)</span></label>
                  <input
                    id="settings-global-pat"
                    type="password"
                    className="w-full rounded-lg border border-slate-800 focus:border-hyper-500 focus:ring-1 focus:ring-hyper-500 bg-slate-950/40 px-3.5 py-2.5 text-xs font-mono tracking-widest text-slate-200 placeholder-slate-700 focus:outline-none transition-all shadow-inner"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={pat}
                    onChange={(e) => setPat(e.target.value)}
                  />
                  <div className="text-xs text-white/50 space-y-1 font-normal mt-3 leading-relaxed bg-white/5 p-4 border border-white/10 rounded-xl">
                    <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">隱私與安全說明</p>
                    <p>• 您的金鑰僅會保存在本地端瀏覽器中，不會傳送至任何第三方伺服器。</p>
                    <p>• 設定金鑰可解鎖完整的檔案同步與存取功能。</p>
                    <p>• 即使未設定金鑰，您仍可利用瀏覽器在新分頁中手動建立 GitHub 草稿。</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 flex items-center justify-end space-x-4 border-t border-slate-900/60 shrink-0">
              {saved && (
                <div className="flex items-center text-emerald-400 font-semibold text-xs animate-fade-in bg-emerald-500/5 px-3.5 py-2 rounded-lg border border-emerald-500/10 shadow-sm animate-fade-in">
                  <CheckCircle2 className="size-4 mr-1.5 text-emerald-400" />
                  設定與金鑰配置已儲存
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center justify-center space-x-2 rounded-lg bg-[#0055FF] hover:bg-[#0047D6] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,85,255,0.25)] font-semibold h-11 px-6 text-white text-xs disabled:opacity-50 min-w-[140px]"
              >
                <Save className="size-4" />
                <span>{isSaving ? '儲存中...' : '儲存變更'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
