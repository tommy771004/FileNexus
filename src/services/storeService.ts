export interface SyncHistoryItem {
  id: string;
  timestamp: number;
  message: string;
  path: string;
  url: string;
}

export interface Profile {
  id: string;
  name: string;
  owner: string;
  repo: string;
  basePath: string;
}

/**
 * Local Storage Service (Mock for Electron IPC)
 * 
 * 💡 TIPS: 在目前的 Web 預覽環境中，我們使用瀏覽器的 `localStorage` 來模擬儲存。
 * 因為真實的 Electron IPC (Inter-Process Communication) 是非同步的，
 * 這裡特別設計成 Promise 介面。
 * 
 * 當您遷移回 Electron 環境時，只需將這些內容替換為呼叫 ipcRenderer：
 * 例如： return await window.electron.ipcRenderer.invoke('store-get', key);
 */
export const storeService = {
  get: async (key: string): Promise<string> => {
    // 模擬非同步延遲
    await new Promise(resolve => setTimeout(resolve, 50));
    return localStorage.getItem(key) || '';
  },
  
  set: async (key: string, value: string): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    localStorage.setItem(key, value);
  },

  getHistory: async (): Promise<SyncHistoryItem[]> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    const data = localStorage.getItem('github_sync_history');
    return data ? JSON.parse(data) : [];
  },

  addHistory: async (item: SyncHistoryItem): Promise<void> => {
    const history = await storeService.getHistory();
    history.unshift(item); // Add newest at the top
    const trimmedHistory = history.slice(0, 50); // Keep max 50 recent records
    localStorage.setItem('github_sync_history', JSON.stringify(trimmedHistory));
  },

  getProfiles: async (): Promise<Profile[]> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    const data = localStorage.getItem('filenexus_profiles');
    if (data) return JSON.parse(data);
    
    // Default migration if nothing exists yet
    const legacyOwner = localStorage.getItem('github_owner');
    const legacyRepo = localStorage.getItem('github_repo');
    if (legacyOwner || legacyRepo) {
      const defaultProfile: Profile = {
        id: 'default-profile',
        name: '預設設定檔',
        owner: legacyOwner || '',
        repo: legacyRepo || '',
        basePath: ''
      };
      localStorage.setItem('filenexus_profiles', JSON.stringify([defaultProfile]));
      return [defaultProfile];
    }
    return [];
  },

  setProfiles: async (profiles: Profile[]): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    localStorage.setItem('filenexus_profiles', JSON.stringify(profiles));
  },

  getFileSyncState: async (): Promise<Record<string, { lastModified: number; size: number }>> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    const data = localStorage.getItem('filenexus_file_sync_state');
    return data ? JSON.parse(data) : {};
  },

  setFileSyncState: async (states: Record<string, { lastModified: number; size: number }>): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    localStorage.setItem('filenexus_file_sync_state', JSON.stringify(states));
  },

  updateFileSyncStateForFiles: async (repo: string, filePaths: { path: string; lastModified: number; size: number }[]): Promise<void> => {
    const states = await storeService.getFileSyncState();
    filePaths.forEach(f => {
      const key = `${repo}:${f.path}`;
      states[key] = { lastModified: f.lastModified, size: f.size };
    });
    await storeService.setFileSyncState(states);
  },

  getActiveProfileId: async (): Promise<string | null> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return localStorage.getItem('filenexus_active_profile_id');
  },

  setActiveProfileId: async (id: string): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    localStorage.setItem('filenexus_active_profile_id', id);
  }
};
