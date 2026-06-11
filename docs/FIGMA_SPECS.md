# FileNexus: Figma Implementation & Design Ops Specs

As the Design Ops lead for the FileNexus project, this document dictates exactly how the UI designs and HIG principles are translated into a scalable, maintainable Figma file architecture. This ensures seamless collaboration between design and development, strictly utilizing Figma's latest features (Variables, Advanced Auto Layout, Component Properties).

---

## 1. Frame Structure & Grids

### 1.1 Base Frames
*   **Desktop (macOS / iPadOS Pro):** `1440 x 1024` (Primary workspace)
*   **Split View Breakdown:**
    *   `Sidebar` (Left): Fixed Width `260px`
    *   `Source List` (Middle): Fixed Width `320px`
    *   `Detail Canvas` (Right): Fill Container (Resizes fluidly)

### 1.2 Layout Grids
Applied at the page/container levels, driving responsive behavior.
*   **Detail Canvas Grid:**
    *   Columns: `12`
    *   Margin: `32px` (adaptive to `48px` on ultra-wide screens)
    *   Gutter: `24px`
    *   Type: `Stretch`

### 1.3 Constraints & Responsive Rules
*   **macOS Window Controls (Traffic Lights):** Pinned `Top` and `Left`.
*   **Sidebar:** Constraints set to `Left` and `Top & Bottom`.
*   **Detail Canvas Content:** Content containers within the canvas are set to `Center` or `Left & Right` depending on max-width rules.

---

## 2. Auto Layout Specifications

Every frame in the Figma file MUST use Auto Layout. Absolute positioning is strictly reserved for tooltips, absolute background textures, or drag-and-drop overlays.

### 2.1 Standard Spacing (Based on 8px grid)
*   **App.Sidebar**
    *   Direction: Vertical (↓)
    *   Padding: Top `40px` (macOS clearance), Left/Right `12px`, Bottom `16px`
    *   Item Spacing: `4px`
*   **Component.FileTreeItem**
    *   Direction: Horizontal (→)
    *   Padding: `4px` Vertical, `8px` Horizontal
    *   Item Spacing: `8px`
    *   Resizing: Width `Fill Container`, Height `Hug Contents`
    *   Alignment: Left Center
*   **View.DiffViewer**
    *   Direction: Vertical (↓)
    *   Padding: `16px` Horizontal
    *   Item Spacing: `0px` (Code lines stack flush)

---

## 3. Component Architecture

We construct components using atom-to-organism methodologies, heavily utilizing Component Properties (Booleans, Instance Swaps, Text Properties) to reduce variant bloat.

### 3.1 `Action / Button`
*   **Variants:**
    *   `Type`: Primary, Secondary, Ghost, Destructive
    *   `State`: Default, Hover, Pressed, Disabled
    *   `Size`: Small (32px), Medium (44px HIG standard), Large (54px)
*   **Properties:**
    *   `Show Icon Left` (Boolean)
    *   `Show Icon Right` (Boolean)
    *   `Label` (Text)
    *   `Icon` (Instance Swap -> preferred: SF Symbols)

### 3.2 `Data / FileTreeItem`
*   **Variants:**
    *   `State`: Default, Hover, Active/Selected
    *   `Status`: Unmodified, Added, Modified, Deleted
    *   `Has Children`: True, False (determines chevron presence)
*   **Properties:**
    *   `Depth Level` (Number Variable applied to Left Padding: `level * 16px`)
    *   `Filename` (Text)
    *   `File Icon` (Instance Swap)

### 3.3 `Overlay / CommitSheet`
*   **Variants:**
    *   `State`: Input, Loading, Success, Error
*   **Properties:**
    *   `Title` (Text)
    *   `Commit Message` (Text)

---

## 4. Design Tokens (Figma Local Variables)

We manage tokens using Figma Local Variables to support native Light/Dark mode switching via modes.

### 4.1 Collection 1: Primitives (Colors)
*   `blue-500`: `#0A84FF`
*   `slate-900`: `#0F172A`
*   `slate-100`: `#F1F5F9`
*   `green-500`: `#30D158`
*   `red-500`: `#FF453A`

