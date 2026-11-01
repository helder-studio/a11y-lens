import { announce, roleName } from './announce';
import {
  type A11yState,
  type A11yValue,
  type Frame,
  type HostNode,
  kindOf,
  type Platform,
  readA11y,
  textOf,
} from './tree';

export type WarningCode =
  | 'missing-label'
  | 'role-in-label'
  | 'small-target'
  | 'image-no-label'
  | 'hidden-interactive';

export interface Warning {
  code: WarningCode;
  message: string;
  /** Reading-order index of the element it belongs to, if any. */
  index?: number;
  frame?: Frame;
}

export interface A11yElement {
  /** 1-based reading order. */
  index: number;
  label: string;
  role?: string;
  state: A11yState;
  value: A11yValue;
  hint?: string;
  announcement: string;
  frame?: Frame;
  node: HostNode;
}

export interface Analysis {
  platform: Platform;
  elements: A11yElement[];
  warnings: Warning[];
}

/** Minimum touch target: 44×44 pt (Apple HIG), 48×48 dp (Material). */
export const MIN_TARGET: Record<Platform, number> = { ios: 44, android: 48 };

const DECORATIVE_ROLES = new Set(['none', 'presentation']);
/** Roles that make an element focusable and actionable even without an onPress handler. */
const ACTIONABLE_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'switch',
  'tab',
  'radio',
  'adjustable',
  'slider',
  'togglebutton',
]);

function slop(props: Record<string, unknown>): { x: number; y: number } {
  const h = props.hitSlop;
  if (typeof h === 'number') return { x: 2 * h, y: 2 * h };
  if (h && typeof h === 'object') {
    const s = h as { left?: number; right?: number; top?: number; bottom?: number };
    return { x: (s.left ?? 0) + (s.right ?? 0), y: (s.top ?? 0) + (s.bottom ?? 0) };
  }
  return { x: 0, y: 0 };
}

function hasInteractiveDescendant(node: HostNode): boolean {
  return (node.children ?? []).some(
    (child) =>
      typeof child !== 'string' &&
      !readA11y(child.props).hidden &&
      (readA11y(child.props).interactive || hasInteractiveDescendant(child)),
  );
}

/**
 * Predicts the screen-reader elements of a host tree in reading order (render order with RN's
 * grouping rules) and flags common problems. Order is approximate: real readers also use geometry.
 */
export function analyze(root: HostNode | HostNode[] | string | null, platform: Platform): Analysis {
  const elements: A11yElement[] = [];
  const warnings: Warning[] = [];

  const warn = (code: WarningCode, message: string, at: { index?: number; frame?: Frame }) => {
    warnings.push({
      code,
      message,
      ...(at.index !== undefined && { index: at.index }),
      ...(at.frame && { frame: at.frame }),
    });
  };

  const add = (
    node: HostNode,
    label: string,
    a: ReturnType<typeof readA11y>,
    fallbackRole?: string,
  ) => {
    const role = a.role ?? fallbackRole;
    const index = elements.length + 1;
    const el: A11yElement = {
      index,
      label,
      ...(role && { role }),
      state: a.state,
      value: a.value,
      ...(a.hint && { hint: a.hint }),
      announcement: announce(
        { label, role, state: a.state, value: a.value, hint: a.hint },
        platform,
      ),
      ...(node.frame && { frame: node.frame }),
      node,
    };
    elements.push(el);
    const at = { index, ...(node.frame && { frame: node.frame }) };

    const actionable = a.interactive || ACTIONABLE_ROLES.has(role ?? '');
    if (actionable && !label) {
      warn(
        'missing-label',
        'Pressable element has no label: screen readers announce only its role.',
        at,
      );
    }
    const spoken = roleName(role, platform);
    const words = new Set([role?.toLowerCase(), ...spoken.split(/[ ,]+/)].filter(Boolean));
    for (const word of words) {
      if (
        word &&
        new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(label)
      ) {
        warn(
          'role-in-label',
          `Label repeats the role ("${label}, ${spoken}"): drop "${word}" from the label.`,
          at,
        );
        break;
      }
    }
    if (a.interactive && node.frame) {
      const min = MIN_TARGET[platform];
      const extra = slop(node.props);
      const w = node.frame.width + extra.x;
      const h = node.frame.height + extra.y;
      if (w < min || h < min) {
        warn(
          'small-target',
          `Touch target is ${Math.round(w)}×${Math.round(h)}, under ${min}×${min}.`,
          at,
        );
      }
    }
    return index;
  };

  const walk = (node: HostNode | string, inLabelledGroup: boolean): void => {
    if (typeof node === 'string') return;
    const a = readA11y(node.props);
    if (a.hidden) return;
    const kind = kindOf(node.type);

    if (kind === 'image') {
      const decorative = a.ignored || DECORATIVE_ROLES.has(a.role ?? '');
      if (a.label) add(node, a.label, a, 'image');
      else if (!decorative && !inLabelledGroup) {
        warn(
          'image-no-label',
          'Image has no label. Add one, or mark it decorative with accessible={false}.',
          {
            ...(node.frame && { frame: node.frame }),
          },
        );
      }
      return;
    }
    if (kind === 'text' && !a.ignored) {
      const label = a.label ?? textOf(node);
      if (label) add(node, label, a);
      return;
    }
    if (kind === 'input' && !a.ignored) {
      add(
        node,
        a.label ?? (typeof node.props.placeholder === 'string' ? node.props.placeholder : ''),
        a,
        'textbox',
      );
      return;
    }
    // Controls like Switch are focusable through their role alone, without onPress.
    const actionable = a.interactive || ACTIONABLE_ROLES.has(a.role ?? '');
    const groups = a.accessible === true || (actionable && a.accessible !== false);
    if (groups) {
      const label = a.label ?? textOf(node);
      const index = add(node, label, a);
      if (hasInteractiveDescendant(node)) {
        warn(
          'hidden-interactive',
          'This accessible container hides pressable children: screen readers can only reach the container.',
          { index, ...(node.frame && { frame: node.frame }) },
        );
      }
      for (const child of node.children ?? []) walkImages(child, Boolean(label));
      return;
    }
    for (const child of node.children ?? []) walk(child, inLabelledGroup);
  };

  // Inside a group only unlabeled images still matter (when the group itself has no label).
  const walkImages = (node: HostNode | string, labelled: boolean): void => {
    if (typeof node === 'string' || readA11y(node.props).hidden) return;
    if (kindOf(node.type) === 'image') {
      walk(node, labelled);
      return;
    }
    for (const child of node.children ?? []) walkImages(child, labelled);
  };

  const roots = root === null ? [] : Array.isArray(root) ? root : [root];
  for (const node of roots) walk(node, false);
  return { platform, elements, warnings };
}
