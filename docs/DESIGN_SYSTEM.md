# FileNexus Design System

## 1. Principles
As the core design system for FileNexus, we prioritize clarity, deference, and depth—the hallmarks of exceptional interactive design. The interface should seamlessly recede, allowing user content (files, repositories, synchronization states) to become the focal point.

*   **Clarity:** Text must be legible at every size. Icons should be precise and universally understood. Embellishments are removed if they do not serve a purpose.
*   **Deference:** Fluid motion and an unobtrusive interface help people understand and interact with content without competing with it.
*   **Depth:** Visual layers and realistic motion impart vitality and heighten delight and understanding.

---

## 2. Foundations

### 2.1 Color System
The color palette uses semantic designations natively adapting to Light and Dark modes.

*   **Primary (Action):** `#007AFF` (Light) / `#0A84FF` (Dark) - Used for primary buttons, active states, and links.
*   **Success:** `#34C759` (Light) / `#30D158` (Dark) - Synchronized states, successful uploads.
*   **Warning:** `#FF9500` (Light) / `#FF9F0A` (Dark) - Modified local files.
*   **Destructive:** `#FF3B30` (Light) / `#FF453A` (Dark) - Deletions, critical errors.

**Backgrounds & Surfaces:**
*   **Background (Primary):** `#FFFFFF` / `#000000`
*   **Secondary (Grouped Cards):** `#F2F2F7` / `#1C1C1E`
*   **Tertiary (Hover states):** `#E5E5EA` / `#2C2C2E`

### 2.2 Typography (San Francisco / Inter)
We use a responsive 9-level typographic scale with dynamic leading (line-height).

1.  **Large Title:** 34px, Bold, -0.4px tracking
2.  **Title 1:** 28px, Bold, 0.36px tracking
3.  **Title 2:** 22px, Regular, 0.35px tracking
4.  **Title 3:** 20px, Regular, 0.38px tracking
5.  **Headline:** 17px, Semi-Bold, -0.41px tracking (Primary bold text)
6.  **Body:** 17px, Regular, -0.41px tracking (General reading text)
7.  **Callout:** 16px, Regular, -0.32px tracking
8.  **Subhead:** 15px, Regular, -0.24px tracking
9.  **Footnote:** 13px, Regular, -0.08px tracking

### 2.3 Grid & Spacing
*   **Spacing Scale (8px base):** 4px (micro), 8px (tight), 16px (standard/margins), 24px (loose), 32px (section), 48px, 64px.
*   **Grid System:** 12-column responsive layout. Max-width of 1200px for desktop viewing.
    *   **Gutter:** 16px (Mobile), 24px (Tablet+).

---

## 3. Components Library

Below is the specification matrix for 30+ UI components defining the FileNexus ecosystem.

### Layout & Composition
1.  **AppHeader:** Global navigation, branding, and global actions.
2.  **Sidebar:** Tree view navigation for repositories and local directories.
3.  **SplitView:** Resizable pane acting as master-detail layout.
4.  **Card:** Elevated surface with 12px rounded corners and subtle shadow.
5.  **Divider:** 1px hairline separator (`#E5E5EA`).
6.  **Modal:** Focus-trapping dialogue for confirmations.
7.  **Popover:** Contextual floating panel for settings menus.

### Actions & Inputs
8.  **Button (Primary):** Solid background, pill-radius. 44px min touch target.
9.  **Button (Secondary):** Tinted background (15% opacity), pill-radius.
10. **Button (Icon):** Transparent background, 44x44px target.
11. **TextField:** 12px radius, light gray background (`#F2F2F7`).
12. **SearchField:** Pill radius with leading magnifying glass icon.
13. **SegmentedControl:** Tab alternative for switching views (e.g. Diff vs All).
14. **Toggle (Switch):** Boolean inputs (e.g., Dark Mode auto-toggle).
15. **Checkbox:** Boolean list inputs.
16. **ContextMenu:** Right-click context actions.
17. **Slider:** Value scaling configuration.
18. **DropdownMenu:** Form action selectors.

### Status & Feedback
19. **Badge:** Inline status indicators (e.g., "Modified", "New").
20. **Toast:** Transient bottom-floating notification.
21. **ProgressBar:** Indeterminate and determinate upload statuses.
22. **Spinner (Loader):** Circular gray indicator for loading states.
23. **EmptyState:** Icon (opacity 30%), Title, and descriptive text.
24. **Skeleton:** Shimmering rect/circle for loading content.

### Data Display
25. **ListRow:** 44px height standard list item with hover state.
26. **FileTreeItem:** Hierarchical indented row with expand/collapse chevron.
27. **DiffViewer:** Side-by-side or inline code difference display.
28. **Avatar:** Circular user image mapping for GitHub profiles.
29. **Tooltip:** Hover-state contextual definitions.
30. **CodeSnippet:** Rendered markdown block with copy button action.
31. **Tag:** Distinct metadata grouping element.

---

## 4. Design Tokens (JSON Export)

```json
{
  "color": {
    "primary": { "value": "#007AFF", "type": "color" },
    "background": {
      "light": { "value": "#FFFFFF", "type": "color" },
      "dark": { "value": "#000000", "type": "color" }
    }
  },
  "spacing": {
    "xs": { "value": "4px", "type": "dimension" },
    "sm": { "value": "8px", "type": "dimension" },
    "md": { "value": "16px", "type": "dimension" },
    "lg": { "value": "24px", "type": "dimension" }
  },
  "radii": {
    "card": { "value": "12px", "type": "dimension" },
    "button": { "value": "8px", "type": "dimension" },
    "pill": { "value": "9999px", "type": "dimension" }
  }
}
```

## 5. Do's and Don'ts

*   **DO** use 44px minimum touch targets for all interactive elements.
*   **DON'T** use multiple primary (solid blue) buttons in the same view.
*   **DO** use SF Pro (or Inter) and respect the native font rendering.
*   **DON'T** use highly saturated colors for backgrounds; reserve them for active states and badges.
*   **DO** use transparency to create depth (e.g., slightly transparent overlays with background blur).

## 6. Accessibility (a11y)
*   **Contrast:** All text must meet WCAG 2.1 AA standards (4.5:1 contrast ratio against backgrounds).
*   **Focus Rings:** Visible focus rings must be present for keyboard navigation (`ring-2 ring-blue-500 ring-offset-2`).
*   **Screen Readers:** All icon-only buttons must have `aria-label` tags describing the action.
*   **Motion:** Adhere to `prefers-reduced-motion` media queries for animations.
