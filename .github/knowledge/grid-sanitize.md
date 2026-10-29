---
domain: grid-sanitize
related: [grid-render-pipeline, grid-plugins-editing, grid-core]
---

# Sanitize & Template Security — Mental Model

`libs/grid/src/lib/core/internal/sanitize.ts`: the HTML sanitizer every renderer string passes through, the `{{ }}` template evaluator, and the editor-markup scrub.

- Scheduling, virtualization, `rows.ts` patch path (the CALLERS of `setSanitizedHTML`) → grid-render-pipeline.md.
- Editor injection, commit/cancel, keyboard guards (the CALLERS of `scrubEditorMarkup` / `compileTemplate(…, keepMarkupWhenEmpty)`) → grid-plugins-editing.md.

Read order for "row data executed / rendered as markup": `setSanitizedHTML` INVARIANT (did the string go through it?) → `sanitizeNode` attribute rules (URL normaliser, `is=`) → `evalTemplateString` escaping → the editor EXEMPTION.

## sanitize.ts

- INVARIANT: EVERY string a **user renderer** returns into `innerHTML` MUST pass `sanitizeHTML()`. NO opt-out config — do not add one. Covered: `rows.ts` (6 sites), `header.ts`, `empty.ts`, `loading.ts`, `dom-builder.ts`, `base-plugin.ts`, `context-menu/menu.ts`, `grouping-columns`, `master-detail.ts`, `shell.ts`. Grep `innerHTML =` before merging a new renderer — recurring miss = hand-written `string` branch beside a correct `HTMLElement` one.
- INVARIANT: **`setSanitizedHTML(el, html)` is the ONLY sanctioned way to put a computed string into the DOM** — sanitizes into a `DocumentFragment` + `replaceChildren()`; no parse→serialize→re-parse, so mXSS round trips are impossible. `sanitizeToFragment()` = fragment variant (append into existing content). `sanitizeHTML()` returns a STRING, kept only where needed (`shell.ts` `iconToString()`, toolbar templates).
- ENFORCED: ESLint `no-restricted-syntax` ([eslint.config.mjs](eslint.config.mjs)) fails the build on `X.innerHTML = <computed>` under `libs/grid/src/lib/**`. Allowed RHS: string literal, zero-expression template literal, `sanitizeHTML(...)`, `booleanCellHTML(...)`. Ignores specs/benches + `internal/sanitize.ts`. `math` ∈ `DANGEROUS_TAGS` (foreign-content mXSS gadget); `svg` allowed for icons.
- INVARIANT (Aug 2026 audit S3): `is=` ALWAYS stripped, right after the `DANGEROUS_ATTR_PATTERN` event-handler check — upgrades an allow-listed tag into a registered customized built-in, past the tag-name allow-list. Test: `sanitize-security.spec.ts > strips the \`is=\` attribute`.
- INVARIANT (PR #578 review, URL schemes): `sanitizeNode` tests `DANGEROUS_URL_PROTOCOL` against `normalizeUrlForSchemeCheck(value)` — leading/trailing U+0000–U+0020 stripped, embedded `\t\n\r` removed — NOT the raw attribute. WHY: the URL parser does exactly that before reading the scheme, so `java\tscript:` / `\u0001javascript:` execute while a raw-regex check passes them. The DOM-based pass already sees entity-decoded values (`&#9;` → tab). Any new scheme/URL check MUST go through the same normaliser. Tests: `sanitize.spec.ts` › "obfuscated with embedded tab/newline".
- EXEMPTION (only one): `plugins/editing/internal/editor-injection.ts` assigns editor markup via raw `innerHTML` with an inline `eslint-disable-next-line`, then runs `scrubEditorMarkup(root)` in place (`sanitizeNode` with `keepTags` = input/button/textarea/select). WHY: the full sanitizer strips those controls — every editor. Attribute rules (event handlers, `is`, URL schemes, `style`) still apply and other dangerous tags are dropped; `{{ }}` values are escaped by the compiled template, but escaping alone leaves `href="{{ row.url }}"` = `javascript:` intact — hence the scrub. TENSION: column editor = code-trust boundary — do NOT make editor specs loadable from a remote/serialized source. Tests: `sanitize.spec.ts` › "scrubEditorMarkup".
- DECIDED (audit 2026-08-07): `evalTemplateString` HTML-escapes `{{ }}` values via `escapeHtml`. WHY: template markup is author-controlled, row data is not; `sanitizeHTML` strips only _dangerous_ markup, so unescaped values allowed layout-breaking / overlay clickjacking. Escape the VALUES, never the template. Spec: `sanitize-security.spec.ts`.
- DECIDED (PR #578, `keepMarkupWhenEmpty`): `evalTemplateString`/`compileTemplate` return `''` when EVERY `{{ }}` is blank (view: all-blank cell renders nothing). Editor templates MUST pass `{ keepMarkupWhenEmpty: true }` — the markup IS the control; `<input value="{{ value }}">` on a `null` cell otherwise renders no editor. Forbidden tokens still → `''`. Editor compile is plugin-owned (`renderTemplateEditor` lazy `??=`, `EditingPlugin#seedTypeEditorsFromLightDom`); config-manager compiles `__compiledView` ONLY. Tests: `sanitize.spec.ts`, `editor-injection.spec.ts`, `type-defaults.spec.ts` › "…blank".
