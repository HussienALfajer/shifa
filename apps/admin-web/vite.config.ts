import { shellViteConfig } from '@shifa/web-shell/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => shellViteConfig({ port: 5174, mode }));
