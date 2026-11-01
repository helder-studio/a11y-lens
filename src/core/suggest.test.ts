import { describe, expect, it, vi } from 'vitest';
import { analyze } from './analyze';
import { buildFixPrompt, parseFixes, suggestFixes } from './suggest';
import type { HostNode } from './tree';

const h = (
  type: string,
  props: Record<string, unknown> = {},
  ...children: (HostNode | string)[]
): HostNode => ({
  type,
  props,
  children: children.length ? children : null,
});

const screen = h(
  'View',
  {},
  h('Text', { role: 'header' }, 'Edit profile'),
  h(
    'View',
    { accessible: true, onClick: () => {}, testID: 'close-button' },
    h('Image', { source: { uri: 'icons/x.png' }, accessible: false }),
  ),
  h('View', { accessible: true, onClick: () => {}, role: 'button', 'aria-label': 'Save button' }),
);

describe('buildFixPrompt', () => {
  it('lists the reading order and each warning with element hints', () => {
    const prompt = buildFixPrompt(analyze(screen, 'ios'));
    expect(prompt).toContain('VoiceOver');
    expect(prompt).toContain('1. Edit profile, heading');
    expect(prompt).toContain('[missing-label] element #2');
    expect(prompt).toContain('testID="close-button"');
    expect(prompt).toContain('[role-in-label] element #3');
    expect(prompt).toContain('label="Save button"');
    expect(prompt).toContain('Reply with only a JSON array');
  });
});

describe('parseFixes', () => {
  it('reads a fenced JSON array and drops malformed entries', () => {
    const reply = [
      'Here you go:',
      '```json',
      '[{"index": 2, "code": "missing-label", "label": "Close", "fix": "accessibilityLabel=\\"Close\\""},',
      ' {"index": null, "code": "image-no-label", "label": null, "fix": "Mark the image accessible={false}"},',
      ' {"index": 3}]',
      '```',
    ].join('\n');
    expect(parseFixes(reply)).toEqual([
      { index: 2, code: 'missing-label', label: 'Close', fix: 'accessibilityLabel="Close"' },
      { code: 'image-no-label', fix: 'Mark the image accessible={false}' },
    ]);
  });

  it('returns [] for replies without a JSON array', () => {
    expect(parseFixes('Sorry, I cannot help.')).toEqual([]);
    expect(parseFixes('[not json]')).toEqual([]);
    expect(parseFixes('{"index": 1}')).toEqual([]);
  });
});

describe('suggestFixes', () => {
  it('calls your model once with the prompt and parses the reply', async () => {
    const complete = vi.fn(
      async (_prompt: string) =>
        '[{"index": 2, "code": "missing-label", "label": "Close", "fix": "aria-label=\\"Close\\""}]',
    );
    const fixes = await suggestFixes(analyze(screen, 'android'), complete);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0]?.[0]).toContain('TalkBack');
    expect(fixes).toEqual([
      { index: 2, code: 'missing-label', label: 'Close', fix: 'aria-label="Close"' },
    ]);
  });

  it('skips the model when there are no warnings', async () => {
    const complete = vi.fn(async () => '[]');
    expect(await suggestFixes(analyze(h('Text', {}, 'All good'), 'ios'), complete)).toEqual([]);
    expect(complete).not.toHaveBeenCalled();
  });
});
