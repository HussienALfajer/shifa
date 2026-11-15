/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build-time engine: outbox (default), powersync, stub-drop, stub-dup. */
  readonly VITE_ENGINE?: string;
}
