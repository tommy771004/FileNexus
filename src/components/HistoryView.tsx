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
    <div className="flex-1 flex flex-col h-full bg-transparent">
      <div className="hidden md:flex h-16 items-center border-b border-slate-200 px-8 bg-white shadow-sm shrink-0">
        <History className="mr-3 size-5 text-slate-800" />
        <span className="text-sm font-bold text-slate-700 tracking-wide">
          / 歷史紀錄
        </span>
      </div>
      <div className="flex-1 overflow-auto p-0 sm:p-8 relative flex flex-col">
        <div className="flex-1 flex flex-col w-full min-w-0 max-w-none h-full">
          <div className="flex-1 flex flex-col space-y-4 rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 bg-white p-5 sm:p-8 shadow-none sm:shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-4 border-b border-slate-100 space-y-4 sm:space-y-0 text-pretty">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 text-balance">同步歷史紀錄</h2>
                <p className="text-sm font-medium text-slate-500 text-pretty mt-1">
                  近期從 FileNexus 成功推播至 GitHub 的檔案清單。
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜尋路徑或提交訊息..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm font-medium border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center p-12 text-slate-500 font-bold">
                <Clock className="size-5 animate-pulse mr-2 text-slate-400" />
                正在載入歷史紀錄...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <History className="size-12 mb-4 opacity-30 drop-shadow-sm" />
                <p className="font-bold">{searchQuery ? '找不到符合的紀錄。' : '目前尚無同步紀錄。'}</p>
                <p className="text-sm mt-1 font-medium text-pretty">
                  {searchQuery ? '請嘗試不同的關鍵字。' : '您成功同步的 GitHub 紀錄將會顯示於此處。'}
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                {filteredHistory.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors group"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center space-x-2">
                        <FileText className="size-4 text-emerald-500 flex-shrink-0" />
                        <h4 className="text-sm font-bold text-slate-700 truncate" title={item.path}>
                          {item.path}
                        </h4>
                        <span className="text-xs font-bold text-slate-400 whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-sm tabular-nums">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-500 mt-1 truncate" title={item.message}>
                        "{item.message}"
                      </p>
                    </div>
                    <div className="mt-4 sm:mt-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openInBrowser(item.url)}
                        className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors shadow-sm active:scale-95"
                      >
                        <ExternalLink className="size-3.5" />
                        <span>檢視</span>
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
