// The data-display components of the design-system bundle (slice 0.4-07) that are composed from
// parts in code (Card, Skeleton) or take buttons (EmptyState), as data: only text crosses from a
// Design canvas into the bundle's React (bundle-entry.tsx).
import {
  Button,
  CardBody,
  CardFooter,
  CardHeader,
  CardLink,
  Card as CodeCard,
  EmptyState as CodeEmptyState,
  Skeleton as CodeSkeleton,
  type EmptyStateArt,
  type EmptyStateSize,
  type IconName,
  SkeletonGroup,
  SkeletonText,
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
