# FileNexus: Production Frontend Implementation Guide

**From:** Vercel Design Engineering Team  
**Tech Stack:** React 18+, TypeScript, Tailwind CSS, Framer Motion, Radix UI (Primitives)  
**Date:** May 27, 2026  

## 1. Executive Summary
As Design Engineers, bridging the gap between Figma and the DOM is our core mandate. We don’t just implement design; we build resilient, accessible, and highly performant interfaces. This document translates the Apple HIG and Web Content Accessibility Guidelines (WCAG) into production-ready React code for FileNexus. We utilize Tailwind CSS for robust styling, Framer Motion for layout transitions, and Radix UI primitives to guarantee accessibility (a11y) out of the box.

---

## 2. Component Hierarchy & Data Flow

### 2.1 Architecture
To manage re-renders efficiently, we split the application into a smart container (Client Component) and dumb presentational components.

```text
<BatchSyncLayout> (Layout Shell)
 ├── <Sidebar> (Repositories)
 │    └── <RepoListItem> (Active state, branch badge)
 ├── <SourceTree> (Virtualized Local/Remote directories)
 │    ├── <TreeDropZone> (Handles drag & drop events)
 │    └── <FileTreeItem> (Recursive component, expands/collapses)
 └── <DetailCanvas> (Dynamic content area)
      ├── <EmptyState> (Drop target)
      ├── <DiffViewer> (Side-by-side or inline)
      │    └── <CodeLine> (Individual diff line with +/-, ins/del)
      └── <CommitSheet> (Framer Motion overlay)
```

### 2.2 State & Data Flow
*   **Global State:** Use a lightweight store (e.g., Zustand) to manage the Git configuration (Current Repo, Branch, GitHub Token) to avoid prop-drilling across the split panes.
*   **Local State:** Tree expansion (`expandedFolders`) and selected file (`activeFile`) naturally sit within `<SourceTree>` and are passed down.
*   **Performance Note:** The file parsing tree maps (`Map<string, string>`) should be memoized using `useMemo` to prevent massive reconciliation tasks during every keystroke in the commit message box.

---

## 3. Production-Ready Components (Copy-Paste Code)

Below is the implementation for the core `FileTreeItem` addressing the HIG styling and WCAG accessibility audits.

### 3.1 `FileTreeItem.tsx`

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRightIcon, DocumentIcon } from '@heroicons/react/24/outline'; // Or Lucide
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileTreeItemProps {
  nodeId: string;
  name: string;
  depth: number;
  type: 'file' | 'folder';
  status: 'synced' | 'added' | 'modified' | 'deleted';
  isExpanded?: boolean;
  isSelected?: boolean;
  onToggle?: (id: string, e: React.MouseEvent | React.KeyboardEvent) => void;
  onSelect?: (id: string) => void;
  children?: React.ReactNode;
}

