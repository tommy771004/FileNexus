import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Files, Send, Loader2, FolderUp, FilePlus, CheckCircle2, XCircle, Clock, GitBranch,
  Folder, FolderOpen, File, FileCode2, FileJson, FileText, Image, ChevronRight, ChevronDown,
  FileSearch, Trash2, Sparkles, RefreshCcw, HardDrive, Database, Music, Video, Archive,
  ChevronsDown, ChevronsUp, Maximize
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { syncMultipleFilesViaGitDatabase, getRepoTree } from '../services/githubService';
import { storeService } from '../services/storeService';
import { generateBatchCommitMessage } from '../services/llmService';
import { detectLanguage } from '../services/routingService';
import { Editor } from '@monaco-editor/react';
import { get, set } from 'idb-keyval';
import { motion, AnimatePresence } from 'motion/react';

interface FileItem {
  id: string;
  file: File;
  path: string; // The relative path calculated including folder structure
  status: 'pending' | 'syncing' | 'success' | 'error';
  localStatus: 'new' | 'modified' | 'synced' | 'unknown';
  errorMessage?: string;
  url?: string;
}

type DiffStatus = 'new' | 'modified' | 'synced' | 'unknown';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: Record<string, TreeNode>;
  fileItem?: FileItem;
}

const FileIcon = ({ fileName, className }: { fileName: string; className?: string }) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext || '')) return <FileCode2 className={className || "w-4 h-4 text-blue-500"} />;
  if (['json', 'yaml', 'yml', 'toml'].includes(ext || '')) return <FileJson className={className || "w-4 h-4 text-amber-500"} />;
  if (['html', 'css', 'scss', 'less', 'php', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp'].includes(ext || '')) return <FileCode2 className={className || "w-4 h-4 text-emerald-500"} />;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')) return <Image className={className || "w-4 h-4 text-purple-500"} />;
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext || '')) return <Music className={className || "w-4 h-4 text-pink-500"} />;
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '')) return <Video className={className || "w-4 h-4 text-indigo-500"} />;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext || '')) return <Archive className={className || "w-4 h-4 text-amber-600"} />;
  if (['sql', 'db', 'sqlite', 'mysql', 'psql'].includes(ext || '')) return <Database className={className || "w-4 h-4 text-indigo-400"} />;
  if (['md', 'markdown'].includes(ext || '')) return <FileText className={className || "w-4 h-4 text-sky-500"} />;
  if (['txt', 'log', 'env', 'gitignore', 'dockerignore'].includes(ext || '')) return <FileText className={className || "w-4 h-4 text-slate-500"} />;
  
  return <File className={className || "w-4 h-4 text-slate-400"} />;
};

