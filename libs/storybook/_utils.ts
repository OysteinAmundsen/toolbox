/**
 * Build a DOM element containing a sticky toggle button that switches exclusively between
 * (a) the live grid element and (b) formatted HTML + JS code blocks. The button stays at the
 * top (position:sticky) so it remains visible while scrolling either view.
 *
 * @param gridEl - The grid element to display
 * @param htmlMarkup - HTML snippet to show in code view
 * @param jsCode - JavaScript snippet to show in code view
 * @param options - Configuration options
 * @param options.start - Initial view mode ('grid' or 'code'), default 'grid'
 * @param options.sessionKey - Key for persisting view mode across arg changes
 * @param options.description - Optional HTML content shown above the grid in result view
 *                              (not included in code snippets). Use for explaining the
 *                              functionality in plain English.
 *
 * Usage:
 *   const ui = buildExclusiveGridCodeView(gridElement, htmlSnippet, jsSnippet, {
 *     description: '<p>Click on a row to select it. Hold Shift to select a range.</p>'
 *   });
 *   return ui; // from a Storybook render function
 */
const __dgSessionViewModes = new Map<string, 'grid' | 'code'>();
export function clearExclusiveGridViewCache() {
  __dgSessionViewModes.clear();
}

/**
 * Plugin metadata for generating import code in code view.
 * With class-based plugins, we only need to import the class - no registration needed.
 */
export interface PluginCodeMeta {
  /** Class name of the plugin, e.g. 'SelectionPlugin' */
  className: string;
  /** Path relative to @toolbox-web/grid/, e.g. 'plugins/selection' */
  path: string;
}

export function buildExclusiveGridCodeView(
  gridEl: HTMLElement,
  htmlMarkup: string,
  jsCode: string,
  {
    start = 'grid',
    sessionKey,
    description,
    plugins,
  }: {
    start?: 'grid' | 'code';
    sessionKey?: string;
    description?: string;
    /** Plugin metadata for generating import/registration code */
    plugins?: PluginCodeMeta[];
  } = {}
) {
  const wrapper = document.createElement('div');
  wrapper.className = 'dg-view-wrapper';

  // Sticky control bar
  const bar = document.createElement('div');
  bar.className = 'dg-view-bar';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'dg-toggle-btn';
  toggleBtn.setAttribute('aria-pressed', start === 'code' ? 'true' : 'false');

  const gridContainer = document.createElement('div');
  gridContainer.className = 'dg-grid-container';

  gridContainer.appendChild(gridEl);

  // Optional description HTML (shown below grid in result view only, not in code)
  if (description) {
    const descEl = document.createElement('div');
    descEl.className = 'dg-description';
    descEl.innerHTML = description;
    gridContainer.appendChild(descEl);
  }

  const codeContainer = document.createElement('div');
  codeContainer.className = 'dg-code-container';

  const htmlFormatted = formatHtml(
    htmlMarkup
      .replace(/\s+(role|tabindex)="[^"]*"/g, '')
      .replace(/\s+aria-[a-zA-Z0-9_-]+="[^"]*"/g, '')
      .replace(/ style="\s*"/g, '')
      .trim()
  );
  const jsFormatted = /\n/.test(jsCode.trim()) ? jsCode.trim() : formatJs(jsCode.trim());

  // Build the JavaScript preamble with optional plugin imports
  let jsPreamble = `import '@toolbox-web/grid';`;

  if (plugins && plugins.length > 0) {
    // Add plugin class imports
    for (const plugin of plugins) {
      jsPreamble += `\nimport { ${plugin.className} } from '@toolbox-web/grid/${plugin.path}';`;
    }
  }

  jsPreamble += `\n\nconst grid = document.querySelector('tbw-grid');`;

  codeContainer.innerHTML = `
    <div class="dg-code-heading">HTML</div>
    <pre class="dg-code-block"><code class="hljs language-html">${escapeHtml(htmlFormatted)}</code></pre>
    <div class="dg-code-heading">JavaScript</div>
    <pre class="dg-code-block"><code class="hljs language-javascript">${escapeHtml(jsPreamble)}
${escapeHtml(jsFormatted)}
    </code></pre>`;

  function setMode(mode: 'grid' | 'code') {
    const showCode = mode === 'code';
    gridContainer.style.display = showCode ? 'none' : '';
    codeContainer.style.display = showCode ? 'block' : 'none';
    toggleBtn.textContent = showCode ? 'Show Grid' : 'Show Markup';
    toggleBtn.setAttribute('aria-pressed', String(showCode));
    if (sessionKey) __dgSessionViewModes.set(sessionKey, showCode ? 'code' : 'grid');
  }

  toggleBtn.addEventListener('click', () => {
    const showingCode = toggleBtn.getAttribute('aria-pressed') === 'true';
    setMode(showingCode ? 'grid' : 'code');
  });

  bar.appendChild(toggleBtn);
  wrapper.appendChild(bar);
  wrapper.appendChild(gridContainer);
  wrapper.appendChild(codeContainer);

  // Initialize: prefer session cached mode if available (arg changes), otherwise start param
  let initial = start;
  if (sessionKey && __dgSessionViewModes.has(sessionKey)) {
    initial = __dgSessionViewModes.get(sessionKey)!;
  }
  setMode(initial as 'grid' | 'code');
  return wrapper;
}

