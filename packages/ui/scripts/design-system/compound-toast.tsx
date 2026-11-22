// Toast as the design system sees it (slice 0.4-06): in code a ToastProvider and `useToast()`; on
// a canvas a card that holds its own region and shows the toasts it is given, at once and again
// from its button. The props are documented in index.d.ts.
import { useEffect } from 'react';
import { Button } from '../../src/button/button.tsx';
import { type ToastOptions, ToastProvider, useToast } from '../../src/toast/toast.tsx';

export interface ToastData {
  toasts: {
    type?: 'default' | 'success' | 'info' | 'warning' | 'error';
    title: string;
    description?: string;
    actionLabel?: string;
  }[];
  triggerLabel?: string;
}

function Shower({ toasts, triggerLabel }: ToastData) {
  const toast = useToast();
  const options: ToastOptions[] = toasts.map((t) => ({
    title: t.title,
    // On a canvas the toasts stay, so a drawing can show them.
    duration: Number.POSITIVE_INFINITY,
    ...(t.type === undefined ? {} : { type: t.type }),
    ...(t.description === undefined ? {} : { description: t.description }),
    ...(t.actionLabel === undefined ? {} : { action: { label: t.actionLabel } }),
  }));
  const showAll = () => {
    for (const o of options) toast.show(o);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: shown once, when the card mounts.
  useEffect(() => {
    showAll();
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
