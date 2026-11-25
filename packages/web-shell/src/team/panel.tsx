// The drawer's panel (slice A-01-08 checkpoint 3): the title and its body, marked for the tests and
// journeys; and what every panel of the team drawer needs from the page.
import { DrawerContent, SkeletonGroup, SkeletonText } from '@shifa/ui';
import type { ReactNode } from 'react';
import { LoadFailed } from '../account/load-failed.tsx';
import { useText } from '../text.ts';
import type { Branch } from './data.ts';
import type { KeyDefault } from './permissions-field.tsx';

export interface TeamContext {
  tenantId: string;
  /** The clinic's active branches, for the role scopes. */
  branches: readonly Branch[];
  /** Two active branches or more in a clinic that is not solo: roles name their branches. */
  scoped: boolean;
  catalogue: readonly KeyDefault[] | undefined;
  /** The branches (unless solo) and the toggles' defaults are read: roles may be chosen. */
  ready: boolean;
  /** One of those reads failed: the drawer offers `retry`. */
  failed: boolean;
  retry: () => void;
  rereadBranches: () => void;
}

/** While the branches or the defaults are unknown: a skeleton, or the failure with a retry. */
export function ChoicesPending({ team }: { team: TeamContext }) {
  const text = useText();
  return team.failed ? (
    <LoadFailed retry={team.retry} />
  ) : (
    <SkeletonGroup label={text('memberLoading')}>
      <SkeletonText lines={5} />
    </SkeletonGroup>
  );
}

export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const text = useText();
  return (
    <DrawerContent
      data-testid="member-drawer"
      title={title}
      description={description}
      closeLabel={text('close')}
    >
      {children}
    </DrawerContent>
  );
}
