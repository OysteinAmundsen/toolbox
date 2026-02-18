# Cross-Framework E2E Visual Regression Tests

This folder contains Playwright end-to-end tests that verify visual and functional parity across the demo implementations (Vanilla JS, React, Angular). The Vue demo also exists but is not yet included in the e2e visual regression suite.

## Purpose

These tests serve as a **pre-release QA checkpoint** to ensure:

1. **Visual Parity**: All demos render identically (except for the framework name in the header)
2. **Renderer Consistency**: Custom cell renderers (status badges, ratings, etc.) look the same
3. **Editor Consistency**: Custom cell editors function and appear the same
4. **Detail Panel Parity**: Master-detail panels render identical content
5. **Responsive Layout**: Mobile card layouts are consistent across frameworks
6. **Functional Parity**: Sorting, selection, keyboard navigation work the same

## Running Tests

### Prerequisites

1. Install Playwright browsers (first time only):

   ```bash
   bunx playwright install chromium
   ```

2. Make sure all demo dependencies are installed:
   ```bash
   bun install
   ```

### Run All Tests (Local Development)

For local development, you need to start the demo servers first in separate terminals:

```bash
# Terminal 1: Start vanilla demo
bun nx run demo-vanilla:serve

# Terminal 2: Start react demo
bun nx run demo-react:serve

# Terminal 3: Start angular demo
bun nx run demo-angular:serve

# Terminal 4: Run e2e tests (after servers are ready)
bun run e2e
```

Or use wait-on to start servers in background and wait:

```bash
# Start all servers in background
bun nx run demo-vanilla:serve &
bun nx run demo-react:serve &
bun nx run demo-angular:serve &

# Wait for them to be ready
bunx wait-on http://localhost:4000 http://localhost:4300 http://localhost:4200 -t 120000

# Run tests
bun run e2e
```

### Interactive UI Mode

```bash
# With servers already running:
bun nx e2e:ui e2e

# Or directly
cd e2e && bunx playwright test --ui
```

### Update Baseline Screenshots

When intentionally changing visual appearance:

```bash
# With servers already running:
bun nx e2e:update-snapshots e2e

# Or directly
cd e2e && bunx playwright test --update-snapshots
```

### Run Specific Test File

```bash
cd e2e && bunx playwright test cross-framework-visual.spec.ts
```

### Debug Mode

```bash
cd e2e && bunx playwright test --debug
```

## Test Structure

```
e2e/
├── playwright.config.ts      # Playwright configuration
├── project.json              # Nx project configuration
├── tsconfig.json             # TypeScript configuration
├── README.md                 # This file
├── reporters/
│   └── clean-list-reporter.ts  # Custom local reporter
├── scripts/
│   └── fetch-story-index.ts   # Storybook story index fetcher
├── tests/
│   ├── cross-framework-visual.spec.ts  # Cross-framework visual parity
│   ├── custom-editors.spec.ts          # Custom editor tests
│   ├── master-detail.spec.ts           # Master-detail panel tests
│   ├── performance-regression.spec.ts  # Performance regression tests
│   ├── virtualization-stability.spec.ts # Virtualization stability tests
│   ├── utils.ts                        # Shared test utilities
│   └── storybook/                      # Storybook-specific tests
└── test-results/             # Generated test artifacts (gitignored)
```

## How It Works

### Demo URLs

| Demo    | URL                   | Port |
| ------- | --------------------- | ---- |
| Vanilla | http://localhost:4000 | 4000 |
| React   | http://localhost:4300 | 4300 |
| Angular | http://localhost:4200 | 4200 |

### Visual Comparison Strategy

1. **Baseline**: Vanilla demo screenshots are used as the baseline
2. **Masking**: Shell header titles are masked (they contain framework names)
3. **Tolerance**: Small anti-aliasing differences are allowed (1% pixel diff)

### Test Categories

#### 1. Visual Parity Tests

- Initial grid render comparison
- Custom renderer screenshots (status badges, ratings, etc.)
- Editor appearance when activated
- Detail panel content
- Responsive mobile layout

#### 2. Functional Parity Tests

- Sorting interaction
- Row selection
- Keyboard navigation
- Column resizing

#### 3. Data Consistency Tests

- Same number of rows displayed
- Same column headers

## Updating Tests

### When to Update Snapshots

Update snapshots when you've made intentional visual changes to the grid or demos:

```bash
bun nx e2e:update-snapshots e2e
```

### Adding New Tests

1. Add test cases to `tests/cross-framework-visual.spec.ts`
2. Follow the existing pattern of testing across all three demos
3. Use the provided helper functions (`waitForGridReady`, `hideShellTitle`, etc.)

## CI Integration

The E2E tests are automatically run in CI as part of the validation pipeline:

1. **After build**: E2E tests run after the build job succeeds
2. **Blocks release**: Release-please only runs if E2E tests pass
3. **Report artifact**: Playwright HTML report is uploaded as a build artifact

The CI workflow:

- Installs Playwright browsers (Chromium only for speed)
- Builds the grid library
- Spins up all three demo servers
- Runs visual regression tests
- Uploads the HTML report for debugging

See `.github/workflows/ci.yml` for the full configuration.

## Troubleshooting

### Tests Timeout

If demos don't start in time:

1. Increase `webServer.timeout` in `playwright.config.ts`
2. Check that ports 4000, 4300, 4200 are available

### Screenshot Differences

If screenshots fail:

1. Run with `--update-snapshots` if changes are intentional
2. Check if framework-specific styling leaked through
3. Increase `maxDiffPixelRatio` for more tolerance

### Demo Won't Start

1. Ensure grid library is built: `bun nx build grid`
2. Check for port conflicts
3. Run demos manually first to verify they work
