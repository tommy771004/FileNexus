import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, FileCode2, FileJson, FileText, Image, Music, Video, Archive, Database, File } from 'lucide-react';
import { cn } from '../lib/utils';

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

interface FileTreeItemProps {
  nodeId: string;
  name: string;
  depth: number;
  type: 'file' | 'folder';
  status: 'synced' | 'added' | 'modified' | 'deleted' | 'unknown' | 'new';
  isExpanded?: boolean;
  isSelected?: boolean;
  onToggle?: (id: string, e: React.MouseEvent | React.KeyboardEvent) => void;
  onSelect?: (id: string) => void;
  children?: React.ReactNode;
}

export const FileTreeItem = React.forwardRef<HTMLDivElement, FileTreeItemProps & React.HTMLAttributes<HTMLDivElement>>(({
  nodeId,
  name,
  depth,
  type,
  status,
  isExpanded = false,
  isSelected = false,
  onToggle,
  onSelect,
  children,
  className,
  ...props
}, ref) => {
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (type === 'folder' && onToggle) onToggle(nodeId, e as any);
      if (type === 'file' && onSelect) onSelect(nodeId);
    }
  };

  return (
    <div
      ref={ref}
      role="treeitem" 
      aria-expanded={type === 'folder' ? isExpanded : undefined} 
      aria-selected={isSelected}
      tabIndex={0}
      onClick={(e) => type === 'folder' ? onToggle?.(nodeId, e) : onSelect?.(nodeId)}
      onKeyDown={handleKeyDown}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      className={cn(
        "group flex items-center min-h-[32px] py-1 pr-3 cursor-pointer outline-none transition-colors rounded-md mx-2",
        "focus-visible:ring-2 focus-visible:ring-hyper-500 focus-visible:bg-blue-50/50 dark:focus-visible:bg-blue-900/20",
        isSelected ? "bg-hyper-500 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
        className
      )}
      {...props}
    >
      {/* Expand/Collapse Icon */}
      <div className="w-5 flex items-center justify-center shrink-0">
        {type === 'folder' && (
          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
            <ChevronRight className={cn("w-3.5 h-3.5", isSelected ? "text-white" : "text-slate-400 dark:text-slate-500")} />
          </div>
        )}
      </div>

      {/* File Icon */}
      {type === 'folder' ? (
        <FileIcon fileName={name} className={cn("w-4 h-4 mr-2 shrink-0 opacity-80", isSelected ? "text-white" : "text-slate-500")} /> 
      ) : (
        <FileIcon fileName={name} className={cn("w-4 h-4 mr-2 shrink-0", isSelected ? "text-white" : "text-slate-500")} />
      )}
      
      {/* File Name */}
      <span className={cn(
        "text-[13px] truncate flex-1 leading-tight",
        isSelected ? "font-medium text-white" : "font-medium"
      )}>
        {name}
      </span>

      {/* Status Badge (Accessible) */}
      {status !== 'synced' && status !== 'unknown' && (
        <div className="flex items-center space-x-1.5 ml-2 shrink-0">
          <span className="sr-only">Status: {status}</span>
          <div className={cn(
            "w-2 h-2 rounded-full",
            isSelected ? "ring-2 ring-hyper-600" : "ring-2 ring-white dark:ring-slate-900",
            status === 'added' || status === 'new' ? "bg-diff-green" :
            status === 'modified' ? "bg-warning-amber" :
            status === 'deleted' ? "bg-diff-red" : ""
          )} />
        </div>
      )}
    </div>
  );
});
