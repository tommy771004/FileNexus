# FileNexus UI Design Specification (Apple HIG)

## 1. Context & Persona

*   **App Type:** macOS / iPadOS Desktop-Class Application (FileNexus)
*   **Persona:** "Alex" (Software Engineer / Tech Writer). 
*   **Goals:** Quickly sync local directories to remote GitHub repositories without wrestling with the terminal. Needs high visibility of diffs.
*   **Pain Points:** Terminal is too opaque for visual file diffs. Existing Git GUIs are overly complex for simple "upload and override" tasks.

## 2. Apple HIG Foundations

### 2.1 Hierarchy & Layout Patterns
We utilize a **Sidebar & Split View** layout natively supported in macOS and iPadOS.
*   **Primary Column (Sidebar):** Repository selection, Recent Syncs, Global Settings. Uses a translucent material (`NSVisualEffectView` under macOS).
*   **Secondary Column (Source List):** The local directory tree versus the remote repository tree.
*   **Detail Column (Canvas):** The actual file diff (Code Snippet) and the batch commit interface.

### 2.2 Navigation & Navigation Bars
*   **macOS Toolbar:** Integrated title bar with global search, sync status icon, and global actions (Settings, User Profile).
*   **Gestures:** Two-finger swipe left/right to navigate back/forward in folder hierarchy. Pinch to zoom on image diffs. Drag-and-drop from Finder directly into the Detail Column to initiate a batch sync.

## 3. Core Screens (Wireframes & Interactions)

### Screen 1: The Empty State (Onboarding)
*   **Layout:** Centered content in the Detail Column.
*   **Visual:** SF Symbol (`folder. badge.plus`) highly enlarged with a soft gradient fill.
*   **Text:** "Drag a folder here to begin syncing."
*   **Interaction:** Drop target highlights with a blue translucent overlay when a file is dragged over the window.

### Screen 2: Sidebar (Repository Selection)
*   **Layout:** Left-most column.
*   **Visual:** List of saved GitHub Repositories. Each cell contains the repository icon (SF Symbol `curlybraces.square`), name, and branch badge.
*   **Interaction:** Selection highlights cell in standard Apple Accent Color. Reorderable via drag-and-drop.

### Screen 3: Local vs. Remote Workspace (Tree View)
*   **Layout:** Secondary Column showing a grouped list type.
*   **Visual:** File tree using standard SF Symbols for file types (e.g., `doc.text`, `photo`, `swift`). Status badges (New: Green Dot, Modified: Orange Dot, Deleted: Red Dot).
*   **Gestures:** Right-click (Control-click) to reveal context menu ("Ignore File", "Revert to Remote").

### Screen 4: Diff Viewer (Detail Canvas)
*   **Layout:** Split vertically or inline within the Detail Column.
*   **Visual:** Code blocks using `JetBrains Mono` or native `SF Mono`. Highlighting additions in light green and subtractions in light red.
*   **Component:** Segmented Control at the top: inline vs. side-by-side diff.

### Screen 5: Batch Commit Interface (Sheet)
*   **Layout:** A macOS/iPadOS modal Sheet dropping down from the top.
*   **Visual:** A large text area for the Commit Message, a summary list of changed files, and a primary "Commit & Sync" button.
*   **Interaction:** Pressing `Cmd + Enter` instantly triggers the sync button.

### Screen 6: Active Sync Progress (HUD / Loading State)
*   **Layout:** Centered HUD overlay or prominent Progress Bar in the Toolbar.
*   **Visual:** Determinate progress bar. If hashing, an indeterminate spinner.
*   **Text:** "Syncing 42 files to origin/main..."

### Screen 7: Error State (Conflict Resolution)
*   **Layout:** Alert dialog or inline banner inside the Detail Column.
*   **Visual:** Red tint banner with a warning icon (`exclamationmark.triangle.fill`).
*   **Text:** "Remote contains newer changes. Pull required."
*   **Action:** Primary button "Review Remote", Secondary button "Force Push (Destructive)".

### Screen 8: Settings (Preferences)
*   **Layout:** Standard macOS Settings window (Tabbed layout: General, Accounts, Ignore Rules).
*   **Visual:** Form groups using `Form` and `Section` (SwiftUI).
*   **Interaction:** Automatic save on toggle. Secure text field for GitHub Personal Access Tokens.

## 4. UI Components

### 4.1 Buttons & Controls
*   **Primary Action Button:** Prominent, rounded rectangle (8px-12px radius, or native Apple capsule). Uses the system accent color (`#007AFF`).
*   **Secondary Actions:** Borderless tinted buttons or gray filled capsule buttons.
*   **Segmented Controls:** Used exclusively for alternating views of the same data (e.g., "Code View" / "Preview").

### 4.2 Data Visualization
*   **Progress Rings:** Circular progress indicators for overall repository sync health.
*   **Diff Graphs:** Mini sparklines showing commit frequency or file alteration volume over the last 30 days.

### 4.3 Forms
*   Clean, grouped list styles (like iOS Settings). Inputs have no explicit borders until hovered or focused, relying on background contrast (`#F2F2F7` on macOS light mode).

## 5. Accessibility

*   **Dynamic Type:** All text strictly uses Apple's Human Interface Guidelines text styles (e.g., `.headline`, `.body`, `.callout`). No hardcoded font sizes.
*   **VoiceOver:** 
    *   File tree elements combine file name and status for VoiceOver: "App.tsx, Modified".
    *   Diff viewer lines announce "Added" or "Removed" before reading the code line.
*   **Contrast:** Support for "Increase Contrast" system accessibility setting, switching subtle grays to solid black/white boundaries.
*   **Motion:** Support for "Reduce Motion" by switching sheet sliding animations to simple cross-dissolves.

## 6. Micro-Interactions

*   **Diff Transition:** Smoothly expanding code blocks. When clicking a file in the tree, the previous diff slightly scales down and fades out, while the new diff scales up and fades in (spring animation).
*   **Sync Completion:** A subtle haptic feedback (on supported trackpads/devices) accompanied by the file badges turning into green checkmarks with a quick pop animation.

## 7. Designer's Notes
> "The goal of FileNexus on Apple platforms is to feel like an extension of Finder. We deliberately chose not to rebuild complex Git graphs. By focusing deeply on the immediate bridge between the Local Directory and the Remote Tree, we eliminate cognitive load. Relying heavily on SF Symbols and native macOS visual effects (Vibrancy) ensures developers immediately trust the tool as a first-class citizen of their operating system." - *Principal UI Designer*
