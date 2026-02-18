# Toolbox Web

[![CI/CD Pipeline](https://github.com/OysteinAmundsen/toolbox/actions/workflows/ci.yml/badge.svg)](https://github.com/OysteinAmundsen/toolbox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤-ea4aaa?logo=github)](https://github.com/sponsors/OysteinAmundsen)

A monorepo for **framework-agnostic web component libraries** built with pure TypeScript. Components work natively in vanilla JS, React, Vue, Angular, Svelte, and any other framework.

## Libraries

| Package                                                                                | Description                                                           | Docs                                  |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| [`@toolbox-web/grid`](https://www.npmjs.com/package/@toolbox-web/grid)                 | High-performance data grid with virtualization, plugins, and theming  | [README](libs/grid/README.md)         |
| [`@toolbox-web/grid-angular`](https://www.npmjs.com/package/@toolbox-web/grid-angular) | Angular adapter with directives for template-driven renderers/editors | [README](libs/grid-angular/README.md) |
| [`@toolbox-web/grid-react`](https://www.npmjs.com/package/@toolbox-web/grid-react)     | React adapter                                                         | [README](libs/grid-react/README.md)   |
| [`@toolbox-web/grid-vue`](https://www.npmjs.com/package/@toolbox-web/grid-vue)         | Vue 3 adapter                                                         | [README](libs/grid-vue/README.md)     |

## Quick Start

```bash
# Install dependencies
bun install

# Start Storybook (development)
bun start

# Build all libraries
bun run build

# Run all tests
bun run test
```

## Development

### Project Structure

```
libs/
  grid/           # @toolbox-web/grid - Data grid component
  grid-angular/   # @toolbox-web/grid-angular - Angular adapter
  grid-react/     # @toolbox-web/grid-react - React adapter
  grid-vue/       # @toolbox-web/grid-vue - Vue 3 adapter
  themes/         # Shared theme system
demos/
  employee-management/   # Full-featured demo applications
    shared/              # Shared types and data generators
    vanilla/             # Pure TypeScript/Vite demo
    angular/             # Angular 21 demo
    react/               # React 19 demo
    vue/                 # Vue 3 demo
apps/
  docs/           # Storybook documentation site
```

### Commands

```bash
# Development
bun start                    # Start Storybook
bun nx build <lib>           # Build a library
bun nx test <lib>            # Run tests for a library

# CI
bun run build                # Build all libraries
bun run test                 # Test all libraries
```

## AI/LLM Integration

This project includes [`llms.txt`](llms.txt) and [`llms-full.txt`](llms-full.txt) files following the [llms.txt specification](https://llmstxt.org/) to help AI assistants understand and work with the codebase:

- **`llms.txt`** - Concise overview with links to documentation
- **`llms-full.txt`** - Comprehensive implementation guide with migration patterns from AG Grid, TanStack Table, and ngx-datatable

## Architecture

### Design Philosophy

- **Zero framework lock-in**: Pure web components using standard APIs
- **Light DOM + CSS Nesting**: Render directly to element with scoped styles
- **Plugin system**: Extend functionality without bloating core
- **Virtualization**: Handle large datasets efficiently
- **Theming**: CSS custom properties for easy customization

### Adding a New Library

1. Create library: `bun nx g @nx/js:lib libs/<name> --publishable --importPath=@toolbox/<name>`
2. Add Vite config following `libs/grid/vite.config.ts` pattern
3. Add path mappings to `tsconfig.base.json`
4. Create stories in `libs/<name>/stories/`

## Tech Stack

- **Bun** - Package manager and runtime
- **Vite** - Build tool
- **Vitest** - Test runner
- **Storybook** - Component development
- **Nx** - Monorepo orchestration
- **TypeScript** - Type safety

## Support

Built and maintained by a solo developer. Sponsorship keeps this project alive:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor_on_GitHub-ea4aaa?style=for-the-badge&logo=github)](https://github.com/sponsors/OysteinAmundsen)
[![Patreon](https://img.shields.io/badge/Support_on_Patreon-f96854?style=for-the-badge&logo=patreon)](https://www.patreon.com/c/OysteinAmundsen)

## License

MIT
