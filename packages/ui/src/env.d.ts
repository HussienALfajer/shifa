// Vite (Storybook, the apps) and Vitest define `import.meta.env`; other runtimes may not.
interface ImportMetaEnv {
  readonly DEV?: boolean;
}

interface ImportMeta {
  readonly env?: ImportMetaEnv;
}
