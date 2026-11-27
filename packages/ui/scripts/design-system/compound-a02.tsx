// The components of A-02 (sheets approved by the owner 2026-11-27, A-02-01) as data for the
// design-system bundle: only JSON crosses from a Design canvas into the bundle's React
// (bundle-entry.tsx), so a function prop becomes a text template.
import { UsageChart as CodeUsageChart, type UsageChartDay } from '../../src/index.ts';

export interface UsageChartData {
  'aria-label': string;
  days: UsageChartDay[];
  /** The figure's words, `{n}` standing for the count: «{n} تسجيل دخول». */
  unit?: string;
  lastIsToday?: boolean;
  loading?: boolean;
}

export function UsageChart({ unit = '{n}', lastIsToday, loading, ...rest }: UsageChartData) {
  return (
    <CodeUsageChart
      {...rest}
      unit={(n) => unit.replaceAll('{n}', String(n))}
      {...(lastIsToday === undefined ? {} : { lastIsToday })}
      {...(loading === undefined ? {} : { loading })}
    />
  );
}
