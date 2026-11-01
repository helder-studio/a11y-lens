import type { Analysis, Warning, WarningCode } from './analyze';
import { type HostNode, readA11y, textOf } from './tree';

/** One proposed fix for one warning. */
export interface FixSuggestion {
  /** Reading-order index of the element, when the warning has one. */
  index?: number;
  code: WarningCode;
  /** Proposed accessible label, when the fix is a label. */
  label?: string;
  /** What to change, as a short instruction or a JSX prop to paste. */
  fix: string;
}

/**
 * Sends a prompt to a model of your choice and resolves with its text reply. Call your own backend
 * or proxy; never ship an API key in an app bundle.
 */
export type Complete = (prompt: string) => Promise<string>;

/** Props that hint at what an element is: ids, icon names, image sources. */
const HINT_PROPS = [
  'testID',
  'nativeID',
  'id',
  'name',
  'icon',
  'iconName',
  'source',
  'src',
  'placeholder',
];

function describeNode(node: HostNode | undefined): string {
  if (!node) return 'unknown element';
  const a = readA11y(node.props);
  const hints = HINT_PROPS.flatMap((key) => {
    const value = node.props[key];
    if (typeof value === 'string' || typeof value === 'number')
      return [`${key}=${JSON.stringify(value)}`];
    const uri = (value as { uri?: unknown } | null | undefined)?.uri;
    return typeof uri === 'string' ? [`${key}.uri=${JSON.stringify(uri)}`] : [];
  });
  const parts = [`<${node.type}>`];
  if (a.role) parts.push(`role=${a.role}`);
  if (a.label) parts.push(`label=${JSON.stringify(a.label)}`);
  const text = textOf(node);
  if (text) parts.push(`text=${JSON.stringify(text.slice(0, 80))}`);
  if (node.frame)
    parts.push(`size=${Math.round(node.frame.width)}x${Math.round(node.frame.height)}`);
  return [...parts, ...hints].join(' ');
}

/** Prompt asking for one fix per warning, answered as a JSON array. */
export function buildFixPrompt(analysis: Analysis): string {
  const screen = analysis.elements
    .map((e) => `${e.index}. ${e.announcement || '(silent)'}`)
    .join('\n');
  const warnings = analysis.warnings
    .map(
      (w: Warning, i) =>
        `${i + 1}. [${w.code}]${w.index !== undefined ? ` element #${w.index}` : ''}: ${w.message}\n   ${describeNode(w.node)}`,
    )
    .join('\n');
  return `You are an accessibility expert reviewing a React Native screen for ${
    analysis.platform === 'ios' ? 'VoiceOver' : 'TalkBack'
  } users.

What the screen reader announces, in order:
${screen || '(nothing)'}

Problems found:
${warnings}

For each problem, propose the smallest fix. For a missing or bad label, write a short label a
sighted user would recognise ("Close", "Add to cart"), without the role ("button") in it; infer it
from the element's text, ids, icon names and the surrounding screen. For other problems, say what to
change in one sentence.

Reply with only a JSON array, one object per problem, in the same order:
[{"index": <element number or null>, "code": "<problem code>", "label": "<label or null>", "fix": "<JSX prop to paste or one-sentence change>"}]`;
}

/** Reads the JSON array out of a model reply, tolerating code fences and prose around it. */
export function parseFixes(reply: string): FixSuggestion[] {
  const start = reply.indexOf('[');
  const end = reply.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  let items: unknown;
  try {
    items = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    if (typeof o.code !== 'string' || typeof o.fix !== 'string') return [];
    return [
      {
        ...(typeof o.index === 'number' && { index: o.index }),
        code: o.code as WarningCode,
        ...(typeof o.label === 'string' && o.label && { label: o.label }),
        fix: o.fix,
      },
    ];
  });
}

/** Asks your model for fixes to every warning. Resolves with `[]` when there's nothing to fix. */
export async function suggestFixes(
  analysis: Analysis,
  complete: Complete,
): Promise<FixSuggestion[]> {
  if (analysis.warnings.length === 0) return [];
  return parseFixes(await complete(buildFixPrompt(analysis)));
}
