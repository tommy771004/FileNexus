import { useState, useEffect, useRef, useCallback } from 'react';
import { useSyncState } from '../contexts/SyncContext';
import { Github, Send, Loader2, Sparkles, ClipboardPaste, ExternalLink, Code, Route, UserSquare2, X, Eye, EyeOff, Diff } from 'lucide-react';
import { Editor, DiffEditor } from '@monaco-editor/react';
import { syncFileToGitHub, getFileContentFromGitHub } from '../services/githubService';
import { generateCommitMessage } from '../services/llmService';
import { storeService, Profile } from '../services/storeService';
import { detectLanguage, getSmartRoute } from '../services/routingService';
import { validateContent, ValidationError } from '../services/validationService';

export default function GitHubSync() {
  const { setToast, refreshSidebarData, updateStatusGlobally } = useSyncState();
  const [repoName, setRepoName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState('');
  const [content, setContent] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'syncing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successUrl, setSuccessUrl] = useState('');

  // Diff Mode States
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const [isFetchingOriginal, setIsFetchingOriginal] = useState(false);
  const [renderSideBySide, setRenderSideBySide] = useState(true);

  // Monaco Editor States & Refs
  const editorRef = useRef<any>(null);
  const [editorLanguage, setEditorLanguage] = useState('plaintext');
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  const [defaultOwner, setDefaultOwner] = useState('');
  const [smartRouteMsg, setSmartRouteMsg] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');

  // Refs to avoid stale closures in handleContentChange
  const repoRef = useRef(repoName);
  const pathRef = useRef(filePath);
  const ownerRef = useRef(defaultOwner);
  useEffect(() => { repoRef.current = repoName; }, [repoName]);
  useEffect(() => { pathRef.current = filePath; }, [filePath]);
  useEffect(() => { ownerRef.current = defaultOwner; }, [defaultOwner]);

  // Sync Monaco Theme with OS OS Preferences
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setEditorTheme(mediaQuery.matches ? 'vs-dark' : 'light');
    
    const listener = (e: MediaQueryListEvent) => {
      setEditorTheme(e.matches ? 'vs-dark' : 'light');
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Heuristic Language Detection (MIGRATED TO SERVICE)
  
  const handleContentChange = useCallback((value: string | undefined) => {
    const text = value || '';
    setContent(text);
    if (text) {
      const detectedLang = detectLanguage(text);
      setEditorLanguage(detectedLang);
      
      // Perform Validation
      const errors = validateContent(text, detectedLang);
      setValidationErrors(errors);
      
      const routeResult = getSmartRoute(text, ownerRef.current, repoRef.current, pathRef.current);
      if (routeResult) {
        if (routeResult.repoName) setRepoName(routeResult.repoName);
        if (routeResult.filePath) setFilePath(routeResult.filePath);
        if (routeResult.detectedType) {
          setSmartRouteMsg(`自動套用路由：${routeResult.detectedType}`);
          setTimeout(() => setSmartRouteMsg(''), 7000);
        }
      }
    } else {
      setEditorLanguage('plaintext');
      setValidationErrors([]);
    }
  }, []);

  const handleEditorDidMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  const formatCode = useCallback(() => {
    if (editorRef.current) {
      if (isDiffMode) {
        // In Diff mode, we usually format the modified side if possible, 
        // but simple toggle back to editor is safer for formatting.
        setIsDiffMode(false);
        setTimeout(() => {
          if (editorRef.current) editorRef.current.getAction('editor.action.formatDocument').run();
        }, 100);
      } else {
        editorRef.current.getAction('editor.action.formatDocument').run();
      }
    }
  }, [isDiffMode]);

  const toggleDiffMode = useCallback(async () => {
    if (isDiffMode) {
      setIsDiffMode(false);
      return;
    }

    if (!repoName || !filePath) {
      setToast('請先填寫儲存庫與路徑以比對線上版本');
      return;
    }

    setIsFetchingOriginal(true);
    try {
      const savedPat = await storeService.get('github_pat');
      const remoteContent = await getFileContentFromGitHub(repoName, filePath, savedPat, branch);
      
      setOriginalContent(remoteContent || ''); // If null, it's a new file (empty string original)
      setIsDiffMode(true);
      
      if (remoteContent === null) {
        setToast('線上尚無此檔案，將顯示為全新建立');
      }
    } catch (err) {
      console.error(err);
      setToast('無法取得線上檔案內容');
    } finally {
      setIsFetchingOriginal(false);
    }
  }, [isDiffMode, repoName, filePath, branch]);

  const handlePullAndStashLocal = useCallback(async () => {
    if (!repoName || !filePath) return;
    setIsFetchingOriginal(true);
    setStatus('analyzing');
    setErrorMessage('');
    
    try {
      const savedPat = await storeService.get('github_pat');
      const remoteContent = await getFileContentFromGitHub(repoName, filePath, savedPat, branch);
      
      // Save current content as "stashed" in local storage just in case
      const stashKey = `stash:${repoName}:${filePath}`;
      await storeService.set(stashKey, content);

      // Now set original content to remote content
      setOriginalContent(remoteContent || '');
      // Turn on diff mode immediately so they can see the remote changes vs their edits!
      setIsDiffMode(true);
      setStatus('idle');
      
      setToast('💡 已拉取線上最新版本，並與您的變更進行自動合併比對 (Diff)！');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`拉取最新版本失敗：${err.message || '請確認網路與權限。'}`);
      setStatus('error'); updateStatusGlobally('error', errorMessage || '發生錯誤');
      setTimeout(() => updateStatusGlobally('idle', ''), 3000);
    } finally {
      setIsFetchingOriginal(false);
    }
  }, [repoName, filePath, branch, content]);

  // Load defaults from our local storage (mock IPC) on component mount
  useEffect(() => {
    const loadDefaults = async () => {
      const loadedProfiles = await storeService.getProfiles();
      setProfiles(loadedProfiles);
      
      const activeId = await storeService.getActiveProfileId();
      if (activeId) {
        const active = loadedProfiles.find(p => p.id === activeId);
        if (active) {
          setActiveProfileId(activeId);
          applyProfileValues(active);
          return;
        }
      }

      if (loadedProfiles.length > 0) {
        const active = loadedProfiles[0];
        setActiveProfileId(active.id);
        applyProfileValues(active);
      } else {
         // Legacy fallback
         const savedOwner = await storeService.get('github_owner');
         const savedRepo = await storeService.get('github_repo');
         if (savedOwner) setDefaultOwner(savedOwner);
         if (savedOwner && savedRepo) {
           setRepoName(`${savedOwner}/${savedRepo}`);
         } else if (savedOwner) {
           setRepoName(`${savedOwner}/`);
         }
      }
    };
    loadDefaults();
  }, []);

  // Listen for active profile shifts from the global layout sidebar
  useEffect(() => {
    const handleProfileShift = (e: any) => {
      const { profile } = e.detail;
      if (profile) {
        setActiveProfileId(profile.id);
        applyProfileValues(profile);
      }
    };
    window.addEventListener('filenexus-profile-changed', handleProfileShift);
    return () => window.removeEventListener('filenexus-profile-changed', handleProfileShift);
  }, [profiles]);

  const applyProfileValues = (p: Profile) => {
    setDefaultOwner(p.owner);
    // Don't overwrite if user has already heavily edited a repo name to something else manually recently,
    // but typically profiles should force update.
    let baseRepo = p.owner && p.repo ? `${p.owner}/${p.repo}` : p.owner ? `${p.owner}/` : '';
    setRepoName(baseRepo);
    
    // Only update path if we have a base path and it's empty right now
    if (p.basePath) {
      setFilePath(prev => prev ? prev : `${p.basePath}/`.replace(/\/+/g, '/'));
    }
  };

  const handleProfileChange = (e: any) => {
    const id = e.target.value;
    setActiveProfileId(id);
    const target = profiles.find(p => p.id === id);
    if (target) {
      applyProfileValues(target);
      setSmartRouteMsg(`已切換至設定檔：${target.name}`);
      setTimeout(() => setSmartRouteMsg(''), 3000);
    }
  };

  // Listen to Global Drop Events (Dispatched from App.tsx)
  useEffect(() => {
    const handleGlobalDrop = (e: any) => {
      const { name, content } = e.detail;
      if (content) {
        handleContentChange(content);
        
        // Find if we have a base path configured in the active profile
        const activeProfile = profiles.find(p => p.id === activeProfileId);
        if (activeProfile?.basePath) {
          // Prepend base path to the dropped filename
          setFilePath(`${activeProfile.basePath}/${name}`.replace(/\/+/g, '/'));
        } else {
          setFilePath(name);
        }
        
        setToast(`已讀取 ${name}`);
      }
    };
    window.addEventListener('global-file-drop', handleGlobalDrop);
    return () => window.removeEventListener('global-file-drop', handleGlobalDrop);
  }, [profiles, activeProfileId]);

  // Helper: Auto-generate file name
  const generateDefaultFileName = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `snippet_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.txt`;
  };

  // Feature: Paste from Clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleContentChange(text);
        setFilePath(prev => prev || generateDefaultFileName());
      }
    } catch (error) {
      console.error('Clipboard read failed:', error);
      alert('無法讀取剪貼簿。請確認您已允許瀏覽器存取剪貼簿的權限。');
    }
  };

  // Feature: Keyboard Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd + Shift + V (Mac) or Ctrl + Shift + V (Windows)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteFromClipboard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Feature: Draft directly in Web Browser (Bypasses API restrictions)
  const handleDraftInBrowser = useCallback(async () => {
    if (!repoName) {
      setErrorMessage("必須提供儲存庫名稱 (Repository Name) 才能在瀏覽器中開啟。");
      setStatus('error'); updateStatusGlobally('error', errorMessage || '發生錯誤');
      setTimeout(() => updateStatusGlobally('idle', ''), 3000);
      return;
    }

    setErrorMessage('');
    
    try {
      let finalCommitMessage = commitMessage;
      if (!finalCommitMessage.trim() && content) {
        setStatus('analyzing');
        finalCommitMessage = await generateCommitMessage(content, filePath, isDiffMode ? originalContent : undefined);
        setCommitMessage(finalCommitMessage);
        setStatus('idle');
      }

      // Format GitHub "New File" URL with pre-filled query parameters
      // Notice: If content is incredibly large (e.g., > 10,000 chars), URLs might hit browser limits. 
      // But for normal code snippets, this works flawlessly.
      const encodedFilename = encodeURIComponent(filePath || generateDefaultFileName());
      const encodedValue = encodeURIComponent(content);
      const encodedMessage = encodeURIComponent(finalCommitMessage);
      
      const draftUrl = `https://github.com/${repoName}/new/${branch || 'main'}?filename=${encodedFilename}&value=${encodedValue}&message=${encodedMessage}`;
      
      // In Electron, use native shell.openExternal
      window.open(draftUrl, '_blank', 'noopener,noreferrer');
      
      // Save it to history as a Web Draft action
      await storeService.addHistory({
        id: Date.now().toString(),
        timestamp: Date.now(),
        message: `[網頁草稿] ${finalCommitMessage || '未命名'}`,
        path: filePath || 'Draft',
        url: draftUrl
      });
      
      // Refresh sidebar state immediately
      refreshSidebarData();
      
      // Don't clear content just in case they need to recopy, but flag success
      setStatus('success'); updateStatusGlobally('idle', '');
      setSuccessUrl(''); // No specific API URL returned
      setTimeout(() => setStatus('idle'), 5000);

    } catch (err: any) {
      console.error(err);
      setErrorMessage("無法準備瀏覽器草稿。");
      setStatus('error'); updateStatusGlobally('error', errorMessage || '發生錯誤');
      setTimeout(() => updateStatusGlobally('idle', ''), 3000);
    }
  }, [repoName, filePath, content, commitMessage, branch]);

  const handleSync = useCallback(async () => {
    if (!repoName || !filePath || !content) {
      setErrorMessage("請填寫所有必填欄位 (包含儲存庫名稱、檔案路徑與檔案內容)。");
      setStatus('error'); updateStatusGlobally('error', errorMessage || '發生錯誤');
      setTimeout(() => updateStatusGlobally('idle', ''), 3000);
      return;
    }

    setErrorMessage('');
    
    try {
      // INTERCEPTOR: Automatically generate commit message using LLM if left blank
      let finalCommitMessage = commitMessage;
      
      if (!finalCommitMessage.trim()) {
        setStatus('analyzing');
        finalCommitMessage = await generateCommitMessage(content, filePath, isDiffMode ? originalContent : undefined);
        setCommitMessage(finalCommitMessage);
      }

      setStatus('syncing'); updateStatusGlobally('syncing', '正在同步...');

      // Fetch the token directly from the store at the moment of syncing
      const savedPat = await storeService.get('github_pat');

      const response = await syncFileToGitHub(
        repoName,
        filePath,
        finalCommitMessage,
        content,
        savedPat,
        false,
        branch
      );
      
      const fileUrl = response.content?.html_url || `https://github.com/${repoName}/blob/${branch || 'main'}/${filePath}`;
      
      // Feature: Save history
      await storeService.addHistory({
        id: Date.now().toString(),
        timestamp: Date.now(),
        message: finalCommitMessage,
        path: filePath,
        url: fileUrl
      });
      
      // Refresh sidebar state immediately
      refreshSidebarData();
      
      setSuccessUrl(fileUrl);
      setStatus('success'); updateStatusGlobally('idle', '');
      
      // Clear inputs on success
      setFilePath('');
      setCommitMessage('');
      setContent('');
      
      // Auto reset success message after 8 seconds
      setTimeout(() => setStatus('idle'), 8000);
    } catch (error: any) {
      console.error(error);
      
      let displayError = error.message || "發生未知錯誤。";
      if (displayError.includes('401') || displayError.includes('Missing Personal Access Token')) {
        displayError = "身分驗證失敗。請前往「設定」中確認您已配置 Personal Access Token 授權碼。";
      } else if (displayError.includes('404')) {
        displayError = "找不到該儲存庫。請確認儲存庫是否存在，且您的 Token 有存取權限。";
      } else if (displayError.includes('409') || displayError.includes('conflict')) {
        displayError = "檔案發生衝突。此檔案已被其他人修改過，請先同步最新的變更記錄。";
      }
      
      setErrorMessage(displayError);
      setStatus('error'); updateStatusGlobally('error', errorMessage || '發生錯誤');
      setTimeout(() => updateStatusGlobally('idle', ''), 3000);
    }
  }, [repoName, filePath, content, commitMessage, branch]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090D16] overflow-hidden animate-fade-in relative">
      {/* Background radial highlight */}
      <div className="absolute top-10 right-10 w-[250px] height-[250px] rounded-full bg-hyper-500/5 blur-3xl pointer-events-none" />

      <div className="hidden md:flex h-16 items-center justify-between border-b border-slate-900 px-8 bg-[#0E1321]/40 backdrop-blur-xl shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Github className="size-4 mr-2 text-white/50" />
            <span className="text-sm font-medium text-white/60">
              單檔編輯
            </span>
          </div>

          {/* Persistent status indicator based on content dirty status */}
          {filePath && (
            <div className={`hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-300 ${
              originalContent === '' && !isDiffMode
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                : content !== originalContent
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}>
              <span className="relative flex h-1.5 w-1.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  originalContent === '' && !isDiffMode ? 'bg-blue-400' : content !== originalContent ? 'bg-amber-400' : 'bg-emerald-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  originalContent === '' && !isDiffMode ? 'bg-blue-500' : content !== originalContent ? 'bg-amber-500' : 'bg-emerald-500'
                }`}></span>
              </span>
              <span>
                {originalContent === '' && !isDiffMode 
                  ? '草稿' 
                  : content !== originalContent 
                    ? '未同步' 
                    : '已同步'}
              </span>
            </div>
          )}
        </div>
        
        {profiles.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Profile</span>
            <select
              value={activeProfileId}
              onChange={handleProfileChange}
              className="bg-slate-900 border border-slate-800 text-slate-200 font-medium text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-hyper-500 cursor-pointer shadow-md transition-all outline-none"
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id} className="text-slate-200 bg-[#0E1321]">{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 sm:p-8 relative flex flex-col">
        <div className="flex-1 flex flex-col w-full min-w-0 max-w-7xl mx-auto h-full space-y-6">
          <div className="flex-1 flex flex-col space-y-6 bg-[#0E1321]/60 backdrop-blur-md shadow-2xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            
            <div className="flex flex-col sm:flex-row items-start justify-between pb-6 border-b border-slate-900/60 space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-xl font-medium tracking-tight text-white/90">單檔編輯器</h2>
                <p className="text-sm text-white/60 mt-1 max-w-xl">
                  編輯檔案內容並進行同步。
                </p>
              </div>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'batch' }))}
                className="flex items-center space-x-2 px-4 py-2 h-10 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/40 hover:bg-slate-800 rounded-lg border border-slate-700/50 transition-colors active:scale-95 shrink-0 whitespace-nowrap shadow-md w-full sm:w-auto justify-center"
                title="需要同步多個檔案？點擊切換"
              >
                <Route className="size-3.5 text-hyper-500" />
                <span>切換至批次同步</span>
              </button>
            </div>

            {smartRouteMsg && (
              <div className="flex items-center text-xs font-semibold text-hyper-400 bg-hyper-500/10 border border-hyper-500/20 px-4 py-3 rounded-lg shadow-sm animate-fade-in -mt-2">
                <Route className="size-4 mr-2.5 flex-shrink-0 text-hyper-500" />
                <span><strong className="font-bold mr-1 text-slate-100">偵測：</strong> {smartRouteMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                  儲存庫名稱 (Repository) <span className="text-hyper-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3.5 py-2.5 text-xs font-medium text-slate-100 placeholder-slate-600 focus:border-hyper-500 focus:ring-1 focus:ring-hyper-500 focus:bg-[#0A0D16] focus:outline-none transition-all shadow-inner font-mono"
                  placeholder="例如：username/repo-name"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  disabled={status === 'syncing' || status === 'analyzing'}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                  分支 (Branch) <span className="text-hyper-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3.5 py-2.5 text-xs font-medium text-slate-100 placeholder-slate-600 focus:border-hyper-500 focus:ring-1 focus:ring-hyper-500 focus:bg-[#0A0D16] focus:outline-none transition-all shadow-inner font-mono"
                  placeholder="例如：main 或 master"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={status === 'syncing' || status === 'analyzing'}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                  寫入目的地路徑 (File Path) <span className="text-hyper-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3.5 py-2.5 text-xs font-medium text-slate-100 placeholder-slate-600 focus:border-hyper-500 focus:ring-1 focus:ring-hyper-500 focus:bg-[#0A0D16] focus:outline-none transition-all shadow-inner font-mono"
                  placeholder="例如：src/utils/helpers.js"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  disabled={status === 'syncing' || status === 'analyzing'}
                />
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-900/60 pt-6">
              <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase flex items-center justify-between">
                <span className="flex items-center">
                  提交描述訊息 (Commit Message)
                  <span className="ml-2 text-slate-500 font-normal normal-case text-[10px]">(若保持空白將由 AI 自動推導摘要)</span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (!content) return;
                    setStatus('analyzing');
                    const summary = await generateCommitMessage(content, filePath, isDiffMode ? originalContent : undefined);
                    setCommitMessage(summary);
                    setStatus('idle');
                  }}
                  disabled={status === 'syncing' || status === 'analyzing' || !content}
                  className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-hyper-400 hover:text-hyper-300 bg-hyper-500/10 hover:bg-hyper-500/20 rounded-lg border border-hyper-500/10 transition-all active:scale-95 disabled:opacity-40"
                >
                  <Sparkles className="size-3" />
                  <span>AI 評估最佳提交文</span>
                </button>
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3.5 py-2.5 text-xs font-medium text-slate-100 placeholder-slate-600 focus:border-hyper-500 focus:ring-1 focus:ring-hyper-500 focus:bg-[#0A0D16] focus:outline-none transition-all shadow-inner"
                placeholder="例如：feat: 實作登入功能驗證邏輯"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                disabled={status === 'syncing' || status === 'analyzing'}
              />
            </div>

            {/* Validation Feedback */}
            {validationErrors.length > 0 && (
              <div className="space-y-2 border-t border-slate-900/60 pt-4 animate-fade-in text-[12px]">
                <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">
                  Diagnostics / 代碼靜態分析
                </div>
                {validationErrors.map((err, i) => (
                  <div 
                    key={i} 
                    className={`flex items-center text-xs px-3.5 py-2 rounded-lg border ${
                      err.severity === 'error' 
                        ? 'bg-red-500/5 border-red-500/20 text-red-400' 
                        : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                    }`}
                  >
                    <div className={`size-1.5 rounded-full mr-2.5 shrink-0 ${
                      err.severity === 'error' ? 'bg-diff-red' : 'bg-warning-amber'
                    }`} />
                    <span className="font-bold mr-1.5">{err.severity === 'error' ? '[編譯錯誤]' : '[優化建議]'}</span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 flex-1 flex flex-col min-h-[300px] border-t border-slate-900/60 pt-6">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                <div className="flex items-center space-x-2">
                  <span>程式源碼內容 (Source Content) <span className="text-hyper-500">*</span></span>
                  {editorLanguage !== 'plaintext' && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-[10px] uppercase text-hyper-400 border border-slate-800 shadow-sm font-mono">
                      {editorLanguage}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {isDiffMode && (
                    <div 
                      role="radiogroup" 
                      aria-label="Diff 檢視模式 (Diff View Mode)"
                      className="hidden sm:flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg h-8 items-center mr-1 select-none"
                    >
                      <button
                        role="radio"
                        aria-checked={renderSideBySide}
                        onClick={() => setRenderSideBySide(true)}
                        className={`px-3 h-full text-[10.5px] font-semibold rounded-md transition-all duration-155 focus:outline-none focus:ring-1 focus:ring-blue-500 ${renderSideBySide ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-350'}`}
                      >
                        左右對照
                      </button>
                      <button
                        role="radio"
                        aria-checked={!renderSideBySide}
                        onClick={() => setRenderSideBySide(false)}
                        className={`px-3 h-full text-[10.5px] font-semibold rounded-md transition-all duration-155 focus:outline-none focus:ring-1 focus:ring-blue-500 ${!renderSideBySide ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-350'}`}
                      >
                        單欄行內
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={toggleDiffMode}
                    disabled={status === 'syncing' || status === 'analyzing' || isFetchingOriginal}
                    className={`flex items-center space-x-1.5 h-8 px-3.5 text-xs font-semibold rounded-lg border shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 ${isDiffMode ? 'bg-[#0055FF] text-white border-hyper-500 hover:bg-[#0047D6]' : 'bg-slate-900 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'}`}
                    title={isDiffMode ? "回到編輯模式" : "比對線上版本"}
                  >
                    {isFetchingOriginal ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : isDiffMode ? (
                      <EyeOff className="size-3" />
                    ) : (
                      <Diff className="size-3" />
                    )}
                    <span>{isDiffMode ? '返回代碼編輯' : '版本差分 (Diff)'}</span>
                  </button>
                  <button 
                    onClick={formatCode}
                    disabled={status === 'syncing' || status === 'analyzing' || !content}
                    className="flex items-center space-x-1.5 h-8 px-3 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors active:scale-[0.98] disabled:opacity-50"
                  >
                    <Code className="size-3" />
                    <span>自動排版</span>
                  </button>
                  <button 
                    onClick={handlePasteFromClipboard}
                    disabled={status === 'syncing' || status === 'analyzing'}
                    className="flex items-center space-x-1.5 h-8 px-3 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors active:scale-[0.98] disabled:opacity-50"
                    title="快速組合鍵: Cmd/Ctrl + Shift + V"
                  >
                    <ClipboardPaste className="size-3" />
                    <span>貼上</span>
                  </button>
                </div>
              </div>
              
              <div className="flex-1 border border-slate-800 rounded-xl overflow-hidden shadow-2xl bg-slate-950 focus-within:border-hyper-500 transition-all flex flex-col relative min-h-[350px]">
                {isDiffMode && (
                  <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-900 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-405 select-none animate-fade-in relative z-10 w-full shrink-0">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center justify-center w-4 h-4 rounded-md bg-emerald-500/20 text-emerald-450 border border-emerald-500/25 font-bold text-[10px] shrink-0" aria-hidden="true">+</span>
                        <span className="text-slate-300">線上新增變更 <strong className="text-emerald-400 font-bold font-sans">(+) Additions</strong></span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center justify-center w-4 h-4 rounded-md bg-rose-500/20 text-rose-455 border border-rose-500/25 font-bold text-[10px] shrink-0" aria-hidden="true">-</span>
                        <span className="text-slate-300">本機刪除/覆蓋 <strong className="text-rose-455 font-bold font-sans">(-) Deletions</strong></span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 hidden md:inline">
                      本機代碼 vs 遠端最新版本比對 · 邊界已附加 + / - 符號標記
                    </span>
                  </div>
                )}
                {isDiffMode ? (
                  <DiffEditor
                    height="100%"
                    original={originalContent}
                    modified={content}
                    language={editorLanguage}
                    theme={editorTheme}
                    onMount={(editor) => {
                      editorRef.current = editor.getModifiedEditor();
                    }}
                    options={{
                      readOnly: true,
                      renderSideBySide: renderSideBySide,
                      renderIndicators: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 12.5,
                      lineHeight: 18,
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                      wordWrap: 'on',
                      padding: { top: 16, bottom: 16 },
                      smoothScrolling: true,
                      originalEditable: false,
                    }}
                  />
                ) : (
                  <Editor
                    height="100%"
                    language={editorLanguage}
                    theme={editorTheme}
                    value={content}
                    onChange={handleContentChange}
                    onMount={handleEditorDidMount}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 12.5,
                      lineHeight: 18,
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                      wordWrap: 'on',
                      padding: { top: 16, bottom: 16 },
                      readOnly: status === 'syncing' || status === 'analyzing',
                      cursorBlinking: 'smooth',
                      smoothScrolling: true,
                    }}
                  />
                )}
              </div>
            </div>

            {/* Status Messages */}
            {status === 'error' && (
              <div className="rounded-xl bg-red-500/5 p-4 border border-red-500/20 flex flex-col md:flex-row items-start md:items-center justify-between mt-4 animate-fade-in gap-4">
                <div className="flex items-start">
                  <X className="size-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-sm font-bold text-red-400 tracking-tight">同步中斷</h3>
                    <div className="mt-1 text-xs text-red-300 leading-relaxed text-pretty">{errorMessage}</div>
                  </div>
                </div>
                {(errorMessage.includes('衝突') || errorMessage.includes('conflict') || errorMessage.includes('409') || errorMessage.includes('412')) && (
                  <button
                    onClick={handlePullAndStashLocal}
                    disabled={isFetchingOriginal}
                    className="w-full md:w-auto h-9 px-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/20 transition-all active:scale-[0.98] shrink-0 flex items-center justify-center space-x-1.5 shadow-md hover:border-emerald-500/40"
                    title="立即安全讀取 remote 最新線上代碼，並與您当前的本機代碼進行即時 Diff 比對合併"
                  >
                    {isFetchingOriginal ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span>正在整合線上版本...</span>
                      </>
                    ) : (
                      <>
                        <Diff className="w-3.5 h-3.5 text-emerald-400" />
                        <span>拉取遠端並比對本機衝突 (Pull & Diff)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            
            {status === 'success' && (
              <div className="rounded-xl bg-emerald-500/5 p-4 border border-emerald-500/20 flex items-center justify-between mt-4 animate-fade-in">
                <div className="flex items-center">
                  <Sparkles className="size-5 text-emerald-500 shrink-0 animate-pulse" />
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-emerald-400 tracking-tight">同步程序完成！變更已順利登入 Codebase</h3>
                  </div>
                </div>
                {successUrl && (
                  <a href={successUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-hyper-400 hover:text-hyper-300 flex items-center bg-hyper-500/10 hover:bg-hyper-500/25 px-3 py-1.5 rounded-lg active:scale-95 transition-all outline-none border border-hyper-500/10">
                    在 GitHub 上檢視程式 <ExternalLink className="ml-1 size-3" />
                  </a>
                )}
              </div>
            )}

            {/* Sage and Magician Combined Dual Core Action Layout */}
            <div className="mt-auto pt-6 flex flex-col sm:flex-row items-center justify-end border-t border-slate-900/60 gap-4 shrink-0 relative z-10">
              <button
                onClick={handleDraftInBrowser}
                disabled={status === 'syncing' || status === 'analyzing' || !repoName || !content}
                className="w-full sm:w-auto h-11 px-6 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/40 hover:bg-slate-800 rounded-lg border border-slate-700/50 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed justify-center flex items-center space-x-2"
                title="於新分頁開啟 GitHub 草稿"
              >
                <ExternalLink className="size-4 text-slate-400" />
                <span>在瀏覽器開啟草稿 (繞過防火牆)</span>
              </button>

              <button
                onClick={handleSync}
                disabled={status === 'syncing' || status === 'analyzing' || !repoName || !content}
                className="w-full sm:w-auto h-11 px-8 rounded-lg bg-[#0055FF] hover:bg-[#0047D6] active:scale-[0.98] focus:outline-none transition-all shadow-[0_4px_16px_rgba(0,85,255,0.25)] font-semibold text-white text-xs disabled:opacity-40 disabled:cursor-not-allowed justify-center flex items-center space-x-2 min-w-[200px]"
              >
                {(status === 'syncing' || status === 'analyzing') ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                <span>
                  {status === 'analyzing' ? '正在使用 AI 分析...' : 
                   status === 'syncing' ? '正在推播至 GitHub...' : '直接同步推播 (API)'}
                </span>
              </button>
            </div>

            {/* Liquid glass progress bar for syncing status */}
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-white/5 transition-opacity duration-500 ease-in-out ${status === 'syncing' || status === 'analyzing' ? 'opacity-100' : 'opacity-0'}`}>
              <div 
                className="h-full bg-blue-500/80 relative w-full origin-left transition-transform duration-1000 ease-out shadow-[0_0_8px_rgba(0,85,255,0.8)] liquid-glass" 
                style={{ transform: status === 'syncing' ? 'scaleX(1)' : status === 'analyzing' ? 'scaleX(0.5)' : 'scaleX(0)' }} 
              >
                <div className="absolute inset-0 w-full h-full animate-[pulse_1.5s_infinite] bg-white/20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
