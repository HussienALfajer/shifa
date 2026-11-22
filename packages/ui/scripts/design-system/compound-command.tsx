// The command palette as the design system sees it (slice 0.4-06): plain values only, so the
// empty text is a sentence with «{query}» where the typed text goes, and running an option only
// closes the palette. The props are documented in index.d.ts.
import {
  CommandPalette as CodeCommandPalette,
  type CommandPaletteGroup,
} from '../../src/command-palette/command-palette.tsx';

export interface CommandPaletteData {
  triggerLabel?: string;
  title: string;
  inputLabel: string;
  groups: CommandPaletteGroup[];
  /** «لا نتائج لـ «{query}»»: {query} is replaced by the typed text. */
  emptyText: string;
  defaultOpen?: boolean;
}

export function CommandPalette({
  triggerLabel = 'بحث',
  title,
  inputLabel,
  groups,
  emptyText,
  defaultOpen,
}: CommandPaletteData) {
  return (
    <CodeCommandPalette
      triggerLabel={triggerLabel}
      title={title}
      inputLabel={inputLabel}
      groups={groups}
      onAction={() => undefined}
      emptyText={(query) => emptyText.replace('{query}', query)}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
    />
  );
}