export const FileTreeItem = ({
  nodeId,
  name,
  depth,
  type,
  status,
  isExpanded = false,
  isSelected = false,
  onToggle,
  onSelect,
  children
}: FileTreeItemProps) => {
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (type === 'folder' && onToggle) onToggle(nodeId, e);
      if (type === 'file' && onSelect) onSelect(nodeId);
    }
  };

  return (
    <div className="flex flex-col w-full" role="treeitem" aria-expanded={type === 'folder' ? isExpanded : undefined} aria-selected={isSelected}>
      <div
        tabIndex={0}
        onClick={(e) => type === 'folder' ? onToggle?.(nodeId, e) : onSelect?.(nodeId)}
        onKeyDown={handleKeyDown}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        className={cn(
          "group flex items-center min-h-[36px] py-1.5 pr-3 cursor-pointer outline-none transition-colors rounded-md mx-2",
          "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:bg-blue-50/50 dark:focus-visible:bg-blue-900/20",
          isSelected ? "bg-blue-100/50 dark:bg-blue-500/20" : "hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        {/* Expand/Collapse Icon */}
        <div className="w-5 flex items-center justify-center shrink-0">
          {type === 'folder' && (
            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15, ease: "easeOut" }}>
              <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            </motion.div>
          )}
        </div>

        {/* File Icon */}
        <DocumentIcon className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-2 shrink-0" aria-hidden="true" />
        
        {/* File Name */}
        <span className={cn(
          "text-[14px] truncate flex-1",
          isSelected ? "text-blue-900 dark:text-blue-100 font-medium" : "text-slate-700 dark:text-slate-200"
        )}>
          {name}
        </span>

        {/* Status Badge (Accessible) */}
        {status !== 'synced' && (
          <div className="flex items-center space-x-1.5 ml-2 shrink-0">
            <span className="sr-only">Status: {status}</span>
            <div className={cn(
              "w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900",
              status === 'added' ? "bg-green-500" :
              status === 'modified' ? "bg-amber-500" :
              status === 'deleted' ? "bg-red-500" : ""
            )} />
          </div>
        )}
      </div>

      {/* Children Animation */}
      <AnimatePresence initial={false}>
        {type === 'folder' && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
            className="overflow-hidden"
            role="group"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

---

## 4. Accessibility & Styling Specifications

### 4.1 ARIA & Keyboard Navigation
*   **Tree Navigation:** Use `role="tree"`, `role="treeitem"`, and `role="group"`. 
*   **Diff Viewer Semantics:** Instead of relying just on `bg-red-100` and `bg-green-100`, use `<del>` for removed text and `<ins>` for added text. Add `aria-label="Line added"` for screen readers.
*   **Focus Rings:** Always apply `focus-visible:ring-2 focus-visible:ring-blue-500`. We *only* use `focus-visible` so that mouse users don't see ugly rings, but keyboard users are fully accommodated.

### 4.2 Tailwind Theming (Design Tokens)
Add these extensions to `tailwind.config.js` to map to the Figma Design Tokens:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        hyper: {
          500: '#0055FF', // Primary action
          600: '#0047D6', // Hover
        },
        slate: {
          950: '#0F172A', // App background dark mode
        }
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Text', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'SF Mono', 'ui-monospace'],
      }
    }
  }
}
```

---

## 5. Animations & Micro-Interactions

We use `framer-motion` for spring-based physics, replicating native Apple interactions.
*   **Commit Sheet (Sheet UI):** Use `y: "100%"` to `y: 0` with a spring configuration `{ type: "spring", stiffness: 300, damping: 30 }`. 
*   **Hover States:** Button hovers use Tailwind's `transition-colors duration-150 ease-out`.

---

## 6. Performance Tips & Asset Optimization

1.  **Stop Tree Re-renders:** A file tree with 1,000 nodes will block the main thread if implemented naively. Use `@tanstack/react-virtual` to virtualize the `SourceTree` and `DiffViewer` lines.
2.  **Memoization:** Wrap the recursive Tree rendering in `React.memo` with a custom comparison function focusing only on `expanded` and `status` properties, ignoring deep object checks if immutability is maintained.
3.  **Client-Side Diffing:** Text diffing blocks the browser thread. Move the diff/hash computations (`computeGitSha`) into a **Web Worker** so the UI (like loading spinners) doesn't freeze.
4.  **Icons:** Do not import the entire heroicons/lucide library. Ensure tree-shaking is active or import explicitly (`import Icon from 'lucide-react/dist/esm/icons/icon-name'`).

---

## 7. Testing Strategy

1.  **Component Tests (Vitest + RTL):** 
    *   Test `FileTreeItem` keyboard navigation (Space/Enter).
    *   Test ARIA attributes toggle correctly on interaction.
2.  **Functionality Tests:** 
    *   Unit test the clean path helper routines.
    *   Test the Web Worker hash computation against known Git SHA assertions.
3.  **E2E (Playwright):** 
    *   Simulate file drop -> Mock GitHub API tree fetch -> Verify Modals open -> Verify Commit API payload.
