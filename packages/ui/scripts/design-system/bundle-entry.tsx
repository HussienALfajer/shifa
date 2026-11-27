// The entry of the design-system bundle (bundle.ts builds it into one classic script). React 19
// travels inside, because the components need it and a Design canvas runs its own React 18:
// - `Shifa.mount(element, name, props)` renders a component into an element (previews);
// - `Shifa.<Name>` is an island for a host React: it renders a span and mounts the component
//   inside with the bundle's React. Only text children cross from the host.
// Direction, theme and density come from the page: dir, data-theme and data-density on an ancestor.
import { type ComponentType, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  Badge,
  Button,
  Checkbox,
  CodeList,
  Combobox,
  CopyField,
  CountBadge,
  DatePicker,
  Icon,
  IconButton,
  Input,
  MultiCombobox,
  NumberInput,
  OtpInput,
  PasswordInput,
  QrCode,
  SegmentedControl,
  Select,
  Spinner,
  Switch,
  Textarea,
  TimeInput,
} from '../../src/index.ts';
import './bundle.css';
import { Dialog, Menu, Popover, Tabs } from './compound.tsx';
import { UsageChart } from './compound-a02.tsx';
import { CommandPalette } from './compound-command.tsx';
import {
  Avatar,
  Callout,
  Card,
  EmptyState,
  Pagination,
  Skeleton,
  Toolbar,
} from './compound-data.tsx';
import { Field, Form, RadioGroup } from './compound-forms.tsx';
import { Accordion, AlertDialog, Drawer, Tooltip } from './compound-overlays.tsx';
import { DataTable } from './compound-table.tsx';
import { Toast } from './compound-toast.tsx';

/** The public components, in the order the system lists them (bundle.ts BUNDLE_COMPONENTS). */
const COMPONENTS = {
  Button,
  Icon,
  Tabs,
  Dialog,
  Popover,
  Menu,
  Select,
  Combobox,
  NumberInput,
  DatePicker,
  IconButton,
  Input,
  Textarea,
  PasswordInput,
  Checkbox,
  RadioGroup,
  Switch,
  OtpInput,
  TimeInput,
  Field,
  Form,
  Tooltip,
  Accordion,
  SegmentedControl,
  AlertDialog,
  Drawer,
  Toast,
  CommandPalette,
  Spinner,
  Badge,
  CountBadge,
  Skeleton,
  Card,
  EmptyState,
  Callout,
  QrCode,
  CodeList,
  CopyField,
  Avatar,
  Toolbar,
  Pagination,
  DataTable,
  UsageChart,
  MultiCombobox,
} as const;
type Name = keyof typeof COMPONENTS;
type Props = Record<string, unknown>;

/** Text children only: an element of another React cannot be rendered by this one. */
function own(props: Props): Props {
  const { children, ...all } = props;
  const rest = Object.fromEntries(Object.entries(all).filter(([k]) => k !== 'instanceKey'));
  return typeof children === 'string' || typeof children === 'number'
    ? { ...rest, children }
    : rest;
}

/**
 * `instanceKey` is not a prop of the component: when it changes the component mounts afresh, so
 * a canvas can change what a component reads only when it mounts (`defaultValue`, `defaultOpen`).
 */
function render(root: Root, name: Name, props: Props) {
  const key = props['instanceKey'];
  root.render(
    createElement(COMPONENTS[name] as unknown as ComponentType<Props>, {
      ...own(props),
      ...(typeof key === 'string' || typeof key === 'number' ? { key } : {}),
    }),
  );
}

function mount(element: Element, name: Name, props: Props = {}): () => void {
  const root = createRoot(element);
  render(root, name, props);
  return () => {
    root.unmount();
  };
}

interface HostReact {
  createElement: (type: string, props: object) => unknown;
  useRef: <T>(value: T) => { current: T };
  useLayoutEffect: (effect: () => undefined | (() => void), deps?: unknown[]) => void;
}

function island(name: Name) {
  function Island(props: Props) {
    const host = (globalThis as unknown as { React: HostReact }).React;
    const element = host.useRef<HTMLSpanElement | null>(null);
    const root = host.useRef<Root | null>(null);
    host.useLayoutEffect(() => {
      if (element.current) root.current = createRoot(element.current);
      return () => {
        const done = root.current;
        root.current = null;
        queueMicrotask(() => done?.unmount());
      };
    }, []);
    host.useLayoutEffect(() => {
      if (root.current) render(root.current, name, props);
      return undefined;
    });
    return host.createElement('span', { ref: element, style: { display: 'contents' } });
  }
  Island.displayName = `Shifa.${name}`;
  return Island;
}

const target = (typeof window === 'undefined' ? globalThis : window) as unknown as Props;
target['Shifa'] = {
  version: '0.4-07',
  mount,
  ...Object.fromEntries(Object.keys(COMPONENTS).map((name) => [name, island(name as Name)])),
};
