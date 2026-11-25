// Toast as the design system sees it (slice 0.4-06): in code a ToastProvider and `useToast()`; on
// a canvas a card that holds its own region and shows the toasts it is given, when it mounts and
// again from its button. The props are documented in index.d.ts.
import { useEffect } from 'react';
import { Button } from '../../src/button/button.tsx';
import { type ToastOptions, ToastProvider, useToast } from '../../src/toast/toast.tsx';

interface ToastEntry {
  type?: 'default' | 'success' | 'info' | 'warning' | 'error';
  title: string;
  description?: string;
  actionLabel?: string;
}

/** `toasts`, or one toast given by its own props (`type`, `title`…). */
export interface ToastData extends Partial<ToastEntry> {
  toasts?: ToastEntry[];
  triggerLabel?: string;
  /**
   * The toasts leave after the app's own times (5 s, 8 s with an action, errors stay). Without
   * it they stay, so a drawing can show them.
   */
  autoDismiss?: boolean;
  /** false: only the button shows them (several cards on one sheet). */
  showOnMount?: boolean;
}

function Shower({ toasts, triggerLabel, autoDismiss, showOnMount = true, ...one }: ToastData) {
  const toast = useToast();
  const single: ToastEntry[] =
    one.title === undefined
      ? []
      : [
          {
            title: one.title,
            ...(one.type === undefined ? {} : { type: one.type }),
            ...(one.description === undefined ? {} : { description: one.description }),
            ...(one.actionLabel === undefined ? {} : { actionLabel: one.actionLabel }),
          },
        ];
  const options: ToastOptions[] = (toasts ?? single).map((t) => ({
    title: t.title,
    ...(autoDismiss === true ? {} : { duration: Number.POSITIVE_INFINITY }),
    ...(t.type === undefined ? {} : { type: t.type }),
    ...(t.description === undefined ? {} : { description: t.description }),
    ...(t.actionLabel === undefined ? {} : { action: { label: t.actionLabel } }),
  }));
  const showAll = () => {
    for (const o of options) toast.show(o);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: shown once, when the card mounts.
  useEffect(() => {
    if (showOnMount) showAll();
  }, []);
  return <Button onClick={showAll}>{triggerLabel ?? 'إظهار الإشعارات'}</Button>;
}

export function Toast(props: ToastData) {
  return (
    <ToastProvider>
      <Shower {...props} />
    </ToastProvider>
  );
}
