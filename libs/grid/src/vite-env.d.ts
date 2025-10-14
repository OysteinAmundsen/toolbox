/// <reference types="vite/client" />

// CSS module declarations for inline imports
declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}
