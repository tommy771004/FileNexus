/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { FSNode, FileSystemState } from '../types';

const STORAGE_KEY = 'filenexus_fs_v1';

const INITIAL_NODES: Record<string, FSNode> = {
  'root': {
    id: 'root',
    name: 'Home',
    type: 'folder',
    parentId: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  'docs': {
    id: 'docs',
    name: 'Documents',
    type: 'folder',
    parentId: 'root',
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  'readme': {
    id: 'readme',
    name: 'README.txt',
    type: 'file',
    parentId: 'root',
    content: 'Welcome to FileNexus! Your high-performance file management system.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    size: 68
  }
};

export function useFileSystem() {
  const [nodes, setNodes] = useState<Record<string, FSNode>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse FS storage', e);
      }
    }
    return INITIAL_NODES;
  });

  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [path, setPath] = useState<string[]>(['root']);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
  }, [nodes]);

  const navigateTo = (nodeId: string) => {
    const node = nodes[nodeId];
    if (node && node.type === 'folder') {
      setCurrentFolderId(nodeId);
      
      // Rebuild path
      const newPath = [];
      let current: FSNode | null = node;
      while (current) {
        newPath.unshift(current.id);
        current = current.parentId ? nodes[current.parentId] : null;
      }
      setPath(newPath);
    }
  };

  const createNode = (name: string, type: 'file' | 'folder', content = '') => {
    const id = Math.random().toString(36).substring(2, 9);
    const newNode: FSNode = {
      id,
      name,
      type,
      parentId: currentFolderId,
      content: type === 'file' ? content : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      size: type === 'file' ? content.length : 0
    };

    setNodes(prev => ({ ...prev, [id]: newNode }));
    return id;
  };

  const deleteNode = (id: string) => {
    if (id === 'root') return;
    setNodes(prev => {
      const next = { ...prev };
      delete next[id];
      // Recursive delete children (simple version)
      Object.keys(next).forEach(k => {
        if (next[k].parentId === id) {
          delete next[k];
        }
      });
      return next;
    });
  };

  const updateFileContent = (id: string, content: string) => {
    setNodes(prev => {
      const node = prev[id];
      if (!node || node.content === content) return prev;

      return {
        ...prev,
        [id]: {
          ...node,
          content,
          updatedAt: Date.now(),
          size: content.length
        }
      };
    });
  };

  const saveVersion = (id: string, label?: string) => {
    setNodes(prev => {
      const node = prev[id];
      if (!node) return prev;

      const newVersion = {
        id: Math.random().toString(36).substring(2, 9),
        content: node.content || '',
        timestamp: Date.now(),
        label: label || '手動儲存'
      };

      const updatedVersions = [newVersion, ...(node.versions || [])].slice(0, 20); // Keep last 20 versions

      return {
        ...prev,
        [id]: {
          ...node,
          versions: updatedVersions
        }
      };
    });
  };

  const restoreVersion = (nodeId: string, versionId: string) => {
    setNodes(prev => {
      const node = prev[nodeId];
      if (!node || !node.versions) return prev;

      const version = node.versions.find(v => v.id === versionId);
      if (!version) return prev;

      // When restoring, we move the CURRENT version to history and set the selected version as current
      const currentToHistory = {
        id: Math.random().toString(36).substring(2, 9),
        content: node.content || '',
        timestamp: node.updatedAt
      };

      const remainingVersions = node.versions.filter(v => v.id !== versionId);
      const updatedVersions = [currentToHistory, ...remainingVersions].slice(0, 10);

      return {
        ...prev,
        [nodeId]: {
          ...node,
          content: version.content,
          updatedAt: Date.now(),
          size: version.content.length,
          versions: updatedVersions
        }
      };
    });
  };

  const moveNode = (id: string, newParentId: string | null) => {
    if (id === newParentId) return;
    setNodes(prev => {
      const node = prev[id];
      if (!node) return prev;
      
      // Prevent circular moves
      let curr = newParentId ? prev[newParentId] : null;
      while (curr) {
        if (curr.id === id) return prev;
        curr = curr.parentId ? prev[curr.parentId] : null;
      }

      return {
        ...prev,
        [id]: {
          ...node,
          parentId: newParentId,
          updatedAt: Date.now()
        }
      };
    });
  };

  const reorderNodes = (parentId: string, activeId: string, overId: string) => {
    setNodes(prev => {
      const siblings = (Object.values(prev) as FSNode[])
        .filter(n => n.parentId === parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
      
      const oldIndex = siblings.findIndex(n => n.id === activeId);
      const newIndex = siblings.findIndex(n => n.id === overId);
      
      if (oldIndex === -1 || newIndex === -1) return prev;

      const nextSiblings = [...siblings];
      const [movedItem] = nextSiblings.splice(oldIndex, 1);
      nextSiblings.splice(newIndex, 0, movedItem);

      const next = { ...prev };
      nextSiblings.forEach((node, index) => {
        next[node.id] = { ...node, order: index };
      });
      
      return next;
    });
  };

  const renameNode = (id: string, newName: string) => {
    setNodes(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        name: newName,
        updatedAt: Date.now()
      }
    }));
  };

  const updateTags = (id: string, tags: string[]) => {
    setNodes(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        tags,
        updatedAt: Date.now()
      }
    }));
  };

  const getChildren = (parentId: string): FSNode[] => {
    return (Object.values(nodes) as FSNode[])
      .filter(node => node.parentId === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
  };

  const importNodesMap = (newNodes: Record<string, FSNode>) => {
    setNodes(prev => ({ ...prev, ...newNodes }));
  };

  return {
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
    currentFolder: nodes[currentFolderId]
  };
}
