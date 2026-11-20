// Fixture for shifa/no-physical-direction: the logical equivalents of physical.bad.tsx.
declare function cn(...classes: unknown[]): string;
declare const open: boolean;

export const margin = <div className="ms-2 me-4" />;
export const padding = cn('ps-3', open && 'pe-2');
export const position = <span className="absolute start-0 hover:end-4" />;
export const align = <p className="text-start md:text-end" />;
export const corners = cn('rounded-s-md', 'rounded-se-sm');
export const borders = cn({ 'border-s-2': open });
export const style = <div style={{ marginInlineStart: 8, textAlign: 'end' }} />;
export const words = 'Press the left arrow key, then the right one.';
