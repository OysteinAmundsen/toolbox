import { describe, expect, it } from 'vitest';
import { compileTemplate, evalTemplateString, finalCellScrub, sanitizeHTML } from './sanitize';

describe('sanitize functions', () => {
  it('evaluates simple expressions and blanks forbidden tokens', () => {
    const out = evalTemplateString('Hello {{ value }} {{ row.name }}', { value: 'World', row: { name: 'DG' } });
    expect(out).toBe('Hello World DG');
    const blocked = evalTemplateString('Test {{ Reflect.ownKeys(value) }}', { value: 1, row: {} });
    expect(blocked).toBe('');
  });
  it('compileTemplate marks blocked templates', () => {
    const good = compileTemplate('Val: {{ value }}');
    expect((good as any).__blocked).toBe(false);
    const bad = compileTemplate('x {{ Reflect.get(value) }}');
    expect((bad as any).__blocked).toBe(true);
    expect(bad({ value: 1, row: {} })).toBe('');
  });
  it('finalCellScrub removes residual forbidden tokens', () => {
    const cell = document.createElement('div');
    cell.textContent = 'Proxy Reflect.ownKeys(foo) OK';
    finalCellScrub(cell);
    expect(/Reflect|Proxy|ownKeys/.test(cell.textContent || '')).toBe(false);
  });
});

