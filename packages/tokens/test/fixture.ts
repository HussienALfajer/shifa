// A small valid token set for the schema, build and contrast tests. Each test copies it and
// breaks one thing.
import { type Sources, srgb } from '../src/index.ts';

const px = (value: number) => ({ value, unit: 'px' });
const dark = (ref: string) => ({ shifa: { modes: { dark: ref } } });

export function validSources(): Sources {
  return {
    layers: {
      primitive: {
        color: {
          $type: 'color',
          white: { $value: srgb('#FFFFFF') },
          ink: { 900: { $value: srgb('#1D2A26') }, 100: { $value: srgb('#E8F2EE') } },
          night: { 900: { $value: srgb('#101A17') } },
          green: { 600: { $value: srgb('#1F6F5C') }, 300: { $value: srgb('#7CCBB4') } },
          gold: { 500: { $value: srgb('#C8A24A') } },
        },
        space: { $type: 'dimension', 8: { $value: px(32) }, 11: { $value: px(44) } },
        motion: { duration: { fast: { $type: 'duration', $value: { value: 120, unit: 'ms' } } } },
      },
      semantic: {
        color: {
          $type: 'color',
          bg: {
            surface: {
              $description: 'Cards and inputs.',
              $value: '{color.white}',
              $extensions: dark('{color.night.900}'),
            },
          },
          text: {
            default: {
              $description: 'Body text.',
              $value: '{color.ink.900}',
              $extensions: dark('{color.ink.100}'),
            },
          },
          status: {
            $description: 'Locked status colours.',
            success: {
              fg: {
                $value: '{color.green.600}',
                $extensions: { shifa: { locked: true, modes: { dark: '{color.green.300}' } } },
              },
            },
          },
        },
        size: {
          $description: 'Control sizes.',
          control: {
            md: {
              $type: 'dimension',
              $value: '{space.11}',
              $extensions: { shifa: { modes: { compact: '{space.8}' } } },
            },
          },
        },
      },
      brand: {
        color: {
          $type: 'color',
          brand: {
            $description: 'The slots a clinic palette replaces.',
            primary: { $value: '{color.green.600}', $extensions: dark('{color.green.300}') },
            'on-primary': { $value: '{color.white}', $extensions: dark('{color.night.900}') },
          },
        },
      },
      component: {
        button: {
          height: { $type: 'dimension', $value: '{size.control.md}' },
          primary: { bg: { $type: 'color', $value: '{color.brand.primary}' } },
        },
      },
    },
    pairs: [
      { text: 'color.text.default', surface: 'color.bg.surface', class: 'body' },
      { text: 'color.status.success.fg', surface: 'color.bg.surface', class: 'body' },
      { text: 'color.brand.on-primary', surface: 'color.brand.primary', class: 'body' },
    ],
  };
}
