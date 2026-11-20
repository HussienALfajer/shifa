import type { Preview } from '@storybook/react-vite';
import '../src/styles/tailwind.css';
import { withMatrix } from './matrix.tsx';

const preview: Preview = {
  decorators: [withMatrix],
  parameters: {
    layout: 'padded',
    // axe runs on every story; a violation fails the story in the Storybook test run.
    a11y: { test: 'error' },
    controls: { expanded: true },
  },
};

export default preview;
