/**
 * Playwright globalSetup script: fetches the Storybook story index
 * and writes it to a JSON file so test files can generate one test
 * per story at parse time (enabling parallel execution).
 *
 * If Storybook is not running, writes an empty array — tests will
 * skip gracefully.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const STORYBOOK_URL = 'http://localhost:4400';
const OUTPUT_PATH = resolve(__dirname, '..', 'test-results', 'story-index.json');

interface StoryIndexEntry {
  id: string;
  title: string;
  name: string;
  type: 'story' | 'docs';
}

export default async function globalSetup(): Promise<void> {
  // Ensure the output directory exists
  mkdirSync(resolve(__dirname, '..', 'test-results'), { recursive: true });

  try {
    const res = await fetch(`${STORYBOOK_URL}/index.json`);
    if (!res.ok) {
      console.warn(`⚠️  Storybook index returned ${res.status} — skipping smoke tests`);
      writeFileSync(OUTPUT_PATH, '[]');
      return;
    }

    const index = (await res.json()) as { entries: Record<string, StoryIndexEntry> };
    const stories = Object.values(index.entries).filter((e) => e.type === 'story');

    writeFileSync(OUTPUT_PATH, JSON.stringify(stories, null, 2));
    console.log(`✅ Fetched ${stories.length} stories from Storybook index`);
  } catch {
    console.warn(`⚠️  Could not connect to Storybook at ${STORYBOOK_URL} — skipping smoke tests`);
    writeFileSync(OUTPUT_PATH, '[]');
  }
}
