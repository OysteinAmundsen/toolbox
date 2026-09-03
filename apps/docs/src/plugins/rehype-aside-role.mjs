/**
 * Starlight renders `:::note` / `:::tip` / `:::caution` / `:::danger` callouts as
 * `<aside aria-label="Note">`. `<aside>` is an implicit `complementary` landmark,
 * so a page carrying two untitled notes ends up with two identically-named
 * landmarks — axe `landmark-unique`, and genuinely confusing when a screen-reader
 * user pulls up the landmark list on a page with eight "Note" regions.
 *
 * These callouts are inline annotations, not page-level complementary regions,
 * so `role="note"` is the accurate mapping: it is a non-landmark role, keeps the
 * "note" announcement, and preserves the existing `aria-label`.
 *
 * Applied globally (including TypeDoc-generated pages) via `markdown.rehypePlugins`.
 */
export function rehypeAsideRole() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== 'element' || node.tagName !== 'aside') return;
      const className = node.properties?.className;
      const classes = Array.isArray(className)
        ? className
        : typeof className === 'string'
          ? className.split(/\s+/)
          : [];
      if (!classes.includes('starlight-aside')) return;
      node.properties = { ...node.properties, role: 'note' };
    });
  };
}

/** Minimal depth-first walk — avoids pulling `unist-util-visit` in just for this. */
function visit(node, fn) {
  fn(node);
  for (const child of node.children ?? []) visit(child, fn);
}

export default rehypeAsideRole;
