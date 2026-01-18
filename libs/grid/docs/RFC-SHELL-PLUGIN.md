# RFC: ShellPlugin Extraction

**Status**: Not started  
**Author**: Copilot / @OysteinAmundsen  
**Created**: 2026-01-16  
**Target**: @toolbox-web/grid v2.x

---

## Summary

Extract shell functionality (tool panels, header, toolbar) from `grid.ts` into a standalone `ShellPlugin`. This makes shell features tree-shakeable for read-only grids that don't need the chrome.

**Current state**:

- `grid.ts`: 2,545 lines
- `shell.ts`: 1,327 lines (internal helper module)
- Shell methods and state in grid.ts: ~300 lines

**Expected result**:

- `grid.ts`: ~2,200 lines (-300 lines)
- `ShellPlugin.ts`: ~400-500 lines (new plugin)
- Shell becomes opt-in and tree-shakeable

---

## What Moves to ShellPlugin

### From grid.ts

**State**:

- `#shellState: ShellState` → owned by plugin
- `#shellController: ShellController` → owned by plugin
- `#resizeCleanup` → owned by plugin

**Getters**:

- `get isToolPanelOpen()`
- `get activeToolPanel()`
- `get expandedToolPanelSections()`

**Tool Panel Methods**:

- `openToolPanel()`
- `closeToolPanel()`
- `toggleToolPanel()`
- `toggleToolPanelSection()`
- `getToolPanels()`
- `registerToolPanel()`
- `unregisterToolPanel()`

**Header Content Methods**:

- `getHeaderContents()`
- `registerHeaderContent()`
- `unregisterHeaderContent()`

**Toolbar Button Methods**:

- `getToolbarButtons()`
- `registerToolbarButton()`
- `unregisterToolbarButton()`
- `setToolbarButtonDisabled()`

**Internal Methods**:

- `refreshShellHeader()`
- `#updateShellHeaderInPlace()`
- `#collectPluginShellContributions()`
- `#getToolPanelRendererFactory()`

---

## Plugin Structure

```
libs/grid/src/lib/plugins/shell/
├── index.ts                # Barrel exports
├── ShellPlugin.ts          # Main plugin class
├── shell.css               # Shell-specific styles (if any)
├── types.ts                # ShellPluginConfig, exported types
├── shell.spec.ts           # Unit tests
├── shell.stories.ts        # Storybook demos
└── shell.mdx               # Documentation
```

---

## Plugin API Design

```typescript
export interface ShellPluginConfig {
  /** Initial tool panel to open */
  initialPanel?: string;
  /** Whether tool panel is initially open */
  initialOpen?: boolean;
}

export class ShellPlugin extends BaseGridPlugin<ShellPluginConfig> {
  readonly name = 'shell';
  readonly version = '1.0.0';

  // State (owned by plugin, not grid)
  #state: ShellState;
  #controller: ShellController;

  // ============== Tool Panel API ==============

  /** Whether a tool panel is currently open */
  get isOpen(): boolean;

  /** ID of the currently active tool panel, or null */
  get activePanel(): string | null;

  /** Set of expanded section IDs in the active panel */
  get expandedSections(): Set<string>;

  /** Open the tool panel (uses last active or first registered) */
  openPanel(id?: string): void;

  /** Close the tool panel */
  closePanel(): void;

  /** Toggle tool panel open/closed */
  togglePanel(): void;

  /** Toggle a section within the active panel */
  toggleSection(sectionId: string): void;

  /** Get all registered tool panels */
  getPanels(): Map<string, ToolPanelDefinition>;

  /** Register a tool panel (plugins call this to add their panels) */
  registerPanel(panel: ToolPanelDefinition): void;

  /** Unregister a tool panel */
  unregisterPanel(panelId: string): void;

  // ============== Header Content API ==============

  /** Get all registered header contents */
  getHeaderContents(): Map<string, HeaderContentDefinition>;

  /** Register header content */
  registerHeaderContent(content: HeaderContentDefinition): void;

  /** Unregister header content */
  unregisterHeaderContent(contentId: string): void;

  // ============== Toolbar Button API ==============

  /** Get all registered toolbar buttons */
  getToolbarButtons(): Map<string, ToolbarButtonConfig>;

  /** Register a toolbar button */
  registerToolbarButton(button: ToolbarButtonConfig): void;

  /** Unregister a toolbar button */
  unregisterToolbarButton(buttonId: string): void;

  /** Set a toolbar button's disabled state */
  setToolbarButtonDisabled(buttonId: string, disabled: boolean): void;

  // ============== Lifecycle Hooks ==============

  attach(grid: InternalGrid): void {
    super.attach(grid);
    // Initialize shell state
    // Set up shell DOM (header, tool panel container)
    // Register Light DOM handlers with ConfigManager
  }

  detach(): void {
    // Cleanup shell DOM
    // Unregister handlers
    super.detach();
  }

  afterRender(): void {
    // Update shell header if needed
    // Sync tool panel state
  }
}
```

