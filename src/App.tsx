/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Settings, Github, History, Files, DownloadCloud, Check, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import GitHubSync from './components/GitHubSync';
import SettingsView from './components/Settings';
import HistoryView from './components/HistoryView';
import BatchSync from './components/BatchSync';
import { useSyncState } from './contexts/SyncContext';
import { walkDataTransferItems } from './lib/fileQueue';

export default function App() {
  const { 
    toastMsg, 
    isToastExiting, 
    profiles, 
    activeProfileId, 
    recentHistory, 
    handleSelectSidebarProfile,
    setStatus,
    setToast,
    updateStatusGlobally,
    status
  } = useSyncState();

  const [currentView, setCurrentView] = useState<'github' | 'settings' | 'history' | 'batch'>('github');
  const [isDragging, setIsDragging] = useState(false);

  // Global Drag listeners
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
         setIsDragging(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (!e.dataTransfer) return;
      
      const allFiles: File[] = [];
      updateStatusGlobally('scanning', '正在掃描檔案...');

      try {
        for await (const file of walkDataTransferItems(e.dataTransfer.items)) {
          allFiles.push(file);
        }
      } catch (err) {
        console.error("Failed to parse dropped files", err);
      }
      
      setStatus('idle');

      if (allFiles.length === 0) return;

      if (allFiles.length > 1) {
        setCurrentView('batch');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('global-batch-drop', {
            detail: { files: allFiles }
          }));
        }, 50);
        return;
      }

      const file = allFiles[0];
      const isBinary = file.type.startsWith('image/') || file.name.match(/\.(pdf|zip|exe|dll|bin|mp4)$/i);
      
      if (isBinary) {
        setCurrentView('batch');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('global-batch-drop', {
            detail: { files: [file] }
          }));
          setToast(`已自動為二進位檔案切換至批次同步功能。`);
        }, 50);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCurrentView('github');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('global-file-drop', { 
            detail: { name: file.name, content: content } 
          }));
        }, 50);
      };
      reader.readAsText(file);
    };

    const handleNavigate = (e: any) => {
      if (e.detail) {
        setCurrentView(e.detail);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('navigate', handleNavigate);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('navigate', handleNavigate);
    };
  }, [setStatus, updateStatusGlobally]);

  const listVariations = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } }
  };

  const itemVariations = {
    hidden: { opacity: 0, y: 15, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } }
  };

  return (
    <div className="relative flex h-dvh w-full bg-[#090D16] font-sans overflow-hidden text-slate-200 flex-col md:flex-row selection:bg-hyper-500/30 selection:text-[#38BDF8]">
      {/* Background Ambience Layers */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      {/* Mobile Top Bar */}
      <div className="md:hidden flex h-14 items-center justify-between px-4 border-b border-white/5 z-20 shrink-0 liquid-glass liquid-glass-sweep">
        <div className="flex items-center space-x-2.5">
          <div className="relative size-7 shrink-0 flex items-center justify-center rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 shadow-sm">
             <Files className="size-4 text-white" />
          </div>
          <span className="text-base font-medium tracking-tight text-white/90">FileNexus</span>
        </div>
        <div className="flex items-center space-x-2">
          {status !== 'idle' && (
            <div className="animate-pulse flex items-center justify-center text-blue-400">
              <Activity className="size-5" />
            </div>
          )}
          <button 
            onClick={() => setCurrentView('settings')}
            className={`p-2 rounded-lg transition-colors ${currentView === 'settings' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white/90'}`}
          >
            <Settings className="size-5" />
          </button>
        </div>
      </div>

      {/* Global Drag and Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-6 pointer-events-none transition-all duration-300">
          <div className="flex flex-col items-center space-y-4 animate-fade-in liquid-glass p-10 rounded-3xl shadow-2xl max-w-sm text-center border border-white/10">
            <div className="bg-white/10 p-4 rounded-full border border-white/10">
              <DownloadCloud className="size-12 text-white/90 animate-bounce" />
            </div>
            <h2 className="text-xl font-medium text-white/90 tracking-tight">拖放以進行同步</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              將本地端的檔案或目錄拖曳放開，系統即可即時在雲端進行同步與比對。
            </p>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (Apple HIG 260px spacing) */}
      <div className="relative z-10 hidden md:flex w-[260px] flex-col border-r border-white/5 bg-transparent shrink-0">
        <div className="flex flex-col items-start p-6 w-full pt-10 pb-4">
          <div className="flex items-center justify-between w-full group cursor-default">
            <div className="flex items-center space-x-3 px-1">
              <div className="relative size-8 shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 shadow-md">
                 <Files className="size-4.5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-medium tracking-tight text-white/90">FileNexus</span>
              </div>
            </div>
            {status !== 'idle' && (
              <div className="flex items-center animate-pulse text-blue-400">
                <Activity className="size-4" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 px-4 py-4 space-y-8 overflow-y-auto">
          <div>
            <div className="mb-3 px-2 text-xs font-medium tracking-wide text-white/40">
              工作區
            </div>
            <ul className="space-y-1.5">
              <li 
                role="button"
                tabIndex={0}
                aria-pressed={currentView === 'github'}
                className={`flex cursor-pointer glass-interaction items-center space-x-3 rounded-xl px-3 py-2.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${currentView === 'github' ? 'bg-white/10 text-white shadow-sm' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}`}
                onClick={() => setCurrentView('github')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentView('github'); } }}
              >
                <Github className="size-4.5" />
                <span className="text-sm font-medium">單檔編輯</span>
              </li>
              <li 
                role="button"
                tabIndex={0}
                aria-pressed={currentView === 'batch'}
                className={`flex cursor-pointer glass-interaction items-center space-x-3 rounded-xl px-3 py-2.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${currentView === 'batch' ? 'bg-white/10 text-white shadow-sm' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}`}
                onClick={() => setCurrentView('batch')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentView('batch'); } }}
              >
                <Files className="size-4.5" />
                <span className="text-sm font-medium">批次同步</span>
              </li>
              <li 
                role="button"
                tabIndex={0}
                aria-pressed={currentView === 'history'}
                className={`flex cursor-pointer glass-interaction items-center space-x-3 rounded-xl px-3 py-2.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${currentView === 'history' ? 'bg-white/10 text-white shadow-sm' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}`}
                onClick={() => setCurrentView('history')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentView('history'); } }}
              >
                <History className="size-4.5" />
                <span className="text-sm font-medium">歷史紀錄</span>
              </li>
            </ul>
          </div>

          {profiles.length > 0 ? (
            <div>
              <div className="mb-3 px-2 text-xs font-medium tracking-wide text-white/40 flex items-center justify-between">
                <span>儲存庫</span>
              </div>
              <motion.ul 
                className="space-y-2"
                variants={listVariations}
                initial="hidden"
                animate="visible"
                key={profiles.length} /* re-trigger animation when length changes */
              >
                {profiles.map((p) => {
                  const isActive = activeProfileId === p.id;
                  return (
                    <motion.li
                      key={p.id}
                      variants={itemVariations}
                      role="button"
                      tabIndex={0}
                      aria-label={`切換儲存庫至 ${p.name}`}
                      className={`relative flex flex-col cursor-pointer glass-interaction rounded-xl px-3 py-3 border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 liquid-morph ${isActive ? 'bg-white/10 text-white border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)]' : 'text-white/60 hover:text-white/90 hover:bg-white/5 border-transparent'}`}
                      onClick={() => handleSelectSidebarProfile(p)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectSidebarProfile(p); } }}
                    >
                      {isActive && (
                        <div className="absolute inset-[-2px] rounded-xl border border-blue-500/50 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] opacity-50 pointer-events-none" />
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate max-w-[150px] relative z-10">{p.name}</span>
                      </div>
                      {p.owner && p.repo ? (
                        <span className="text-xs mt-1 text-white/40 truncate relative z-10" title={`${p.owner}/${p.repo}`}>
                          {p.owner}/{p.repo}
                        </span>
                      ) : (
                        <span className="text-xs mt-1 text-white/30 italic relative z-10">尚未配置</span>
                      )}
                    </motion.li>
                  );
                })}
              </motion.ul>
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center py-6 text-center animate-fade-in liquid-glass rounded-xl p-4 border border-white/5 mx-2 liquid-glass-sweep">
               <img src="/src/assets/images/glass_empty_box_1781165331171.png" alt="無儲存庫" className="w-16 h-16 mb-4 opacity-80 liquid-morph hover:scale-110 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]" />
               <span className="text-[13px] font-medium text-white/70 mb-1">尚未連結儲存庫</span>
               <span className="text-[10px] text-white/40">請至設定頁面新增</span>
             </div>
          )}

          {recentHistory.length > 0 && (
            <div>
              <div className="mb-3 px-2 text-xs font-medium tracking-wide text-white/40 flex items-center justify-between">
                <span>近期同步</span>
              </div>
              <motion.ul 
                className="space-y-2"
                variants={listVariations}
                initial="hidden"
                animate="visible"
                key={`history-${recentHistory.length}`}
              >
                {recentHistory.map(item => (
                  <motion.li 
                    key={item.id}
                    variants={itemVariations}
                    className="group flex flex-col p-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white/90 transition-all text-pretty cursor-default"
                  >
                    <div className="flex items-center justify-between text-xs font-medium truncate shrink-0">
                      <span className="truncate text-white/80 pr-2 select-text" title={item.path}>{item.path.split('/').pop()}</span>
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center opacity-0 group-hover:opacity-100 transition-all"
                        title="在 GitHub 檢視"
                      >
                        <span>檢視</span>
                      </a>
                    </div>
                    <p className="text-xs text-white/40 line-clamp-1 mt-1" title={item.message}>
                      {item.message}
                    </p>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          )}
        </div>
        
        <div className="p-4 mt-auto">
          <div 
            role="button"
            tabIndex={0}
            aria-pressed={currentView === 'settings'}
            className={`flex cursor-pointer items-center space-x-3 rounded-xl px-3 py-2.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${currentView === 'settings' ? 'bg-white/10 text-white shadow-sm' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}`}
            onClick={() => setCurrentView('settings')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentView('settings'); } }}
          >
            <Settings className="size-4.5" />
            <span className="text-sm font-medium">設定</span>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden flex h-16 items-center justify-around border-t border-white/5 bg-transparent liquid-glass z-20 shrink-0 pb-safe">
        <button
          onClick={() => setCurrentView('github')}
          className={`flex flex-col items-center justify-center space-y-1 w-full h-full transition-all duration-300 liquid-morph hover:scale-105 ${currentView === 'github' ? 'text-blue-500 drop-shadow-[0_2px_8px_rgba(0,85,255,0.4)]' : 'text-white/50 hover:text-white/80 hover:drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]'}`}
        >
          <Github className={`size-4.5 ${currentView === 'github' ? 'text-blue-500' : 'text-white/50'}`} />
          <span className="text-[10px] font-medium tracking-wide">單檔編輯</span>
        </button>
        <button
          onClick={() => setCurrentView('batch')}
          className={`relative flex flex-col items-center justify-center space-y-1 w-full h-full transition-all duration-300 liquid-morph hover:scale-105 ${currentView === 'batch' ? 'text-blue-500 drop-shadow-[0_2px_8px_rgba(0,85,255,0.4)]' : 'text-white/50 hover:text-white/80 hover:drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]'}`}
        >
          <Files className={`size-4.5 ${currentView === 'batch' ? 'text-blue-500' : 'text-white/50'}`} />
          <span className="text-[10px] font-medium tracking-wide">批次同步</span>
          {status !== 'idle' && (
            <span className="absolute top-2 right-6 size-2 rounded-full bg-blue-500 animate-pulse border border-[#090D16]"></span>
          )}
        </button>
        <button
          onClick={() => setCurrentView('history')}
          className={`flex flex-col items-center justify-center space-y-1 w-full h-full transition-all duration-300 liquid-morph hover:scale-105 ${currentView === 'history' ? 'text-blue-500 drop-shadow-[0_2px_8px_rgba(0,85,255,0.4)]' : 'text-white/50 hover:text-white/80 hover:drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]'}`}
        >
          <History className={`size-4.5 ${currentView === 'history' ? 'text-blue-500' : 'text-white/50'}`} />
          <span className="text-[10px] font-medium tracking-wide">查核歷史</span>
        </button>
      </div>

      {/* Global Toast */}
      {toastMsg && (
        <div className={`absolute bottom-20 md:bottom-8 right-6 left-6 md:left-auto md:w-[400px] z-50 ${isToastExiting ? 'animate-toast-out' : 'animate-toast-in'}`}>
          <div className="liquid-glass liquid-glass-sweep rounded-2xl flex items-center p-4">
            <div className="bg-white/10 p-2 rounded-xl mr-3 shrink-0 border border-white/10">
              <Check className="size-4 text-white/90" />
            </div>
            <span className="text-sm font-medium tracking-wide text-white/90">{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col h-full bg-transparent overflow-hidden">
        {currentView === 'settings' ? (
          <SettingsView />
        ) : currentView === 'history' ? (
          <HistoryView />
        ) : currentView === 'batch' ? (
          <BatchSync />
        ) : (
          <GitHubSync />
        )}
      </div>
    </div>
  );
}
