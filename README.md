# Toolbox Web

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤-ea4aaa?logo=github)](https://github.com/sponsors/OysteinAmundsen)

A monorepo for **framework-agnostic web component libraries** built with pure TypeScript. Components work natively in vanilla JS, React, Vue, Angular, Svelte, and any other framework.

## Libraries

| Package                           | Description                                                          | Docs                          |
| --------------------------------- | -------------------------------------------------------------------- | ----------------------------- |
| [`@toolbox-web/grid`](libs/grid/) | High-performance data grid with virtualization, plugins, and theming | [README](libs/grid/README.md) |

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
  themes/         # Shared theme system
  storybook/      # Shared Storybook utilities
apps/
  storybook-app/  # Unified Storybook application
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

## Architecture

### Design Philosophy

- **Zero framework lock-in**: Pure web components using standard APIs
- **Shadow DOM**: Encapsulated styles that don't leak
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
[![Patreon](https://img.shields.io/badge/Support_on_Patreon-f96854?style=for-the-badge&logo=patreon)](https://patreon.com/user?u=40656340)

## License

MIT
