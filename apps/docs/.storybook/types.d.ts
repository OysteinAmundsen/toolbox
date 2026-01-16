/// <reference types="vite/client" />

// Declare CSS modules for raw import
declare module '*.css?raw' {
  const content: string;
  export default content;
}

// Declare MDX files
declare module '*.mdx' {
  import type { ComponentType } from 'react';
  const component: ComponentType;
  export default component;
}
