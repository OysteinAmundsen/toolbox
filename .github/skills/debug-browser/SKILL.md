---
name: debug-browser
description: Debug components in a live browser using the Chrome DevTools MCP server. Covers launching dev servers, navigating to pages/stories, DOM inspection, console monitoring, network analysis, screenshots, and script evaluation.
argument-hint: <issue-description>
---

# Browser Debugging via Chrome DevTools MCP

Guide for debugging grid components in a live browser using the Chrome DevTools MCP server. This enables inspecting DOM, evaluating scripts, capturing screenshots, monitoring console/network, and more — all from within the AI coding assistant.

> **Performance-specific debugging?** See the `debug-perf` skill for hot path analysis, render scheduler profiling, and performance budget verification. That skill includes a section on live browser profiling via MCP.

## Prerequisites

The workspace has Chrome DevTools MCP pre-configured in `.vscode/mcp.json`:

```jsonc
{
  "servers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"],
    },
  },
}
```

The MCP server launches its own Chromium instance. This is **separate** from any VS Code debug launch configuration — they are independent workflows:

- **MCP browser**: For AI-driven inspection, script evaluation, screenshots
- **VS Code debugger**: For breakpoints, step-through, variable inspection

## Step 1: Start a Dev Server

Before navigating, ensure a dev server is running. Use one of:

```bash
# Storybook (all stories, port 4400)
bun nx serve docs

# Vanilla demo (port 4000)
bun nx serve demo-vanilla

# Angular demo (port 4200)
bun nx serve demo-angular

# React demo (port 4300)
bun nx serve demo-react

# Vue demo (port 4173)
bun nx serve demo-vue

# All demos at once
bun run demo
```

**Server reference:**

| App          | Port | Command                     |
| ------------ | ---- | --------------------------- |
| Storybook    | 4400 | `bun nx serve docs`         |
| Demo Vanilla | 4000 | `bun nx serve demo-vanilla` |
| Demo Angular | 4200 | `bun nx serve demo-angular` |
| Demo React   | 4300 | `bun nx serve demo-react`   |
| Demo Vue     | 4100 | `bun nx serve demo-vue`     |

## Step 2: Navigate to the Target

### Navigate to a demo app

```
navigate_page → url: http://localhost:4200/
```

### Navigate to a specific Storybook story

Stories are served at path `iframe.html?id=<story-id>`. Use the Storybook sidebar structure to construct the ID:

```
navigate_page → url: http://localhost:4400/iframe.html?id=plugins-editing--basic
navigate_page → url: http://localhost:4400/iframe.html?id=features-columns--column-types
```

Pattern: `category-subcategory--story-name` (lowercase, hyphens).

### Reload a page (after code changes with HMR)

```
navigate_page → type: reload, ignoreCache: true
```

### List open pages

```
list_pages
```

Use `select_page` to switch between tabs if multiple are open.

## Step 3: Inspect and Debug

### DOM Inspection

**Take a DOM snapshot** to see the full HTML structure:

```
take_snapshot → selector: tbw-grid
```

This returns a structured DOM tree with element attributes, classes, and text content. Very useful for understanding the current grid state.

**Evaluate a script** to query the DOM programmatically:

```javascript
// Example: Count visible rows, editing cells, check column count
() => {
  const grid = document.querySelector('tbw-grid');
  return {
    rows: grid?._bodyEl?.querySelectorAll('.data-grid-row').length,
    editingCells: grid?.querySelectorAll('.cell.editing').length,
    columns: grid?._visibleColumns?.length,
  };
};
```

### Console Monitoring

**List console messages** to catch warnings/errors:

```
list_console_messages
```

**Get a specific console message** by index for full details:

```
get_console_message → index: 0
```

Useful for catching grid validation warnings (e.g., "EditingPlugin required", config validation errors).

### Network Monitoring

**List network requests** to debug API calls or asset loading:

```
list_network_requests
```

**Get details of a specific request** (headers, response body):

```
get_network_request → index: 0
```

### Screenshots

**Take a screenshot** for visual verification:

```
take_screenshot
```

**Take a screenshot of a specific element:**

```
take_screenshot → selector: tbw-grid
```

Useful for visual regression debugging — compare before/after states.

### Interaction

**Click** on an element:

```
click → selector: .cell[data-col="3"][data-row="0"]
```

**Fill** an input:

```
fill → selector: .cell.editing input → value: new text
```

**Press a key:**

```
press_key → key: Enter
press_key → key: Escape
press_key → key: Tab
```

**Hover** over an element (e.g., to trigger tooltips):

```
hover → selector: .cell[data-col="0"][data-row="0"]
```

### Wait for Conditions

**Wait for an element** to appear:

```
wait_for → selector: .cell.editing
wait_for → selector: tbw-grid .data-grid-row
```

**Wait for network idle** (after navigation or data loading):

```
wait_for → type: networkIdle
```

## Step 4: Script Evaluation Patterns

The `evaluate_script` tool is the most powerful debugging tool. It runs arbitrary JavaScript in the page context.

### Grid Internals Access

The grid's internal state is accessible through the DOM element:

```javascript
() => {
  const grid = document.querySelector('tbw-grid');
  return {
    // Configuration
    effectiveConfig: Object.keys(grid.effectiveConfig || {}),
    columnCount: grid._visibleColumns?.length,
    rowCount: grid._rows?.length,

    // Virtualization window
    virtStart: grid._virtualization?.start,
    virtEnd: grid._virtualization?.end,
    rowHeight: grid._virtualization?.rowHeight,

    // Edit state
    activeEditRow: grid._activeEditRows,
    isGridEditMode: grid._isGridEditMode,
    editingCells: grid.querySelectorAll('.cell.editing').length,

    // Plugin state
    plugins: grid._pluginManager?._plugins?.map((p) => p.constructor.name),
  };
};
```

