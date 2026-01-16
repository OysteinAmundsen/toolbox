#!/usr/bin/env bun
/**
 * Generate sitemap.xml from Storybook's index.json manifest
 *
 * Run after build-storybook to create a sitemap for search engines.
 * Usage: bun apps/docs/scripts/generate-sitemap.ts
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Configuration
const BASE_URL = process.env.STORYBOOK_URL || 'https://toolboxjs.com';
const OUTPUT_DIR = join(process.cwd(), 'dist/docs');
const INDEX_JSON_PATH = join(OUTPUT_DIR, 'index.json');

interface StoryEntry {
  id: string;
  title: string;
  name: string;
  type: 'story' | 'docs' | 'component';
  tags?: string[];
}

interface StoriesManifest {
  v: number;
  entries: Record<string, StoryEntry>;
}

function generateSitemap(): void {
  // Check if index.json exists
  if (!existsSync(INDEX_JSON_PATH)) {
    console.error(`❌ index.json not found at ${INDEX_JSON_PATH}`);
    console.error('   Run build-storybook first.');
    process.exit(1);
  }

  const manifest: StoriesManifest = JSON.parse(readFileSync(INDEX_JSON_PATH, 'utf-8'));
  const entries = Object.values(manifest.entries);

  // Filter to docs pages (primary content) and main stories
  // Prioritize docs pages as they contain the main documentation
  const docsUrls: string[] = [];
  const storyUrls: string[] = [];

  for (const entry of entries) {
    // Skip entries marked as hidden or internal
    if (entry.tags?.includes('hidden') || entry.tags?.includes('!autodocs')) {
      continue;
    }

    const path = entry.type === 'docs' ? `docs/${entry.id}` : `story/${entry.id}`;
    const url = `${BASE_URL}/?path=/${path}`;

    if (entry.type === 'docs') {
      docsUrls.push(url);
    } else if (entry.type === 'story') {
      storyUrls.push(url);
    }
  }

  // Generate sitemap XML with priority weighting
  const today = new Date().toISOString().split('T')[0];

  const urlElements = [
    // Docs pages get higher priority
    ...docsUrls.map(
      (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
    ),
    // Story pages get lower priority
    ...storyUrls.map(
      (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`,
    ),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements.join('\n')}
</urlset>
`;

  // Write sitemap
  const sitemapPath = join(OUTPUT_DIR, 'sitemap.xml');
  writeFileSync(sitemapPath, sitemap);

  console.log(`✅ Generated sitemap.xml`);
  console.log(`   📄 ${docsUrls.length} docs pages`);
  console.log(`   📖 ${storyUrls.length} story pages`);
  console.log(`   📍 ${sitemapPath}`);

  // Also generate robots.txt if it doesn't exist
  const robotsPath = join(OUTPUT_DIR, 'robots.txt');
  if (!existsSync(robotsPath)) {
    const robots = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
    writeFileSync(robotsPath, robots);
    console.log(`✅ Generated robots.txt`);
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Run
generateSitemap();
