// Fixture for shifa/no-hardcoded-design-values: the token equivalents of hardcoded.bad.tsx.
declare function cn(...classes: unknown[]): string;

export const step = <div className="p-16 gap-3" />;
export const arbitrary = cn('w-full', 'mt-12', 'h-(--shifa-button-height)');
export const colour = cn('bg-brand-primary', 'text-text-default');
export const font = cn('font-sans');
export const style = (
  <div
    style={{
      color: 'var(--shifa-color-text-default)',
      padding: 'var(--shifa-space-3)',
      fontFamily: 'var(--shifa-font-family-sans)',
    }}
  />
);
export const contrast = ['#000000', '#ffffff'];
