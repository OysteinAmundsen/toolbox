// Test environment setup for happy-dom
// afterEach is injected as a global (globals: true in vite.config.ts) — do not
// import it explicitly from 'vitest'; doing so causes "Vitest failed to find the
// current suite" errors in Vitest 4.x setupFiles evaluation context.

// Clean up DOM after each test
afterEach(() => {
  document.body.innerHTML = '';
});
