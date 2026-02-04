// Centralized template expression evaluation & sanitization utilities.
// Responsible for safely interpolating {{ }} expressions while blocking
// access to dangerous globals / reflective capabilities.
import type { CompiledViewFunction, EvalContext } from '../types';

// #region Constants
const EXPR_RE = /{{\s*([^}]+)\s*}}/g;
const EMPTY_SENTINEL = '__DG_EMPTY__';
const SAFE_EXPR = /^[\w$. '?+\-*/%:()!<>=,&|]+$/;
const FORBIDDEN =
  /__(proto|defineGetter|defineSetter)|constructor|window|globalThis|global|process|Function|import|eval|Reflect|Proxy|Error|arguments|document|location|cookie|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|Worker|SharedWorker|ServiceWorker|opener|parent|top|frames|self|this\b/;
// #endregion

// #region HTML Sanitization

/**
 * Escape a plain text string for safe insertion into HTML.
 * Converts special HTML characters to their entity equivalents.
 *
 * @param text - Plain text string to escape
 * @returns HTML-safe string
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tags that are considered dangerous and will be completely removed.
 * These can execute scripts, load external resources, or manipulate the page.
 */
const DANGEROUS_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'link',
  'meta',
  'base',
  'style',
  'template',
  'slot',
  'portal',
  'frame',
  'frameset',
  'applet',
  'noscript',
  'noembed',
  'plaintext',
  'xmp',
  'listing',
]);

/**
 * Attributes that are considered dangerous - event handlers and data loading.
 */
const DANGEROUS_ATTR_PATTERN = /^on\w+$/i;

/**
 * Attributes that can contain URLs which might be javascript: or data: URIs.
 */
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'data', 'srcdoc', 'xlink:href', 'poster', 'srcset']);

/**
 * Protocol patterns that are dangerous in URLs.
 */
const DANGEROUS_URL_PROTOCOL = /^\s*(javascript|vbscript|data|blob):/i;

/**
 * Sanitize an HTML string by removing dangerous tags and attributes.
 * This is a defense-in-depth measure for content rendered via innerHTML.
 *
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string safe for innerHTML
 */
export function sanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // Fast path: if no HTML tags at all, return as-is (already safe)
  if (html.indexOf('<') === -1) return html;

  const template = document.createElement('template');
  template.innerHTML = html;

  sanitizeNode(template.content);

  return template.innerHTML;
}

/**
 * Recursively sanitize a DOM node tree.
 */
