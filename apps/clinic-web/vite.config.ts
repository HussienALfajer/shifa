import { shellViteConfig } from '@shifa/web-shell/vite';
import { defineConfig } from 'vite';

// Port 5173: setup links point here (CLINIC_WEB_URL default, A-01-03).
export default defineConfig(({ mode }) => shellViteConfig({ port: 5173, mode }));
