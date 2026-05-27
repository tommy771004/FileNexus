/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Settings, Github, History, Files, Sparkles, Minus, Maximize, X, DownloadCloud } from 'lucide-react';
import GitHubSync from './components/GitHubSync';
import SettingsView from './components/Settings';
import HistoryView from './components/HistoryView';
import BatchSync from './components/BatchSync';

export default function App() {
  // Default to github view since all fake local file UI has been removed
  const [currentView, setCurrentView] = useState<'github' | 'settings' | 'history' | 'batch'>('github');
  
  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Global Toast Listener
  useEffect(() => {
    const handleGlobalToast = (e: any) => {
      if (e.detail?.message) {
        setToastMsg(e.detail.message);
        setTimeout(() => setToastMsg(''), 4000);
      }
    };
    window.addEventListener('global-toast', handleGlobalToast);
    return () => window.removeEventListener('global-toast', handleGlobalToast);
  }, []);

  // Global Drag listeners
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      // Only show overlay if we are dragging a file (not dragging text within Monaco)
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Ensure we only disable overlay if cursor leaves the main window boundaries
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
         setIsDragging(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (!e.dataTransfer) return;

      // Check if dropped items include directories
      const items = Array.from(e.dataTransfer.items);
      const isDirectoryDropped = items.some(item => {
        const entry = item.webkitGetAsEntry?.();
        return entry?.isDirectory;
      });

      // Gather all files, parsing directories recursively if needed
      const allFiles: File[] = [];

      const readFileEntry = (fileEntry: any): Promise<File> => {
        return new Promise((resolve) => {
          fileEntry.file((file: File) => resolve(file));
        });
      };

      const readDirEntry = async (dirEntry: any, path = '') => {
        const dirReader = dirEntry.createReader();
        const entries = await new Promise<any[]>((resolve) => {
          dirReader.readEntries((results: any[]) => resolve(results));
        });

        for (const entry of entries) {
          if (entry.isDirectory) {
            await readDirEntry(entry, `${path}${entry.name}/`);
          } else {
            const file = await readFileEntry(entry);
            // Overwrite the file path to maintain directory structure if possible
            Object.defineProperty(file, 'webkitRelativePath', {
              value: `${path}${file.name}`,
              writable: false
            });
            allFiles.push(file);
          }
        }
      };

      if (isDirectoryDropped) {
        // If there's a directory, parse everything as items
        for (const item of items) {
          const entry = item.webkitGetAsEntry?.();
          if (entry) {
            if (entry.isDirectory) {
              await readDirEntry(entry, `${entry.name}/`);
            } else {
              const file = await readFileEntry(entry);
              allFiles.push(file);
            }
          }
        }
      } else {
        // Just files
        allFiles.push(...Array.from(e.dataTransfer.files));
      }

      if (allFiles.length === 0) return;

      // If multiple files (or single directory converted to files), route to batch sync
      if (allFiles.length > 1) {
        setCurrentView('batch');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('global-batch-drop', {
            detail: { files: allFiles }
          }));
        }, 50);
        return;
      }

      // Single file logic
      const file = allFiles[0];
      const isBinary = file.type.startsWith('image/') || file.name.match(/\.(pdf|zip|exe|dll|bin|mp4)$/i);
      
      if (isBinary) {
        setCurrentView('batch');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('global-batch-drop', {
            detail: { files: [file] }
          }));
          window.dispatchEvent(new CustomEvent('global-toast', { 
            detail: { message: `已自動為二進位檔案切換至批次同步功能。`, type: 'info' } 
          }));
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
  }, []);

  return (
    <div className="relative flex h-dvh w-full bg-slate-50 font-sans overflow-hidden text-slate-800 flex-col md:flex-row selection:bg-blue-100 selection:text-blue-900">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex h-14 items-center justify-between px-4 border-b border-slate-200 bg-white z-20 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="bg-slate-900 p-1.5 rounded-lg">
            <Sparkles className="size-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">FileNexus</span>
        </div>
        <button 
          onClick={() => setCurrentView('settings')}
          className={`p-2 rounded-full transition-colors ${currentView === 'settings' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}
        >
          <Settings className="size-5" />
        </button>
      </div>

      {/* Global Drag and Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-500/20 backdrop-blur-sm m-4 rounded-2xl pointer-events-none transition-all duration-200">
          <div className="flex flex-col items-center space-y-4 animate-fade-in bg-white p-10 rounded-2xl border border-slate-200 shadow-lg">
            <div className="bg-slate-50 p-4 rounded-full border border-slate-100">
              <DownloadCloud className="size-16 text-blue-600 animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight text-balance">放開以讀取檔案</h2>
            <p className="text-slate-500 text-sm font-medium text-pretty">將自動帶入並載入智慧編輯器</p>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (Hidden on mobile) */}
      <div className="relative z-10 hidden md:flex w-[320px] flex-col border-r border-slate-200 bg-white shrink-0 group/sidebar">
        <div className="flex flex-col items-start border-b border-slate-100 p-10 w-full">
          <div className="flex items-center justify-between w-full mb-8">
            <div className="flex items-center space-x-4 transition-all duration-500 hover:translate-x-1">
              <div className="bg-slate-900 p-3.5 rounded-[1.25rem] shadow-md relative overflow-hidden group-hover/sidebar:animate-float">
                <Sparkles className="size-6 text-white relative z-10" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black text-slate-900 leading-none">FileNexus</span>
                <span className="text-[11px] font-black text-blue-600 uppercase mt-2 ml-0.5 opacity-70">Premium Edition</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-8 space-y-10 overflow-y-auto custom-scrollbar">
          <div>
            <div className="mb-6 px-4 text-[11px] font-black uppercase text-slate-400 opacity-60">
              Workspace Core
            </div>
            <ul className="space-y-3">
              <li 
                className={`flex cursor-pointer items-center space-x-4 rounded-2xl p-4 transition-all duration-200 active:scale-95 ${currentView === 'github' ? 'bg-slate-50 text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent'}`}
                onClick={() => setCurrentView('github')}
              >
                <div className={`p-2 rounded-xl transition-all duration-200 ${currentView === 'github' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'}`}>
                  <Github className="size-5" />
                </div>
                <span className="text-base font-black tracking-tight">單檔編輯同步</span>
              </li>
              <li 
                className={`flex cursor-pointer items-center space-x-4 rounded-2xl p-4 transition-all duration-200 active:scale-95 ${currentView === 'batch' ? 'bg-slate-50 text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent'}`}
                onClick={() => setCurrentView('batch')}
              >
                <div className={`p-2 rounded-xl transition-all duration-200 ${currentView === 'batch' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'}`}>
                  <Files className="size-5" />
                </div>
                <span className="text-base font-black tracking-tight">批次專案同步</span>
              </li>
              <li 
                className={`flex cursor-pointer items-center space-x-4 rounded-2xl p-4 transition-all duration-200 active:scale-95 ${currentView === 'history' ? 'bg-slate-50 text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent'}`}
                onClick={() => setCurrentView('history')}
              >
                <div className={`p-2 rounded-xl transition-all duration-200 ${currentView === 'history' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'}`}>
                  <History className="size-5" />
                </div>
                <span className="text-base font-black tracking-tight">作業歷史紀錄</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="p-8 border-t border-slate-100">
          <div 
            className={`flex cursor-pointer items-center space-x-4 rounded-2xl p-4 transition-all duration-200 active:scale-95 ${currentView === 'settings' ? 'bg-slate-50 text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent'}`}
            onClick={() => setCurrentView('settings')}
          >
            <div className={`p-2 rounded-xl transition-all duration-200 ${currentView === 'settings' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'}`}>
              <Settings className="size-5" />
            </div>
            <span className="text-base font-black tracking-tight">系統環境設定</span>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden flex h-16 items-center justify-around border-t border-slate-200 bg-white z-20 shrink-0 pb-safe">
        <button
          onClick={() => setCurrentView('github')}
          className={`flex flex-col items-center justify-center space-y-1 w-full h-full transition-colors ${currentView === 'github' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <Github className={`size-5 ${currentView === 'github' ? 'text-slate-900' : 'text-slate-400'}`} />
          <span className="text-[10px] font-bold uppercase tracking-tight">單檔編輯</span>
        </button>
        <button
          onClick={() => setCurrentView('batch')}
          className={`flex flex-col items-center justify-center space-y-1 w-full h-full transition-colors ${currentView === 'batch' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <Files className={`size-5 ${currentView === 'batch' ? 'text-slate-900' : 'text-slate-400'}`} />
          <span className="text-[10px] font-bold uppercase tracking-tight">批次同步</span>
        </button>
        <button
          onClick={() => setCurrentView('history')}
          className={`flex flex-col items-center justify-center space-y-1 w-full h-full transition-colors ${currentView === 'history' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <History className={`size-5 ${currentView === 'history' ? 'text-slate-900' : 'text-slate-400'}`} />
          <span className="text-[10px] font-bold uppercase tracking-tight">作業歷史</span>
        </button>
      </div>

      {/* Global Toast */}
      {toastMsg && (
        <div className="absolute bottom-24 md:bottom-10 right-6 left-6 md:left-auto md:w-[450px] z-50 animate-slide-in">
          <div className="bg-white shadow-lg rounded-2xl flex items-center px-6 py-5 border border-slate-200">
            <div className="bg-emerald-500/10 p-2.5 rounded-xl mr-4">
              <Sparkles className="size-6 text-emerald-500" />
            </div>
            <span className="text-sm font-black text-slate-800 tracking-tight text-pretty">{toastMsg}</span>
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
