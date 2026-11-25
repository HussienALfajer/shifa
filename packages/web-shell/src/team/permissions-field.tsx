// The sensitive toggles of a member (slice A-01-08 checkpoint 3; prototype `Team08`; PLT-43,
// OD-102): one switch per sensitive key, its default from the roles chosen in the form (GET
// /team/permissions), named under it («مفتوحة افتراضياً لدوره»); a switch away from the default
// is named («أغلقتَها لهذا الشخص») with «إعادة إلى ما يعطيه دوره». The draft holds, per key, the
// person's own switch or null (the role default).
import { Button, Switch } from '@shifa/ui';
import { useText } from '../text.ts';
import { PERMISSION_WORD, ROLES, type Role } from './data.ts';
import type { RolesDraft } from './roles-field.tsx';

export type SwitchDraft = Record<string, boolean | null>;

export interface KeyDefault {
  key: string;
  roles: readonly Role[];
}

/** Whether the roles on in the form grant `key` by default. */
export function defaultOf(catalogue: readonly KeyDefault[], key: string, roles: RolesDraft) {
  const grants = catalogue.find((k) => k.key === key)?.roles ?? [];
  return ROLES.some((r) => roles[r].on && grants.includes(r));
}

/** The switches that differ from the default, as the server takes them on add. */
export function changedFromDefault(
  catalogue: readonly KeyDefault[],
  draft: SwitchDraft,
  roles: RolesDraft,
) {
  return Object.entries(draft).flatMap(([key, granted]) =>
    granted === null || granted === defaultOf(catalogue, key, roles) ? [] : [{ key, granted }],
  );
}

export function PermissionsField({
  keys,
  catalogue,
  roles,
  draft,
  onChange,
}: {
  keys: readonly string[];
  catalogue: readonly KeyDefault[];
  roles: RolesDraft;
  draft: SwitchDraft;
  onChange: (next: SwitchDraft) => void;
}) {
  const text = useText();
  if (keys.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-body leading-heading font-semibold">{text('memberSensitive')}</h3>
      <p className="m-0 text-caption leading-body text-text-muted">{text('memberSensitiveHint')}</p>
      {keys.map((key) => {
        const byRole = defaultOf(catalogue, key, roles);
        const own = draft[key] ?? null;
        const shown = own ?? byRole;
        const away = own !== null && own !== byRole;
        const word = PERMISSION_WORD[key];
        return (
          <div key={key} className="flex flex-col gap-1">
            <Switch
              checked={shown}
              onCheckedChange={(next) => {
                onChange({ ...draft, [key]: next === byRole ? null : next });
              }}
              description={
                away
                  ? text(own ? 'permOpened' : 'permClosed')
                  : text(byRole ? 'permDefaultOn' : 'permDefaultOff')
              }
            >
              {word === undefined ? key : text(word)}
            </Switch>
            {away && (
              <div className="ps-13">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onChange({ ...draft, [key]: null });
                  }}
                >
                  {text('permReset')}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
