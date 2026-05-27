/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeType = 'file' | 'folder';

export interface FileVersion {
  id: string;
  content: string;
  timestamp: number;
  label?: string;
}

export interface FSNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  content?: string;
  createdAt: number;
  updatedAt: number;
  size?: number;
  order?: number;
  tags?: string[];
  versions?: FileVersion[];
}

export interface FileSystemState {
  nodes: Record<string, FSNode>;
  currentPath: string[]; // stack of folder IDs
}
