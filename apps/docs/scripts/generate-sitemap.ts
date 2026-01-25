#!/usr/bin/env bun
/**
 * Generate sitemap.xml from Storybook's index.json manifest
 *
 * Run after build-storybook to create a sitemap for search engines.
 * Usage: bun apps/docs/scripts/generate-sitemap.ts
 *
 * SEO Strategy:
 * - Homepage (/) gets priority 1.0
 * - Introduction/Getting Started pages get priority 0.9
 * - Core feature docs get priority 0.8
 * - Plugin docs get priority 0.7
 * - API reference and other pages get priority 0.6
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

interface SitemapUrl {
  loc: string;
  priority: number;
  changefreq: 'daily' | 'weekly' | 'monthly';
}

/**
 * Determine SEO priority based on page type and importance
 */
function getPriority(entryId: string, title: string): { priority: number; changefreq: 'daily' | 'weekly' | 'monthly' } {
  const id = entryId.toLowerCase();
  const t = title.toLowerCase();

  // High priority - landing pages and getting started
  if (id.includes('introduction') || id.includes('getting-started') || t.includes('introduction')) {
    return { priority: 0.9, changefreq: 'weekly' };
  }

  // Core features - important for discoverability
  if (id.includes('core') || id.includes('theming') || id.includes('demos')) {
    return { priority: 0.8, changefreq: 'weekly' };
  }

  // Plugins - secondary but still valuable
  if (id.includes('plugin')) {
    return { priority: 0.7, changefreq: 'weekly' };
  }

  // API reference - detailed docs
  if (id.includes('api') || id.includes('reference')) {
    return { priority: 0.6, changefreq: 'monthly' };
  }

  // Default priority
  return { priority: 0.5, changefreq: 'monthly' };
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

  // Start with homepage at highest priority (no trailing slash to avoid duplicates)
  const urls: SitemapUrl[] = [{ loc: `${BASE_URL}/`, priority: 1.0, changefreq: 'daily' }];

  for (const entry of entries) {
    // Skip entries marked as hidden or internal
    if (entry.tags?.includes('hidden') || entry.tags?.includes('!autodocs')) {
      continue;
    }

    // Only include docs pages, not individual stories
    if (entry.type === 'docs') {
      const url = `${BASE_URL}/?path=/docs/${entry.id}`;
      const { priority, changefreq } = getPriority(entry.id, entry.title);
      urls.push({ loc: url, priority, changefreq });
    }
  }

  // Sort by priority (highest first) for better crawl budget allocation
  urls.sort((a, b) => b.priority - a.priority);

  // Generate sitemap XML
  const today = new Date().toISOString().split('T')[0];

  const urlElements = urls.map(
    ({ loc, priority, changefreq }) => `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`,
  );

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
                            http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlElements.join('\n')}
</urlset>
`;

  // Write sitemap
  const sitemapPath = join(OUTPUT_DIR, 'sitemap.xml');
  writeFileSync(sitemapPath, sitemap);

  console.log(`✅ Generated sitemap.xml`);
  console.log(`   📄 ${urls.length} pages (sorted by priority)`);
  console.log(`   📍 ${sitemapPath}`);

  // Generate robots.txt with SEO best practices
  const robotsPath = join(OUTPUT_DIR, 'robots.txt');
  const robots = `# Toolbox Grid Documentation
# https://toolboxjs.com

User-agent: *
Allow: /

# Sitemap location
Sitemap: ${BASE_URL}/sitemap.xml

# Crawl-delay suggestion (be nice to servers)
Crawl-delay: 1

# Block Storybook internal routes that aren't useful for SEO
Disallow: /?path=/story/*
Disallow: /*&globals=*
Disallow: /*viewMode=canvas*
`;
  writeFileSync(robotsPath, robots);
  console.log(`✅ Generated robots.txt`);
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