### 4.2 Collection 2: Semantic (Modes: Light / Dark)
Alias primitive tokens to semantic UI roles.
*   `surface / primary`: Light: `#FFFFFF`, Dark: `#1E1E1E`
*   `surface / secondary`: Light: `#F2F2F7`, Dark: `#2C2C2E` (Sidebar background)
*   `text / primary`: Light: `#000000`, Dark: `#FFFFFF`
*   `status / positive`: Light: `green-500`, Dark: `green-500`

### 4.3 Typography (Text Styles)
*   `HIG / Title 1`: SF Pro Display, 28px, Bold, Auto LH.
*   `HIG / Body`: SF Pro Text, 17px, Regular, 1.4 LH.
*   `Code / Body`: JetBrains Mono, 13px, Regular, 1.6 LH.

### 4.4 Effects (Layer Styles)
*   `Elevation / Modal`: Drop Shadow `0 8px 32px rgba(0,0,0, 0.12)`, `0 1px 4px rgba(0,0,0, 0.04)`
*   `Material / Vibrancy`: Background Blur `60px` (macOS translucent material simulation)

---

## 5. Prototype Flows & Interactions

Interactive flows are built to simulate the desktop application experience.

### Flow 1: Complete Batch Sync
1.  **Trigger:** `On Drag` (User drops folder onto Detail Canvas dropzone).
2.  **Action:** `Navigate To` -> "Parsing Files" State.
3.  **Animation:** `Smart Animate`, `Ease Out`, `300ms`.
4.  **Trigger:** `After Delay` (800ms) -> `Navigate To` -> "Diff Verification" View.
5.  **Trigger:** `On Click` ("Commit & Sync" button) -> `Open Overlay` (CommitSheet).
    *   *Overlay Settings:* Centered, Close when clicking outside, Background overlay `20% black`.
    *   *Animation:* `Move In` from top, `Spring` (Damping: 20, Stiffness: 250).

### Flow 2: Hover States & Micro-interactions
*   **FileTreeItems:** `While Hovering` -> change state to `Hover`. `Smart Animate` `150ms`. Allows for smooth highlight transitions.

---

## 6. Dev Handoff & Asset Management

To ensure a 1:1 translation from Figma to Code (TypeScript/React/Tailwind):

### 6.1 Naming Conventions
*   Components must follow the slash convention for categorization: `Category / Component / Variant`. Example: `Button / Primary / Default`.
*   Variable names mimic Tailwind CSS classes for predictability. `surface / secondary` translates directly to `bg-slate-100` (Light) or `bg-slate-800` (Dark).

### 6.2 Dev Mode Configuration
*   **Code Syntax:** Ensure Figma's Dev Mode is set to output `CSS` and `Tailwind`.
*   **Component Documentation:** Use the Figma Component Description field. Inputs here will appear in Dev Mode. Include props definitions (e.g., `interface ButtonProps { variant: 'primary' | 'secondary' ... }`).
*   **Exports:** All icons (custom) must be marked for export as `SVG`. SF Symbols do not need export as they are system-native or handled via an icon font.

### 6.3 Handoff Checklists
Before marking a frame as "Ready for Dev":
*   Check Auto Layout dimensions (no arbitrary fixed pixel heights for text containers).
*   Verify contrast ratios using the Stark plugin.
*   Attach relevant documentation links (to `DESIGN_SYSTEM.md` or HIG documentation) directly in the Figma frame descriptions.

---

## 7. Accessibility (A11y) Notes in Figma

*   **Focus States:** Explicitly design a Focus variant for interactive components. Document that the Focus Ring uses the `system accent color` and is universally applied via CSS `:focus-visible`.
*   **Layer Structure (DOM Order):** Developers rely on Figma layer order. Ensure the layer panel reflects the logical DOM order (Top to Bottom mapping to HTML structure).
*   **Annotation:** Use redline annotations (special Figma components) to explicitly define `aria-hidden="true"` attributes for decorative shapes or icons that screen readers should ignore.
