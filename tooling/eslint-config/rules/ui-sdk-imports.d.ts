import type { Rule } from 'eslint';

/** True for `@ui-sdk/*`, `@base-ui/*` and `@base-ui-components/*` specifiers. */
export function isUiLibrary(specifier: string): boolean;

/** True for the agent bridge: `@ui-sdk/<package>/agent` (and below) or `@ui-sdk/agent`. */
export function isAgentBridge(specifier: string): boolean;

export const uiSdkOnlyInUiRule: Rule.RuleModule;
export const noUiSdkAgentRule: Rule.RuleModule;
