import { useState, useEffect, useRef, useCallback } from 'react';
import { Github, Send, Loader2, Sparkles, ClipboardPaste, ExternalLink, Code, Route, UserSquare2, X, Eye, EyeOff, Diff } from 'lucide-react';
import { Editor, DiffEditor } from '@monaco-editor/react';
import { syncFileToGitHub, getFileContentFromGitHub } from '../services/githubService';
import { generateCommitMessage } from '../services/llmService';
import { storeService, Profile } from '../services/storeService';
import { detectLanguage, getSmartRoute } from '../services/routingService';
import { validateContent, ValidationError } from '../services/validationService';

export default function GitHubSync() {
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
      window.dispatchEvent(new CustomEvent('global-toast', { 
        detail: { message: '請先填寫儲存庫與路徑以比對線上版本' } 
      }));
      return;
    }

    setIsFetchingOriginal(true);
    try {
      const savedPat = await storeService.get('github_pat');
      const remoteContent = await getFileContentFromGitHub(repoName, filePath, savedPat, branch);
      
      setOriginalContent(remoteContent || ''); // If null, it's a new file (empty string original)
      setIsDiffMode(true);
      
      if (remoteContent === null) {
        window.dispatchEvent(new CustomEvent('global-toast', { 
          detail: { message: '線上尚無此檔案，將顯示為全新建立' } 
        }));
      }
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('global-toast', { 
        detail: { message: '無法取得線上檔案內容' } 
      }));
    } finally {
      setIsFetchingOriginal(false);
    }
  }, [isDiffMode, repoName, filePath, branch]);

  // Load defaults from our local storage (mock IPC) on component mount
  useEffect(() => {
    const loadDefaults = async () => {
      const loadedProfiles = await storeService.getProfiles();
      setProfiles(loadedProfiles);
      
      if (loadedProfiles.length > 0) {
        // Find latest active profile or use first
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
        
        window.dispatchEvent(new CustomEvent('global-toast', { 
          detail: { message: `已讀取 ${name}` } 
        }));
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
      setStatus('error');
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
      
      // Don't clear content just in case they need to recopy, but flag success
      setStatus('success');
      setSuccessUrl(''); // No specific API URL returned
      setTimeout(() => setStatus('idle'), 5000);

    } catch (err: any) {
      console.error(err);
      setErrorMessage("無法準備瀏覽器草稿。");
      setStatus('error');
    }
  }, [repoName, filePath, content, commitMessage, branch]);

  const handleSync = useCallback(async () => {
    if (!repoName || !filePath || !content) {
      setErrorMessage("請填寫所有必填欄位 (包含儲存庫名稱、檔案路徑與檔案內容)。");
      setStatus('error');
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

      setStatus('syncing');

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
      
      setSuccessUrl(fileUrl);
      setStatus('success');
      
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
      setStatus('error');
    }
  }, [repoName, filePath, content, commitMessage, branch]);

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent animate-slide-in">
      <div className="hidden md:flex h-20 items-center justify-between border-b border-slate-200/60 px-10 bg-white/40 backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0">
        <div className="flex items-center">
          <div className="bg-slate-900/5 p-2 rounded-xl border border-slate-200/50 mr-4">
            <Github className="size-5 text-slate-800" />
          </div>
          <span className="text-sm font-black text-slate-800 tracking-tight">
            INTEGRATION / SINGLE SYNC
          </span>
        </div>
        
        {profiles.length > 0 && (
          <div className="flex items-center space-x-2">
            <UserSquare2 className="size-4 text-slate-500" />
            <select
              value={activeProfileId}
              onChange={handleProfileChange}
              className="bg-slate-50 border border-slate-200 text-slate-700 font-medium text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-4 focus:ring-slate-100 cursor-pointer shadow-sm transition-all"
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id} className="text-slate-800">{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-6 sm:p-12 relative flex flex-col">
        <div className="flex-1 flex flex-col w-full min-w-0 max-w-7xl mx-auto h-full">
          <div className="flex-1 flex flex-col space-y-8 bg-white shadow-sm border border-slate-200 rounded-3xl p-6 sm:p-12">
            <div className="flex flex-col sm:flex-row items-start justify-between pb-6 border-b border-slate-100/50 space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">單一檔案智慧編輯器</h2>
                <p className="text-sm font-bold text-slate-400 mt-2">
                  極致流暢的 API 單檔推播體驗。
                </p>
              </div>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'batch' }))}
                className="flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-xl border border-slate-200 transition-colors active:scale-95 shrink-0 whitespace-nowrap shadow-sm w-full sm:w-auto justify-center"
                title="需要上傳多個檔案？切換至批次同步"
              >
                <Route className="size-4" />
                <span>切換批次同步</span>
              </button>
            </div>

            {smartRouteMsg && (
              <div className="flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-lg shadow-sm animate-fade-in -mt-2">
                <Route className="size-4 mr-2 flex-shrink-0" />
                <span className="font-extrabold mr-1">由智慧路由套用：</span> {smartRouteMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-slate-100 pt-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center">
                    儲存庫 (Repository) <span className="ml-1 text-red-500">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50 transition-all"
                  placeholder="例如：username/repo-name"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  disabled={status === 'syncing' || status === 'analyzing'}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center">
                  分支 (Branch) <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50 transition-all"
                  placeholder="例如：main 或 master"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={status === 'syncing' || status === 'analyzing'}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center">
                  寫入路徑
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50 transition-all"
                  placeholder="例如：src/utils/helpers.js"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  disabled={status === 'syncing' || status === 'analyzing'}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-5">
              <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                <div>
                  提交訊息 (Commit Message) <span className="ml-1 text-slate-400 font-medium text-xs text-pretty">(若保持空白，AI 將自動分析代碼並摘要)</span>
                </div>
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
                  className="flex items-center space-x-1.5 px-2 py-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="size-3" />
                  <span>AI 產生摘要</span>
                </button>
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50 transition-all"
                placeholder="例如：feat: 實作登入功能"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                disabled={status === 'syncing' || status === 'analyzing'}
              />
            </div>

            {/* Validation Feedback */}
            {validationErrors.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-4 animate-fade-in">
                <div className="flex items-center text-xs font-bold text-slate-500 mb-1 uppercase tracking-tight">
                  代碼檢查報告 (Real-time Scan)
                </div>
                {validationErrors.map((err, i) => (
                  <div 
                    key={i} 
                    className={`flex items-center text-xs px-3 py-2 rounded-lg border ${
                      err.severity === 'error' 
                        ? 'bg-red-50 border-red-100 text-red-700' 
                        : 'bg-amber-50 border-amber-100 text-amber-700'
                    }`}
                  >
                    <div className={`size-1.5 rounded-full mr-2 shrink-0 ${
                      err.severity === 'error' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <span className="font-extrabold mr-1">{err.severity === 'error' ? '[錯誤]' : '[警示]'}</span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 flex-1 flex flex-col min-h-[300px] border-t border-slate-100 pt-5">
              <label className="text-sm font-bold text-slate-700 flex items-center justify-between xl:mr-2">
                <div className="flex items-center space-x-2">
                  <span>檔案內容 <span className="ml-1 text-red-500">*</span></span>
                  {editorLanguage !== 'plaintext' && (
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-[10px] uppercase text-slate-700 font-bold tracking-wider border border-slate-200 shadow-sm">
                      {editorLanguage}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={toggleDiffMode}
                    disabled={status === 'syncing' || status === 'analyzing' || isFetchingOriginal}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border shadow-sm transition-all active:scale-95 disabled:opacity-50 ${isDiffMode ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'}`}
                    title={isDiffMode ? "回到編輯模式" : "比對線上版本"}
                  >
                    {isFetchingOriginal ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : isDiffMode ? (
                      <EyeOff className="size-3" />
                    ) : (
                      <Diff className="size-3" />
                    )}
                    <span>{isDiffMode ? '返回編輯' : '版本比對 (Diff)'}</span>
                  </button>
                  <button 
                    onClick={formatCode}
                    disabled={status === 'syncing' || status === 'analyzing' || !content}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-sm transition-colors active:scale-95 disabled:opacity-50"
                  >
                    <Code className="size-3" />
                    <span>排版 (Format)</span>
                  </button>
                  <button 
                    onClick={handlePasteFromClipboard}
                    disabled={status === 'syncing' || status === 'analyzing'}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-sm transition-colors active:scale-95 disabled:opacity-50"
                    title="Cmd/Ctrl + Shift + V"
                  >
                    <ClipboardPaste className="size-3" />
                    <span>貼上代碼</span>
                  </button>
                </div>
              </label>
              <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white focus-within:ring-4 focus-within:ring-slate-100 transition-all flex flex-col relative">
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
                      readOnly: true, // Typically diff view is review-only
                      renderSideBySide: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                      lineHeight: 22,
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
                      fontSize: 14,
                      lineHeight: 22,
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
              <div className="rounded-xl bg-red-50 p-4 border border-red-200 flex items-start shadow-sm mt-4">
                <X className="size-5 text-red-500 shrink-0" />
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-red-800 tracking-tight">推播失敗</h3>
                  <div className="mt-1 text-sm font-medium text-red-600 text-pretty">{errorMessage}</div>
                </div>
              </div>
            )}
            
            {status === 'success' && (
              <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 flex items-center justify-between shadow-sm mt-4 animate-fade-in">
                <div className="flex items-center">
                  <Sparkles className="size-5 text-emerald-500 shrink-0" />
                  <div className="ml-3">
                    <h3 className="text-sm font-bold text-emerald-800 tracking-tight">推播成功</h3>
                  </div>
                </div>
                {successUrl && (
                  <a href={successUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center bg-emerald-100/50 px-3 py-1.5 rounded-lg active:scale-95 transition-colors outline-none focus:ring-4 focus:ring-emerald-100">
                    在 GitHub 上檢視 <ExternalLink className="ml-1 size-3.5" />
                  </a>
                )}
              </div>
            )}

            <div className="mt-auto pt-6 flex justify-end border-t border-slate-100">
              <button
                onClick={handleSync}
                disabled={status === 'syncing' || status === 'analyzing' || !repoName || !content}
                className="flex items-center justify-center space-x-2 rounded-xl bg-slate-900 px-8 py-3.5 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-colors shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
              >
                {(status === 'syncing' || status === 'analyzing') ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Send className="size-5" />
                )}
                <span>
                  {status === 'analyzing' ? '正在使用 AI 分析...' : 
                   status === 'syncing' ? '正在推播至 GitHub...' : '推播變更 (Commit)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
