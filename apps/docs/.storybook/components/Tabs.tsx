import React, { Children, isValidElement, type ReactElement, type ReactNode, useEffect, useRef, useState } from 'react';

interface TabItemProps {
  /** The label shown in the tab button */
  label: string;
  /** Optional icon/emoji to show before the label */
  icon?: string;
  /** The content inside the tab */
  children: ReactNode;
}

/**
 * Individual tab item for use inside Tabs.
 * Uses React.Fragment explicitly to keep React import in scope for Storybook's JSX runtime.
 */
export function Tab({ children }: TabItemProps) {
  return <React.Fragment>{children}</React.Fragment>;
}

// Alias for semantic naming
export { Tab as TabItem };

interface TabsProps {
  /** Tab children */
  children: ReactNode;
  /** Index of the default open tab (0-based) */
  defaultTab?: number;
}

/**
 * Manually update TOC active link since scroll-spy can't detect hidden panels.
 */
function updateTocActiveLink(targetId: string) {
  const tocContainer = document.querySelector('.sbdocs-toc--custom');
  if (!tocContainer) return;

  // Remove active class from all TOC links
  tocContainer.querySelectorAll('a.is-active-link').forEach((link) => {
    link.classList.remove('is-active-link');
  });

  // Add active class to the clicked link
  const targetLink = tocContainer.querySelector(`a[href="#${CSS.escape(targetId)}"]`);
  if (targetLink) {
    targetLink.classList.add('is-active-link');
  }
}

/**
 * Tab component using details/summary under the hood.
 * All content is rendered in the DOM for TOC visibility.
 * Uses native details/summary for accessibility.
 */
export function Tabs({ children, defaultTab = 0 }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract Tab components from children
  const tabs = Children.toArray(children).filter(
    (child): child is ReactElement<TabItemProps> =>
      isValidElement(child) && (child.type === Tab || (child.type as { name?: string }).name === 'Tab'),
  );

  // Find which tab contains an element by ID and switch to it
  const switchToTabContaining = (elementId: string): boolean => {
    if (!containerRef.current) return false;

    const panels = containerRef.current.querySelectorAll('.sb-tabs__panel');
    for (let index = 0; index < panels.length; index++) {
      const panel = panels[index];
      const targetElement = panel.querySelector(`#${CSS.escape(elementId)}`);
      if (targetElement) {
        setActiveTab(index);
        return true;
      }
    }
    return false;
  };

  // Handle hash changes to auto-select correct tab
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash) return;

      const targetId = hash.slice(1);
      if (switchToTabContaining(targetId)) {
        // Update TOC highlighting manually
        updateTocActiveLink(targetId);
        // Wait for React to re-render with new active tab, then scroll
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
              targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        });
      }
    };

    // Run on mount for initial hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    // Also intercept TOC link clicks to handle them before browser does
    const handleTocClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href^="#"]');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href?.startsWith('#')) return;

      const targetId = href.slice(1);
      if (switchToTabContaining(targetId)) {
        e.preventDefault();
        e.stopPropagation();
        // Update URL hash
        history.pushState(null, '', href);
        // Update TOC highlighting manually
        updateTocActiveLink(targetId);
        // Wait for React to re-render, then scroll
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
              targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        });
      }
    };

    // Listen on the TOC sidebar (capture phase to run before scroll-spy)
    const tocContainer = document.querySelector('.sbdocs-toc--custom');
    tocContainer?.addEventListener('click', handleTocClick as EventListener, true);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      tocContainer?.removeEventListener('click', handleTocClick as EventListener, true);
    };
  }, []);

  return (
    <div className="sb-tabs" ref={containerRef}>
      {/* Tab headers - styled like tabs but using details/summary */}
      <div className="sb-tabs__nav" role="tablist">
        {tabs.map((tab, index) => (
          <details
            key={index}
            className="sb-tabs__tab"
            open={activeTab === index}
            onClick={(e) => {
              e.preventDefault();
              setActiveTab(index);
            }}
          >
            <summary role="tab" aria-selected={activeTab === index}>
              {tab.props.icon && <span className="sb-tabs__icon">{tab.props.icon}</span>}
              {tab.props.label}
            </summary>
          </details>
        ))}
      </div>

      {/* Tab panels - all rendered but only active is visible */}
      <div className="sb-tabs__panels">
        {tabs.map((tab, index) => (
          <div
            key={index}
            className="sb-tabs__panel"
            role="tabpanel"
            hidden={activeTab !== index}
            aria-hidden={activeTab !== index}
          >
            {tab.props.children}
          </div>
        ))}
      </div>
    </div>
  );
}

// Backwards compatibility aliases
export { Tabs as AccordionTabs };
