import { Link } from 'react-router-dom';

/**
 * Demo index page — rendered at `/` listing every registered route.
 */

export interface DemoIndexEntry {
  path: string;
  label: string;
  description?: string;
}

export function DemoIndex({ entries }: { entries: readonly DemoIndexEntry[] }) {
  return (
    <main className="demo-index">
      <header className="demo-index-header">
        <h1>Toolbox Web — React Demos</h1>
        <p>Pick a demo below or navigate directly via URL.</p>
      </header>
      <ul className="demo-index-list">
        {entries.map((entry) => (
          <li key={entry.path} className="demo-index-card">
            <Link to={`/${entry.path}`} className="demo-index-link">
              <h2 className="demo-index-title">{entry.label}</h2>
              {entry.description && <p className="demo-index-description">{entry.description}</p>}
              <span className="demo-index-route">/{entry.path}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
