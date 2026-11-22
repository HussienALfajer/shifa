// The data-display components of the design-system bundle (slice 0.4-07) that are composed from
// parts in code (Card, Skeleton, Toolbar), take buttons (EmptyState) or need state (Pagination),
// as data: only text crosses from a Design canvas into the bundle's React (bundle-entry.tsx).
import { Fragment, useState } from 'react';
import {
  AvatarGroup,
  type AvatarSize,
  Button,
  CardBody,
  CardFooter,
  CardHeader,
  CardLink,
  Avatar as CodeAvatar,
  Card as CodeCard,
  EmptyState as CodeEmptyState,
  Pagination as CodePagination,
  Skeleton as CodeSkeleton,
  Toolbar as CodeToolbar,
  type EmptyStateArt,
  type EmptyStateSize,
  type IconName,
  SkeletonGroup,
  SkeletonText,
  ToolbarButton,
  ToolbarSeparator,
} from '../../src/index.ts';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ActionData {
  label: string;
  variant?: Variant;
}

function Actions({ actions, size }: { actions: ActionData[]; size?: 'sm' }) {
  return (
    <>
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.variant ?? 'secondary'}
          {...(size === undefined ? {} : { size })}
        >
          {action.label}
        </Button>
      ))}
    </>
  );
}

export interface CardData {
  title: string;
  description?: string;
  /** Makes it a link card: the title is a link and the whole card its hit area. */
  href?: string;
  /** Lines of the body. */
  body?: string[];
  /** Buttons of the footer, the main one first. */
  footer?: ActionData[];
}

export function Card({ title, description, href, body, footer }: CardData) {
  return (
    <CodeCard>
      <CardHeader
        title={href === undefined ? title : <CardLink href={href}>{title}</CardLink>}
        {...(description === undefined ? {} : { description })}
      />
      {body !== undefined && body.length > 0 && (
        <CardBody>
          {body.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </CardBody>
      )}
      {footer !== undefined && footer.length > 0 && (
        <CardFooter>
          <Actions actions={footer} size="sm" />
        </CardFooter>
      )}
    </CodeCard>
  );
}

export interface SkeletonData {
  /** What screen readers hear while it loads. */
  label: string;
  /** A circle before two short lines, as a person's row. */
  avatar?: boolean;
  /** Lines of text under it. */
  lines?: number;
  /** A block for a picture or a chart. */
  block?: boolean;
}

export function Skeleton({ label, avatar = false, lines = 3, block = false }: SkeletonData) {
  return (
    <SkeletonGroup label={label}>
      {avatar && (
        <div className="flex items-center gap-3">
          <CodeSkeleton shape="circle" className="size-10" />
          <div className="flex flex-1 flex-col gap-2">
            <CodeSkeleton shape="line" className="w-1/2" />
            <CodeSkeleton shape="line" className="w-1/3" />
          </div>
        </div>
      )}
      {block && <CodeSkeleton className="h-16 w-full" />}
      {lines > 0 && <SkeletonText lines={lines} />}
    </SkeletonGroup>
  );
}

export interface EmptyStateData {
  title: string;
  description?: string;
  art?: EmptyStateArt;
  icon?: IconName;
  size?: EmptyStateSize;
  /** Up to two buttons, the main one first. */
  actions?: ActionData[];
}

export function EmptyState({ actions, ...rest }: EmptyStateData) {
  return (
    <CodeEmptyState
      {...rest}
      {...(actions === undefined ? {} : { actions: <Actions actions={actions} /> })}
    />
  );
}

export interface AvatarData {
  /** One person: their name (and picture). */
  name?: string;
  src?: string;
  size?: AvatarSize;
  /** A group instead: the people, how many show, and what the group is. */
  people?: { name: string; src?: string }[];
  max?: number;
  label?: string;
}

export function Avatar({ name, src, size, people, max, label }: AvatarData) {
  if (people !== undefined) {
    return (
      <AvatarGroup
        label={label ?? ''}
        people={people.map((p, i) => ({ id: String(i), name: p.name, src: p.src }))}
        {...(max === undefined ? {} : { max })}
        {...(size === undefined ? {} : { size })}
      />
    );
  }
  return <CodeAvatar name={name ?? ''} src={src} {...(size === undefined ? {} : { size })} />;
}

export interface ToolbarData {
  'aria-label': string;
  /** Groups of buttons, split by separators. */
  groups: { label: string; icon?: IconName; pressed?: boolean; disabled?: boolean }[][];
}

export function Toolbar({ groups, ...aria }: ToolbarData) {
  return (
    <CodeToolbar aria-label={aria['aria-label']}>
      {groups.map((group, g) => (
        <Fragment key={group.map((b) => b.label).join('|')}>
          {g > 0 && <ToolbarSeparator />}
          {group.map((b) => (
            <ToolbarButton
              key={b.label}
              {...(b.icon === undefined ? {} : { icon: b.icon })}
              {...(b.pressed === undefined ? {} : { pressed: b.pressed })}
              {...(b.disabled === undefined ? {} : { disabled: b.disabled })}
            >
              {b.label}
            </ToolbarButton>
          ))}
        </Fragment>
      ))}
    </CodeToolbar>
  );
}

export interface PaginationData {
  totalItems: number;
  defaultPage?: number;
  pageSize?: number;
  pageSizes?: number[];
  form?: 'numbers' | 'compact';
}

export function Pagination({
  totalItems,
  defaultPage = 1,
  pageSize: initialSize = 25,
  pageSizes,
  form,
}: PaginationData) {
  const [page, setPage] = useState(defaultPage);
  const [pageSize, setPageSize] = useState(initialSize);
  return (
    <CodePagination
      page={page}
      onPageChange={setPage}
      pageSize={pageSize}
      totalItems={totalItems}
      {...(pageSizes === undefined ? {} : { pageSizes, onPageSizeChange: setPageSize })}
      {...(form === undefined ? {} : { form })}
    />
  );
}
