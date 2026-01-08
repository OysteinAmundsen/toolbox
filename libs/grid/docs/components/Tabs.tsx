import React, { Children, isValidElement, ReactNode, useState } from 'react';

interface TabProps {
  label: string;
  children: ReactNode;
}

export function Tab({ children }: TabProps) {
  return <>{children}</>;
}

interface TabsProps {
  children: ReactNode;
  defaultTab?: number;
}

export function Tabs({ children, defaultTab = 0 }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Extract Tab components from children
  const tabs = Children.toArray(children).filter(
    (child): child is React.ReactElement<TabProps> => isValidElement(child) && child.type === Tab,
  );

  return (
    <div className="docs-tabs">
      <style>{`
        .docs-tabs {
          margin: 1rem 0;
        }
        .docs-tabs__nav {
          display: flex;
          border-bottom: 1px solid var(--docs-tabs-border, #e0e0e0);
          margin-bottom: 0;
          gap: 0;
        }
        .docs-tabs__button {
          padding: 0.5rem 1rem;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--docs-tabs-text, #666);
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: color 0.15s, border-color 0.15s;
        }
        .docs-tabs__button:hover {
          color: var(--docs-tabs-hover, #333);
        }
        .docs-tabs__button--active {
          color: var(--docs-tabs-active, #1ea7fd);
          border-bottom-color: var(--docs-tabs-active, #1ea7fd);
        }
        .docs-tabs__content {
          padding-top: 0.5rem;
        }
        /* Dark mode support */
        .sb-show-main.sb-main-padded[data-theme="dark"] .docs-tabs__nav,
        [data-theme="dark"] .docs-tabs__nav {
          border-bottom-color: #444;
        }
        .sb-show-main.sb-main-padded[data-theme="dark"] .docs-tabs__button,
        [data-theme="dark"] .docs-tabs__button {
          color: #999;
        }
        .sb-show-main.sb-main-padded[data-theme="dark"] .docs-tabs__button:hover,
        [data-theme="dark"] .docs-tabs__button:hover {
          color: #fff;
        }
      `}</style>
      <div className="docs-tabs__nav" role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={index}
            role="tab"
            aria-selected={activeTab === index}
            className={`docs-tabs__button ${activeTab === index ? 'docs-tabs__button--active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {tab.props.label}
          </button>
        ))}
      </div>
      <div className="docs-tabs__content" role="tabpanel">
        {tabs[activeTab]}
      </div>
    </div>
  );
}