### Framework Adapter Inspection

```javascript
// Angular adapter state
() => {
  const grid = document.querySelector('tbw-grid');
  const adapter = grid?.__frameworkAdapter;
  return {
    adapterType: adapter?.constructor.name,
    viewRefs: adapter?.viewRefs?.length,
    componentRefs: adapter?.componentRefs?.length,
    editorViewRefs: adapter?.editorViewRefs?.length,
    editorComponentRefs: adapter?.editorComponentRefs?.length,
  };
};
```

### Monkey-Patching for Tracing

Inject tracing code to track specific operations:

```javascript
// Track how many times releaseCell is called and what triggers it
() => {
  const grid = document.querySelector('tbw-grid');
  const adapter = grid?.__frameworkAdapter;
  if (!adapter?.releaseCell) return { error: 'No adapter or releaseCell' };

  const original = adapter.releaseCell.bind(adapter);
  window.__releaseLogs = [];
  adapter.releaseCell = (cellEl) => {
    window.__releaseLogs.push({
      col: cellEl.getAttribute('data-col'),
      row: cellEl.getAttribute('data-row'),
      isEditing: cellEl.classList.contains('editing'),
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
    });
    return original(cellEl);
  };
  return { patched: true };
};
```

Then trigger the action and read results:

```javascript
() => ({
  logCount: window.__releaseLogs?.length || 0,
  logs: window.__releaseLogs?.slice(0, 10) || [],
});
```

### Async Operations

For operations that need to wait for render cycles:

```javascript
() => {
  const grid = document.querySelector('tbw-grid');
  // Trigger something
  grid.rows = [...grid.rows];
  // Wait for render to complete
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve({ rendered: true, rowCount: grid._rows?.length });
      });
    });
  });
};
```

## Step 5: Common Debugging Workflows

### "Component renders incorrectly"

1. `navigate_page` to the page showing the issue
2. `take_screenshot` for visual context
3. `take_snapshot` on `tbw-grid` for DOM structure
4. `evaluate_script` to read grid state (config, columns, rows)
5. Identify the discrepancy between expected and actual state

### "Editor is destroyed during editing"

1. Navigate to the page with the editor
2. `evaluate_script`: Monkey-patch `adapter.releaseCell` to log destructions
3. Enter edit mode via `click` + `press_key Enter`
4. Trigger the suspected cause (e.g., rows replacement)
5. `evaluate_script`: Read the logs to see if/how destruction happened

### "Event not firing or has wrong payload"

1. `evaluate_script`: Add event listener with logging
   ```javascript
   () => {
     window.__eventLogs = [];
     const grid = document.querySelector('tbw-grid');
     grid.addEventListener('cell-commit', (e) => {
       window.__eventLogs.push({ type: e.type, detail: e.detail });
     });
     return { listening: true };
   };
   ```
2. Trigger the action
3. `evaluate_script`: Read `window.__eventLogs`

### "Styles not applied correctly"

1. `take_screenshot` for visual state
2. `evaluate_script`: Read computed styles
   ```javascript
   () => {
     const cell = document.querySelector('.cell[data-col="0"]');
     const styles = getComputedStyle(cell);
     return {
       width: styles.width,
       color: styles.color,
       background: styles.backgroundColor,
       display: styles.display,
     };
   };
   ```
3. `take_snapshot` with selector for the specific element's DOM

### "Storybook story fails to render"

1. `navigate_page` to `http://localhost:4400/iframe.html?id=<story-id>`
2. `list_console_messages` to catch any errors
3. `take_screenshot` for visual state
4. `take_snapshot` to see what DOM was actually rendered

## MCP Tool Reference

| Tool                          | Purpose                                      |
| ----------------------------- | -------------------------------------------- |
| `navigate_page`               | Go to URL, reload, go back/forward           |
| `list_pages`                  | List all open browser tabs                   |
| `select_page`                 | Switch to a different tab                    |
| `new_page`                    | Open a new tab                               |
| `close_page`                  | Close a tab                                  |
| `take_screenshot`             | Capture full page or element screenshot      |
| `take_snapshot`               | Get DOM tree structure                       |
| `evaluate_script`             | Run JavaScript in page context               |
| `click`                       | Click an element by selector                 |
| `fill`                        | Type text into an input                      |
| `fill_form`                   | Fill multiple form fields at once            |
| `press_key`                   | Send keyboard events                         |
| `hover`                       | Hover over an element                        |
| `drag`                        | Drag from one element to another             |
| `upload_file`                 | Upload a file to a file input                |
| `handle_dialog`               | Accept/dismiss browser dialogs               |
| `wait_for`                    | Wait for element, URL, timeout, or network   |
| `emulate`                     | Set viewport size or device emulation        |
| `resize_page`                 | Resize the browser viewport                  |
| `list_console_messages`       | Get all console messages                     |
| `get_console_message`         | Get specific console message details         |
| `list_network_requests`       | List all network requests                    |
| `get_network_request`         | Get specific request/response details        |
| `performance_start_trace`     | Start a performance trace (see `debug-perf`) |
| `performance_stop_trace`      | Stop trace and get results                   |
| `performance_analyze_insight` | Get AI-analyzed performance insights         |
