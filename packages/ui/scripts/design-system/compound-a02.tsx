// The components of A-02 (sheets approved by the owner 2026-11-27, A-02-01) as data for the
// design-system bundle: only JSON crosses from a Design canvas into the bundle's React
// (bundle-entry.tsx), so a function prop becomes a text template.
import { useState } from 'react';
import {
  Button,
  PageBanner as CodePageBanner,
  UsageChart as CodeUsageChart,
  type IconName,
  type PageBannerTone,
  type UsageChartDay,
} from '../../src/index.ts';

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

export interface PageBannerData {
  tone: PageBannerTone;
  title: string;
  text?: string;
  icon?: IconName;
  /** The one button's label («إنهاء الدخول»). */
  action?: string;
  /** Several announcements: their texts, shown in turn from `index` (0 by default). */
  texts?: string[];
  index?: number;
  /** A close button (announcements only). */
  dismissible?: boolean;
  dismissLabel?: string;
  /** The region's name when several copies share a title on one page. */
  'aria-label'?: string;
}

export function PageBanner({
  text,
  action,
  texts,
  index = 0,
  dismissible,
  dismissLabel,
  ...rest
}: PageBannerData) {
  const [shown, setShown] = useState(index);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <CodePageBanner
      {...rest}
      {...(action === undefined ? {} : { action: <Button size="sm">{action}</Button> })}
      {...(texts === undefined || texts.length < 2
        ? {}
        : { pager: { index: shown, count: texts.length, onIndexChange: setShown } })}
      {...(dismissible === true
        ? {
            onDismiss: () => {
              setHidden(true);
            },
          }
        : {})}
      {...(dismissLabel === undefined ? {} : { dismissLabel })}
    >
      {texts === undefined ? text : texts[shown]}
    </CodePageBanner>
  );
}
