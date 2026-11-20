import type { StorybookConfig } from '@storybook/react-vite';

// Storybook for @shifa/ui (spec 0.4 criterion 9): every story in the eight combinations of
// direction × theme × density (preview.tsx), axe on every story (addon-a11y), and the stories run
// as tests through Vitest (addon-vitest, the `storybook` project of vitest.config.ts).
const config: StorybookConfig = {
  framework: { name: '@storybook/react-vite', options: {} },
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  core: { disableTelemetry: true },
  async viteFinal(viteConfig) {
    const { default: tailwindcss } = await import('@tailwindcss/vite');
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
    return viteConfig;
  },
};

export default config;
