# Screen Reader Testing Protocol

> **Status:** Active  
> **Last tested:** _Not yet tested_  
> **Applies to:** `@toolbox-web/grid` v2.x

## Purpose

This document provides a reproducible manual testing protocol for verifying the `<tbw-grid>` screen reader experience. Run this protocol before major releases, after accessibility changes, or when ARIA attributes are modified.

## Screen Readers to Test

| Screen Reader | OS      | Priority  | Notes                           |
| ------------- | ------- | --------- | ------------------------------- |
| **NVDA**      | Windows | Primary   | Free, most popular on Windows   |
| **VoiceOver** | macOS   | Secondary | Built-in, covers Safari/macOS   |
| **JAWS**      | Windows | Stretch   | Commercial, enterprise standard |

## Setup

1. Start the vanilla demo: `bun nx serve demo-vanilla`
2. Open `http://localhost:4000` in the browser
3. Enable the screen reader
4. Ensure grid has data loaded (default employee dataset)

## Test Script

Run each test below with each screen reader. Mark pass (✅) or fail (❌) per reader.

### 1. Grid Discovery

| Step                            | Expected                          | NVDA | VoiceOver | JAWS |
| ------------------------------- | --------------------------------- | ---- | --------- | ---- |
| Navigate to the grid using Tab  | Grid role announced with "grid"   |      |           |      |
| Grid announces row/column count | e.g., "grid, 100 rows, 8 columns" |      |           |      |
| Grid aria-label is announced    | Grid title or explicit aria-label |      |           |      |

### 2. Header Navigation

| Step                                 | Expected                           | NVDA | VoiceOver | JAWS |
| ------------------------------------ | ---------------------------------- | ---- | --------- | ---- |
| Arrow right through header cells     | Column name announced for each     |      |           |      |
| Sortable headers announce sort state | "column header, sort none"         |      |           |      |
| Click header to sort ascending       | "ascending" announced              |      |           |      |
| Click header to sort descending      | "descending" announced             |      |           |      |
| Click header to clear sort           | aria-live announces "Sort cleared" |      |           |      |

### 3. Cell Navigation

| Step                                | Expected                        | NVDA | VoiceOver | JAWS |
| ----------------------------------- | ------------------------------- | ---- | --------- | ---- |
| Arrow down into data cells          | Cell content announced          |      |           |      |
| Arrow right between cells           | Column name + cell content      |      |           |      |
| Home key jumps to first cell in row | First cell content announced    |      |           |      |
| End key jumps to last cell in row   | Last cell content announced     |      |           |      |
| Ctrl+Home jumps to first row        | First row, first cell announced |      |           |      |
| Ctrl+End jumps to last row          | Last row, last cell announced   |      |           |      |

### 4. Sort Interaction

| Step                        | Expected                                    | NVDA | VoiceOver | JAWS |
| --------------------------- | ------------------------------------------- | ---- | --------- | ---- |
| Click sortable header       | aria-live: "Sorted by {column}, ascending"  |      |           |      |
| Click again                 | aria-live: "Sorted by {column}, descending" |      |           |      |
| Click again to clear        | aria-live: "Sort cleared"                   |      |           |      |
| aria-sort attribute updates | Header cell reflects current sort state     |      |           |      |

### 5. Selection (if SelectionPlugin loaded)

| Step                        | Expected                                        | NVDA | VoiceOver | JAWS |
| --------------------------- | ----------------------------------------------- | ---- | --------- | ---- |
| Click a row                 | aria-live: "1 rows selected" (debounced)        |      |           |      |
| Shift+Click to select range | aria-live: "{N} rows selected"                  |      |           |      |
| Ctrl+A to select all        | aria-live: "{total} rows selected"              |      |           |      |
| Click to deselect           | aria-live: "1 rows selected" or no announcement |      |           |      |

### 6. Editing (if EditingPlugin loaded)

| Step                           | Expected                        | NVDA | VoiceOver | JAWS |
| ------------------------------ | ------------------------------- | ---- | --------- | ---- |
| Trigger edit on a cell         | aria-live: "Editing row {N}"    |      |           |      |
| Edit value and press Enter     | aria-live: "Row {N} saved"      |      |           |      |
| Press Escape to cancel         | No "saved" announcement         |      |           |      |
| Boolean cell toggle with Space | Checkbox state change announced |      |           |      |

### 7. Grouping (if GroupingRowsPlugin loaded)

| Step                           | Expected                                     | NVDA | VoiceOver | JAWS |
| ------------------------------ | -------------------------------------------- | ---- | --------- | ---- |
| Click group toggle to expand   | aria-live: "Group {name} expanded, {N} rows" |      |           |      |
| Click group toggle to collapse | aria-live: "Group {name} collapsed"          |      |           |      |
| Expand nested group            | Inner group announced with count             |      |           |      |

### 8. Filtering (if FilteringPlugin loaded)

| Step                     | Expected                                  | NVDA | VoiceOver | JAWS |
| ------------------------ | ----------------------------------------- | ---- | --------- | ---- |
| Apply filter on a column | aria-live: "Filter applied on {column}"   |      |           |      |
| Clear filter on a column | aria-live: "Filter cleared from {column}" |      |           |      |
| Clear all filters        | aria-live: "All filters cleared"          |      |           |      |

### 9. Loading State

| Step                    | Expected                                 | NVDA | VoiceOver | JAWS |
| ----------------------- | ---------------------------------------- | ---- | --------- | ---- |
| Trigger loading overlay | Loading status announced (role="status") |      |           |      |
| Loading completes       | Content becomes available                |      |           |      |

## Known Limitations

- **Virtualization recycling:** When scrolling past the visible window, screen readers may temporarily lose context as rows are recycled. The grid preserves `aria-rowindex` on virtualized rows to maintain position context.
- **Complex editors:** Custom editor components (e.g., datepickers) may have their own screen reader behavior that this protocol does not cover.
- **Live region timing:** The `aria-live="polite"` region waits for current speech to finish. Rapid consecutive actions may queue announcements.

## Updating This Protocol

When new features or plugins are added that affect screen reader interaction:

1. Add a new test section above
2. Re-run the protocol with at least NVDA
3. Update the "Last tested" date at the top
4. File issues for any failures found
