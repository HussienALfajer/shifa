// Fixture for shifa/no-physical-direction: every line below breaks the rule once or more.
declare function cn(...classes: unknown[]): string;
declare const open: boolean;

export const margin = <div className="ml-2 mr-4" />;
export const padding = cn('pl-3', open && 'pr-2');
export const position = <span className="absolute left-0 hover:right-4" />;
export const align = <p className="text-left md:text-right" />;
export const corners = cn('rounded-l-md', 'rounded-tr-sm');
export const borders = cn({ 'border-l-2': open });
export const style = <div style={{ marginLeft: 8, textAlign: 'right' }} />;
