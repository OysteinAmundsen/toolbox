# Contributing to Toolbox Web

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- Node.js 18+ (for some tooling compatibility)
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/OysteinAmundsen/toolbox.git
cd toolbox

# Install dependencies
bun install

# Start Storybook for development
bun start

# Run tests
bun run test
```

## Project Structure

```
libs/
  grid/           # @toolbox-web/grid - Data grid component
  themes/         # Shared CSS themes
  storybook/      # Shared Storybook utilities
apps/
  storybook-app/  # Unified Storybook application
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/). This enables automatic changelog generation.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | Description                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature                                             |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation only                                      |
| `style`    | Code style (formatting, semicolons, etc.)               |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                 |
| `test`     | Adding or updating tests                                |
| `chore`    | Maintenance tasks                                       |
| `ci`       | CI/CD changes                                           |

### Scopes

- `grid` - Changes to @toolbox-web/grid
- `themes` - Changes to shared themes
- `storybook` - Changes to Storybook setup

### Examples

```bash
feat(grid): add column auto-sizing on double-click
fix(grid): selection persists after data refresh
docs(grid): update TreePlugin README with examples
test(grid): add integration tests for row grouping
chore: update dependencies
```

## Pull Request Process

1. **Fork & Branch**: Create a feature branch from `main`

   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make Changes**: Follow existing code patterns and conventions

3. **Test**: Ensure all tests pass

   ```bash
   bun nx test grid
   ```

4. **Lint**: Check for linting errors

   ```bash
   bun run lint
   ```

5. **Commit**: Use conventional commit format

6. **Push & PR**: Open a pull request against `main`

## Code Guidelines

### TypeScript

- Use strict TypeScript (`strict: true`)
- Prefer explicit types over `any`
- Use ES private fields (`#privateField`) for internal state

### Testing

- **Unit tests**: Co-locate with source files (`feature.ts` → `feature.spec.ts`)
- **Integration tests**: Place in `src/__tests__/integration/`
- Aim for meaningful coverage, not 100%

### Components

- Use Shadow DOM for style encapsulation
- Expose theming via CSS custom properties
- Follow the plugin pattern for optional features

### Documentation

- Update README when adding features
- Add JSDoc comments for public APIs
- Include code examples in documentation

## Plugin Development

When creating a new plugin:

1. Create directory: `libs/grid/src/lib/plugins/<plugin-name>/`
2. Required files:

   - `index.ts` - Barrel exports
   - `<PluginName>Plugin.ts` - Plugin class
   - `types.ts` - TypeScript interfaces
   - `README.md` - Plugin documentation
   - `*.spec.ts` - Tests

3. Extend `BaseGridPlugin`:

   ```typescript
   export class MyPlugin extends BaseGridPlugin<MyConfig> {
     readonly name = 'myPlugin';
     readonly version = '1.0.0';
     // ...
   }
   ```

4. Export from plugin's `index.ts`

## Questions?

- Open an [issue](https://github.com/OysteinAmundsen/toolbox/issues) for bugs or feature requests
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
