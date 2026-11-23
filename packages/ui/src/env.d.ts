// Vite (Storybook, the apps) and Vitest define `import.meta.env`; other runtimes may not.
interface ImportMetaEnv {
  readonly DEV?: boolean;
}

interface ImportMeta {
  readonly env?: ImportMetaEnv;
  /** Vite's eager glob import (the vendored icon files, src/icons/icon.tsx). */
  glob<T>(
    patterns: string | readonly string[],
    options: { query: string; import: string; eager: true },
  ): Record<string, T>;
}

// A stylesheet imported for its side effect (tests, Storybook).
declare module '*.css';

// A file's text, imported through Vite (`./file.svg?raw`).
declare module '*?raw' {
  const text: string;
  export default text;
}
