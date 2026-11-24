// ESLint plugin `shifa`: one object for every config block, so ESLint never sees the plugin
// defined twice.
import { moduleBoundariesRule } from './module-boundaries.js';
import { noHardcodedDesignValuesRule } from './no-hardcoded-design-values.js';
import { noPhysicalDirectionRule } from './no-physical-direction.js';
import { noRawButtonRule } from './no-raw-button.js';
import { noUiSdkAgentRule, uiSdkOnlyInUiRule } from './ui-sdk-imports.js';

export const shifaPlugin = {
  meta: { name: 'shifa' },
  rules: {
    'module-boundaries': moduleBoundariesRule,
    'no-physical-direction': noPhysicalDirectionRule,
    'no-hardcoded-design-values': noHardcodedDesignValuesRule,
    'no-raw-button': noRawButtonRule,
    'ui-sdk-only-in-ui': uiSdkOnlyInUiRule,
    'no-ui-sdk-agent': noUiSdkAgentRule,
  },
};
