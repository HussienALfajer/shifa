// Fixture for shifa/no-hardcoded-design-values: every line below breaks the rule once or more.
declare function cn(...classes: unknown[]): string;

export const step = <div className="p-14 gap-2.5" />;
export const arbitrary = cn('w-[200px]', 'mt-[3rem]');
export const colour = cn('bg-[#1f6f5c]', 'text-[rgb(0,0,0)]');
export const font = cn("font-['Inter']");
export const style = <div style={{ color: '#ffffff', padding: '13px', fontFamily: 'Arial' }} />;
