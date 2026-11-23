// Vite (Storybook, the apps) and Vitest define `import.meta.env`; other runtimes may not.
interface ImportMetaEnv {
  readonly DEV?: boolean;
}

interface ImportMeta {
  readonly env?: ImportMetaEnv;
}

// A stylesheet imported for its side effect (tests, Storybook).
declare module '*.css';

// A file's text, imported through Vite (`./file.svg?raw`).
declare module '*?raw' {
  const text: string;
  export default text;
}
