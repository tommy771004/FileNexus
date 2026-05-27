import React, { useState } from 'react';
import { useTaskQueue, Task } from '../contexts/TaskQueueContext';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  X,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

export const TaskQueueOverlay: React.FC = () => {
  const { tasks, removeTask, clearCompleted } = useTaskQueue();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'queued');
  const hasTasks = tasks.length > 0;

  if (!hasTasks) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-80 max-h-[400px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col pointer-events-auto"
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" />
                任務管理佇列 ({tasks.length})
              </span>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-slate-400 hover:text-rose-500"
                  onClick={clearCompleted}
                  title="清除已完成"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-slate-400"
                  onClick={() => setIsExpanded(false)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {tasks.map(task => (
                <TaskItem key={task.id} task={task} onRemove={() => removeTask(task.id)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        layout
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "h-12 px-4 rounded-full shadow-lg border flex items-center gap-3 transition-all pointer-events-auto",
          activeTasks.length > 0 
            ? "bg-blue-600 border-blue-500 text-white animate-pulse" 
            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
        )}
      >
        {activeTasks.length > 0 ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Layers className="w-5 h-5" />
        )}
        <span className="font-medium text-sm">
          {activeTasks.length > 0 
            ? `正在處理 ${activeTasks.length} 個任務...` 
            : `任務佇列 (${tasks.length})`}
        </span>
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </motion.button>
    </div>
  );
};

const TaskItem: React.FC<{ task: Task; onRemove: () => void }> = ({ task, onRemove }) => {
  const getIcon = () => {
    switch (task.status) {
      case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-rose-500" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className={cn(
      "p-3 rounded-xl border transition-all",
      task.status === 'failed' ? "bg-rose-50 border-rose-100" : "bg-white border-slate-100 hover:border-slate-200"
    )}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="shrink-0">{getIcon()}</div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-slate-900 truncate">{task.name}</span>
            <span className="text-[10px] text-slate-500 truncate">{task.stage}</span>
          </div>
        </div>
        {(task.status === 'completed' || task.status === 'failed') && (
          <button onClick={onRemove} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {(task.status === 'running' || task.status === 'queued') && (
        <div className="space-y-1.5">
          <Progress value={task.progress} className="h-1 bg-slate-100" />
          <div className="flex justify-between items-center text-[10px] text-slate-400 tabular-nums">
            <span>{Math.round(task.progress)}%</span>
            <span>{task.type.toUpperCase()}</span>
          </div>
        </div>
      )}

      {task.error && (
        <p className="text-[10px] text-rose-600 mt-1 line-clamp-2 leading-relaxed">
          {task.error}
        </p>
      )}
    </div>
  );
};
