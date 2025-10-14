/// <reference types="vite/client" />

// Declare CSS modules for raw import
declare module '*.css?raw' {
  const content: string;
  export default content;
}