---

## Usage After Extraction

### Before (shell methods on grid)

```typescript
// Shell methods directly on grid element
grid.openToolPanel();
grid.registerToolPanel({ id: 'myPanel', ... });
grid.registerToolbarButton({ id: 'export', ... });
```

### After (shell via plugin)

```typescript
import { ShellPlugin } from '@toolbox-web/grid/plugins/shell';

// Add ShellPlugin to enable shell features
grid.gridConfig = {
  plugins: [new ShellPlugin()],
};

// Access shell via plugin API
const shell = grid.getPlugin(ShellPlugin);
shell?.openPanel();
shell?.registerPanel({ id: 'myPanel', ... });
shell?.registerToolbarButton({ id: 'export', ... });
```

### Plugins That Need Shell

Plugins that provide tool panels (VisibilityPlugin, etc.) will:

1. Declare a soft dependency on ShellPlugin
2. Check for ShellPlugin in `attach()`
3. Register their panels if ShellPlugin is present
4. Work without shell features if ShellPlugin is absent

```typescript
export class VisibilityPlugin extends BaseGridPlugin {
  static override readonly dependencies: PluginDependency[] = [
    { name: 'shell', required: false, reason: 'Enables column visibility panel' },
  ];

  attach(grid: InternalGrid): void {
    super.attach(grid);

    const shell = grid.getPlugin(ShellPlugin);
    if (shell) {
      shell.registerPanel({
        id: 'visibility',
        title: 'Columns',
        icon: 'columns',
        render: () => this.#renderPanel(),
      });
    }
    // Plugin still works for programmatic visibility control
  }
}
```

---

## Implementation Steps

### Step 1: Create Plugin Skeleton

1. Create `libs/grid/src/lib/plugins/shell/` directory
2. Create `ShellPlugin.ts` with basic structure
3. Create `index.ts` barrel export
4. Add to `all.ts` plugin bundle

### Step 2: Move State and Controller

1. Move `#shellState` initialization to plugin
2. Move `#shellController` creation to plugin
3. Plugin's `attach()` sets up shell infrastructure

### Step 3: Move Public Methods

1. Move all tool panel methods to plugin
2. Move all header content methods to plugin
3. Move all toolbar button methods to plugin
4. Keep method signatures identical for easy migration

### Step 4: Update grid.ts

1. Remove shell state and methods from grid.ts
2. Add shell rendering hook for plugin
3. Ensure Light DOM shell elements still work (via ConfigManager)

### Step 5: Update Dependent Plugins

1. VisibilityPlugin: Use ShellPlugin for panel registration
2. Other plugins: Check for ShellPlugin before registering panels

### Step 6: Tests and Documentation

1. Move/update shell tests to plugin
2. Create shell.stories.ts
3. Create shell.mdx documentation
4. Update README with ShellPlugin usage

---

## Breaking Changes

| Before                     | After                                          | Migration                        |
| -------------------------- | ---------------------------------------------- | -------------------------------- |
| `grid.openToolPanel()`     | `grid.getPlugin(ShellPlugin)?.openPanel()`     | Add ShellPlugin, use plugin API  |
| `grid.registerToolPanel()` | `grid.getPlugin(ShellPlugin)?.registerPanel()` | Use plugin API                   |
| `grid.isToolPanelOpen`     | `grid.getPlugin(ShellPlugin)?.isOpen`          | Use plugin API                   |
| Shell always available     | Shell is opt-in                                | Add ShellPlugin to plugins array |

---

## Open Questions

1. **Should shell rendering stay in grid.ts or move to plugin?**
   - Option A: Plugin only registers content, grid.ts still renders shell
   - Option B: Plugin owns all shell rendering
   - **Recommendation**: Option A initially, refactor to B later

2. **How to handle Light DOM shell elements without ShellPlugin?**
   - Option A: Ignore them (logged warning)
   - Option B: Auto-register ShellPlugin
   - **Recommendation**: Option A with clear warning

3. **Should we keep grid-level shell methods as deprecated wrappers?**
   - Could help migration but adds complexity
   - **Recommendation**: No, clean break for v2.x