export default function BatchSync() {
  const [repoName, setRepoName] = useState('');
  const [branch, setBranch] = useState('main');
  const [basePath, setBasePath] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [globalError, setGlobalError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileSyncStates, setFileSyncStates] = useState<Record<string, { lastModified: number; size: number }>>({});
  const [previewContent, setPreviewContent] = useState<{ name: string; content: string; status: string; language?: string; isTruncated?: boolean; file?: File } | null>(null);
  const [activeTab, setActiveTab] = useState<'logs' | 'preview'>('logs');

  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const [customOrder, setCustomOrder] = useState<Record<string, string[]>>({});
  const [draggedItem, setDraggedItem] = useState<{ path: string, type: 'file' | 'folder', parentPath: string, name: string } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ path: string, position: 'before' | 'after' | 'inside', type: 'file' | 'folder', parentPath: string, name: string } | null>(null);

  const [localFolderPath, setLocalFolderPath] = useState('');
  const [hasCachedDir, setHasCachedDir] = useState(false);

  // Add state for date/time filtering
  const [useDateFilter, setUseDateFilter] = useState(false);
  const [filterDateTime, setFilterDateTime] = useState('');

  // Add state for extension filtering
  const [useExtFilter, setUseExtFilter] = useState(false);
  const [filterExtension, setFilterExtension] = useState('.js, .ts, .css, .html');

  const [useDiffFilter, setUseDiffFilter] = useState(false);
  const [githubDiffStates, setGithubDiffStates] = useState<Record<string, DiffStatus>>({});
  const [syncingRepo, setSyncingRepo] = useState(false);

  // Add state for name filtering
  const [filterName, setFilterName] = useState('');

  const [currentSyncingFile, setCurrentSyncingFile] = useState<string | null>(null);
  const [isProgressCollapsed, setIsProgressCollapsed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Set default datetime to 1 hour ago
  useEffect(() => {
    const d = new Date();
    d.setHours(d.getHours() - 1);
    const pad = (n: number) => n.toString().padStart(2, '0');
    // Format to YYYY-MM-DDThh:mm
    const localTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setFilterDateTime(localTime);
    
    // Load directory cache state
    get('local_dir_handle_path').then(path => {
      if (path) setLocalFolderPath(path);
    });
    get('local_dir_handle').then(handle => {
      if (handle) setHasCachedDir(true);
    });
  }, []);

  const getLocalStatus = useCallback((path: string, file: File): 'new' | 'modified' | 'synced' | 'unknown' => {
    const diffStatus = githubDiffStates[path];
    if (diffStatus && diffStatus !== 'unknown') return diffStatus;

    if (!repoName || !repoName.includes('/')) return 'unknown';
    const targetPath = cleanPath(basePath, path);
    const key = `${repoName}:${targetPath}`;
    const state = fileSyncStates[key];
    if (!state) return 'unknown';
    
    const isModified = file.lastModified !== state.lastModified || file.size !== state.size;
    return isModified ? 'modified' : 'synced';
  }, [repoName, fileSyncStates, basePath, githubDiffStates]);

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      let keep = true;
      if (filterName) {
        const query = filterName.toLowerCase();
        if (!f.file.name.toLowerCase().includes(query) && !f.path.toLowerCase().includes(query)) {
          keep = false;
        }
      }
      if (useDateFilter && filterDateTime) {
        const cutoffTime = new Date(filterDateTime).getTime();
        // If file.lastModified is less than cutoff, hide it
        if (f.file.lastModified < cutoffTime) keep = false;
      }
      if (useExtFilter && filterExtension) {
        const exts = filterExtension.split(',').map(ext => ext.trim().toLowerCase()).filter(Boolean);
        if (exts.length > 0) {
          const nameRaw = f.file.name.toLowerCase();
          const matchesExt = exts.some(ext => nameRaw.endsWith(ext.startsWith('.') ? ext : `.${ext}`));
          if (!matchesExt) keep = false;
        }
      }
      if (useDiffFilter) {
        const diffStatus = githubDiffStates[f.path];
        if (!diffStatus || diffStatus === 'synced' || diffStatus === 'unknown') keep = false;
      }
      return keep;
    });
  }, [files, filterName, useDateFilter, filterDateTime, useExtFilter, filterExtension, useDiffFilter, githubDiffStates]);

  const processFilesArray = useCallback((fileArray: File[], append = true, source = 'drag') => {
    let topLevelDir = '';
    let allShareTopLevel = false;

    // Filter out common ignored directories to avoid performance issues
    const filteredArray = fileArray.filter(f => {
      const path = f.webkitRelativePath || f.name;
      const parts = path.split('/');
      return !parts.some(p => p === 'node_modules' || p === '.git' || p === '.next' || p === 'dist' || p === 'build');
    });

    if (filteredArray.length > 0) {
      const firstPath = filteredArray[0].webkitRelativePath;
      if (firstPath && firstPath.includes('/')) {
        topLevelDir = firstPath.split('/')[0] + '/';
        allShareTopLevel = filteredArray.every(f => f.webkitRelativePath.startsWith(topLevelDir));
      }
    }

    const newFiles: FileItem[] = filteredArray.map((file, index) => {
      let path = file.webkitRelativePath || file.name;
      if (allShareTopLevel && path.startsWith(topLevelDir)) {
        path = path.substring(topLevelDir.length);
      }
      return {
        id: `${Date.now()}_${source}_${index}`,
        file,
        path: path || file.name,
        status: 'pending',
        localStatus: getLocalStatus(path || file.name, file)
      };
    });

    setFiles(prev => append ? [...prev, ...newFiles] : newFiles);
    
    if (source === 'drag') {
      window.dispatchEvent(new CustomEvent('global-toast', { 
        detail: { message: `已匯入 ${newFiles.length} 個檔案至批次同步 (已略過 node_modules 等目錄)。` } 
      }));
    }
  }, [getLocalStatus]);

  // Handle global batch drop
  useEffect(() => {
    const handleGlobalBatchDrop = (e: any) => {
      if (e.detail?.files && Array.isArray(e.detail.files)) {
        processFilesArray(e.detail.files as File[], true, 'drag');
      }
    };
    window.addEventListener('global-batch-drop', handleGlobalBatchDrop);
    return () => window.removeEventListener('global-batch-drop', handleGlobalBatchDrop);
  }, [processFilesArray]);

  // Load default repo from settings and sync states
  useEffect(() => {
    const loadDefaults = async () => {
      const savedOwner = await storeService.get('github_owner');
      const savedRepo = await storeService.get('github_repo');
      if (savedOwner && savedRepo) {
        setRepoName(`${savedOwner}/${savedRepo}`);
      } else if (savedOwner) {
        setRepoName(`${savedOwner}/`);
      }

      const states = await storeService.getFileSyncState();
      setFileSyncStates(states);
    };
    loadDefaults();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileArray = Array.from(e.target.files) as File[];
    processFilesArray(fileArray, true);
    e.target.value = ''; // Reset input so the same files can be selected again if removed
  };

  const getFilesRecurse = async (dirHandle: any, path: string = ''): Promise<File[]> => {
    const files: File[] = [];
    // @ts-ignore
    for await (const entry of dirHandle.values()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'dist' || entry.name === 'build') {
            continue;
        }

        if (entry.kind === 'file') {
            const file = await entry.getFile();
            Object.defineProperty(file, 'webkitRelativePath', {
                value: `${path}${entry.name}`
            });
            files.push(file);
        } else if (entry.kind === 'directory') {
            files.push(...await getFilesRecurse(entry, `${path}${entry.name}/`));
        }
    }
    return files;
  };

  const handleSelectDirectoryAPI = async () => {
    if (!('showDirectoryPicker' in window)) {
      window.dispatchEvent(new CustomEvent('global-toast', { 
        detail: { message: '您的瀏覽器不支援目錄選取功能，請嘗試使用最新版 Chrome 或 Edge。' } 
      }));
      return;
    }

    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      await set('local_dir_handle', dirHandle);
      await set('local_dir_handle_path', dirHandle.name);
      setLocalFolderPath(dirHandle.name);
      setHasCachedDir(true);
      
      setIsProcessing(true);
      setLogs(prev => [...prev, `[System] 正在掃描目錄 ${dirHandle.name}...`]);
      const fileArray = await getFilesRecurse(dirHandle, '');
      processFilesArray(fileArray, false);
      setIsProcessing(false);
      setLogs(prev => [...prev, `[System] 已載入目錄 ${dirHandle.name}，共 ${fileArray.length} 個檔案。`]);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Directory selection failed:', err);
        const errorMsg = err.name === 'SecurityError' ? '瀏覽器安全性限制（可能是因為在 iframe 中執行），無法開啟目錄選取器。' : (err.message || '未知錯誤');
        setLogs(prev => [...prev, `[Error] 無法選取目錄：${errorMsg}`]);
        window.dispatchEvent(new CustomEvent('global-toast', { 
          detail: { message: `選取失敗：${errorMsg}` } 
        }));
      }
      setIsProcessing(false);
    }
  };

  const handleReloadDirectoryAPI = async () => {
    if (!('showDirectoryPicker' in window)) return;
    
    try {
      const dirHandle = await get('local_dir_handle');
      if (!dirHandle) {
        setHasCachedDir(false);
        return;
      }
      
      setLogs(prev => [...prev, `[System] 正在請求存取許可：${dirHandle.name}...`]);

      // Request permission if needed
      // @ts-ignore
      if (await dirHandle.queryPermission({ mode: 'read' }) !== 'granted') {
          // @ts-ignore
          const permission = await dirHandle.requestPermission({ mode: 'read' });
          if (permission !== 'granted') {
            setLogs(prev => [...prev, `[Warning] 用戶拒絕了目錄存取許可。`]);
            return;
          }
      }

      setIsProcessing(true);
      setLogs(prev => [...prev, `[System] 正在重新掃描目錄 ${dirHandle.name}...`]);
      const fileArray = await getFilesRecurse(dirHandle, '');
      processFilesArray(fileArray, false);
      setIsProcessing(false);
      setLogs(prev => [...prev, `[System] 已重新載入專案，共 ${fileArray.length} 個檔案。`]);
      
      window.dispatchEvent(new CustomEvent('global-toast', { 
        detail: { message: `已還原快取目錄：${dirHandle.name}` } 
      }));
    } catch (err: any) {
      console.error('Reload failed:', err);
      // If the handle is dead (e.g. site shifted or deleted in IDB)
      if (err.name === 'NotFoundError' || err.name === 'NotAllowedError') {
        setLogs(prev => [...prev, `[Error] 無法使用先前的目錄控制項，請重新選擇資料夾。`]);
        setHasCachedDir(false);
      } else {
        setLogs(prev => [...prev, `[Error] 載入失敗：${err.message || '未知錯誤'}`]);
      }
      setIsProcessing(false);
    }
  };

  const removeFile = useCallback((id: string) => {
    if (isProcessing) return;
    setFiles(prev => prev.filter(f => f.id !== id));
  }, [isProcessing]);

  const readFileAsBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Data URL format: "data:image/png;base64,iVBORw0K..."
        // We need to strip the prefix
        const [meta, base64Data] = result.split(',');
        // For completely empty text files, base64Data might be undefined
        resolve(base64Data || ''); 
      };
      reader.onerror = reject;
      // Read as DataURL guarantees robust binary handling
      reader.readAsDataURL(file);
    });
  }, []);

  const handleBatchSync = useCallback(async () => {
    if (!repoName.includes('/')) {
      setGlobalError('儲存庫格式無效。必須為 "owner/repo"。');
      return;
    }
    
    if (filteredFiles.length === 0) {
      setGlobalError('請至少選擇一個檔案進行同步。');
      return;
    }

    setGlobalError('');
    setIsProcessing(true);
    setLogs([]);
    setProgress({ current: 0, total: filteredFiles.length });

    const token = await storeService.get('github_pat');
    
    // Filter out files that are already successfully uploaded
    const filesToProcess = filteredFiles.filter(f => f.status !== 'success');

    let finalCommitMessage = commitMessage;
    
    try {
      // 0. AI Analysis of the whole batch
      if (!finalCommitMessage.trim() && filesToProcess.length > 0) {
        setIsAnalyzing(true);
        setLogs(prev => [...prev, `[AI] 正在分析批次內容以生成摘要...`]);
        
        // Read contents for AI (limit to first few files to avoid token limits)
        const sampleFiles = await Promise.all(
          filesToProcess.slice(0, 10).map(async (f) => ({
            path: f.path,
            content: await f.file.slice(0, 1000).text()
          }))
        );
        
        finalCommitMessage = await generateBatchCommitMessage(sampleFiles);
        setCommitMessage(finalCommitMessage);
        setLogs(prev => [...prev, `[AI] 生成摘要：${finalCommitMessage}`]);
        setIsAnalyzing(false);
      }

      // 1. Prepare files and read contents
      setLogs(prev => [...prev, `[System] 正在準備 ${filesToProcess.length} 個檔案...`]);
      const filePayloads = await Promise.all(
        filesToProcess.map(async (f) => {
          setFiles(prev => prev.map(file => 
            file.id === f.id ? { ...file, status: 'syncing', errorMessage: undefined } : file
          ));

          const base64Content = await readFileAsBase64(f.file);
          const targetPath = cleanPath(basePath, f.path);

          return {
            id: f.id,
            path: targetPath,
            content: base64Content,
            isBase64: true 
          };
        })
      );

      // 2. Perform the 6-Step Git Database API Batch Upload
      setLogs(prev => [...prev, `[System] 檔案準備完畢。開始啟動 Git API 核心序列...`]);
      const result = await syncMultipleFilesViaGitDatabase(
        repoName,
        branch,
        finalCommitMessage || `批次上傳 ${filePayloads.length} 個檔案`,
        filePayloads,
        token,
        (msg) => {
          setLogs(prev => [...prev, msg]);
          
          const match = msg.match(/\[(\d+)\/(\d+)\]/);
          if (match) {
            const current = parseInt(match[1]);
            const total = parseInt(match[2]);
            setProgress({ current, total });

            const isStart = msg.includes("正在同步:");
            const isDone = msg.includes("同步成功");
            
            if (isStart || isDone) {
               const pMatch = msg.match(/(?:正在同步:|✅)\s*(.+?)(?:\s*\.\.\.|\s*同步成功)/);
               if (pMatch) {
                 const extractedPath = pMatch[1].trim();
                 if (isStart) setCurrentSyncingFile(extractedPath);
                 setFiles(prev => prev.map(f => {
                   const fPath = cleanPath(basePath, f.path);
                   if (fPath === extractedPath) {
                      return { ...f, status: isDone ? 'success' as const : 'syncing' as const };
                   }
                   return f;
                 }));
               }
            }
          }
        }
      );

      // 3. Set success status for all processed files
      const syncMetadata = filePayloads.map(p => ({
        path: p.path,
        lastModified: files.find(f => f.id === p.id)?.file.lastModified || 0,
        size: files.find(f => f.id === p.id)?.file.size || 0
      }));

      await storeService.updateFileSyncStateForFiles(repoName, syncMetadata);
      
      // Update local set of states to refresh UI immediately
      const newStates = await storeService.getFileSyncState();
      setFileSyncStates(newStates);

      setFiles(prev => prev.map(file => {
        const payloadMatch = filePayloads.find(p => p.id === file.id);
        if (payloadMatch) {
          return { ...file, status: 'success', url: result.html_url };
        }
        return file;
      }));

      setProgress({ current: filteredFiles.length, total: filteredFiles.length });
      
      // Update history once for the whole batch
      await storeService.addHistory({
        id: Date.now().toString(),
        timestamp: Date.now(),
        message: `[批次 API 同步] ${finalCommitMessage || '批次檔案上傳'}`,
        path: `(共 ${filePayloads.length} 個檔案)`,
        url: result.html_url
      });

    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || '未知錯誤';
      setGlobalError(`批次同步失敗: ${errorMessage}`);
      
      setLogs(prev => [...prev, `[Error] 批次作業中斷：${errorMessage}`]);
      setLogs(prev => [...prev, `[Error] 請檢查網路連線或 GitHub Token 權限，並點擊下方「重試失敗檔案」按鈕。`]);

      setFiles(prev => prev.map(file => 
        file.status === 'syncing' ? { ...file, status: 'error', errorMessage: errorMessage } : file
      ));
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
    }
  }, [repoName, branch, basePath, commitMessage, files, filteredFiles, readFileAsBase64]);

  const clearAll = useCallback(() => {
    if (isProcessing) return;
    setFiles([]);
    setGlobalError('');
    setLogs([]);
  }, [isProcessing]);

  const retryFailed = useCallback(() => {
    if (isProcessing) return;
    // Set failed files back to pending
    setFiles(prev => prev.map(f => 
      f.status === 'error' ? { ...f, status: 'pending', errorMessage: undefined } : f
    ));
    setGlobalError('');
    // Start sync
    setTimeout(() => handleBatchSync(), 100);
  }, [isProcessing, handleBatchSync]);

  const cleanPath = (base: string, relative: string) => {
    let combined = base ? `${base}/${relative}` : relative;
    // Remove duplicate slashes, leading slashes, and current directory ./ 
    combined = combined.replace(/\/+/g, '/')
                       .replace(/^\//, '')
                       .replace(/(^|\/)\.\//g, '$1');
    return combined;
  };

  const computeGitSha = async (file: File): Promise<string[]> => {
    const buffer = await file.arrayBuffer();
    const originalContent = new Uint8Array(buffer);
    const shas: string[] = [];

    const getHash = async (content: Uint8Array) => {
      const prefix = "blob " + content.length + "\0";
      const prefixBuffer = new TextEncoder().encode(prefix);
      const blobBuffer = new Uint8Array(prefixBuffer.length + content.length);
      blobBuffer.set(prefixBuffer);
      blobBuffer.set(content, prefixBuffer.length);
      const hashBuffer = await crypto.subtle.digest('SHA-1', blobBuffer);
      return Array.from(new Uint8Array(hashBuffer)).map((b: number) => b.toString(16).padStart(2, '0')).join('');
    };

    // 1. Calculate for original format
    shas.push(await getHash(originalContent));

    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let text = decoder.decode(originalContent);
      
      // Remove UTF-8 BOM if present
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
        const noBomContent = new TextEncoder().encode(text);
        shas.push(await getHash(noBomContent));
      }

      // Check different line endings combos
      if (!text.includes('\0')) {
        // 2. LF normalized
        const lfText = text.replace(/\r\n/g, '\n');
        if (lfText !== text) {
          const lfContent = new TextEncoder().encode(lfText);
          shas.push(await getHash(lfContent));
        }

        // 3. CRLF normalized (in case git has CRLF)
        const crlfText = lfText.replace(/\n/g, '\r\n');
        if (crlfText !== text) {
          const crlfContent = new TextEncoder().encode(crlfText);
          shas.push(await getHash(crlfContent));
        }
      }
    } catch (e) {
      // Decode failed (binary file), so we only rely on originalContent
    }

    return shas;
  };

  const handleSyncRepo = async () => {
    if (!repoName.includes('/')) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: '請輸入有效的 GitHub 儲存庫名稱' } }));
      return;
    }
    setSyncingRepo(true);
    setLogs(prev => [...prev, `[System] 正在與 GitHub Repo 比對差異...`]);
    try {
      const tree = await getRepoTree(repoName, branch);
      const treeMap = new Map(tree.map((t: any) => [t.path, t.sha]));
      console.log(`[Diff] Repo Tree keys sample:`, Array.from(treeMap.keys()).slice(0, 10));
      
      const newDiffs: Record<string, DiffStatus> = {};
      const newSyncStates: Record<string, { lastModified: number; size: number }> = { ...fileSyncStates };
      let anyDiff = false;
      let diffCount = 0;
      
      const diffResults = await Promise.all(
        files.map(async (f) => {
          let fPath = cleanPath(basePath, f.path);
          if (fPath.startsWith('/')) fPath = fPath.substring(1);

          console.log(`[Diff] Checking path: '${fPath}' (Original: '${f.path}', Base: '${basePath}')`);
          const ghSha = treeMap.get(fPath) as string;
          if (!ghSha) {
            return { f, fPath, isDiff: true, diffStatus: 'new' as DiffStatus, localSha: null, ghSha: null };
          }

          try {
            const localShas = await computeGitSha(f.file);
            const isDiff = !localShas.includes(ghSha);
            return {
              f,
              fPath,
              isDiff,
              diffStatus: (isDiff ? 'modified' : 'synced') as DiffStatus,
              localSha: localShas[0],
              ghSha
            };
          } catch (err) {
            console.error(`Error computing SHA for ${f.path}`, err);
            return { f, fPath, isDiff: true, diffStatus: 'modified' as DiffStatus, localSha: null, ghSha };
          }
        })
      );

      for (const result of diffResults) {
        const { f, fPath, isDiff, diffStatus, localSha, ghSha } = result;
        newDiffs[f.path] = diffStatus;
        if (isDiff) {
          console.debug(`[Diff] ${diffStatus.toUpperCase()} file detected. Workspace: ${f.path} -> Repo: ${fPath} | Local SHA: ${localSha} | Remote SHA: ${ghSha}`);
          anyDiff = true;
          diffCount++;
          delete newSyncStates[`${repoName}:${fPath}`];
        } else {
          newSyncStates[`${repoName}:${fPath}`] = { lastModified: f.file.lastModified, size: f.file.size };
        }
      }
      
      setGithubDiffStates(newDiffs);
      setUseDiffFilter(true);
      setFileSyncStates(newSyncStates);
      
      // Update local storage for synced files
      const syncMetadata = Object.keys(newSyncStates)
        .filter(k => k.startsWith(repoName + ':'))
        .map(k => ({
           path: k.substring(repoName.length + 1),
           lastModified: newSyncStates[k].lastModified,
           size: newSyncStates[k].size
        }));
      await storeService.updateFileSyncStateForFiles(repoName, syncMetadata);

      setLogs(prev => [...prev, `[System] 比對完成！發現 ${diffCount} 個差異檔案。已啟用過濾檢視。`]);
      window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: `比對完成，顯示 ${diffCount} 個差異檔案` } }));
    } catch (err: any) {
      console.error(err);
      setLogs(prev => [...prev, `[Error] 無法比對：${err.message}`]);
    } finally {
      setSyncingRepo(false);
    }
  };

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Transform flat list to tree
  const fileTree = useMemo(() => {
    const root: Record<string, TreeNode> = {};
    
    filteredFiles.forEach(file => {
      const parts = file.path.split('/');
      let current = root;
      
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');
        
        if (!current[part]) {
          current[part] = {
            name: part,
            path: currentPath,
            type: isLast ? 'file' : 'folder',
            children: {},
            fileItem: isLast ? file : undefined
          };
        }
        current = current[part].children;
      });
    });
    
    return root;
  }, [files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const expandAll = () => {
    const newExpanded: Record<string, boolean> = {};
    const traverse = (nodes: Record<string, TreeNode>) => {
      Object.values(nodes).forEach(node => {
        if (node.type === 'folder') {
          newExpanded[node.path] = true;
          traverse(node.children);
        }
      });
    };
    traverse(fileTree);
    setExpandedFolders(newExpanded);
  };

  const collapseAll = () => {
    setExpandedFolders({});
  };

  const getVisibleOrderedFileIds = useCallback(() => {
    const ids: string[] = [];
    const traverse = (nodes: Record<string, TreeNode>, parentPath = '') => {
      const orderArr = customOrder[parentPath];
      const sortedEntries = Object.entries(nodes).sort((a, b) => {
        if (orderArr) {
          const aIdx = orderArr.indexOf(a[0]);
          const bIdx = orderArr.indexOf(b[0]);
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
        }
        if (a[1].type !== b[1].type) return a[1].type === 'folder' ? -1 : 1;
        return a[0].localeCompare(b[0]);
      });
      sortedEntries.forEach(([_, node]) => {
        if (node.type === 'folder') {
          if (expandedFolders[node.path] !== false) {
            traverse(node.children, node.path);
          }
        } else if (node.fileItem) {
          ids.push(node.fileItem.id);
        }
      });
    };
    traverse(fileTree);
    return ids;
  }, [fileTree, expandedFolders, customOrder]);

  const handleFileClick = useCallback(async (e: React.MouseEvent, fileItem: FileItem) => {
    if (isProcessing) return;
    
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      setSelectedFileIds(prev => {
        const next = new Set(prev);
        if (next.has(fileItem.id)) next.delete(fileItem.id);
        else next.add(fileItem.id);
        return next;
      });
      setLastSelectedId(fileItem.id);
      
      // If we unselected the only file being previewed, maybe clear it? But we'll leave it for now.
    } else if (e.shiftKey && lastSelectedId) {
      e.stopPropagation();
      const visibleIds = getVisibleOrderedFileIds();
      const startIdx = visibleIds.indexOf(lastSelectedId);
      const endIdx = visibleIds.indexOf(fileItem.id);
      if (startIdx !== -1 && endIdx !== -1) {
        const min = Math.min(startIdx, endIdx);
        const max = Math.max(startIdx, endIdx);
        setSelectedFileIds(prev => {
          const next = new Set(prev);
          for (let i = min; i <= max; i++) {
            next.add(visibleIds[i]);
          }
          return next;
        });
      }
      return; // Skip preview if multi-selecting via shift
    } else {
      setSelectedFileIds(new Set([fileItem.id]));
      setLastSelectedId(fileItem.id);
    }

    const file = fileItem.file;
    const isText = file.type.startsWith('text/') || 
                   ['js', 'jsx', 'ts', 'tsx', 'json', 'md', 'html', 'css', 'txt'].includes(file.name.split('.').pop()?.toLowerCase() || '');

    if (!isText) {
      window.dispatchEvent(new CustomEvent('global-toast', { 
        detail: { message: `無法預覽二進位檔案: ${file.name}` } 
      }));
      return;
    }

    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file.size > 50000 ? file.slice(0, 50000) : file);
      });

      const currentStatus = getLocalStatus(fileItem.path, fileItem.file);
      const statusLabel = currentStatus === 'modified' ? '已修改 MODIFIED' : 
                          currentStatus === 'synced' ? '已同步 SYNCED' : '全新檔案 NEW';
                          
      const extensionLabel = fileItem.file.name.split('.').pop()?.toLowerCase();
      let lang = 'plaintext';
      if (extensionLabel) {
        if (['js', 'jsx', 'mjs', 'cjs'].includes(extensionLabel)) lang = 'javascript';
        else if (['ts', 'tsx'].includes(extensionLabel)) lang = 'typescript';
        else if (['json'].includes(extensionLabel)) lang = 'json';
        else if (['md', 'markdown'].includes(extensionLabel)) lang = 'markdown';
        else if (['html'].includes(extensionLabel)) lang = 'html';
        else if (['css'].includes(extensionLabel)) lang = 'css';
        else if (['scss', 'sass'].includes(extensionLabel)) lang = 'scss';
        else if (['less'].includes(extensionLabel)) lang = 'less';
        else if (['xml'].includes(extensionLabel)) lang = 'xml';
        else if (['yaml', 'yml'].includes(extensionLabel)) lang = 'yaml';
        else if (['sh', 'bash'].includes(extensionLabel)) lang = 'shell';
        else if (['py'].includes(extensionLabel)) lang = 'python';
        else if (['java'].includes(extensionLabel)) lang = 'java';
        else if (['c'].includes(extensionLabel)) lang = 'c';
        else if (['cpp', 'cxx', 'cc'].includes(extensionLabel)) lang = 'cpp';
        else if (['go'].includes(extensionLabel)) lang = 'go';
        else if (['rs'].includes(extensionLabel)) lang = 'rust';
        else if (['rb'].includes(extensionLabel)) lang = 'ruby';
        else if (['php'].includes(extensionLabel)) lang = 'php';
        else if (['sql'].includes(extensionLabel)) lang = 'sql';
        else if (['cs'].includes(extensionLabel)) lang = 'csharp';
        else {
           lang = detectLanguage(content);
        }
      } else {
        lang = detectLanguage(content);
      }

      setPreviewContent({
        name: fileItem.file.name,
        // Increase truncation limit so more code can be previewed
        content: content + (file.size > 50000 ? '\n\n// 內容過長，僅顯示前 50000 字元' : ''),
        status: statusLabel,
        language: lang,
        isTruncated: file.size > 50000,
        file
      });
      setActiveTab('preview');
    } catch (err) {
      console.error('Preview error:', err);
    }
  }, [isProcessing, getLocalStatus]);

  const handleDragStart = (e: React.DragEvent, item: { path: string, type: 'file' | 'folder', parentPath: string, name: string }) => {
    e.stopPropagation();
    setDraggedItem(item);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.path);
    }
  };

  const handleDragOver = (e: React.DragEvent, item: { path: string, type: 'file' | 'folder', parentPath: string, name: string }) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.path === item.path) return;
    
    // Prevent dragging folder into its own descendants
    if (draggedItem.type === 'folder' && item.path.startsWith(draggedItem.path + '/')) {
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    let position: 'before' | 'after' | 'inside' = 'inside';

    if (item.type === 'folder') {
      if (y < rect.height * 0.25) position = 'before';
      else if (y > rect.height * 0.75) position = 'after';
      else position = 'inside';
    } else {
      position = y < rect.height / 2 ? 'before' : 'after';
    }

    setDragOverItem({ ...item, position });
  };

  const clearDrag = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleTreeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || !dragOverItem) {
       clearDrag();
       return;
    }
    if (draggedItem.path === dragOverItem.path) {
       clearDrag();
       return;
    }
    if (draggedItem.type === 'folder' && dragOverItem.path.startsWith(draggedItem.path + '/')) {
       clearDrag();
       return;
    }

    let targetParentPath = dragOverItem.parentPath;
    let movedToNewFolder = false;
    let newPathPrefix = '';
    
    if (dragOverItem.position === 'inside' && dragOverItem.type === 'folder') {
       targetParentPath = dragOverItem.path;
       movedToNewFolder = targetParentPath !== draggedItem.parentPath;
       newPathPrefix = targetParentPath ? `${targetParentPath}/` : '';
    } else {
       movedToNewFolder = targetParentPath !== draggedItem.parentPath;
       newPathPrefix = targetParentPath ? `${targetParentPath}/` : '';
    }

    const newPath = newPathPrefix + draggedItem.name;

    if (movedToNewFolder) {
       setFiles(prev => prev.map(f => {
          if (draggedItem.type === 'file' && f.path === draggedItem.path) {
             return { ...f, path: newPath };
          } else if (draggedItem.type === 'folder' && f.path.startsWith(draggedItem.path + '/')) {
             return { ...f, path: newPath + f.path.substring(draggedItem.path.length) };
          }
          return f;
       }));
    }

    setCustomOrder(prev => {
       const next = { ...prev };
       if (next[draggedItem.parentPath]) {
          next[draggedItem.parentPath] = next[draggedItem.parentPath].filter(n => n !== draggedItem.name);
       }
       
       // Build current children for target
       let existingChildren: string[] = [];
       if (next[targetParentPath]) {
         existingChildren = next[targetParentPath];
       } else {
         // Get from fileTree if possible, or just build what we know
         // Due to moving, let's keep it simple: if not in custom order, we just append or we just rely on sort.
         // Actually, if we just push it, the rest will sort alphabetically. Let's just create an array.
         existingChildren = [];
         const traverseFind = (nodes: Record<string, TreeNode>, currentPath: string): string[] | null => {
           if (currentPath === targetParentPath) return Object.keys(nodes);
           for (const key in nodes) {
             if (nodes[key].type === 'folder' && targetParentPath.startsWith(nodes[key].path)) {
               const res = traverseFind(nodes[key].children, nodes[key].path);
               if (res) return res;
             }
           }
           return null;
         };
         const found = traverseFind(fileTree, '');
         if (found) existingChildren = [...found];
       }
       
       let tArr = existingChildren.filter(n => n !== draggedItem.name);
       
       if (dragOverItem.position === 'inside') {
          tArr.push(draggedItem.name);
       } else {
          const insertIdx = tArr.indexOf(dragOverItem.name);
          if (insertIdx !== -1) {
             tArr.splice(dragOverItem.position === 'before' ? insertIdx : insertIdx + 1, 0, draggedItem.name);
          } else {
             tArr.push(draggedItem.name);
          }
       }
       next[targetParentPath] = tArr;
       return next;
    });
    
    clearDrag();
  };

  type FlatNode = {
    id: string;
    name: string;
    depth: number;
    type: 'folder' | 'file';
    node: TreeNode;
    parentPath: string;
  };

  const flattenTree = useCallback((nodes: Record<string, TreeNode>, depth = 0, parentPath = ''): FlatNode[] => {
    const result: FlatNode[] = [];
    const orderArr = customOrder[parentPath];
    const sortedEntries = Object.entries(nodes).sort((a, b) => {
      if (orderArr) {
        const aIdx = orderArr.indexOf(a[0]);
        const bIdx = orderArr.indexOf(b[0]);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
      }
      if (a[1].type !== b[1].type) return a[1].type === 'folder' ? -1 : 1;
      return a[0].localeCompare(b[0]);
    });

    for (const [name, node] of sortedEntries) {
      const isExpanded = expandedFolders[node.path] !== false;
      result.push({
        id: node.type === 'file' ? node.fileItem!.id : node.path,
        name,
        depth,
        type: node.type,
        node,
        parentPath
      });

      if (node.type === 'folder' && isExpanded) {
        result.push(...flattenTree(node.children, depth + 1, node.path));
      }
    }
    return result;
  }, [customOrder, expandedFolders]);

  const flattenedTree = useMemo(() => {
    return flattenTree(fileTree);
  }, [fileTree, flattenTree]);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: flattenedTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback((index: number) => {
      const item = flattenedTree[index];
      return item.type === 'folder' ? 32 : 46;
    }, [flattenedTree]),
    overscan: 10,
  });

  const renderVirtualRow = (virtualRow: any) => {
    const item = flattenedTree[virtualRow.index];
    const { name, node, depth, parentPath } = item;
    
    const isDragOver = dragOverItem?.path === node.path;
    const dropPosition = dragOverItem?.position;
    const dropClass = isDragOver ? (
      dropPosition === 'inside' ? 'bg-blue-100/50 ring-2 ring-blue-400' :
      dropPosition === 'before' ? 'border-t-2 border-t-blue-500' :
      'border-b-2 border-b-blue-500'
    ) : '';

    if (node.type === 'folder') {
      const isExpanded = expandedFolders[node.path] !== false;
      return (
        <div key={virtualRow.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}>
          <div className="flex flex-col relative px-2">
            <div 
              draggable
              onDragStart={(e) => handleDragStart(e, { path: node.path, type: 'folder', parentPath, name })}
              onDragOver={(e) => handleDragOver(e, { path: node.path, type: 'folder', parentPath, name })}
              onDrop={handleTreeDrop}
              onDragEnd={clearDrag}
              onClick={() => toggleFolder(node.path)}
              className={`flex items-center space-x-2 py-1 px-2 hover:bg-slate-200/50 cursor-pointer transition-colors group rounded-md ${dropClass}`}
              style={{ paddingLeft: `${depth * 12 + 4}px` }}
            >
              <div className="flex items-center transition-transform duration-200 shrink-0">
                {isExpanded ? 
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" /> : 
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                }
              </div>
              <div className="shrink-0">
                {isExpanded ? 
                  <FolderOpen className="w-4 h-4 text-amber-400 fill-amber-400/10" /> : 
                  <Folder className="w-4 h-4 text-amber-300 fill-amber-300/5" />
                }
              </div>
              <span className="text-xs font-bold text-slate-700 truncate select-none">{name}</span>
            </div>
          </div>
        </div>
      );
    }

    const file = node.fileItem!;
    const currentLocalStatus = getLocalStatus(file.path, file.file);
    const isSelected = selectedFileIds.has(file.id);
    
    return (
      <div key={virtualRow.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}>
        <div className="px-2 pb-0.5 pt-0.5">
          <div 
            draggable
            onDragStart={(e) => handleDragStart(e, { path: node.path, type: 'file', parentPath, name })}
            onDragOver={(e) => handleDragOver(e, { path: node.path, type: 'file', parentPath, name })}
            onDrop={handleTreeDrop}
            onDragEnd={clearDrag}
            onClick={(e) => handleFileClick(e, file)}
            className={`flex justify-between items-center py-1.5 px-3 hover:bg-white transition-all duration-200 group rounded-lg border cursor-pointer ${isSelected ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-100' : 'border-transparent hover:border-slate-200/60'} ${dropClass}`}
            style={{ marginLeft: `${depth * 12 + 20}px` }}
          >
            <div className="flex flex-col flex-1 min-w-0 pr-2">
              <div className="flex items-center space-x-2.5">
                <div className="relative shrink-0">
                  <FileIcon fileName={name} />
                  {currentLocalStatus === 'modified' && (
                    <div className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-amber-500 ring-1 ring-white" title="檔案已修改" />
                  )}
                  {currentLocalStatus === 'new' && (
                    <div className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-blue-500 ring-1 ring-white" title="全新檔案" />
                  )}
                </div>
                
                <div className="flex items-center space-x-2 min-w-0">
                  <span className={`text-[13px] truncate leading-tight ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`} title={file.path}>
                    {name}
                  </span>
                  
                  <div className="hidden sm:flex items-center space-x-1 shrink-0">
                    {currentLocalStatus === 'modified' && (
                      <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/40">
                        已修改
                      </span>
                    )}
                    {currentLocalStatus === 'new' && (
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/40">
                        新增
                      </span>
                    )}
                    {currentLocalStatus === 'synced' && (

                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/40">
                        已同步
                      </span>
                    )}
                    {currentLocalStatus === 'unknown' && (
                      <span className="text-[10px] font-black text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/40">
                        全新檔案
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {file.status === 'syncing' && (
                <div className="w-full mt-1.5 flex items-center space-x-2 pl-6">
                  <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full w-1/3 animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite]" style={{ transform: 'translateX(100%)' }} />
                  </div>
                  <span className="text-[10px] text-blue-500 font-bold whitespace-nowrap">上傳中...</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {file.status === 'syncing' ? (
                <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
              ) : file.status === 'success' ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              ) : file.status === 'error' ? (
                <div className="flex items-center space-x-1">
                  <XCircle className="w-3 h-3 text-red-500" />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'pending', errorMessage: undefined } : f));
                      setTimeout(() => handleBatchSync(), 100);
                    }}
                    className="p-1 hover:bg-red-50 rounded text-red-500 group/retry transition-colors"
                  >
                    <RefreshCcw className="w-2.5 h-2.5 group-hover/retry:rotate-180 transition-transform duration-500" />
                  </button>
                </div>
              ) : null}
              
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                disabled={isProcessing}
                className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0 p-1"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden animate-slide-in">
      <div className="hidden md:flex h-20 items-center justify-between border-b border-slate-200/60 px-10 bg-white/40 backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0">
        <div className="flex items-center">
          <div className="bg-slate-900/5 p-2 rounded-xl border border-slate-200/50 mr-4">
            <Files className="size-5 text-slate-800" />
          </div>
          <span className="text-sm font-black text-slate-800 tracking-tight uppercase">
            INTEGRATION / BATCH SYNC ENGINE
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 sm:p-12 relative flex flex-col">
        <div className="flex-1 flex flex-col w-full min-w-0 max-w-7xl mx-auto h-full">
          <div className="flex-1 flex flex-col space-y-8 bg-white shadow-sm border border-slate-200 rounded-3xl p-6 sm:p-12">
            <div className="flex flex-col sm:flex-row items-start justify-between pb-6 border-b border-slate-100/50 space-y-4 sm:space-y-0 text-pretty">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">批次專案同步引擎</h2>
                <p className="text-sm font-bold text-slate-400 mt-2">
                  一次拖曳多個檔案與目錄，系統會自動歸類狀態，並確保透過樹狀目錄直接部署。
                </p>
              </div>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'github' }))}
                className="flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-xl border border-slate-200 transition-colors active:scale-95 shrink-0 whitespace-nowrap shadow-sm w-full sm:w-auto justify-center"
                title="返回單檔同步"
              >
                <GitBranch className="size-4" />
                <span>單檔編輯同步</span>
              </button>
            </div>

            <div className="border-b border-slate-100/50 pb-6">
              <label className="text-sm font-bold text-slate-700 flex items-center mb-3">
                <HardDrive className="w-4 h-4 mr-2 text-slate-500" />
                本地工作目錄 (Workspace)
              </label>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 overflow-hidden shadow-inner">
                  <Folder className="w-4 h-4 text-amber-500 mr-2 shrink-0" />
                  <span className="truncate flex-1 font-mono text-xs">
                    {localFolderPath || '尚未選擇目錄...'}
                  </span>
                </div>
                <button
                  onClick={handleSelectDirectoryAPI}
                  disabled={isProcessing}
                  className="shrink-0 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                  title={!('showDirectoryPicker' in window) ? "瀏覽器不支援" : "選擇目錄後會自動掃描"}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>選擇本地資料夾</span>
                </button>
                {hasCachedDir && (
                  <button
                    onClick={handleReloadDirectoryAPI}
                    disabled={isProcessing}
                    className="shrink-0 px-4 py-2.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                    title="從快取中還原先前的目錄"
                  >
                    <RefreshCcw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>載入上次目錄</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] font-bold text-slate-400 mt-2 ml-1">
                選取後將記憶您的目錄。下次開啟本頁面，點擊「載入上次目錄」即可直接還原專案檔案。
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center">
                  儲存庫名稱 (Repository) <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50 transition-all"
                  placeholder="例如：username/repo-name"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center">
                  目標內部路徑 (選填)
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50 transition-all"
                  placeholder="例如：src/assets (檔案放在儲存庫的哪個位置)"
                  value={basePath}
                  onChange={(e) => setBasePath(e.target.value)}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center">
                  分支 (Branch) <span className="ml-1 text-red-500">*</span>
                </label>
                <div className="relative">
                  <GitBranch className="absolute left-3.5 top-3 size-4 text-slate-400" />
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50 transition-all"
                    placeholder="例如：main 或 master"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-white/50 pt-5">
              <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                <div className="flex items-center">
                  全域提交訊息 (選填)
                  {isAnalyzing && <Sparkles className="ml-2 size-3 text-blue-500 animate-pulse" />}
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">AI Optimized Summary</span>
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/60 bg-white/60 px-4 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50 transition-all shadow-inner"
                placeholder={isAnalyzing ? "AI 偵測分析中..." : "若保持空白則由 AI 自動生成批次摘要"}
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                disabled={isProcessing || isAnalyzing}
              />
            </div>

            {/* Hidden file inputs */}
            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            {/* 
              @ts-ignore: webkitdirectory is standard in browsers but not formally in React TS types. 
            */}
            <input type="file" {...({ webkitdirectory: "", directory: "" } as any)} multiple className="hidden" ref={dirInputRef} onChange={handleFileSelect} />

            {/* File List & Output Console container */}
            <div className="pt-4 pb-2 grid grid-cols-1 lg:grid-cols-2 gap-5 border-t border-slate-100 flex-1 min-h-0">
              <div className="flex flex-col space-y-4 min-h-0">
                <div className="flex flex-col space-y-3 shrink-0">
                    <div className="flex items-center flex-wrap gap-3">
                      <button
                        onClick={handleSyncRepo}
                        disabled={syncingRepo || isProcessing}
                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-slate-900 shadow-sm hover:bg-slate-800 text-white text-sm font-bold rounded-xl border border-slate-200 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {syncingRepo ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        <span>與 Github 同步比對未同步的檔案</span>
                      </button>

                      <div className="flex items-center space-x-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useDiffFilter}
                            onChange={(e) => setUseDiffFilter(e.target.checked)}
                            className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                            disabled={isProcessing}
                          />
                          <span className="text-xs font-bold text-amber-700">只顯示有差異/未同步檔案</span>
                        </label>
                      </div>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="flex items-center space-x-2 px-4 py-2 bg-white hover:border-slate-400 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      <FilePlus className="w-4 h-4" />
                      <span>增加個別檔案</span>
                    </button>

                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                      <FileSearch className="w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        placeholder="搜尋路徑或檔名..."
                        className="rounded-lg bg-transparent text-xs font-semibold text-slate-800 focus:outline-none py-0.5 w-32"
                        disabled={isProcessing}
                      />
                    </div>

                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useDateFilter}
                          onChange={(e) => setUseDateFilter(e.target.checked)}
                          className="rounded text-blue-500 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          disabled={isProcessing}
                        />
                        <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">限時:</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={filterDateTime}
                        onChange={(e) => setFilterDateTime(e.target.value)}
                        disabled={!useDateFilter || isProcessing}
                        className="rounded-lg bg-transparent text-xs font-semibold text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none py-0.5"
                        title="只同步在此時間以後修改過的檔案"
                      />
                    </div>

                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useExtFilter}
                          onChange={(e) => setUseExtFilter(e.target.checked)}
                          className="rounded text-blue-500 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          disabled={isProcessing}
                        />
                        <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">類型:</span>
                      </label>
                      <input
                        type="text"
                        value={filterExtension}
                        onChange={(e) => setFilterExtension(e.target.value)}
                        disabled={!useExtFilter || isProcessing}
                        className="rounded-lg bg-transparent text-xs font-semibold text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none py-0.5 w-20"
                        placeholder=".js, .css"
                        title="用逗號分隔要過濾的副檔名"
                      />
                    </div>

                  <div className="flex-1 text-right whitespace-nowrap flex items-center justify-end space-x-2">
                      {filteredFiles.length > 0 && (
                        <>
                          <button
                            onClick={expandAll}
                            className="flex items-center space-x-1 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <ChevronsDown className="w-3.5 h-3.5" />
                            <span>全部展開</span>
                          </button>
                          <span className="text-slate-200">|</span>
                          <button
                            onClick={collapseAll}
                            className="flex items-center space-x-1 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <ChevronsUp className="w-3.5 h-3.5" />
                            <span>全部摺疊</span>
                          </button>
                          <span className="text-slate-200 ml-2">|</span>
                          <button
                          onClick={clearAll}
                          disabled={isProcessing}
                          className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 px-2 py-1 flex items-center ml-2"
                        >
                          <Trash2 className="size-3 mr-1" />
                          清空
                        </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* File Tree View - Now flex-1 to grow */}
                <div id="batch-file-tree" className="rounded-xl border border-slate-200 bg-slate-50/30 shadow-inner flex-1 min-h-[300px] overflow-y-auto p-2 scroll-smooth" ref={parentRef}>
                  {filteredFiles.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 space-y-3">
                      <FileSearch className="w-12 h-12 opacity-30 drop-shadow-md" />
                      <p className="text-sm font-medium">尚未選擇檔案或拖曳目標至此。</p>
                    </div>
                  ) : (
                    <div
                      style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                      }}
                    >
                      {rowVirtualizer.getVirtualItems().map(renderVirtualRow)}
                    </div>
                  )}
                </div>
              </div>

              {/* Terminal Logs & Preview - Now flex-1 to grow */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3 h-8 px-1 shrink-0">
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => setActiveTab('logs')}
                      className={`text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      System Logs
                    </button>
                    <button 
                      onClick={() => setActiveTab('preview')}
                      className={`text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'preview' ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      File Preview
                    </button>
                  </div>
                  {activeTab === 'preview' && previewContent && (
                    <div className="flex items-center space-x-2">
                       <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                         previewContent.status.includes('MODIFIED') ? 'text-amber-600 bg-amber-50' : 
                         previewContent.status.includes('SYNCED') ? 'text-emerald-600 bg-emerald-50' : 'text-sky-600 bg-sky-50'
                       }`}>
                         {previewContent.status}
                       </span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 shadow-2xl flex-1 min-h-[300px] overflow-y-auto font-mono text-xs text-slate-300 focus-within:ring-2 ring-blue-500/30 custom-scrollbar relative">
                  {activeTab === 'logs' ? (
                    <div className="p-5 space-y-1.5">
                      {logs.length === 0 ? (
                        <div className="text-slate-600 italic">No output yet. System ready for deployment.</div>
                      ) : (
                        logs.map((log, idx) => (
                          <div key={idx} className={`leading-relaxed ${log.startsWith('[Error]') ? 'text-red-400 font-bold' : log.includes('successful') ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                            <span className="text-slate-700 mr-2 select-none">$</span>
                            {log}
                          </div>
                        ))
                      )}
                      {isProcessing && (
                        <div className="flex items-center text-blue-400 font-bold opacity-80 pt-2 pb-1 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                          <span>Executing sequence...</span>
                        </div>
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      {previewContent ? (
                        <div className="p-5 flex flex-col h-full">
                          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800 shrink-0">
                            <div className="flex items-center space-x-2">
                              <FileCode2 className="size-4 text-blue-400" />
                              <span className="text-slate-200 font-bold tracking-tight">{previewContent.name}</span>
                              {previewContent.language && previewContent.language !== 'plaintext' && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] uppercase text-slate-300 font-bold border border-slate-700 ml-2 shadow-inner">
                                  {previewContent.language}
                                </span>
                              )}
                            </div>
                            <button 
                              onClick={() => setPreviewContent(null)}
                              className="text-slate-500 hover:text-white transition-colors"
                              title="關閉預覽"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex-1 rounded-lg overflow-hidden border border-slate-800 relative bg-[#1e1e1e]">
                            <Editor
                              height="100%"
                              language={previewContent.language || 'plaintext'}
                              theme="vs-dark"
                              value={previewContent.content}
                              options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                fontSize: 13,
                                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                wordWrap: 'on',
                                padding: { top: 16, bottom: 16 },
                                scrollbar: {
                                  verticalScrollbarSize: 8,
                                  horizontalScrollbarSize: 8,
                                },
                              }}
                            />
                            {previewContent.isTruncated && previewContent.file && (
                              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
                                <button
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('navigate', { detail: 'github' }));
                                    setTimeout(() => {
                                      if (previewContent.file) {
                                        window.dispatchEvent(new CustomEvent('global-file-drop', { detail: { file: previewContent.file } }));
                                      }
                                    }, 100);
                                  }}
                                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full font-bold shadow-[0_4px_20px_rgba(37,99,235,0.4)] transition-all transform hover:scale-105 active:scale-95 border border-blue-400"
                                >
                                  <Maximize className="w-4 h-4" />
                                  <span>Load Full File (單檔編輯)</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 italic p-6 space-y-3">
                          <Sparkles className="size-8 opacity-20" />
                          <p>點擊左側檔案樹中的檔案進行快速預覽</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {globalError && (
              <div className="text-sm text-red-600 font-bold bg-red-50 p-3 rounded-xl border border-red-200">
                {globalError}
              </div>
            )}

            <div className="mt-auto pt-6 flex flex-col space-y-4 border-t border-white/50">
              <div className="flex items-center justify-between">
                <div className="flex-1 text-sm font-bold text-slate-500 flex flex-col pr-4">
                  {filteredFiles.length > 0 ? (
                    <>
                      <span>準備推播 {filteredFiles.length} 個檔案</span>
                      {filteredFiles.some(f => f.status === 'error') && (
                        <span className="text-red-500 text-[10px] mt-1 font-black uppercase tracking-tighter animate-pulse">
                          發現同步失敗的檔案，建議重試
                        </span>
                      )}
                    </>
                  ) : null}
                </div>
                <div className="flex items-center space-x-3">
                  {!isProcessing && filteredFiles.some(f => f.status === 'error') && (
                    <button
                      onClick={retryFailed}
                      className="flex items-center space-x-2 rounded-xl bg-red-50 border border-red-200 px-6 py-3.5 text-sm font-bold text-red-600 hover:bg-red-100 transition-all active:scale-95 shadow-sm"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      <span>重試失敗檔案</span>
                    </button>
                  )}
                  <button
                    onClick={handleBatchSync}
                    disabled={isProcessing || filteredFiles.length === 0}
                    className="flex items-center justify-center space-x-2 rounded-xl bg-slate-900 px-8 py-3.5 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/20 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                    <span>{isProcessing ? '正在推播至 GitHub...' : '批次推播變更 (Commit)'}</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Floating Progress Capsule */}
      <AnimatePresence>
        {isProcessing && progress.total > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 40, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 40, x: "-50%" }}
            whileHover={{ scale: 1.02 }}
            transition={{ 
              type: "spring", stiffness: 300, damping: 25,
              scale: { duration: 0.5, ease: [0.23, 1, 0.32, 1] }
            }}
            className={`fixed bottom-8 left-1/2 origin-bottom z-50 bg-[rgba(255,255,255,0.98)] backdrop-blur-md border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-xl rounded-2xl overflow-hidden transition-shadow duration-500 ${isProgressCollapsed ? 'w-48' : 'w-[400px] max-w-[calc(100vw-2rem)]'}`}
          >
            <div className="p-4 flex items-center justify-between cursor-pointer group focus:outline-none" tabIndex={0} onKeyDown={(e) => { if(e.key==='Enter'||e.key===' ') setIsProgressCollapsed(!isProgressCollapsed) }} onClick={() => setIsProgressCollapsed(!isProgressCollapsed)} aria-label={isProgressCollapsed ? "Expand progress view" : "Collapse progress view"}>
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
                <svg className="absolute inset-0 w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="14" fill="none" className="stroke-blue-200" strokeWidth="2" />
                  <circle cx="16" cy="16" r="14" fill="none" className="stroke-blue-600 transition-all duration-300 ease-out" strokeWidth="2" strokeDasharray="87.96" strokeDashoffset={87.96 - (87.96 * Math.max(0, progress.current / progress.total))} strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-slate-900">
                  {Math.round((progress.current / progress.total) * 100)}% ({progress.current}/{progress.total})
                </span>
                {!isProgressCollapsed && (
                  <span className="text-xs font-medium text-slate-700 truncate mt-0.5">
                    正在同步: {currentSyncingFile || '系統處理中...'}
                  </span>
                )}
              </div>
            </div>
            <button className="text-slate-600 group-hover:text-slate-900 transition-colors shrink-0 p-1 focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-md" aria-label={isProgressCollapsed ? 'Expand' : 'Collapse'}>
               {isProgressCollapsed ? <Maximize className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          {!isProgressCollapsed && (
            <div className="px-4 pb-4">
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${Math.max(2, (progress.current / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