function sanitizeNode(root: DocumentFragment | Element): void {
  const toRemove: Element[] = [];

  // Use querySelectorAll to find all elements, then filter
  const elements = root.querySelectorAll('*');

  for (const el of elements) {
    const tagName = el.tagName.toLowerCase();

    // Check if tag is dangerous
    if (DANGEROUS_TAGS.has(tagName)) {
      toRemove.push(el);
      continue;
    }

    // SVG elements need special handling - they can contain script-like behavior
    if (tagName === 'svg' || el.namespaceURI === 'http://www.w3.org/2000/svg') {
      // Remove entire SVG if it has any suspicious attributes
      const hasDangerousContent = Array.from(el.attributes).some(
        (attr) => DANGEROUS_ATTR_PATTERN.test(attr.name) || attr.name === 'href' || attr.name === 'xlink:href',
      );
      if (hasDangerousContent) {
        toRemove.push(el);
        continue;
      }
    }

    // Check and remove dangerous attributes
    const attrsToRemove: string[] = [];
    for (const attr of el.attributes) {
      const attrName = attr.name.toLowerCase();

      // Event handlers (onclick, onerror, onload, etc.)
      if (DANGEROUS_ATTR_PATTERN.test(attrName)) {
        attrsToRemove.push(attr.name);
        continue;
      }

      // URL attributes with dangerous protocols
      if (URL_ATTRS.has(attrName) && DANGEROUS_URL_PROTOCOL.test(attr.value)) {
        attrsToRemove.push(attr.name);
        continue;
      }

      // style attribute can contain expressions (IE) or url() with javascript:
      if (attrName === 'style' && /expression\s*\(|javascript:|behavior\s*:/i.test(attr.value)) {
        attrsToRemove.push(attr.name);
        continue;
      }
    }

    attrsToRemove.forEach((name) => el.removeAttribute(name));
  }

  // Remove dangerous elements (do this after iteration to avoid modifying during traversal)
  toRemove.forEach((el) => el.remove());
}

// #endregion

// #region Template Evaluation
export function evalTemplateString(raw: string, ctx: EvalContext): string {
  if (!raw || raw.indexOf('{{') === -1) return raw; // fast path (no expressions)
  const parts: { expr: string; result: string }[] = [];
  const evaluated = raw.replace(EXPR_RE, (_m, expr) => {
    const res = evalSingle(expr, ctx);
    parts.push({ expr: expr.trim(), result: res });
    return res;
  });
  const finalStr = postProcess(evaluated);
  // If every part evaluated to EMPTY_SENTINEL we treat this as intentionally blank.
  // If any expression was blocked due to forbidden token (EMPTY_SENTINEL) we *still* only output ''
  // but do not escalate to BLOCKED_SENTINEL unless the original contained explicit forbidden tokens.
  const allEmpty = parts.length && parts.every((p) => p.result === '' || p.result === EMPTY_SENTINEL);
  const hadForbidden = /Reflect\.|\bProxy\b|ownKeys\(/.test(raw);
  if (hadForbidden || allEmpty) return '';
  return finalStr;
}

function evalSingle(expr: string, ctx: EvalContext): string {
  expr = (expr || '').trim();
  if (!expr) return EMPTY_SENTINEL;
  if (/\b(Reflect|Proxy|ownKeys)\b/.test(expr)) return EMPTY_SENTINEL;
  if (expr === 'value') return ctx.value == null ? EMPTY_SENTINEL : String(ctx.value);
  if (expr.startsWith('row.') && !/[()?]/.test(expr) && !expr.includes(':')) {
    const key = expr.slice(4);
    const v = ctx.row ? ctx.row[key] : undefined;
    return v == null ? EMPTY_SENTINEL : String(v);
  }
  if (expr.length > 80) return EMPTY_SENTINEL;
  if (!SAFE_EXPR.test(expr) || FORBIDDEN.test(expr)) return EMPTY_SENTINEL;
  const dotChain = expr.match(/\./g);
  if (dotChain && dotChain.length > 1) return EMPTY_SENTINEL;
  try {
    const fn = new Function('value', 'row', `return (${expr});`);
    const out = fn(ctx.value, ctx.row);
    const str = out == null ? '' : String(out);
    if (/Reflect|Proxy|ownKeys/.test(str)) return EMPTY_SENTINEL;
    return str || EMPTY_SENTINEL;
  } catch {
    return EMPTY_SENTINEL;
  }
}
// #endregion

// #region Cell Scrubbing
function postProcess(s: string): string {
  if (!s) return s;
  return s
    .replace(new RegExp(EMPTY_SENTINEL, 'g'), '')
    .replace(/Reflect\.[^<>{}\s]+/g, '')
    .replace(/\bProxy\b/g, '')
    .replace(/ownKeys\([^)]*\)/g, '');
}

export function finalCellScrub(cell: HTMLElement): void {
  if (/Reflect|Proxy|ownKeys/.test(cell.textContent || '')) {
    Array.from(cell.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE && /Reflect|Proxy|ownKeys/.test(n.textContent || '')) n.textContent = '';
    });
    if (/Reflect|Proxy|ownKeys/.test(cell.textContent || '')) {
      // If remaining content still includes forbidden tokens inside element nodes, clear children entirely.
      const still = /Reflect|Proxy|ownKeys/.test(cell.textContent || '');
      if (still) {
        while (cell.firstChild) cell.removeChild(cell.firstChild);
      }
      cell.textContent = (cell.textContent || '').replace(/Reflect|Proxy|ownKeys/g, '');
    }
    if ((cell.textContent || '').trim().length === 0) cell.textContent = '';
  }
}
// #endregion

// #region Template Compilation
export function compileTemplate(raw: string) {
  const forceBlank = /Reflect\.|\bProxy\b|ownKeys\(/.test(raw);
  const fn = ((ctx: EvalContext) => {
    if (forceBlank) return '';
    const out = evalTemplateString(raw, ctx);
    return out;
  }) as CompiledViewFunction;
  fn.__blocked = forceBlank;
  return fn;
}
// #endregion
