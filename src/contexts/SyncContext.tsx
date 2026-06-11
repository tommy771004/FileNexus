import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { storeService, Profile, SyncHistoryItem } from '../services/storeService';

type SyncStatus = 'idle' | 'scanning' | 'syncing' | 'error' | 'success';

interface SyncContextType {
  status: SyncStatus;
  progress: number;
  total: number;
  message: string;
  toastMsg: string;
  isToastExiting: boolean;
  activeProfileId: string | null;
  profiles: Profile[];
  recentHistory: SyncHistoryItem[];
  setStatus: (status: SyncStatus) => void;
  setProgress: (progress: number, total: number) => void;
  setMessage: (msg: string) => void;
  setToast: (msg: string) => void;
  clearToast: () => void;
  handleSelectSidebarProfile: (profile: Profile) => Promise<void>;
  refreshSidebarData: () => Promise<void>;
  updateStatusGlobally: (status: SyncStatus, msg: string) => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');
  
  const [toastMsg, setToastMsgState] = useState('');
  const [isToastExiting, setIsToastExiting] = useState(false);
  const [toastTimeoutId, setToastTimeoutId] = useState<number | null>(null);
  const [toastExitTimeoutId, setToastExitTimeoutId] = useState<number | null>(null);

  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [recentHistory, setRecentHistory] = useState<SyncHistoryItem[]>([]);

  const refreshSidebarData = useCallback(async () => {
    try {
      const loadedProfiles = await storeService.getProfiles();
      setProfiles(loadedProfiles);
      
      const activeId = await storeService.getActiveProfileId();
      if (activeId && loadedProfiles.some(p => p.id === activeId)) {
        setActiveProfileId(activeId);
      } else if (loadedProfiles.length > 0) {
        setActiveProfileId(loadedProfiles[0].id);
      }
      
      const historyList = await storeService.getHistory();
      setRecentHistory(historyList.slice(0, 4));
    } catch (err) {
      console.error('Failed to load sidebar data:', err);
    }
  }, []);

  const clearToast = useCallback(() => {
    setIsToastExiting(true);
    const id = window.setTimeout(() => {
      setToastMsgState('');
      setIsToastExiting(false);
    }, 800);
    setToastExitTimeoutId(id);
  }, []);

  const setToast = useCallback((msg: string) => {
    if (toastTimeoutId) window.clearTimeout(toastTimeoutId);
    if (toastExitTimeoutId) window.clearTimeout(toastExitTimeoutId);
    
    setIsToastExiting(false);
    setToastMsgState(msg);
    
    const id = window.setTimeout(() => {
      clearToast();
    }, 4000);
    setToastTimeoutId(id);
  }, [toastTimeoutId, toastExitTimeoutId, clearToast]);

  const handleSelectSidebarProfile = useCallback(async (profile: Profile) => {
    try {
      await storeService.setActiveProfileId(profile.id);
      await storeService.set('github_owner', profile.owner.trim());
      await storeService.set('github_repo', profile.repo.trim());
      await storeService.set('github_base_path', profile.basePath.trim());
      
      setActiveProfileId(profile.id);
      
      window.dispatchEvent(new CustomEvent('filenexus-profile-changed', {
        detail: { profile }
      }));
      
      refreshSidebarData();
      setToast(`已切換至作用中儲存庫設定檔：${profile.name}`);
    } catch (err) {
      console.error('Failed to activate profile:', err);
    }
  }, [refreshSidebarData, setToast]);

  // Initial load
  useEffect(() => {
    refreshSidebarData();
    window.addEventListener('filenexus-refresh-sidebar', refreshSidebarData);
    return () => window.removeEventListener('filenexus-refresh-sidebar', refreshSidebarData);
  }, [refreshSidebarData]);

  const setProgressCallback = useCallback((p: number, t: number) => {
    setProgress(p);
    setTotal(t);
  }, []);
  
  const updateStatusGlobally = useCallback((newStatus: SyncStatus, msg: string) => {
    setStatus(newStatus);
    setMessage(msg);
  }, []);

  return (
    <SyncContext.Provider value={{
      status, setStatus,
      progress, total, setProgress: setProgressCallback,
      message, setMessage,
      toastMsg, isToastExiting, setToast, clearToast,
      activeProfileId, profiles, recentHistory,
      handleSelectSidebarProfile, refreshSidebarData,
      updateStatusGlobally
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncState() {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSyncState must be used within SyncProvider');
  return context;
}
