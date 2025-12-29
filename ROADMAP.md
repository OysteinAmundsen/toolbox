# @toolbox-web Roadmap

A modern, framework-agnostic component library built on pure Web Components and native browser APIs.

## Philosophy

- **Native First**: Leverage HTML5 standards (`<dialog>`, `popover`, `<details>`, CSS anchor positioning) instead of reinventing them
- **Building Blocks**: Provide foundational primitives that the web platform lacks; users compose larger solutions
- **Install What You Need**: Each package is independently publishable and tree-shakeable
- **Enterprise Focus**: Fill gaps that native HTML doesn't address for complex applications
- **Zero Runtime Dependencies**: Pure TypeScript, no framework lock-in

---

## Components

### ✅ Released

| Package             | Description                                                      | Status   |
| ------------------- | ---------------------------------------------------------------- | -------- |
| `@toolbox-web/grid` | High-performance data grid with virtualization, editing, plugins | **v1.x** |

### 🔜 Planned Components

#### Priority 1: Core Enterprise Components

| Package                  | Description                   | Complexity | Notes                                                                                           |
| ------------------------ | ----------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `@toolbox-web/tree`      | Standalone tree view          | Medium     | Extract from grid's TreePlugin; add checkbox selection, drag-drop, virtual scroll, lazy loading |
| `@toolbox-web/calendar`  | Day/week/month calendar views | High       | Event scheduling, recurring events, drag-to-resize, resource allocation                         |
| `@toolbox-web/commander` | Command palette (Ctrl+K)      | Medium     | Uses native `<dialog>` + `popover`; fuzzy search, keyboard nav, action registry                 |

#### Priority 2: Data & Content

| Package                 | Description             | Complexity | Notes                                                 |
| ----------------------- | ----------------------- | ---------- | ----------------------------------------------------- |
| `@toolbox-web/explorer` | File explorer / browser | Medium     | Combines tree + grid; file preview, upload, drag-drop |

#### Priority 3: Content & Input

| Package                    | Description           | Complexity | Notes                                                                       |
| -------------------------- | --------------------- | ---------- | --------------------------------------------------------------------------- |
| `@toolbox-web/editor`      | Rich text editor      | High       | Markdown support, formatting toolbar, mentions, collaborative editing ready |
| `@toolbox-web/spreadsheet` | Spreadsheet component | Very High  | Formula support, cell formatting; builds on grid infrastructure             |

---

## Utilities (Enhance Native Elements)

Lightweight packages that work **with** native elements, not replace them.

| Package                 | Description             | Notes                                                                                               |
| ----------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| `@toolbox-web/forms`    | Form utilities          | Validation, async submission, dirty tracking; works with native `<input>`, `<select>`, `<textarea>` |
| `@toolbox-web/virtual`  | Virtual scroll utility  | Wraps any list for virtualization; not a component, a behavior                                      |
| `@toolbox-web/keyboard` | Keyboard navigation     | Arrow key navigation, focus trapping, shortcut registry                                             |
| `@toolbox-web/a11y`     | Accessibility helpers   | Screen reader announcements, focus management, ARIA utilities                                       |
| `@toolbox-web/theme`    | Theming system          | CSS custom property management, theme switcher, dark mode                                           |
| `@toolbox-web/drag`     | Drag and drop utilities | Reorderable lists, cross-container drag, touch support                                              |

---

## Shared Infrastructure

### `@toolbox-web/core` (Internal)

Shared utilities used across components (not published separately initially):

- Resize observer helpers
- Keyboard navigation patterns
- Base component class with common lifecycle
- Theme CSS variables contract
- TypeScript utilities

---

## Native HTML5 Features We DON'T Wrap

These are well-supported natively. We provide guidance, not components:

| Feature            | Native Element                 | Browser Support |
| ------------------ | ------------------------------ | --------------- |
| Modal dialogs      | `<dialog>`                     | ✅ Excellent    |
| Popovers/dropdowns | `popover` attribute            | ✅ Good (2023+) |
| Accordions         | `<details>/<summary>`          | ✅ Excellent    |
| Date pickers       | `<input type="date">`          | ✅ Good         |
| Tooltips           | `popover` + CSS anchor         | 🔄 Emerging     |
| Tabs               | CSS `:target` or radio buttons | ✅ Excellent    |

---

## Component Design Principles

### 1. Shadow DOM Encapsulation

All components use Shadow DOM for style isolation with CSS custom properties for theming.

### 2. Progressive Enhancement

Components work with basic functionality immediately; advanced features load on demand.

### 3. Plugin Architecture

Complex components (grid, calendar, editor) use plugins for optional features.

### 4. Consistent API Patterns

```typescript
// All components follow this pattern:
element.config = { ... };        // Full configuration object
element.property = value;        // Individual property shortcuts
element.addEventListener('event-name', handler);
await element.ready();           // Wait for initialization
```

### 5. Event Constants

```typescript
import { CalendarEvents } from '@toolbox-web/calendar';
calendar.addEventListener(CalendarEvents.DATE_SELECT, handler);
```

---

## Versioning Strategy

- Each package versioned independently
- Major version bumps only for breaking API changes
- Shared infrastructure changes don't force component updates

---

## Contributing

See individual package READMEs for contribution guidelines.

---

## Timeline

| Quarter | Focus                                 |
| ------- | ------------------------------------- |
| Q1 2025 | Grid stabilization, tree extraction   |
| Q2 2025 | Calendar component, commander palette |
| Q3 2025 | Explorer, utility packages            |
| Q4 2025 | Editor, additional utilities          |

_Timeline is aspirational and subject to community feedback._
