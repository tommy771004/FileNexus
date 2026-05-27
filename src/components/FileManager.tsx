/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  FileText, 
  MoreVertical,
  ArrowLeft,
  X,
  Save,
  Download,
  Upload,
  History,
  RotateCcw,
  Tag,
  Check,
  Square,
  CheckSquare,
  ArrowUp,
  ArrowDown,
  Keyboard,
  CloudUpload,
  Settings,
  Clock,
  ArrowRightLeft,
  ExternalLink,
  Info,
  ShieldCheck,
  Link
} from 'lucide-react';
import { useTaskQueue } from '../contexts/TaskQueueContext';
import { diff_match_patch } from 'diff-match-patch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFileSystem } from '@/lib/fs-store';
import { FSNode } from '@/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  Active,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface CloudSettings {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubFolder: string;
  gdriveJson: string;
}

const defaultCloudSettings: CloudSettings = {
  githubToken: '',
  githubOwner: '',
  githubRepo: '',
  githubFolder: 'uploads',
  gdriveJson: ''
};

function SortableRow({ 
  node, 
  openFile, 
  formatDate, 
  formatSize, 
  getChildren, 
  setNewName, 
  setRenameId, 
  deleteNode,
  isSearchingGlobal,
  searchQuery,
  nodes,
  setTagEditingId,
  selectedIds,
  toggleSelect,
  sortField,
  uploadViaProxy,
  syncAsJson
}: { 
  node: FSNode, 
  openFile: (n: FSNode) => void, 
  formatDate: (ts: number) => string, 
  formatSize: (s?: number) => string, 
  getChildren: (id: string) => FSNode[],
  setNewName: (s: string) => void,
  setRenameId: (s: string | null) => void,
  deleteNode: (id: string) => void,
  isSearchingGlobal: boolean,
  searchQuery: string,
  nodes: Record<string, FSNode>,
  setTagEditingId: (id: string | null) => void,
  selectedIds: Set<string>,
  toggleSelect: (id: string, e: React.MouseEvent) => void,
  sortField: string,
  uploadViaProxy: (node: FSNode, type: 'gdrive' | 'github') => void,
  syncAsJson: (node: FSNode) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: node.id,
    disabled: isSearchingGlobal || sortField !== 'default' // Disable manual sorting during search or when custom sort is active
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
    boxShadow: isDragging ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : 'none',
  };

  const isSelected = selectedIds.has(node.id);

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group hover:bg-white/5 cursor-pointer transition-all duration-300 border-b border-white/5",
        isDragging && "bg-primary/20 border-primary/50 shadow-[0_5px_15px_oklch(0.85_0.15_200_/_0.3)] backdrop-blur-md",
        isSelected && "bg-white/10 hover:bg-white/15"
      )}
      onClick={() => openFile(node)}
      {...attributes}
      {...listeners}
    >
      <TableCell className="pl-6 pr-0 py-4 w-10 border-0" onClick={(e: React.MouseEvent) => toggleSelect(node.id, e)}>
        <div className="flex items-center justify-center">
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-primary drop-shadow-[0_0_8px_var(--color-primary)]" />
          ) : (
            <Square className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
          )}
        </div>
      </TableCell>
      <TableCell className="px-6 py-4 border-0">
        <div className="flex items-center gap-3">
          {node.type === 'folder' ? (
            <div className="text-primary/80 drop-shadow-[0_0_8px_var(--color-primary)]">
              <Folder className="w-5 h-5 fill-current" />
            </div>
          ) : (
            <div className="text-white/60">
              <FileText className="w-5 h-5 fill-current" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-white tracking-wide">
              {searchQuery && isSearchingGlobal ? (
                node.name.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
                  part.toLowerCase() === searchQuery.toLowerCase() ? (
                    <span key={i} className="bg-primary text-black font-extrabold rounded px-1 drop-shadow-[0_0_5px_var(--color-primary)]">{part}</span>
                  ) : (
                    part
                  )
                )
              ) : (
                node.name
              )}
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {node.tags?.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded border border-primary/30 uppercase tracking-tighter shadow-sm">
                  {tag}
                </span>
              ))}
            </div>
            {isSearchingGlobal && node.content && node.content.toLowerCase().includes(searchQuery.toLowerCase()) && (
              <div className="text-xs text-white/40 line-clamp-1 mt-1 font-mono flex items-center">
                <span className="shrink-0">...</span>
                {(() => {
                  const content = node.content;
                  const query = searchQuery.toLowerCase();
                  const index = content.toLowerCase().indexOf(query);
                  const start = Math.max(0, index - 30);
                  const end = Math.min(content.length, index + query.length + 30);
                  const snippet = content.substring(start, end);
                  
                  const parts = snippet.split(new RegExp(`(${searchQuery})`, 'gi'));
                  return parts.map((part, i) => 
                    part.toLowerCase() === query ? (
                      <span key={i} className="bg-primary/80 text-black font-bold px-1 rounded shrink-0 drop-shadow-[0_0_5px_var(--color-primary)]">
                        {part}
                      </span>
                    ) : (
                      <span key={i} className="truncate">{part}</span>
                    )
                  );
                })()}
                <span className="shrink-0">...</span>
              </div>
            )}
          </div>
        </div>
      </TableCell>
      {isSearchingGlobal && (
        <TableCell className="px-6 py-4 text-xs text-white/40 font-mono border-0">
          {(() => {
            const pathNodes = [];
            let curr = node;
            while (curr && curr.parentId) {
              pathNodes.unshift(nodes[curr.parentId]?.name || '');
              curr = nodes[curr.parentId];
            }
            return pathNodes.join(' / ') || '/';
          })()}
        </TableCell>
      )}
      <TableCell className="px-6 py-4 text-white/50 font-mono text-xs border-0">
        {formatDate(node.updatedAt)}
      </TableCell>
      <TableCell className="px-6 py-4 text-white/50 text-right font-mono text-xs border-0">
        {node.type === 'file' ? formatSize(node.size) : `${getChildren(node.id).length} 個檔案`}
      </TableCell>
      <TableCell className="px-6 py-4 text-right border-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-8 h-8 p-0 hover:bg-white/10 rounded-full transition-colors">
              <MoreVertical className="w-4 h-4 text-white/40" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-2xl border-white/10 bg-black/80 backdrop-blur-xl">
            <DropdownMenuItem onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('nodeId', node.id);
              navigator.clipboard.writeText(url.toString()).then(() => {
                alert('連結已經複製到剪貼簿！');
              }).catch(() => {
                alert('無法存取剪貼簿。');
              });
            }} className="flex items-center gap-2 h-10 cursor-pointer text-white/70 focus:text-white focus:bg-white/10 rounded-lg">
              <Link className="w-4 h-4 text-primary" /> 複製連結
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setNewName(node.name);
              setRenameId(node.id);
            }} className="flex items-center gap-2 h-10 cursor-pointer text-white/70 focus:text-white focus:bg-white/10 rounded-lg">
              <Edit3 className="w-4 h-4 text-primary" /> 重新命名
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setTagEditingId(node.id);
            }} className="flex items-center gap-2 h-10 cursor-pointer text-white/70 focus:text-white focus:bg-white/10 rounded-lg">
              <Tag className="w-4 h-4 text-primary" /> 管理標籤
            </DropdownMenuItem>
            {node.type === 'file' && (
              <DropdownMenuItem 
                className="flex items-center gap-2 h-10 cursor-pointer text-primary focus:text-primary focus:bg-primary/20 font-medium rounded-lg"
                onClick={() => uploadViaProxy(node, 'gdrive')}
              >
                <CloudUpload className="w-4 h-4" /> 上傳至 Google Drive
              </DropdownMenuItem>
            )}
            {node.type === 'file' && (
              <DropdownMenuItem 
                className="flex items-center gap-2 h-10 cursor-pointer text-white/80 focus:text-white focus:bg-white/10 font-medium rounded-lg"
                onClick={() => uploadViaProxy(node, 'github')}
              >
                <CloudUpload className="w-4 h-4" /> 上傳至 GitHub
              </DropdownMenuItem>
            )}
            {node.type === 'file' && (
              <DropdownMenuItem 
                className="flex items-center gap-2 h-10 cursor-pointer text-purple-400 focus:text-purple-300 font-medium bg-purple-500/10 focus:bg-purple-500/30 rounded-lg mt-1 border border-purple-500/20"
                onClick={() => syncAsJson(node)}
              >
                <CloudUpload className="w-4 h-4" /> 推送至 GitHub (繞過防火牆純文本防擋)
              </DropdownMenuItem>
            )}
            <Separator className="bg-white/10 my-1" />
            <DropdownMenuItem 
              className="text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-red-500/20 flex items-center gap-2 h-10 cursor-pointer rounded-lg"
              onClick={() => deleteNode(node.id)}
            >
              <Trash2 className="w-4 h-4" /> 刪除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export default function FileManager() {
  const { 
    nodes, 
    currentFolderId, 
    path, 
    navigateTo, 
    createNode, 
    deleteNode, 
    updateFileContent, 
    saveVersion,
    renameNode,
    updateTags,
    restoreVersion,
    moveNode,
    reorderNodes,
    getChildren,
    importNodesMap,
    currentFolder
  } = useFileSystem();

  const { tasks, addTask, updateTask } = useTaskQueue();
  
  const isSaving = useMemo(() => tasks.some(t => t.status === 'running' && (t.type === 'upload' || t.type === 'sync')), [tasks]);
  const isImporting = useMemo(() => tasks.some(t => t.status === 'running' && t.type === 'import'), [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [tagEditingId, setTagEditingId] = useState<string | null>(null);
  const [bulkTagId, setBulkTagId] = useState<string | null>(null); // For bulk tagging
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newTag, setNewTag] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [comparingVersionId, setComparingVersionId] = useState<string | null>(null);
  const [uploadResultNode, setUploadResultNode] = useState<{ node: FSNode; result: any; uploadType: 'gdrive' | 'github' | 'github-sync' } | null>(null);
  const [batchUploadResults, setBatchUploadResults] = useState<{
    total: number;
    success: number;
    failed: number;
    details: { name: string; success: boolean; error?: string }[];
    type: 'gdrive' | 'github';
  } | null>(null);
  const [localIsSaving, setLocalIsSaving] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; stage?: string } | null>(null);
  const [batchUploadProgress, setBatchUploadProgress] = useState<{ current: number; total: number; stage?: string } | null>(null);
  const [sortField, setSortField] = useState<'name' | 'updatedAt' | 'size' | 'default'>('default');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastSavedContentRef = useRef<string | null>(null);
  const latestContentRef = useRef<string>('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsWarningMessage, setSettingsWarningMessage] = useState<string | null>(null);
  const [isImportGithubDialogOpen, setIsImportGithubDialogOpen] = useState(false);
  const [cloudSettings, setCloudSettings] = useState<CloudSettings>(defaultCloudSettings);

  // Handle Initial Routing for Copy Link feature
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetNodeId = params.get('nodeId');
    if (targetNodeId && nodes[targetNodeId]) {
      const targetNode = nodes[targetNodeId];
      if (targetNode.type === 'folder') {
        navigateTo(targetNodeId);
      } else {
        if (targetNode.parentId) navigateTo(targetNode.parentId);
        setTimeout(() => setEditingFileId(targetNode.id), 50);
      }
      
      const url = new URL(window.location.href);
      url.searchParams.delete('nodeId');
      window.history.replaceState({}, '', url.toString());
    }
  }, []); // Run on initial load

  // Sync latestContentRef
  useEffect(() => {
    if (editingFileId && nodes[editingFileId]) {
      latestContentRef.current = nodes[editingFileId].content || '';
    }
  }, [editingFileId, nodes]);

  // Auto-save logic
  useEffect(() => {
    if (!editingFileId) {
      lastSavedContentRef.current = null;
      return;
    }

    const node = nodes[editingFileId];
    if (node && lastSavedContentRef.current === null) {
      lastSavedContentRef.current = node.content || '';
    }

    const performAutoSave = (label: string) => {
      const currentContent = latestContentRef.current;

      if (currentContent !== lastSavedContentRef.current) {
        saveVersion(editingFileId, label);
        lastSavedContentRef.current = currentContent;
      }
    };

    // Inactivity Save: 5 seconds after stop typing
    const idleTimer = setTimeout(() => {
      performAutoSave('自動儲存 (閒置)');
    }, 5000);

    return () => clearTimeout(idleTimer);
  }, [editingFileId, editingFileId ? nodes[editingFileId]?.content : undefined]);

  // Periodic Save: Every 30 seconds
  useEffect(() => {
    if (!editingFileId) return;

    const periodicTimer = setInterval(() => {
      const currentContent = latestContentRef.current;

      if (currentContent !== lastSavedContentRef.current) {
        saveVersion(editingFileId, '自動儲存 (定期)');
        lastSavedContentRef.current = currentContent;
      }
    }, 30000);

    return () => clearInterval(periodicTimer);
  }, [editingFileId]);


  useEffect(() => {
    const saved = localStorage.getItem('file-nexus-cloud-settings');
    if (saved) {
      try {
        setCloudSettings(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveCloudSettings = (newSettings: CloudSettings) => {
    setCloudSettings(newSettings);
    localStorage.setItem('file-nexus-cloud-settings', JSON.stringify(newSettings));
  };


  const toggleSort = (field: 'name' | 'updatedAt' | 'size') => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField('default');
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === displayList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayList.map(n => n.id)));
    }
  };

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size > 0 && confirm(`確定要刪除這 ${selectedIds.size} 個項目嗎？`)) {
      selectedIds.forEach(id => deleteNode(id));
      setSelectedIds(new Set());
    }
  }, [selectedIds, deleteNode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (isInput) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // / : Focus Search
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Esc: Close/Clear
      if (e.key === 'Escape') {
        if (editingFileId) {
          setEditingFileId(null);
        } else if (selectedIds.size > 0) {
          clearSelection();
        } else if (searchQuery) {
          setSearchQuery('');
        }
      }

      // Alt + N: New File
      if (e.altKey && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        setCreateType('file');
        setIsCreateDialogOpen(true);
      }

      // Alt + Shift + N: New Folder
      if (e.altKey && e.key.toLowerCase() === 'n' && e.shiftKey) {
        e.preventDefault();
        setCreateType('folder');
        setIsCreateDialogOpen(true);
      }

      // Alt + ArrowUp: Parent Folder
      if (e.altKey && e.key === 'ArrowUp') {
        if (currentFolderId !== 'root') {
          const parentId = nodes[currentFolderId]?.parentId;
          if (parentId) navigateTo(parentId);
        }
      }

      // Delete: Bulk Delete
      if (e.key === 'Delete') {
        if (selectedIds.size > 0) {
          handleBulkDelete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingFileId, selectedIds, searchQuery, currentFolderId, nodes, navigateTo, handleBulkDelete, clearSelection]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    if (active.id !== over.id) {
      const overNode = nodes[over.id as string];
      // Check if we are dropping ON a folder to move it
      if (overNode && overNode.type === 'folder' && active.id !== overNode.id) {
        moveNode(active.id as string, overNode.id);
      } else {
        // Just reorder in current folder
        reorderNodes(currentFolderId, active.id as string, over.id as string);
      }
    }
  };

  const uploadViaProxy = async (node: FSNode, type: 'gdrive' | 'github') => {
    if (node.type !== 'file') return;
    
    const taskId = addTask({
      name: `同步 "${node.name}" 到 ${type === 'gdrive' ? 'Google Drive' : 'GitHub'}`,
      type: 'upload'
    });

    try {
      updateTask(taskId, { status: 'running', progress: 10, stage: '正在編碼內容...' });
      let contentBase64 = '';
      let mimeType = 'text/plain';

      if (node.content && node.content.startsWith('data:')) {
        contentBase64 = node.content.split(',')[1];
        mimeType = node.content.split(';')[0].split(':')[1];
      } else {
        contentBase64 = btoa(unescape(encodeURIComponent(node.content || '')));
      }
      
      const payload: any = {
        filename: node.name,
        contentBase64,
        mimeType
      };

      if (type === 'gdrive' && cloudSettings.gdriveJson) {
        payload.gdriveJson = cloudSettings.gdriveJson;
      }
      if (type === 'github') {
        if (cloudSettings.githubToken) payload.githubToken = cloudSettings.githubToken;
        if (cloudSettings.githubOwner) payload.githubOwner = cloudSettings.githubOwner;
        if (cloudSettings.githubRepo) payload.githubRepo = cloudSettings.githubRepo;
        if (cloudSettings.githubFolder) payload.githubFolder = cloudSettings.githubFolder;
      }

      updateTask(taskId, { progress: 40, stage: `正在上傳至 ${type === 'gdrive' ? 'Google Drive' : 'GitHub'} 伺服器...` });
      const endpoint = type === 'gdrive' ? '/api/upload/gdrive' : '/api/upload/github';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (result.success) {
        updateTask(taskId, { status: 'completed', progress: 100, stage: '同步成功' });
      } else {
        updateTask(taskId, { status: 'failed', stage: '同步失敗', error: result.error || '不明錯誤' });
      }
      
      setUploadResultNode({ node, result, uploadType: type });
    } catch(e: any) {
      updateTask(taskId, { status: 'failed', stage: '連線錯誤', error: e.message });
    }
  };

  const handleBulkUploadProxy = async (type: 'gdrive' | 'github') => {
    const ids = Array.from(selectedIds);
    const filesToUpload = ids
      .map(id => nodes[id])
      .filter(node => node && node.type === 'file') as FSNode[];
    
    if (filesToUpload.length === 0) {
      alert('請選擇至少一個檔案進行上傳。');
      return;
    }

    const taskId = addTask({
      name: `批次同步 ${filesToUpload.length} 個項目到 ${type === 'gdrive' ? 'Google Drive' : 'GitHub'}`,
      type: 'upload'
    });

    // Initialise batch progress state used by the UI panel
    setBatchUploadProgress({ current: 0, total: filesToUpload.length, stage: `準備進行 ${type === 'gdrive' ? 'Google Drive' : 'GitHub'} 批次同步...` });
    updateTask(taskId, { status: 'running', progress: 5, stage: `準備進行 ${type === 'gdrive' ? 'Google Drive' : 'GitHub'} 批次同步...` });
    
    const resultsList: { name: string; success: boolean; error?: string }[] = [];
    let successCount = 0;

    if (type === 'github') {
      try {
        updateTask(taskId, { progress: 20, stage: `正在編碼 ${filesToUpload.length} 個檔案的 Base64 內容...` });
        setBatchUploadProgress(prev => ({ ...(prev || { total: filesToUpload.length }), current: 0, total: filesToUpload.length, stage: '編碼內容...' }));
        
        const payloadFiles = filesToUpload.map((node, idx) => {
          let contentBase64 = '';
          if (node.content && node.content.startsWith('data:')) {
            contentBase64 = node.content.split(',')[1];
          } else {
            contentBase64 = btoa(unescape(encodeURIComponent(node.content || '')));
          }
          return {
            filename: node.name,
            contentBase64
          };
        });

        // mark encoding as complete
        setBatchUploadProgress({ current: filesToUpload.length, total: filesToUpload.length, stage: '已封裝，準備提交' });

        const payload: any = {
          files: payloadFiles,
          ...cloudSettings
        };

        updateTask(taskId, { progress: 50, stage: `正在向 GitHub 提交單一對應 Commit...` });
        
        const response = await fetch('/api/upload/github-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const resultData = await response.json();
        
        if (resultData.success) {
          successCount = filesToUpload.length;
          filesToUpload.forEach(node => resultsList.push({ name: node.name, success: true }));
          updateTask(taskId, { status: 'completed', progress: 100, stage: `同步成功！Commit: ${resultData.data.commitSha.substring(0, 7)}` });
          setBatchUploadProgress({ current: filesToUpload.length, total: filesToUpload.length, stage: '同步完成' });
          // clear progress after short delay to allow UI to show 100%
          setTimeout(() => setBatchUploadProgress(null), 1200);
        } else {
          filesToUpload.forEach(node => resultsList.push({ name: node.name, success: false, error: resultData.error || '批次提交失敗' }));
          updateTask(taskId, { status: 'failed', stage: '批次同步失敗', error: resultData.error || 'GitHub API 錯誤' });
          setBatchUploadProgress(null);
        }
      } catch (e: any) {
        filesToUpload.forEach(node => resultsList.push({ name: node.name, success: false, error: e.message }));
        updateTask(taskId, { status: 'failed', stage: '連線錯誤', error: e.message });
        setBatchUploadProgress(null);
      }
    } else {
      // Google Drive 仍使用循環 (逐一同步)
      for (let i = 0; i < filesToUpload.length; i++) {
        const node = filesToUpload[i];
        try {
          updateTask(taskId, { 
            progress: (i / filesToUpload.length) * 100, 
            stage: `[${i + 1}/${filesToUpload.length}] 正在將 "${node.name}" 上傳至 Google Drive...` 
          });
          setBatchUploadProgress({ current: i + 1, total: filesToUpload.length, stage: `[${i + 1}/${filesToUpload.length}] 正在上傳 ${node.name}` });

          const formData = new FormData();
          let blob: Blob;
          if (node.content && node.content.startsWith('data:')) {
            const res = await fetch(node.content);
            blob = await res.blob();
          } else {
            blob = new Blob([node.content || ''], { type: 'text/plain' });
          }
          
          formData.append('file', blob, node.name);
          if (cloudSettings.gdriveJson) {
            formData.append('gdriveJson', cloudSettings.gdriveJson);
          }

          const response = await fetch('/api/upload/gdrive', {
            method: 'POST',
            body: formData
          });

          const resultData = await response.json();
          if (resultData.success) {
            successCount++;
            resultsList.push({ name: node.name, success: true });
          } else {
            resultsList.push({ name: node.name, success: false, error: resultData.error || '上傳失敗' });
          }
        } catch (e: any) {
          resultsList.push({ name: node.name, success: false, error: e.message });
        }
      }
      
      const isFullSuccess = successCount === filesToUpload.length;
      updateTask(taskId, { 
        status: isFullSuccess ? 'completed' : 'failed',
        progress: 100, 
        stage: isFullSuccess ? '批次同步完成' : `同步完成，但有 ${filesToUpload.length - successCount} 個項目失敗`,
        error: isFullSuccess ? undefined : '部分上傳失敗'
      });
      setBatchUploadProgress({ current: filesToUpload.length, total: filesToUpload.length, stage: isFullSuccess ? '批次同步完成' : '批次完成（部分失敗）' });
      setTimeout(() => setBatchUploadProgress(null), 1200);
    }

    setBatchUploadResults({
      total: filesToUpload.length,
      success: successCount,
      failed: filesToUpload.length - successCount,
      details: resultsList,
      type
    });
    clearSelection();
  };

  const syncAsJson = async (node: FSNode) => {
    if (node.type !== 'file') return;
    
    const taskId = addTask({
      name: `文本同步 "${node.name}" 到 GitHub`,
      type: 'sync'
    });

    try {
      updateTask(taskId, { status: 'running', progress: 10, stage: '正在編碼 Base64...' });
      let contentBase64 = '';
      if (node.content && node.content.startsWith('data:')) {
        contentBase64 = node.content.split(',')[1];
      } else {
        // Base64 encode avoiding unicode issue
        contentBase64 = btoa(unescape(encodeURIComponent(node.content || '')));
      }

      updateTask(taskId, { progress: 40, stage: '正在向 GitHub 提交 JSON 封裝同步...' });
      const response = await fetch('/api/sync/github-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: node.name,
          contentBase64: contentBase64,
          githubToken: cloudSettings.githubToken || undefined,
          githubOwner: cloudSettings.githubOwner || undefined,
          githubRepo: cloudSettings.githubRepo || undefined,
          githubFolder: cloudSettings.githubFolder || undefined
        })
      });

      const result = await response.json();
      
      if (result.success) {
        updateTask(taskId, { status: 'completed', progress: 100, stage: '同步成功' });
      } else {
        updateTask(taskId, { status: 'failed', stage: '同步失敗', error: result.error || '不明錯誤' });
      }
      
      setUploadResultNode({ node, result, uploadType: 'github-sync' });
    } catch(e: any) {
      updateTask(taskId, { status: 'failed', stage: '連線錯誤', error: e.message });
    }
  };

  const [showHistory, setShowHistory] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [newName, setNewName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isSearchingGlobal = searchQuery.length > 0;

  const searchResults = useMemo(() => {
    if (!isSearchingGlobal) return [];
    
    return (Object.values(nodes) as FSNode[]).filter(node => {
      if (node.id === 'root') return false;
      const matchName = node.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchContent = node.content?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchName || matchContent;
    });
  }, [nodes, searchQuery]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    (Object.values(nodes) as FSNode[]).forEach(node => {
      node.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [nodes]);

  const diffHtml = useMemo(() => {
    if (!editingFileId || !comparingVersionId) return '';
    const node = nodes[editingFileId];
    if (!node || !node.versions) return '';
    const version = node.versions.find(v => v.id === comparingVersionId);
    if (!version) return '';

    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(version.content, node.content || '');
    dmp.diff_cleanupSemantic(diffs);
    return dmp.diff_prettyHtml(diffs);
  }, [editingFileId, comparingVersionId, nodes]);

  const currentChildren = useMemo(() => {
    return getChildren(currentFolderId);
  }, [currentFolderId, nodes]);

  const displayList = useMemo(() => {
    let list = isSearchingGlobal ? [...searchResults] : [...currentChildren];
    
    if (selectedTag) {
      list = list.filter(node => node.tags?.includes(selectedTag));
    }

    if (sortField !== 'default') {
      list.sort((a, b) => {
        // Folders always come first if we're not searching global or if we want categorized sort
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }

        let comparison = 0;
        if (sortField === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (sortField === 'updatedAt') {
          comparison = a.updatedAt - b.updatedAt;
        } else if (sortField === 'size') {
          const sizeA = a.size || 0;
          const sizeB = b.size || 0;
          comparison = sizeA - sizeB;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return list;
  }, [isSearchingGlobal, searchResults, currentChildren, selectedTag, sortField, sortDirection]);

  const executeGithubImport = async () => {
    if (!cloudSettings.githubToken || !cloudSettings.githubOwner || !cloudSettings.githubRepo) {
      alert('請填寫完整的 GitHub 資訊');
      return;
    }
    
    setIsImportGithubDialogOpen(false);
    const taskId = addTask({
      name: `從 GitHub 匯入專案: ${cloudSettings.githubRepo}`,
      type: 'import'
    });

    updateTask(taskId, { status: 'running', progress: 5, stage: '正在初始化 GitHub 連線...' });
    
    try {
      updateTask(taskId, { progress: 20, stage: '正在抓取 Git Tree 資料夾結構...' });
      setImportProgress({ current: 0, total: 0, stage: '抓取中...' });
        const response = await fetch('/api/sync/github-tree', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                githubToken: cloudSettings.githubToken,
                githubOwner: cloudSettings.githubOwner,
                githubRepo: cloudSettings.githubRepo,
                branch: 'main'
            })
        });
        const res = await response.json();
        if (!res.success) throw new Error(res.error + ' - ' + (res.details || ''));
        
        const treeNodes = res.tree;
        const totalItems = treeNodes.length;
        setImportProgress({ current: 0, total: totalItems, stage: `正在處理 ${totalItems} 個節點...` });
        updateTask(taskId, { progress: 40, stage: `已獲取 ${totalItems} 個目標節點，正在轉換格式...` });
        
        const newNodes: Record<string, FSNode> = {};
        const repoRootId = `gh_root_${cloudSettings.githubRepo}_${Date.now()}`;
        newNodes[repoRootId] = {
           id: repoRootId,
           name: `${cloudSettings.githubRepo} (GitHub 遠端)`,
           type: 'folder',
           parentId: currentFolderId,
           createdAt: Date.now(),
           updatedAt: Date.now()
        };

        const pathMap: Record<string, string> = { '': repoRootId };
        
        updateTask(taskId, { progress: 50, stage: '正在排序並建立父子級映射...' });
        treeNodes.sort((a: any, b: any) => (a.path.match(/\//g) || []).length - (b.path.match(/\//g) || []).length);

        treeNodes.forEach((item: any, index: number) => {
            const parts = item.path.split('/');
            const name = parts.pop() || '';
            const parentPath = parts.join('/');
            const parentId = pathMap[parentPath] || repoRootId;
            
            const id = 'gh_' + item.sha + '_' + Math.random().toString(36).substring(2, 6);
            pathMap[item.path] = id;
            
            let content;
            if (item.type === 'blob') {
              content = `[GitHub Remote File]
此為檔案夾結構之映射，內容尚未載入。
檔案大小：${item.size || 0} bytes
您可以直接雙擊開啟，系統將會連網為您載入真實內容。`;
            }

            newNodes[id] = {
               id,
               name,
               type: item.type === 'tree' ? 'folder' : 'file',
               parentId,
               createdAt: Date.now(),
               updatedAt: Date.now(),
               size: item.size || 0,
               content,
               tags: ['GitHub']
            };

            if (index % 100 === 0) {
              updateTask(taskId, { 
                progress: 50 + Math.floor((index / totalItems) * 40), 
                stage: `正在處理結構樹 (${index}/${totalItems})...` 
              });
              setImportProgress({ current: index, total: totalItems, stage: `處理節點 ${index}/${totalItems}` });
            }
        });
        
        updateTask(taskId, { progress: 95, stage: '正在寫入資料庫快取...' });
        setImportProgress({ current: totalItems, total: totalItems, stage: '寫入資料庫快取...' });
        importNodesMap(newNodes);
        updateTask(taskId, { status: 'completed', progress: 100, stage: '匯入完成！' });
        // allow UI to show completion then clear
        setTimeout(() => setImportProgress(null), 1200);
        
    } catch(e: any) {
        updateTask(taskId, { status: 'failed', stage: '匯入失敗', error: e.message });
        setImportProgress(null);
    }
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createNode(newName, createType);
    setNewName('');
    setIsCreateDialogOpen(false);
  };

  const handleRename = () => {
    if (!renameId || !newName.trim()) return;
    renameNode(renameId, newName);
    setNewName('');
    setRenameId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files as FileList).forEach((file: File) => {
      const reader = new FileReader();
      
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';
      const isText = file.type.startsWith('text/') || file.name.match(/\.(txt|md|js|ts|tsx|json|css|html)$/);

      reader.onload = (event) => {
        const content = event.target?.result as string;
        createNode(file.name, 'file', content);
      };
      
      if (isText) {
        reader.readAsText(file);
      } else if (isImage || isPDF) {
        reader.readAsDataURL(file);
      } else {
        createNode(file.name, 'file', `[Binary file: ${file.type}]`);
      }
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = (id: string) => {
    const node = nodes[id];
    if (!node || node.type !== 'file') return;

    const content = node.content || '';
    let url: string;
    
    if (content.startsWith('data:')) {
      url = content;
    } else {
      const blob = new Blob([content], { type: 'text/plain' });
      url = URL.createObjectURL(blob);
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = node.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    if (!content.startsWith('data:')) {
      URL.revokeObjectURL(url);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openFile = async (node: FSNode) => {
    if (node.type === 'folder') {
      navigateTo(node.id);
    } else {
      if (node.content && node.content.startsWith('[GitHub Remote File]')) {
         try {
             const shaMatch = node.id.match(/^gh_([^_]+)_/);
             const sha = shaMatch ? shaMatch[1] : node.id.replace('gh_', '');
             
             updateFileContent(node.id, '正在從 GitHub 載入中...\n(請稍候)');
             
             const response = await fetch('/api/sync/github-blob', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     githubToken: cloudSettings.githubToken,
                     githubOwner: cloudSettings.githubOwner,
                     githubRepo: cloudSettings.githubRepo,
                     sha
                 })
             });
             const res = await response.json();
             if (res.success && res.contentBase64) {
                 const decoded = decodeURIComponent(escape(atob(res.contentBase64)));
                 updateFileContent(node.id, decoded);
                 node.content = decoded; // Optimistic
             } else {
                 updateFileContent(node.id, `無法載入 GitHub 檔案內容: ${res.error}`);
             }
         } catch(e) {
            console.error('Failed to download content:', e);
            updateFileContent(node.id, '網路錯誤，無法載入 GitHub 檔案內容。');
         }
      }
      setEditingFileId(node.id);
    }
  };

  return (
    <div className="flex h-screen mesh-gradient bg-noise text-foreground font-sans overflow-hidden dark relative p-4 gap-4">
      <input 
        type="file" 
        multiple 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
      />
      {/* Sidebar - Glassmorphic Style */}
      <aside className="w-64 glass-panel rounded-3xl flex flex-col shrink-0 z-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-noise opacity-50 mix-blend-overlay pointer-events-none"></div>
        <div className="p-8 pb-4 relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_oklch(0.85_0.15_200_/_0.2)]">
              <Folder className="text-primary w-5 h-5" />
            </div>
            <span className="font-heading font-extrabold text-2xl tracking-tighter text-white">NEXUS</span>
          </div>
          
          <nav className="space-y-1">
            <Button 
              variant="ghost" 
              className={cn(
                "w-full justify-start gap-3 h-10 px-3 rounded-xl transition-all duration-300 font-medium",
                currentFolderId === 'root' 
                  ? "bg-white/10 text-white shadow-[0_0_10px_oklch(0.85_0.15_200_/_0.1)] border border-white/10" 
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
              onClick={() => navigateTo('root')}
            >
              <Folder className={cn("w-5 h-5 transition-colors", currentFolderId === 'root' ? "text-primary" : "text-slate-500")} />
              我的檔案
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3 h-10 px-3 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-xl transition-all duration-300"
              onClick={() => {
                setCreateType('folder');
                setIsCreateDialogOpen(true);
              }}
            >
              <Plus className="w-5 h-5 text-slate-500" />
              新增資料夾
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 h-10 px-3 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-xl transition-all duration-300">
              <Plus className="w-5 h-5 text-slate-500" />
              星標文件
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 h-10 px-3 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-xl transition-all duration-300">
              <Trash2 className="w-5 h-5 text-slate-500" />
              垃圾桶
            </Button>
          </nav>

          <div className="mt-8">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-3">熱門標籤</div>
            <div className="space-y-1">
              <Button 
                variant="ghost" 
                className={cn(
                  "w-full justify-start gap-3 h-9 px-3 rounded-xl text-xs group transition-all duration-300",
                  !selectedTag ? "bg-white/10 text-white font-bold border border-white/5" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
                onClick={() => setSelectedTag(null)}
              >
                <div className={cn("w-2 h-2 rounded-full transition-colors", !selectedTag ? "bg-primary shadow-[0_0_8px_var(--color-primary)]" : "bg-slate-600 group-hover:bg-slate-400")} />
                全部項目
              </Button>
              {allTags.length === 0 && (
                <div className="px-3 py-2 text-[10px] text-slate-500 italic">尚無標籤</div>
              )}
              {allTags.map(tag => (
                <Button 
                  key={tag}
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-3 h-9 px-3 rounded-xl text-xs group transition-all duration-300",
                    selectedTag === tag ? "bg-white/10 text-white font-bold border border-white/5" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                >
                  <Tag className={cn("w-3.5 h-3.5 transition-colors", selectedTag === tag ? "text-primary" : "text-slate-500 group-hover:text-slate-400")} />
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-auto p-6 border-t border-white/5 relative z-10 bg-black/20">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 h-10 px-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl mb-4 group transition-all duration-300"
            onClick={() => setIsHelpOpen(true)}
          >
            <Keyboard className="w-5 h-5 text-slate-500 group-hover:text-primary transition-colors" />
            快速鍵說明
          </Button>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">儲存空間</div>
          <div className="w-full bg-white/5 rounded-full h-1.5 mb-2 overflow-hidden border border-white/5">
            <div className="bg-primary h-1.5 rounded-full shadow-[0_0_10px_var(--color-primary)] relative" style={{ width: '65%' }}>
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">已使用 64.2 GB / 100 GB</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              ref={searchInputRef}
              placeholder="搜尋檔案、文件或資料夾..." 
              className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-2xl text-sm focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary outline-none transition-all placeholder:text-white/30 text-white font-mono"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4">
            <Button 
              variant="outline"
              className="h-10 text-slate-300 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-all duration-300 hover-glow font-medium"
              onClick={() => setIsImportGithubDialogOpen(true)}
              disabled={isImporting}
              title="從遠端 GitHub Repository 將專案下載到本機清單"
            >
              {isImporting ? '匯入中...' : '📥 匯入 Github 專案'}
            </Button>
            <Button 
              variant="outline"
              size="icon"
              className="h-10 w-10 text-slate-300 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-all duration-300 hover-glow"
              onClick={() => setIsSettingsOpen(true)}
              title="雲端同步設定"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Button 
              className="bg-primary text-black hover:bg-primary/90 rounded-xl px-5 h-10 gap-2 font-bold transition-all active:scale-95 shadow-[0_0_20px_oklch(0.85_0.15_200_/_0.3)] hover:shadow-[0_0_25px_oklch(0.85_0.15_200_/_0.5)]"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              上傳檔案
            </Button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 border border-white/20 shadow-lg shadow-primary/20" />
          </div>
        </header>

        {/* View Section */}
        <div className="p-8 flex-1 overflow-hidden flex flex-col glass-panel rounded-3xl mx-2 mb-2 border-white/10 relative">
          <div className="absolute inset-0 bg-noise opacity-30 mix-blend-overlay pointer-events-none"></div>
          <div className="relative z-10 flex items-center justify-between mb-8">
            <div className="flex items-center gap-1 text-sm text-slate-400 overflow-hidden">
              {isSearchingGlobal ? (
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary" />
                  <span className="text-white font-extrabold font-heading tracking-tight text-3xl">搜尋結果</span>
                  <span className="text-slate-400 text-sm font-normal mt-1 ml-2 font-mono">"{searchQuery}"</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 font-heading">
                    {path.map((id, i) => (
                      <React.Fragment key={id}>
                        {i > 0 && <ChevronRight className="w-4 h-4 text-white/30" />}
                        <button 
                          className={cn(
                            "hover:text-primary transition-colors whitespace-nowrap px-1 py-0.5 rounded",
                            i === path.length - 1 ? "text-white font-extrabold text-3xl tracking-tight" : "text-white/50"
                          )}
                          onClick={() => navigateTo(id)}
                        >
                          {nodes[id]?.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                  {currentFolderId && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="ml-2 h-8 w-8 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('nodeId', currentFolderId);
                        navigator.clipboard.writeText(url.toString())
                          .then(() => alert('已複製資料夾連結！'))
                          .catch(() => alert('無法存取剪貼簿。'));
                      }}
                      title="複製此資料夾的連結"
                    >
                      <Link className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shadow-inner">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 bg-white/10 rounded shadow-sm text-white hover:bg-primary/20 hover:text-primary transition-colors"
                onClick={() => {
                  setCreateType('file');
                  setIsCreateDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </Button>
            </div>
          </div>

          <div className="mb-12 relative z-10 flex-1 flex flex-col min-h-0">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 font-mono">
              {isSearchingGlobal ? `找到 ${displayList.length} 個項目` : '檔案列表'}
            </h2>
            <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <Table>
                    <TableHeader className="bg-white/5 border-b border-white/10 backdrop-blur-sm">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="pl-6 pr-0 py-3 w-10">
                          <div 
                            className="flex items-center justify-center cursor-pointer"
                            onClick={handleSelectAll}
                          >
                            {selectedIds.size > 0 && selectedIds.size === displayList.length ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : selectedIds.size > 0 ? (
                              <div className="w-4 h-4 bg-primary rounded flex items-center justify-center">
                                <div className="w-2 h-0.5 bg-background" />
                              </div>
                            ) : (
                              <Square className="w-4 h-4 text-white/30 hover:text-white/50 transition-colors" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="px-6 py-3 font-medium text-slate-400 cursor-pointer hover:bg-white/5 transition-colors group"
                          onClick={() => toggleSort('name')}
                        >
                          <div className="flex items-center gap-2 font-mono text-xs tracking-wider">
                             名稱
                             <div className="flex flex-col">
                               <ArrowUp className={cn("w-2 h-2 transition-colors", sortField === 'name' && sortDirection === 'asc' ? "text-primary" : "text-white/20 group-hover:text-white/50")} />
                               <ArrowDown className={cn("w-2 h-2 transition-colors", sortField === 'name' && sortDirection === 'desc' ? "text-primary" : "text-white/20 group-hover:text-white/50")} />
                             </div>
                          </div>
                        </TableHead>
                        {isSearchingGlobal && <TableHead className="px-6 py-3 font-medium text-slate-400 font-mono text-xs tracking-wider">路徑</TableHead>}
                        <TableHead 
                          className="px-6 py-3 font-medium text-slate-400 cursor-pointer hover:bg-white/5 transition-colors group"
                          onClick={() => toggleSort('updatedAt')}
                        >
                          <div className="flex items-center gap-2 font-mono text-xs tracking-wider">
                            上次修改
                            <div className="flex flex-col">
                               <ArrowUp className={cn("w-2 h-2 transition-colors", sortField === 'updatedAt' && sortDirection === 'asc' ? "text-primary" : "text-white/20 group-hover:text-white/50")} />
                               <ArrowDown className={cn("w-2 h-2 transition-colors", sortField === 'updatedAt' && sortDirection === 'desc' ? "text-primary" : "text-white/20 group-hover:text-white/50")} />
                            </div>
                          </div>
                        </TableHead>
                        <TableHead 
                          className="px-6 py-3 font-medium text-slate-400 text-right cursor-pointer hover:bg-white/5 transition-colors group"
                          onClick={() => toggleSort('size')}
                        >
                          <div className="flex items-center justify-end gap-2 font-mono text-xs tracking-wider">
                             大小
                             <div className="flex flex-col">
                               <ArrowUp className={cn("w-2 h-2 transition-colors", sortField === 'size' && sortDirection === 'asc' ? "text-primary" : "text-white/20 group-hover:text-white/50")} />
                               <ArrowDown className={cn("w-2 h-2 transition-colors", sortField === 'size' && sortDirection === 'desc' ? "text-primary" : "text-white/20 group-hover:text-white/50")} />
                             </div>
                          </div>
                        </TableHead>
                        <TableHead className="px-6 py-3 font-medium text-slate-400 text-right font-mono text-xs tracking-wider">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-white/5 border-b border-white/5">
                      {displayList.length === 0 ? (
                        <TableRow className="border-0 hover:bg-transparent">
                          <TableCell colSpan={isSearchingGlobal ? 5 : 4} className="h-64 text-center">
                            <div className="flex flex-col items-center gap-2">
                               <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shadow-[0_0_15px_oklch(0_0_0_/_0.5)]">
                                 <Plus className="text-white/20 w-8 h-8" />
                               </div>
                               <p className="text-sm text-white/40 mt-4 font-mono">{isSearchingGlobal ? '查無符合結果' : '沒有任何檔案'}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <SortableContext 
                          items={displayList.map(n => n.id)} 
                          strategy={verticalListSortingStrategy}
                        >
                          {displayList.map((node) => (
                             <SortableRow 
                               key={node.id}
                               node={node}
                               openFile={openFile}
                               formatDate={formatDate}
                               formatSize={formatSize}
                               getChildren={getChildren}
                               setNewName={setNewName}
                               setRenameId={setRenameId}
                               deleteNode={deleteNode}
                               isSearchingGlobal={isSearchingGlobal}
                               searchQuery={searchQuery}
                               nodes={nodes}
                               setTagEditingId={setTagEditingId}
                               selectedIds={selectedIds}
                               toggleSelect={toggleSelect}
                               sortField={sortField}
                               uploadViaProxy={uploadViaProxy}
                               syncAsJson={syncAsJson}
                             />
                          ))}
                        </SortableContext>
                      )}
                    </TableBody>
                  </Table>
                  
                  <DragOverlay>
                    {activeId ? (
                      <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-xl flex items-center gap-3 opacity-90 scale-105 transition-transform">
                        {nodes[activeId].type === 'folder' ? (
                          <Folder className="w-5 h-5 text-[#f59e0b] fill-current" />
                        ) : (
                          <FileText className="w-5 h-5 text-blue-400 fill-current" />
                        )}
                        <span className="font-medium text-slate-900">{nodes[activeId].name}</span>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Editor Overlay */}
        <AnimatePresence>
          {editingFileId && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 right-0 w-full md:w-3/4 max-w-4xl bg-white shadow-2xl z-20 flex flex-col border-l border-slate-200"
            >
              <div className="h-16 border-b border-slate-100 flex items-center px-6 gap-4 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => setEditingFileId(null)} className="rounded-full">
                  <ArrowLeft className="w-5 h-5 text-slate-400" />
                </Button>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900">{nodes[editingFileId]?.name}</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">編輯中</p>
                </div>
                <div className="flex items-center gap-2">
                   <Button 
                     variant="ghost" 
                     size="icon" 
                     className={cn("rounded-full transition-colors", showHistory ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-slate-900")}
                     onClick={() => setShowHistory(!showHistory)}
                     title="版本紀錄"
                   >
                     <History className="w-5 h-5" />
                   </Button>
                   <Button 
                     variant="ghost" 
                     size="icon" 
                     className="rounded-full text-slate-400 hover:text-slate-900"
                     onClick={() => {
                       const url = new URL(window.location.href);
                       url.searchParams.set('nodeId', editingFileId);
                       navigator.clipboard.writeText(url.toString()).then(() => alert('已複製檔案連結！')).catch(() => alert('無法存取剪貼簿'));
                     }}
                     title="複製檔案連結"
                   >
                     <Link className="w-5 h-5" />
                   </Button>
                   <Button 
                     variant="ghost" 
                     size="icon" 
                     className="rounded-full text-slate-400 hover:text-slate-900"
                     onClick={() => editingFileId && handleDownload(editingFileId)}
                     title="下載"
                   >
                     <Download className="w-5 h-5" />
                   </Button>
                   <Button 
                     className={cn(
                       "rounded-lg px-6 h-9 gap-2 transition-all active:scale-95",
                       (isSaving || localIsSaving) ? "bg-emerald-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100"
                     )}
                     onClick={() => {
                       if (editingFileId) {
                         setLocalIsSaving(true);
                         saveVersion(editingFileId, '手動儲存');
                         setTimeout(() => setLocalIsSaving(false), 2000);
                       }
                     }}
                   >
                     {(isSaving || localIsSaving) ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                     {(isSaving || localIsSaving) ? '正在儲存...' : '儲存版本'}
                   </Button>
                </div>
              </div>
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 p-8 overflow-auto">
                  {(() => {
                    const node = nodes[editingFileId];
                    if (!node) return null;

                    const isBinaryPlaceholder = node.content?.startsWith('[Binary file:');
                    const isDataURL = node.content?.startsWith('data:');
                    
                    if (isDataURL) {
                      const mimeType = node.content?.split(';')[0].split(':')[1];
                      const isImage = mimeType?.startsWith('image/');
                      const isPDF = mimeType === 'application/pdf';

                      if (isImage) {
                        return (
                          <div className="flex flex-col items-center justify-center h-full bg-slate-50/50 rounded-2xl overflow-hidden p-4">
                            <img 
                              src={node.content} 
                              alt={node.name} 
                              className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                              referrerPolicy="no-referrer"
                            />
                            <div className="mt-4 text-xs text-slate-400 font-mono">
                              {mimeType} | {formatSize(node.size)}
                            </div>
                          </div>
                        );
                      }

                      if (isPDF) {
                        return (
                          <div className="w-full h-full flex flex-col gap-4">
                            <iframe 
                              src={node.content} 
                              title={node.name}
                              className="w-full h-full border border-slate-200 rounded-xl bg-white shadow-inner"
                            />
                            <div className="text-center text-xs text-slate-400 font-mono">
                              PDF 預覽 | {formatSize(node.size)}
                            </div>
                          </div>
                        );
                      }
                    }

                    if (isBinaryPlaceholder) {
                      return (
                        <div className="flex flex-col items-center justify-center h-full gap-6 text-slate-400">
                          <div className="w-32 h-32 bg-slate-50 rounded-2xl flex items-center justify-center">
                            <FileText className="w-16 h-16 text-slate-200" />
                          </div>
                          <div className="text-center space-y-2">
                            <h4 className="text-xl font-bold text-slate-900">{node.name}</h4>
                            <p className="text-sm">此檔案為二進位格式，且無可用的預覽。</p>
                            <div className="flex items-center justify-center gap-4 mt-4">
                              <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 shadow-sm text-xs font-mono">
                                <span className="text-slate-400 mr-2 uppercase tracking-tight">大小:</span>
                                <span className="text-slate-900">{formatSize(node.size)}</span>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 shadow-sm text-xs font-mono">
                                <span className="text-slate-400 mr-2 uppercase tracking-tight">類型:</span>
                                <span className="text-slate-900">{node.content?.match(/\[Binary file: (.*)\]/)?.[1] || 'Unknown'}</span>
                              </div>
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            className="gap-2 mt-4 px-8 h-12 rounded-xl text-slate-600 border-slate-200 hover:bg-slate-50 transition-all"
                            onClick={() => editingFileId && handleDownload(editingFileId)}
                          >
                            <Download className="w-4 h-4" /> 下載檔案
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <textarea 
                        className="w-full h-full resize-none focus:outline-none font-mono text-base leading-relaxed bg-transparent text-slate-800"
                        value={node.content || ''}
                        onChange={(e) => updateFileContent(editingFileId, e.target.value)}
                        placeholder="開始輸入..."
                      />
                    );
                  })()}
                </div>
                
                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="w-80 border-l border-slate-100 bg-slate-50 overflow-hidden flex flex-col"
                    >
                      <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">版本歷史</h4>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">最近 20 筆</span>
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="p-3 space-y-3">
                          {(!nodes[editingFileId]?.versions || nodes[editingFileId]?.versions?.length === 0) ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center gap-3">
                              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                                <History className="w-6 h-6 text-slate-300" />
                              </div>
                              <p className="text-xs text-slate-400">目前尚無早期版本。<br/>儲存後將會出現在這裡。</p>
                            </div>
                          ) : (
                            nodes[editingFileId]?.versions?.map((version) => {
                              const isComparing = comparingVersionId === version.id;
                              return (
                                <div 
                                  key={version.id} 
                                  className={cn(
                                    "group relative p-4 bg-white border rounded-xl transition-all shadow-sm",
                                    isComparing ? "border-blue-400 ring-2 ring-blue-50" : "border-slate-100 hover:border-slate-300 hover:shadow-md"
                                  )}
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className={cn(
                                          "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                          version.label?.includes('自動') ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                                        )}>
                                          {version.label || '版本'}
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-400">#{version.id}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(version.timestamp).toLocaleString(undefined, { 
                                          month: 'short', 
                                          day: 'numeric', 
                                          hour: '2-digit', 
                                          minute: '2-digit' 
                                        })}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-[11px] text-slate-600 line-clamp-2 px-3 py-2 bg-slate-50 rounded-lg italic mb-3">
                                    "{version.content.substring(0, 80)}..."
                                  </div>

                                  <div className="flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className={cn(
                                        "flex-1 h-8 text-[10px] rounded-lg gap-1 border-slate-200 transition-all",
                                        isComparing ? "bg-blue-600 text-white border-blue-600" : "hover:bg-slate-50"
                                      )}
                                      onClick={() => setComparingVersionId(isComparing ? null : version.id)}
                                    >
                                      <ArrowRightLeft className="w-3 h-3" />
                                      {isComparing ? '關閉對比' : '與目前對比'}
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-8 text-[10px] rounded-lg gap-1 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all font-bold"
                                      onClick={() => restoreVersion(editingFileId, version.id)}
                                    >
                                      <History className="w-3 h-3" />
                                      還原
                                    </Button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </ScrollArea>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Comparison UI */}
              <AnimatePresence>
                {comparingVersionId && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute inset-x-8 bottom-8 top-24 bg-white border border-slate-200 shadow-2xl rounded-2xl z-30 flex flex-col overflow-hidden"
                  >
                    <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">版本對比分析</h4>
                          <p className="text-[10px] text-slate-400">版本 #{comparingVersionId} ↔ 目前狀態</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-emerald-100 border border-emerald-300 rounded" />
                            <span className="text-emerald-700">新增內容</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-rose-100 border border-rose-300 rounded" />
                            <span className="text-rose-700">刪除內容</span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setComparingVersionId(null)}
                          className="rounded-full hover:bg-white hover:shadow-sm"
                        >
                          <X className="w-4 h-4 text-slate-400" />
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="flex-1 p-8 bg-white">
                       <div 
                         className="font-mono text-sm leading-relaxed whitespace-pre-wrap diff-content"
                         dangerouslySetInnerHTML={{ __html: diffHtml }}
                       />
                       <style>{`
                         .diff-content ins {
                           background: #dcfce7;
                           color: #166534;
                           text-decoration: none;
                           padding: 0 2px;
                           border-radius: 2px;
                         }
                         .diff-content del {
                           background: #fee2e2;
                           color: #991b1b;
                           text-decoration: line-through;
                           padding: 0 2px;
                           border-radius: 2px;
                         }
                       `}</style>
                    </ScrollArea>
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                      <Button 
                        className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl px-6 h-10 shadow-lg shadow-emerald-100"
                        onClick={() => {
                          restoreVersion(editingFileId, comparingVersionId);
                          setComparingVersionId(null);
                        }}
                      >
                        <History className="w-4 h-4 mr-2" />
                        立即還原至此版本
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Dialogs */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl p-8 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-900">
              <span className={cn(
                "p-2 rounded-xl",
                createType === 'folder' ? "bg-amber-50 text-amber-500" : "bg-blue-50 text-blue-500"
              )}>
                {createType === 'folder' ? <Folder className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
              </span>
              建立新{createType === 'folder' ? '資料夾' : '檔案'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            <div className="flex bg-slate-50 p-1 rounded-xl">
              <button 
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                  createType === 'file' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
                onClick={() => setCreateType('file')}
              >
                檔案
              </button>
              <button 
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                  createType === 'folder' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
                onClick={() => setCreateType('folder')}
              >
                資料夾
              </button>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">名稱</label>
              <Input 
                autoFocus
                placeholder={`輸入${createType}名稱...`} 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-12 bg-slate-50 border-slate-200 rounded-xl text-lg focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} className="rounded-lg px-6 transition-colors">取消</Button>
            <Button onClick={handleCreate} className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-8 transition-colors">建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameId} onOpenChange={() => setRenameId(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl p-8 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-900">
              <Edit3 className="w-6 h-6 text-blue-600" />
              重新命名
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">新名稱</label>
            <Input 
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-12 bg-slate-50 border-slate-200 rounded-xl text-lg focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRenameId(null)} className="rounded-lg px-6 transition-colors">取消</Button>
            <Button onClick={handleRename} className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-8 transition-colors">重新命名</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tagEditingId} onOpenChange={() => setTagEditingId(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl p-8 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-900">
              <Tag className="w-6 h-6 text-blue-600" />
              管理標籤
            </DialogTitle>
            <div className="text-sm text-slate-500 mt-1">為 "{nodes[tagEditingId || '']?.name}" 新增或移除標籤</div>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">新增標籤</label>
              <div className="flex gap-2">
                <Input 
                  autoFocus
                  placeholder="輸入標籤名稱 (例如: 重要, 專案A)..." 
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="h-11 bg-slate-50 border-slate-200 rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      const id = tagEditingId!;
                      const currentTags = nodes[id]?.tags || [];
                      if (!currentTags.includes(newTag.trim())) {
                        updateTags(id, [...currentTags, newTag.trim()]);
                      }
                      setNewTag('');
                    }
                  }}
                />
                <Button 
                  onClick={() => {
                    if (newTag.trim()) {
                      const id = tagEditingId!;
                      const currentTags = nodes[id]?.tags || [];
                      if (!currentTags.includes(newTag.trim())) {
                        updateTags(id, [...currentTags, newTag.trim()]);
                      }
                      setNewTag('');
                    }
                  }}
                  className="bg-slate-900 text-white rounded-xl px-4 h-11 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">現有標籤</label>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                {(!nodes[tagEditingId || '']?.tags || nodes[tagEditingId || '']?.tags?.length === 0) ? (
                  <span className="text-xs text-slate-400 italic py-1">尚無標籤</span>
                ) : (
                  nodes[tagEditingId || '']?.tags?.map(tag => (
                    <span 
                      key={tag} 
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-blue-600 text-xs font-bold rounded-lg shadow-sm hover:border-red-200 hover:text-red-500 transition-all cursor-pointer group"
                      onClick={() => {
                        const id = tagEditingId!;
                        const currentTags = nodes[id]?.tags || [];
                        updateTags(id, currentTags.filter(t => t !== tag));
                      }}
                    >
                      {tag}
                      <X className="w-3 h-3 text-slate-300 group-hover:text-red-400" />
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setTagEditingId(null)} className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-xl h-12 font-bold transition-colors shadow-lg shadow-blue-200">
              完成設定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white rounded-3xl shadow-[0_0_30px_oklch(0_0_0_/_0.8)] px-6 py-4 flex flex-col gap-4 z-50 border border-white/10 backdrop-blur-2xl"
          >
            <div className="flex items-center gap-3 w-full border-b border-white/5 pb-3">
              <span className="text-[11px] text-white/50 whitespace-nowrap font-mono flex items-center gap-1 tracking-wider uppercase"><Folder className="w-3 h-3 text-primary"/> 同步目標資料夾 :</span>
              <Input 
                value={cloudSettings.githubFolder || ''}
                onChange={(e) => saveCloudSettings({ ...cloudSettings, githubFolder: e.target.value })}
                placeholder="例如: src/components (留空則為專案根目錄)"
                className="h-8 flex-1 min-w-[300px] bg-white/5 border-white/10 text-white text-xs font-mono rounded-lg focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-white/20 transition-all"
              />
            </div>

            <div className="flex items-center gap-6 w-full justify-between">
              <div className="flex items-center gap-3 pr-6 border-r border-white/10">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-sm text-black drop-shadow-[0_0_8px_var(--color-primary)]">
                  {selectedIds.size}
                </div>
                <span className="text-xs font-mono text-white/50">項目已選</span>
              </div>

              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  className="hover:bg-white/5 text-white/60 hover:text-white gap-2 px-4 h-10 rounded-xl transition-all font-mono text-xs"
                  onClick={() => setBulkTagId('bulk')}
                >
                  <Tag className="w-4 h-4 text-primary" />
                  批次標籤
                </Button>
                <Button 
                  variant="ghost" 
                  className="hover:bg-primary/10 text-primary/80 hover:text-primary gap-2 px-4 h-10 rounded-xl transition-all font-mono text-xs"
                  onClick={() => handleBulkUploadProxy('gdrive')}
                  disabled={isSaving}
                >
                  <CloudUpload className="w-4 h-4" />
                  上傳 GDrive
                </Button>
                <Button 
                  variant="ghost" 
                  className="hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 gap-2 px-4 h-10 rounded-xl transition-all font-mono text-xs"
                  onClick={() => handleBulkUploadProxy('github')}
                  disabled={isSaving}
                >
                  <CloudUpload className="w-4 h-4" />
                  上傳 GitHub
                </Button>
                <Button 
                  variant="ghost" 
                  className="hover:bg-red-500/10 text-red-400 hover:text-red-300 gap-2 px-4 h-10 rounded-xl transition-all font-mono text-xs"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="w-4 h-4" />
                  批次刪除
                </Button>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                className="ml-2 hover:bg-white/10 text-white/30 hover:text-white rounded-full h-8 w-8 transition-colors"
                onClick={clearSelection}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Progress Overlay */}
      <AnimatePresence>
        {importProgress && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-80 bg-slate-900 text-white p-6 rounded-2xl shadow-2xl border border-slate-700 backdrop-blur-md bg-opacity-90"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center animate-pulse">
                <CloudUpload className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold">GitHub 匯入中</h4>
                <p className="text-[10px] text-slate-400 font-mono truncate">{importProgress.stage}</p>
              </div>
              <span className="text-xs font-bold text-blue-400">{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
            </div>
            
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <motion.div 
                className="bg-blue-500 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Sync Progress Overlay */}
      <AnimatePresence>
        {batchUploadProgress && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-80 bg-slate-900 text-white p-6 rounded-2xl shadow-2xl border border-slate-700 backdrop-blur-md bg-opacity-90"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center animate-pulse">
                <CloudUpload className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold">批次同步中</h4>
                <p className="text-[10px] text-slate-400 font-mono truncate">{batchUploadProgress.stage}</p>
              </div>
              <span className="text-xs font-bold text-emerald-400">{Math.round((batchUploadProgress.current / batchUploadProgress.total) * 100)}%</span>
            </div>
            
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <motion.div 
                className="bg-emerald-500 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${(batchUploadProgress.current / batchUploadProgress.total) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl p-8 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-900">
              <Keyboard className="w-6 h-6 text-blue-600" />
              鍵盤快速鍵說明
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-slate-400">一般操作</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">搜尋</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">/</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">清除/關閉</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Esc</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">批次刪除</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Del</kbd>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-slate-400">導覽與建立</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">回到上層</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Alt + ↑</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">建立檔案</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Alt + N</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">建立資料夾</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Alt+Shift+N</kbd>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <p className="text-[11px] text-blue-600 leading-relaxed text-center">
                <span className="font-bold">提示:</span> 快速鍵在輸入框焦點時會暫時停用（Esc 除外）。
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsHelpOpen(false)} className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-xl h-12 font-bold transition-colors shadow-lg shadow-blue-200">
              我知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bulkTagId} onOpenChange={() => { setBulkTagId(null); setNewTag(''); }}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl p-8 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-900">
              <Tag className="w-6 h-6 text-blue-600" />
              批次標籤管理
            </DialogTitle>
            <div className="text-sm text-slate-500 mt-1">為選取的 {selectedIds.size} 個項目新增統一標籤</div>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">新增標籤到所有選取項目</label>
              <div className="flex gap-2">
                <Input 
                  autoFocus
                  placeholder="輸入標籤名稱..." 
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="h-11 bg-slate-50 border-slate-200 rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      selectedIds.forEach(id => {
                        const currentTags = nodes[id]?.tags || [];
                        if (!currentTags.includes(newTag.trim())) {
                          updateTags(id, [...currentTags, newTag.trim()]);
                        }
                      });
                      setNewTag('');
                    }
                  }}
                />
                <Button 
                  onClick={() => {
                    if (newTag.trim()) {
                      selectedIds.forEach(id => {
                        const currentTags = nodes[id]?.tags || [];
                        if (!currentTags.includes(newTag.trim())) {
                          updateTags(id, [...currentTags, newTag.trim()]);
                        }
                      });
                      setNewTag('');
                    }
                  }}
                  className="bg-slate-900 text-white rounded-xl px-4 h-11 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => { setBulkTagId(null); setSelectedIds(new Set()); }} className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-xl h-12 font-bold transition-colors shadow-lg shadow-blue-200">
              完成並關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proxy Upload Result Dialog */}
      <Dialog open={!!uploadResultNode} onOpenChange={() => setUploadResultNode(null)}>
        <DialogContent className="sm:max-w-[550px] rounded-2xl border-none shadow-2xl p-8 bg-white overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-900">
              <CloudUpload className="w-6 h-6 text-emerald-500" />
              上傳至 {uploadResultNode?.uploadType === 'gdrive' ? 'Google Drive' : (uploadResultNode?.uploadType === 'github-sync' ? 'GitHub (繞過防火牆模式)' : 'GitHub')} 結果
            </DialogTitle>
            <div className="text-sm text-slate-500 mt-1">
              操作檔案：「{uploadResultNode?.node?.name}」
            </div>
          </DialogHeader>
          
          {uploadResultNode?.result && (
            <div className="py-2 space-y-4">
              <div className={cn("p-4 rounded-xl border flex gap-3 text-sm font-medium", uploadResultNode.result.success ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100")}>
                <div className="flex-1 break-all">
                  狀態：{uploadResultNode.result.success ? '成功' : '失敗'}<br/>
                  訊息：{uploadResultNode.result.message || uploadResultNode.result.error}
                </div>
              </div>

              {uploadResultNode.result.data && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">回傳內容詳細資訊</div>
                  <ScrollArea className="h-40 bg-slate-900 rounded-xl p-4">
                    <pre className="text-[10px] text-emerald-400 font-mono whitespace-pre-wrap">
                      {JSON.stringify(uploadResultNode.result.data, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button onClick={() => setUploadResultNode(null)} className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-xl h-10 transition-colors">
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Proxy Upload Results Dialog */}
      <Dialog open={!!batchUploadResults} onOpenChange={() => setBatchUploadResults(null)}>
        <DialogContent className="sm:max-w-[550px] rounded-2xl border-none shadow-2xl p-8 bg-white overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-900">
              <CloudUpload className="w-6 h-6 text-blue-600" />
              批次上傳至 {batchUploadResults?.type === 'gdrive' ? 'Google Drive' : 'GitHub'} 結果
            </DialogTitle>
            <div className="mt-4 flex gap-4">
              <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold border border-emerald-100">
                成功: {batchUploadResults?.success}
              </div>
              <div className="bg-rose-50 text-rose-700 px-4 py-2 rounded-lg text-sm font-bold border border-rose-100">
                失敗: {batchUploadResults?.failed}
              </div>
              <div className="bg-slate-50 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold border border-slate-100">
                總計: {batchUploadResults?.total}
              </div>
            </div>
          </DialogHeader>

          <div className="py-6">
            <label className="text-[10px] uppercase font-bold text-slate-400 ml-1 mb-2 block">詳細上傳清單</label>
            <ScrollArea className="h-64 border border-slate-100 rounded-xl bg-slate-50 p-4">
              <div className="space-y-2">
                {batchUploadResults?.details.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 text-xs shadow-sm">
                    <span className="font-medium text-slate-700 truncate max-w-[200px]">{item.name}</span>
                    <div className="flex items-center gap-2">
                      {item.success ? (
                        <span className="text-emerald-500 font-bold flex items-center gap-1">
                          <CheckSquare className="w-3 h-3" /> 成功
                        </span>
                      ) : (
                        <span className="text-rose-500 font-bold flex items-center gap-1" title={item.error}>
                          <X className="w-3 h-3" /> 失敗
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button onClick={() => setBatchUploadResults(null)} className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-xl h-12 font-bold transition-colors">
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog 
        open={isSettingsOpen} 
        onOpenChange={(open) => {
          setIsSettingsOpen(open);
          if (!open) setSettingsWarningMessage(null);
        }}
      >
        <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl p-0 bg-white overflow-hidden">
          <div className="p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-900">
                <Settings className="w-6 h-6 text-slate-500" />
                雲端同步設定
              </DialogTitle>
            </DialogHeader>

            {settingsWarningMessage && (
              <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex gap-3 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                <Info className="w-5 h-5 text-amber-500 shrink-0" />
                <span>{settingsWarningMessage}</span>
              </div>
            )}

            <Tabs defaultValue="github" className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="github">GitHub</TabsTrigger>
                <TabsTrigger value="gdrive">Google Drive</TabsTrigger>
              </TabsList>

              <TabsContent value="github" className="mt-6 space-y-6">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-blue-900">需要 GitHub Personal Access Token (classic)</h5>
                    <p className="text-[10px] text-blue-700 leading-relaxed">
                      請前往 <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline font-bold inline-flex items-center gap-0.5">GitHub 設定 <ExternalLink className="w-2 h-2" /></a> 產生 Token。
                      必須勾選 <code className="bg-blue-100 px-1 rounded font-mono">repo</code> 權限範圍，系統才能讀寫您的儲存庫。
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> GitHub 存取權杖 (PAT)
                      </label>
                    </div>
                    <Input 
                      type="password" 
                      placeholder="ghp_xxxxxxxxxxxx" 
                      value={cloudSettings.githubToken}
                      onChange={e => saveCloudSettings({ ...cloudSettings, githubToken: e.target.value })}
                      className="rounded-xl border-slate-200 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">儲存庫擁有者 (Owner)</label>
                      <Input 
                        placeholder="例如: yuanyouxie52" 
                        value={cloudSettings.githubOwner}
                        onChange={e => saveCloudSettings({ ...cloudSettings, githubOwner: e.target.value })}
                        className="rounded-xl"
                      />
                      <p className="text-[9px] text-slate-400">您的 GitHub 帳號或組織名稱</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">儲存庫名稱 (Repo)</label>
                      <Input 
                        placeholder="例如: file-nexus" 
                        value={cloudSettings.githubRepo}
                        onChange={e => saveCloudSettings({ ...cloudSettings, githubRepo: e.target.value })}
                        className="rounded-xl"
                      />
                      <p className="text-[9px] text-slate-400">要同步到的 Repository 專案名</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">上傳資料夾 (預設根目錄)</label>
                    <Input 
                      placeholder="例如: documents/backup" 
                      value={cloudSettings.githubFolder}
                      onChange={e => saveCloudSettings({ ...cloudSettings, githubFolder: e.target.value })}
                      className="rounded-xl"
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <p className="text-[10px] text-slate-400 font-mono">
                        路徑: {cloudSettings.githubRepo}/<span className="text-blue-500 font-bold">{cloudSettings.githubFolder || '(root)'}</span>/filename
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="gdrive" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Service Account JSON (服務帳戶金鑰)</label>
                  <textarea 
                    className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none transition-all"
                    placeholder={`{\n  "type": "service_account",\n  "project_id": "...",\n  ... \n}`}
                    value={cloudSettings.gdriveJson}
                    onChange={e => saveCloudSettings({ ...cloudSettings, gdriveJson: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-400">請將 GCP 產生的 Service Account JSON 全文貼上。這些資訊將保存在您的本機瀏覽器 localStorage 中，不會回傳給第三方伺服器 (上傳時直接傳給您的自建 Vercel 後台)。</p>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-8">
              <Button onClick={() => setIsSettingsOpen(false)} className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-xl h-10 transition-colors">
                完成並關閉
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isImportGithubDialogOpen} onOpenChange={setIsImportGithubDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl p-0 bg-white overflow-hidden">
          <div className="p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-900">
                <CloudUpload className="w-6 h-6 text-blue-600" />
                匯入 GitHub 專案
              </DialogTitle>
            </DialogHeader>

            <div className="mt-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    將指定的 GitHub 專案直接拉取到 FileManager 中。這會自動為您同步所有原始碼。
                    若是私人專案，請確保您已配置正確的 Token。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">擁有者 (Owner)</label>
                  <Input 
                    placeholder="如: yuanyouxie52" 
                    value={cloudSettings.githubOwner}
                    onChange={e => saveCloudSettings({ ...cloudSettings, githubOwner: e.target.value })}
                    className="rounded-xl border-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">專案名 (Repo)</label>
                  <Input 
                    placeholder="如: file-nexus" 
                    value={cloudSettings.githubRepo}
                    onChange={e => saveCloudSettings({ ...cloudSettings, githubRepo: e.target.value })}
                    className="rounded-xl border-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">存取權杖 (Token, 私人必填)</label>
                <Input 
                  type="password" 
                  placeholder="ghp_xxxxxxxxxxxx" 
                  value={cloudSettings.githubToken}
                  onChange={e => saveCloudSettings({ ...cloudSettings, githubToken: e.target.value })}
                  className="rounded-xl border-slate-300"
                />
              </div>
            </div>

            <DialogFooter className="mt-8 gap-2 border-none">
              <Button onClick={() => setIsImportGithubDialogOpen(false)} variant="ghost" className="w-full text-slate-600 rounded-xl h-10 transition-colors">
                取消
              </Button>
              <Button onClick={executeGithubImport} className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-xl h-10 transition-colors shadow-lg shadow-blue-200" disabled={isImporting}>
                確定匯入
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