describe('sanitizeHTML - XSS prevention', () => {
  describe('script injection', () => {
    it('removes script tags', () => {
      const result = sanitizeHTML('<div>Hello<script>alert(1)</script>World</div>');
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('removes script tags with attributes', () => {
      const result = sanitizeHTML('<script src="evil.js"></script>');
      expect(result).toBe('');
    });

    it('removes nested script attempts', () => {
      // This tests what browsers do with nested attempts
      const result = sanitizeHTML('<div><script>alert(1)</script></div>');
      expect(result).not.toContain('<script');
      expect(result).toContain('<div>');
    });
  });

  describe('event handler injection', () => {
    it('removes onclick handlers', () => {
      const result = sanitizeHTML('<div onclick="alert(1)">Click me</div>');
      expect(result).not.toContain('onclick');
      expect(result).toContain('Click me');
    });

    it('removes onerror handlers', () => {
      const result = sanitizeHTML('<img src="x" onerror="alert(1)">');
      expect(result).not.toContain('onerror');
    });

    it('removes onload handlers', () => {
      const result = sanitizeHTML('<body onload="alert(1)">Content</body>');
      expect(result).not.toContain('onload');
    });

    it('removes onmouseover handlers', () => {
      const result = sanitizeHTML('<a onmouseover="alert(1)">Hover</a>');
      expect(result).not.toContain('onmouseover');
    });

    it('removes onfocus handlers', () => {
      const result = sanitizeHTML('<input onfocus="alert(1)" autofocus>');
      expect(result).not.toContain('onfocus');
    });

    it('removes multiple event handlers', () => {
      const result = sanitizeHTML('<div onclick="a()" onmouseover="b()" onload="c()">Test</div>');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onmouseover');
      expect(result).not.toContain('onload');
    });
  });

  describe('javascript: URL injection', () => {
    it('removes javascript: in href', () => {
      const result = sanitizeHTML('<a href="javascript:alert(1)">Click</a>');
      expect(result).not.toContain('javascript:');
      expect(result).toContain('Click');
    });

    it('removes javascript: in src', () => {
      const result = sanitizeHTML('<img src="javascript:alert(1)">');
      expect(result).not.toContain('javascript:');
    });

    it('removes javascript: with whitespace', () => {
      const result = sanitizeHTML('<a href="  javascript:alert(1)">Click</a>');
      expect(result).not.toContain('javascript:');
    });

    it('removes vbscript: URLs', () => {
      const result = sanitizeHTML('<a href="vbscript:MsgBox(1)">Click</a>');
      expect(result).not.toContain('vbscript:');
    });

    it('removes data: URLs', () => {
      const result = sanitizeHTML('<a href="data:text/html,<script>alert(1)</script>">Click</a>');
      expect(result).not.toContain('data:');
    });
  });

  describe('iframe injection', () => {
    it('removes iframe tags', () => {
      const result = sanitizeHTML('<iframe src="evil.html"></iframe>');
      expect(result).not.toContain('iframe');
    });

    it('removes iframe with srcdoc', () => {
      const result = sanitizeHTML('<iframe srcdoc="<script>alert(1)</script>"></iframe>');
      expect(result).not.toContain('iframe');
      expect(result).not.toContain('srcdoc');
    });
  });

  describe('dangerous tags', () => {
    it('removes object tags', () => {
      const result = sanitizeHTML('<object data="evil.swf"></object>');
      expect(result).not.toContain('object');
    });

    it('removes embed tags', () => {
      const result = sanitizeHTML('<embed src="evil.swf">');
      expect(result).not.toContain('embed');
    });

    it('removes form tags', () => {
      const result = sanitizeHTML('<form action="evil.php"><input></form>');
      expect(result).not.toContain('form');
      expect(result).not.toContain('input');
    });

    it('removes link tags', () => {
      const result = sanitizeHTML('<link rel="stylesheet" href="evil.css">');
      expect(result).not.toContain('link');
    });

    it('removes meta tags', () => {
      const result = sanitizeHTML('<meta http-equiv="refresh" content="0;url=evil.html">');
      expect(result).not.toContain('meta');
    });

    it('removes base tags', () => {
      const result = sanitizeHTML('<base href="https://evil.com">');
      expect(result).not.toContain('base');
    });

    it('removes style tags', () => {
      const result = sanitizeHTML('<style>body { background: url(evil.png); }</style>');
      expect(result).not.toContain('style');
    });
  });

  describe('SVG-based XSS', () => {
    it('removes SVG with onload', () => {
      const result = sanitizeHTML('<svg onload="alert(1)"></svg>');
      expect(result).not.toContain('onload');
    });

    it('removes SVG script elements', () => {
      const result = sanitizeHTML('<svg><script>alert(1)</script></svg>');
      expect(result).not.toContain('script');
    });
  });

  describe('safe content passthrough', () => {
    it('allows basic text content', () => {
      const result = sanitizeHTML('Hello World');
      expect(result).toBe('Hello World');
    });

    it('allows safe HTML elements', () => {
      const result = sanitizeHTML('<div><span class="test">Content</span></div>');
      expect(result).toContain('<div>');
      expect(result).toContain('<span');
      expect(result).toContain('class="test"');
    });

    it('allows safe attributes', () => {
      const result = sanitizeHTML('<div id="test" class="foo" data-value="bar">Content</div>');
      expect(result).toContain('id="test"');
      expect(result).toContain('class="foo"');
      expect(result).toContain('data-value="bar"');
    });

    it('allows safe img tags with http src', () => {
      const result = sanitizeHTML('<img src="https://example.com/image.png" alt="test">');
      expect(result).toContain('src="https://example.com/image.png"');
      expect(result).toContain('alt="test"');
    });

    it('allows safe anchor tags with http href', () => {
      const result = sanitizeHTML('<a href="https://example.com">Link</a>');
      expect(result).toContain('href="https://example.com"');
    });

    it('returns empty string for null/undefined', () => {
      expect(sanitizeHTML(null as any)).toBe('');
      expect(sanitizeHTML(undefined as any)).toBe('');
    });

    it('returns content as-is if no HTML tags', () => {
      const content = 'Just plain text with <no> issues';
      const result = sanitizeHTML(content);
      // The < will be parsed but <no> is a safe tag, so content preserved
      expect(result).toContain('plain text');
    });
  });

  describe('style attribute injection', () => {
    it('removes expression() in style (IE)', () => {
      const result = sanitizeHTML('<div style="width: expression(alert(1))">Test</div>');
      expect(result).not.toContain('expression');
    });

    it('removes javascript: in style url()', () => {
      const result = sanitizeHTML('<div style="background: url(javascript:alert(1))">Test</div>');
      expect(result).not.toContain('javascript:');
    });

    it('removes behavior: in style', () => {
      const result = sanitizeHTML('<div style="behavior: url(evil.htc)">Test</div>');
      expect(result).not.toContain('behavior');
    });

    it('allows safe style attributes', () => {
      const result = sanitizeHTML('<div style="color: red; font-size: 16px;">Test</div>');
      expect(result).toContain('style="color: red; font-size: 16px;"');
    });
  });
});