export function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Minimal HTML pretty-printer (non-robust but good for examples)
export function formatHtml(src: string) {
  try {
    // Remove leading/trailing whitespace lines
    const trimmed = src.trim();
    const tokens = trimmed
      // Add newlines before tags
      .replace(/></g, '>$BREAK$<')
      .split('$BREAK$');
    let indent = 0;
    const lines: string[] = [];
    for (const raw of tokens) {
      const line = raw.trim();
      if (!line) continue;
      const isClosing = /^<\//.test(line);
      const selfClosing =
        /\/>$/.test(line) || /^<!/.test(line) || (/^<[^>]+>$/.test(line) && /^(<link|<meta|<img|<br|<hr)/.test(line));
      if (isClosing) indent = Math.max(indent - 1, 0);
      lines.push('  '.repeat(indent) + line);
      if (!isClosing && !selfClosing && !/^<.*>.*<\/.*>$/.test(line)) indent++;
    }
    return lines.join('\n');
  } catch {
    return src;
  }
}

// Very lightweight JS formatter (heuristic; for display only). For full fidelity we could integrate prettier later.
export function formatJs(src: string) {
  try {
    // Insert newlines after semicolons and before key tokens when missing
    const out = src
      .replace(/;(?=\S)/g, ';\n')
      .replace(/\b(const|let|function|return|if|for|while)\b/g, '\n$1')
      .replace(/\n{2,}/g, '\n');
    // Simple indent based on braces
    const lines = out.split(/\n/);
    let indent = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        lines[i] = '';
        continue;
      }
      if (/^[}\]]/.test(line)) indent = Math.max(indent - 1, 0);
      lines[i] = '  '.repeat(indent) + line;
      if (/[{[]\s*$/.test(line)) indent++;
    }
    return lines.join('\n').trim();
  } catch {
    return src;
  }
}

export function extractCode(fn: (...args: unknown[]) => unknown, args?: Record<string, unknown>) {
  const src = fn.toString();

  // Match classic function
  let m = src.match(/^function\s*[^(]*\([^)]*\)\s*{([\s\S]*?)}$/);
  // Or arrow function with block
  if (!m) m = src.match(/^\([^)]*\)\s*=>\s*{([\s\S]*?)}$/);
  if (!m) return src; // fallback: return raw

  const body = m[1]
    // strip leading/trailing blank lines
    .replace(/^\s*\n/, '')
    .replace(/\n\s*$/, '');

  // Normalize indentation based on minimal indent of non-empty lines
  const lines = body.split('\n');
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)?.[0].length || 0);
  const min = indents.length ? Math.min(...indents) : 0;
  let code = lines.map((l) => l.slice(min)).join('\n');
  // Placeholder substitution: replace __$key$ with args[key] string value
  if (args && typeof args === 'object') {
    code = code.replace(/__\$([a-zA-Z0-9_]+)\$/g, (match, key) => {
      if (Object.prototype.hasOwnProperty.call(args, key)) {
        const v = args[key];
        if (v == null) return '';
        if (typeof v === 'object') return JSON.stringify(v, null, 2);
        return String(v);
      }
      return match; // leave token intact if not found
    });
  }
  code = code.replace(/\/\*\s*@__PURE__\s*\*\//g, '');
  return code;
}
