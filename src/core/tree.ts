/**
 * A host-component tree: the shape of react-test-renderer's `toJSON()` (and RNTL's
 * `screen.toJSON()`), which the fiber walker also produces on device.
 */
export interface HostNode {
  type: string;
  props: Record<string, unknown>;
  children: (HostNode | string)[] | null;
  /** Window frame in points, when measured on device. */
  frame?: Frame;
  /** Host instance, kept by the fiber walker for measuring. */
  instance?: unknown;
}

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Platform = 'ios' | 'android';

export interface A11yState {
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean | 'mixed';
  expanded?: boolean;
  busy?: boolean;
}

export interface A11yValue {
  text?: string;
  min?: number;
  max?: number;
  now?: number;
}

export type Kind = 'view' | 'text' | 'image' | 'input';

export function kindOf(type: string): Kind {
  if (/text ?input|textfield|singleline|multiline/i.test(type)) return 'input';
  if (/text/i.test(type)) return 'text';
  if (/image/i.test(type)) return 'image';
  return 'view';
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const bool = (v: unknown) =>
  v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined;

/** Reads both the legacy `accessibility*` props and the ARIA-style props RN supports. */
export function readA11y(props: Record<string, unknown>) {
  const legacyState = (props.accessibilityState ?? {}) as A11yState;
  const legacyValue = (props.accessibilityValue ?? {}) as A11yValue;
  const state: A11yState = {};
  const disabled = bool(props['aria-disabled']) ?? legacyState.disabled ?? bool(props.disabled);
  const selected = bool(props['aria-selected']) ?? legacyState.selected;
  const checked =
    props['aria-checked'] === 'mixed'
      ? 'mixed'
      : (bool(props['aria-checked']) ?? legacyState.checked);
  const expanded = bool(props['aria-expanded']) ?? legacyState.expanded;
  const busy = bool(props['aria-busy']) ?? legacyState.busy;
  if (disabled !== undefined) state.disabled = disabled;
  if (selected !== undefined) state.selected = selected;
  if (checked !== undefined) state.checked = checked;
  if (expanded !== undefined) state.expanded = expanded;
  if (busy !== undefined) state.busy = busy;

  const value: A11yValue = {};
  const text = str(props['aria-valuetext']) ?? str(legacyValue.text);
  const now = (props['aria-valuenow'] as number | undefined) ?? legacyValue.now;
  const min = (props['aria-valuemin'] as number | undefined) ?? legacyValue.min;
  const max = (props['aria-valuemax'] as number | undefined) ?? legacyValue.max;
  if (text !== undefined) value.text = text;
  if (now !== undefined) value.now = now;
  if (min !== undefined) value.min = min;
  if (max !== undefined) value.max = max;

  return {
    label: str(props['aria-label']) ?? str(props.accessibilityLabel),
    role: str(props.role) ?? str(props.accessibilityRole),
    hint: str(props.accessibilityHint),
    state,
    value,
    /** `accessible` true groups the subtree into one element. */
    accessible: bool(props.accessible),
    hidden:
      bool(props['aria-hidden']) === true ||
      props.accessibilityElementsHidden === true ||
      props.importantForAccessibility === 'no-hide-descendants' ||
      isDisplayNone(props.style),
    /** Excluded itself, children may still be reachable. */
    ignored: props.importantForAccessibility === 'no' || bool(props.accessible) === false,
    interactive: Boolean(
      props.onPress ??
        props.onClick ??
        props.onResponderRelease ??
        props.onStartShouldSetResponder ??
        props.onLongPress ??
        props.accessibilityActions,
    ),
  };
}

/** Text content of a subtree, joined with spaces like RN's default label. */
/** `style` may be an object or a (nested) array, as React Native allows; the last value wins. */
function isDisplayNone(style: unknown): boolean {
  if (Array.isArray(style)) {
    for (let i = style.length - 1; i >= 0; i--) {
      const display = displayOf(style[i]);
      if (display !== undefined) return display === 'none';
    }
    return false;
  }
  return displayOf(style) === 'none';
}

function displayOf(style: unknown): string | undefined {
  if (Array.isArray(style)) return isDisplayNone(style) ? 'none' : undefined;
  return (style as { display?: string } | null | undefined)?.display;
}

/**
 * Text content of a subtree like RN's default label: pieces inside one Text run together
 * ("Hel" + "lo" → "Hello"), separate elements are joined with a space.
 */
export function textOf(node: HostNode | string): string {
  if (typeof node === 'string') return node.trim();
  if (readA11y(node.props).hidden) return '';
  if (kindOf(node.type) === 'text') return rawText(node).replace(/\s+/g, ' ').trim();
  return (node.children ?? []).map(textOf).filter(Boolean).join(' ');
}

function rawText(node: HostNode | string): string {
  if (typeof node === 'string') return node;
  if (readA11y(node.props).hidden) return '';
  return (node.children ?? []).map(rawText).join('');
}
