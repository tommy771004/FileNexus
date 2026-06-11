import { useState, useEffect, useMemo } from 'react';
import { History, ExternalLink, FileText, Clock, Search } from 'lucide-react';
import { storeService, SyncHistoryItem } from '../services/storeService';

export default function HistoryView() {
  const [history, setHistory] = useState<SyncHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      const data = await storeService.getHistory();
      setHistory(data);
      setIsLoading(false);
    };
    loadHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const query = searchQuery.toLowerCase();
    return history.filter(item => 
      item.path.toLowerCase().includes(query) || 
      item.message.toLowerCase().includes(query)
    );
  }, [history, searchQuery]);

  const openInBrowser = (url: string) => {
    // 💡 TIPS: In the Electron environment, you must use shell.openExternal
    // Example: window.electron.ipcRenderer.invoke('open-external', url);
    // In our Web preview, we use window.open as a fallback.
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090D16] overflow-hidden animate-fade-in relative">
      {/* Background radial highlight */}
      <div className="absolute top-10 right-10 w-[250px] height-[250px] rounded-full bg-hyper-500/5 blur-3xl pointer-events-none" />

      <div className="hidden md:flex h-16 items-center border-white/5 border-b px-8 bg-transparent shrink-0">
        <History className="size-4 mr-2 text-white/50" />
        <span className="text-sm font-medium text-white/60">
          歷史紀錄
        </span>
      </div>
      <div className="flex-1 overflow-auto p-6 sm:p-8 relative flex flex-col">
        <div className="flex-1 flex flex-col w-full min-w-0 max-w-7xl mx-auto h-full space-y-6">
          <div className="flex-1 flex flex-col space-y-4 bg-[#0E1321]/60 backdrop-blur-md shadow-2xl border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-4 border-b border-slate-900/60 world space-y-4 sm:space-y-0 text-pretty">
              <div>
                <h2 className="text-xl font-medium tracking-tight text-white/90">同步歷史紀錄</h2>
                <p className="text-sm text-white/60 mt-1 max-w-xl">
                  近期成功同步的檔案日誌。
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="搜尋路徑或提交訊息..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs font-medium border border-slate-800 rounded-lg bg-slate-950/40 text-slate-100 focus:bg-[#0A0D16] focus:border-hyper-500 focus:outline-none focus:ring-1 focus:ring-hyper-500 transition-all placeholder:text-slate-600 font-medium"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex-grow flex flex-col items-center justify-center p-12 text-slate-400 font-medium text-sm">
                <Clock className="size-5 animate-pulse mr-2 text-slate-450" />
                正在載入本機歷史紀錄...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center py-20 text-slate-500">
                <History className="size-12 mb-4 opacity-10 drop-shadow-sm" />
                <p className="font-semibold text-xs">{searchQuery ? '找不到符合搜尋條件的記錄。' : '目前尚無任何同步數據。'}</p>
                <p className="text-[11px] mt-1 text-slate-550 block text-center max-w-xs leading-relaxed">
                  {searchQuery ? '請嘗試不同的關鍵字組合。' : '您成功同步的 GitHub 紀錄將會自動登錄於此以便於審計追蹤。'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-4 overflow-y-auto max-h-[80%] flex-grow">
                {filteredHistory.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-900/85 bg-slate-950/40 hover:bg-[#0D1220]/60 transition-colors group"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center space-x-2">
                        <FileText className="size-3.5 text-hyper-500 flex-shrink-0" />
                        <h4 className="text-xs font-semibold text-slate-200 truncate" title={item.path}>
                          {item.path}
                        </h4>
                        <span className="text-[10px] font-semibold text-slate-400 bg-[#0D1220] px-2 py-0.5 rounded-md border border-slate-800 shadow-xs font-mono tabular-nums">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-400 mt-1 truncate font-mono" title={item.message}>
                        "{item.message}"
                      </p>
                    </div>
                    <div className="mt-4 sm:mt-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openInBrowser(item.url)}
                        className="flex items-center space-x-1.5 h-8 px-3 text-xs font-semibold text-slate-300 hover:text-white bg-slate-850/40 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all shadow-md active:scale-95"
                      >
                        <ExternalLink className="size-3.5" />
                        <span>檢視變更</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
