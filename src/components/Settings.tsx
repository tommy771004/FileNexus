import { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { storeService, Profile } from '../services/storeService';

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
    }
    
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!currentProfile) {
    return <div className="p-8 text-slate-500">載入設定檔中...</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent">
      <div className="hidden md:flex h-16 items-center border-b border-slate-200 px-8 bg-white shadow-sm shrink-0">
        <SettingsIcon className="mr-3 size-5 text-slate-800" />
        <span className="text-sm font-bold text-slate-700 tracking-wide">
          / 應用程式設定
        </span>
      </div>
      <div className="flex-1 overflow-auto p-0 sm:p-8 relative flex flex-col">
        <div className="flex-1 flex flex-col w-full min-w-0 max-w-none h-full">
          <div className="flex-1 flex flex-col space-y-4 rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 bg-white p-5 sm:p-8 shadow-none sm:shadow-sm">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 text-balance">偏好設定</h2>
            <p className="text-sm font-medium text-slate-500 pb-2 text-pretty">
              管理本地端的應用程式設定與預設值。
            </p>
            
            <div className="space-y-6 border-t border-slate-100 pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
                <h3 className="text-lg font-bold text-slate-700">GitHub 設定檔管理</h3>
                <button
                  onClick={handleAddProfile}
                  className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors active:scale-95 shadow-sm justify-center"
                >
                  <Plus className="size-3.5" />
                  <span>新增設定檔</span>
                </button>
              </div>
              
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="w-full sm:w-1/3 space-y-2">
                  <div className="text-xs font-bold text-slate-500 mb-1">選擇要編輯的設定檔</div>
                  <div className="flex flex-col space-y-1 bg-slate-50 border border-slate-100 rounded-xl p-1.5 min-h-[200px]">
                    {profiles.map(p => {
                      const isActive = activeProfileId === p.id;
                      const isEditing = currentProfileId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleProfileSwitch(p.id)}
                          className={`flex items-center justify-between text-left px-3.5 py-2.5 text-sm font-bold rounded-lg transition-colors ${isEditing ? 'bg-slate-200 text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                          <span className="truncate pr-2">{p.name || '未命名'}</span>
                          {isActive && <CheckCircle2 className={`size-4 shrink-0 ${isEditing ? 'text-slate-900' : 'text-emerald-500'}`} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 space-y-4 bg-slate-50 border border-slate-100 rounded-xl p-5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center">
                      設定檔詳細內容
                      {activeProfileId === currentProfileId ? (
                        <span className="ml-3 px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold bg-emerald-100 text-emerald-700 rounded-md border border-emerald-200">作用中</span>
                      ) : (
                        <button
                          onClick={handleSetAsActive}
                          className="ml-3 text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                        >
                          設為主要作用中
                        </button>
                      )}
                    </h4>
                    {profiles.length > 1 && (
                      <button 
                        onClick={() => handleDeleteProfile(currentProfileId)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors shrink-0"
                        title="刪除此設定檔"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">設定檔名稱</label>
                    <input
                      type="text"
                      className={`w-full rounded-xl border ${nameError ? 'border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-slate-400 focus:ring-slate-100'} bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
                      placeholder="例如：Frontend-React"
                      value={currentProfile.name}
                      onChange={(e) => updateCurrentProfile({ name: e.target.value })}
                    />
                    {nameError && (
                      <p className="text-xs font-bold text-red-500 mt-1">{nameError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">預設 GitHub 擁有者 (使用者名稱 / 組織名稱)</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all"
                      placeholder="例如：torvalds"
                      value={currentProfile.owner}
                      onChange={(e) => updateCurrentProfile({ owner: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">預設儲存庫名稱 (Repository)</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all"
                      placeholder="例如：linux"
                      value={currentProfile.repo}
                      onChange={(e) => updateCurrentProfile({ repo: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">基準路徑 Base Path (選填)</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all"
                      placeholder="例如：src/ 或是 legacy/api/ (會自動附加在檔案路徑之前)"
                      value={currentProfile.basePath}
                      onChange={(e) => updateCurrentProfile({ basePath: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 border-t border-slate-100 pt-6">
              <h3 className="text-lg font-bold text-slate-700">全域安全設定</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">GitHub Personal Access Token (PAT) <span className="text-xs text-slate-400 font-medium ml-2">(純網頁草稿模式下為選填)</span></label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100 font-mono tracking-widest transition-all"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={pat}
                    onChange={(e) => setPat(e.target.value)}
                  />
                  <div className="text-xs text-slate-500 space-y-1.5 font-medium mt-2 text-pretty">
                    <p>• 僅安全地儲存在本地裝置中。</p>
                    <p>• 若您希望能使用 <span className="text-blue-600 font-bold">"直接同步 (API)"</span> 或是 <span className="text-orange-600 font-bold">"批次專案同步"</span>，這是<strong>必填</strong>項目。</p>
                    <p>• 若您只打算使用 <span className="text-emerald-600 font-bold">"開啟網頁版草稿 (繞過防火牆)"</span> 功能，則您<strong>無須填寫</strong>這項金鑰。</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 flex items-center justify-end space-x-4 border-t border-slate-100">
              {saved && (
                <div className="flex items-center text-emerald-700 font-bold text-sm animate-fade-in bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm">
                  <CheckCircle2 className="size-4 mr-1.5" />
                  設定已儲存
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center space-x-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Save className="size-4" />
                <span>{isSaving ? '儲存中...' : '儲存設定'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
