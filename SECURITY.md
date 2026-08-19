# Security Policy

## Supported Versions

Only the current major receives security updates. When a new major is released, prior majors are no longer supported.

| Version | Supported          |
| ------- | ------------------ |
| 3.x     | :white_check_mark: |
| < 3.0   | :x:                |

See the [Platform & Support policy](https://toolboxjs.com/grid/guides/platform/) for the full commitment: adapter support matrix, browser baseline, deprecation window, and release cadence.

## Reporting a Vulnerability

This is an open-source project and we value full transparency. Security vulnerabilities can be reported through:

1. **GitHub Issues**: Open a [new issue](https://github.com/OysteinAmundsen/toolbox/issues/new) with the `security` label
2. **GitHub Security Advisories**: Use the "Report a vulnerability" button on the [Security tab](https://github.com/OysteinAmundsen/toolbox/security/advisories/new) if you prefer private disclosure

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

This is a solo-maintained open-source project. Security issues will be addressed as time permits, with critical vulnerabilities prioritized.

For priority support, consider sponsoring via [GitHub Sponsors](https://github.com/sponsors/OysteinAmundsen) or [Patreon](https://patreon.com/OysteinAmundsen).

### After Reporting

- You'll receive acknowledgment when the issue is reviewed
- Credit will be given in the release notes (unless you prefer anonymity)

## Security Best Practices for Users

When using `@toolbox-web/grid`:

- Keep the package updated to the latest version
- The grid includes built-in template sanitization with blocked tokens and XSS prevention
- If extending or customizing template evaluation, review the sanitization behavior
