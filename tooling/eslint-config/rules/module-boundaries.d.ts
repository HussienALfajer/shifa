import type { ESLint, Rule } from 'eslint';

/** Why importing `specifier` from `file` breaks the ADR-0003 module boundary, or null. */
export function boundaryViolation(
  srcRoot: string,
  file: string,
  specifier: string,
): 'deepImport' | 'layerImport' | null;

export const moduleBoundariesRule: Rule.RuleModule;
export const shifaPlugin: ESLint.Plugin;
