import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Task {
  id: string;
  name: string;
  type: 'upload' | 'sync' | 'import' | 'delete';
  status: TaskStatus;
  progress: number; // 0-100
  stage: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

interface TaskQueueContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'status' | 'progress' | 'stage' | 'createdAt'>) => string;
  updateTask: (id: string, updates: Partial<Pick<Task, 'status' | 'progress' | 'stage' | 'error'>>) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
}

const TaskQueueContext = createContext<TaskQueueContextType | undefined>(undefined);

export const useTaskQueue = () => {
  const context = useContext(TaskQueueContext);
  if (!context) {
    throw new Error('useTaskQueue must be used within a TaskQueueProvider');
  }
  return context;
};

export const TaskQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Use a ref to keep track of tasks for callbacks to avoid re-renders or stale closures during task execution
  const tasksRef = useRef<Task[]>([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'status' | 'progress' | 'stage' | 'createdAt'>) => {
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newTask: Task = {
      ...taskData,
      id,
      status: 'queued',
      progress: 0,
      stage: '已加入隊列',
      createdAt: Date.now()
    };
    setTasks(prev => [newTask, ...prev]);
    return id;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Pick<Task, 'status' | 'progress' | 'stage' | 'error'>>) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const completedAt = updates.status === 'completed' || updates.status === 'failed' ? Date.now() : t.completedAt;
        return { ...t, ...updates, completedAt };
      }
      return t;
    }));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'failed'));
  }, []);

  return (
    <TaskQueueContext.Provider value={{ tasks, addTask, updateTask, removeTask, clearCompleted }}>
      {children}
    </TaskQueueContext.Provider>
  );
};
