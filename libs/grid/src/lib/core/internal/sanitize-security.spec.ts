/**
 * Security regression tests for the sanitizer hardening pass.
 *
 * Each block here pins a fix for a specific injection sink. They are separated
 * from `sanitize.spec.ts` (which covers behaviour) so a failure here reads
 * unambiguously as "a security guarantee regressed".
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { evalTemplateString, sanitizeToFragment, setSanitizedHTML } from './sanitize';

describe('setSanitizedHTML', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
  });

  it('strips event handler attributes from renderer output', () => {
    setSanitizedHTML(host, '<img src="x" onerror="alert(1)">');
    const img = host.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.hasAttribute('onerror')).toBe(false);
  });

  it('strips script elements', () => {
    setSanitizedHTML(host, 'safe<script>alert(1)</script>');
    expect(host.querySelector('script')).toBeNull();
    expect(host.textContent).toBe('safe');
  });

  it('strips MathML, which is a foreign-content mXSS gadget', () => {
    setSanitizedHTML(host, '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>');
    expect(host.querySelector('math')).toBeNull();
    expect(host.querySelector('img')?.hasAttribute('onerror') ?? false).toBe(false);
  });

  it('strips javascript: URLs', () => {
    setSanitizedHTML(host, '<a href="javascript:alert(1)">click</a>');
    expect(host.querySelector('a')?.getAttribute('href')).toBeNull();
  });

  it('replaces previous content rather than appending', () => {
    setSanitizedHTML(host, '<span>first</span>');
    setSanitizedHTML(host, '<span>second</span>');
    expect(host.querySelectorAll('span')).toHaveLength(1);
    expect(host.textContent).toBe('second');
  });

  it('clears the element for empty or non-string input', () => {
    setSanitizedHTML(host, '<span>content</span>');
    setSanitizedHTML(host, '');
    expect(host.childNodes).toHaveLength(0);

    setSanitizedHTML(host, '<span>content</span>');
    setSanitizedHTML(host, null as unknown as string);
    expect(host.childNodes).toHaveLength(0);
  });

  it('takes the plain-text fast path for markup-free strings', () => {
    setSanitizedHTML(host, 'just text');
    expect(host.childNodes).toHaveLength(1);
    expect(host.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(host.textContent).toBe('just text');
  });

  it('still decodes entities rather than showing them raw', () => {
    setSanitizedHTML(host, 'Tom &amp; Jerry');
    expect(host.textContent).toBe('Tom & Jerry');
  });

  it('does not re-parse sanitized markup (no mutation-XSS round trip)', () => {
    // The classic mXSS payload: safe once parsed, dangerous if the sanitized
    // string is serialized and parsed a second time.
    setSanitizedHTML(host, '<noscript><p title="</noscript><img src=x onerror=alert(1)>">');
    expect(host.querySelector('img')?.hasAttribute('onerror') ?? false).toBe(false);
  });
});

describe('sanitizeToFragment', () => {
  it('returns a DocumentFragment with sanitized nodes', () => {
    const frag = sanitizeToFragment('<b>bold</b><img src="x" onerror="alert(1)">');
    expect(frag).toBeInstanceOf(DocumentFragment);
    expect(frag.querySelector('b')?.textContent).toBe('bold');
    expect(frag.querySelector('img')?.hasAttribute('onerror')).toBe(false);
  });

  it('returns an empty fragment for empty input', () => {
    expect(sanitizeToFragment('').childNodes).toHaveLength(0);
  });
});

describe('evalTemplateString escaping', () => {
  it('escapes interpolated values so row data cannot inject markup', () => {
    const out = evalTemplateString('{{ row.name }}', { value: null, row: { name: '<img src=x onerror=alert(1)>' } });
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('escapes quotes so a value cannot break out of an attribute', () => {
    const out = evalTemplateString('<a title="{{ value }}">x</a>', { value: '" onmouseover="alert(1)', row: {} });
    expect(out).not.toContain('onmouseover="');
  });

  it('leaves the author-controlled template markup intact', () => {
    const out = evalTemplateString('<b>{{ value }}</b>', { value: 'hi', row: {} });
    expect(out).toBe('<b>hi</b>');
  });
});
