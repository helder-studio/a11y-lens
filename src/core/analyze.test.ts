import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';
import { announce, roleName } from './announce';
import { getA11yReport, toMarkdown } from './report';
import type { HostNode } from './tree';

const h = (
  type: string,
  props: Record<string, unknown> = {},
  ...children: (HostNode | string)[]
): HostNode => ({ type, props, children: children.length ? children : null });

const framed = (node: HostNode, width: number, height: number): HostNode => ({
  ...node,
  frame: { x: 0, y: 0, width, height },
});

describe('announce', () => {
  const base = { state: {}, value: {} };

  it.each([
    [
      { label: 'Add to cart', role: 'button', state: { disabled: true } },
      'Add to cart, button, dimmed',
      'Add to cart, button, disabled',
    ],
    [
      { label: 'Wi-Fi', role: 'switch', state: { checked: true } },
      'Wi-Fi, switch button, on',
      'on, Wi-Fi, switch',
    ],
    [
      { label: 'Remember me', role: 'checkbox', state: { checked: false } },
      'Remember me, checkbox, unchecked',
      'not checked, Remember me, checkbox',
    ],
    [
      { label: 'Home', role: 'tab', state: { selected: true } },
      'selected, Home, tab',
      'Home, tab, selected',
    ],
    [
      { label: 'Volume', role: 'adjustable', value: { min: 0, max: 10, now: 5 } },
      'Volume, 50%, adjustable',
      'Volume, 50%, slider',
    ],
    [
      { label: 'Details', role: 'button', state: { expanded: false }, hint: 'Shows more' },
      'Details, button, collapsed, Shows more',
      'Details, button, collapsed, Shows more',
    ],
    [{ label: 'Orders', role: 'header' }, 'Orders, heading', 'Orders, heading'],
    [{ label: 'Plain text' }, 'Plain text', 'Plain text'],
  ])('%o', (el, ios, android) => {
    const full = { ...base, ...el };
    expect(announce(full, 'ios')).toBe(ios);
    expect(announce(full, 'android')).toBe(android);
  });

  it('names unknown roles as written', () => {
    expect(roleName('grid', 'ios')).toBe('grid');
    expect(roleName('none', 'android')).toBe('');
  });
});

describe('analyze', () => {
  it('orders elements in render order and groups accessible containers', () => {
    const tree = h(
      'View',
      {},
      h('Text', { role: 'header' }, 'Checkout'),
      h(
        'View',
        { accessible: true, onClick: () => {} },
        h('Text', {}, 'Pay'),
        h('Text', {}, '€12'),
      ),
      h('TextInput', { placeholder: 'Coupon code' }),
      h('Text', {}, 'Total ', h('Text', {}, '€12')),
    );
    const { elements } = analyze(tree, 'ios');
    expect(elements.map((e) => [e.index, e.announcement])).toEqual([
      [1, 'Checkout, heading'],
      [2, 'Pay €12'],
      [3, 'Coupon code, text field'],
      [4, 'Total €12'],
    ]);
  });

  it('skips hidden subtrees and reads both legacy and ARIA props', () => {
    const tree = h(
      'View',
      {},
      h('View', { 'aria-hidden': true }, h('Text', {}, 'hidden 1')),
      h('View', { importantForAccessibility: 'no-hide-descendants' }, h('Text', {}, 'hidden 2')),
      h('View', { accessibilityElementsHidden: true }, h('Text', {}, 'hidden 3')),
      h('View', {
        accessible: true,
        accessibilityLabel: 'Legacy',
        accessibilityState: { disabled: true },
        accessibilityRole: 'button',
      }),
      h('View', { accessible: true, 'aria-label': 'Aria', 'aria-disabled': true, role: 'button' }),
    );
    expect(analyze(tree, 'android').elements.map((e) => e.announcement)).toEqual([
      'Legacy, button, disabled',
      'Aria, button, disabled',
    ]);
  });

  it('flags the five planted issues', () => {
    const tree = h(
      'View',
      {},
      // 1. pressable without a label
      h('View', { accessible: true, onClick: () => {} }, h('Image', { accessible: false })),
      // 2. role repeated in the label
      h('View', {
        accessible: true,
        onClick: () => {},
        role: 'button',
        'aria-label': 'Submit button',
      }),
      // 3. touch target too small
      framed(h('View', { accessible: true, onClick: () => {}, 'aria-label': 'Close' }), 24, 24),
      // 4. image without a label
      h('Image', { source: 1 }),
      // 5. accessible container hiding interactive children
      h(
        'View',
        { accessible: true },
        h('Text', {}, 'Card'),
        h('View', { onClick: () => {}, 'aria-label': 'Like' }),
      ),
    );
    const codes = analyze(tree, 'ios').warnings.map((w) => [w.code, w.index]);
    expect(codes).toEqual([
      ['missing-label', 1],
      ['role-in-label', 2],
      ['small-target', 3],
      ['image-no-label', undefined],
      ['hidden-interactive', 4], // the unlabeled image is not an element, so the card is #4
    ]);
  });

  it('counts hitSlop toward the touch target and uses the platform minimum', () => {
    const icon = (hitSlop?: unknown) =>
      framed(
        h('View', {
          onClick: () => {},
          'aria-label': 'Close',
          ...(hitSlop !== undefined && { hitSlop }),
        }),
        40,
        40,
      );
    expect(analyze(icon(), 'ios').warnings.map((w) => w.code)).toEqual(['small-target']);
    expect(analyze(icon(2), 'ios').warnings).toEqual([]);
    expect(analyze(icon(2), 'android').warnings.map((w) => w.code)).toEqual(['small-target']);
    expect(analyze(icon({ left: 4, right: 4, top: 4, bottom: 4 }), 'android').warnings).toEqual([]);
  });

  it('does not flag decorative or covered images', () => {
    const tree = h(
      'View',
      {},
      h('Image', { accessible: false }),
      h('Image', { role: 'presentation' }),
      h('View', { accessible: true, onClick: () => {}, 'aria-label': 'Profile' }, h('Image', {})),
      h('Image', { accessibilityLabel: 'Logo' }),
    );
    const { elements, warnings } = analyze(tree, 'ios');
    expect(warnings).toEqual([]);
    expect(elements.map((e) => e.announcement)).toEqual(['Profile', 'Logo, image']);
  });

  it('joins text inside one Text without spaces and across elements with one', () => {
    const tree = h(
      'View',
      { accessible: true },
      h('Text', {}, 'Hel', h('Text', {}, 'lo'), '  world'),
      h('Text', {}, 'again'),
    );
    expect(analyze(tree, 'ios').elements[0]?.label).toBe('Hello world again');
  });

  it('hides subtrees with display none in style arrays', () => {
    const tree = h(
      'View',
      {},
      h('View', { style: [{ flex: 1 }, [{ display: 'none' }]] }, h('Text', {}, 'hidden')),
      h('View', { style: [{ display: 'none' }, { display: 'flex' }] }, h('Text', {}, 'shown')),
    );
    expect(analyze(tree, 'ios').elements.map((e) => e.label)).toEqual(['shown']);
  });

  it('treats role-only controls like Switch as focusable', () => {
    const tree = h(
      'View',
      {},
      h('RCTSwitch', { role: 'switch', 'aria-checked': true, 'aria-label': 'Wi-Fi' }),
    );
    expect(analyze(tree, 'android').elements.map((e) => e.announcement)).toEqual([
      'on, Wi-Fi, switch',
    ]);
    expect(analyze(h('RCTSwitch', { role: 'switch' }), 'ios').warnings.map((w) => w.code)).toEqual([
      'missing-label',
    ]);
  });

  it('copes with regex characters in custom roles', () => {
    const tree = h('View', { accessible: true, role: 'c++', 'aria-label': 'Compile c++' });
    expect(() => analyze(tree, 'ios')).not.toThrow();
  });

  it('handles empty input', () => {
    expect(analyze(null, 'ios').elements).toEqual([]);
    expect(analyze('raw', 'ios').elements).toEqual([]);
  });
});

describe('report', () => {
  const tree = h(
    'View',
    {},
    h('Text', { role: 'header' }, 'Orders'),
    h('View', { accessible: true, onClick: () => {} }),
  );

  it('summarises a screen as data and Markdown', () => {
    const report = getA11yReport([tree], { screen: 'Orders', platform: 'android' });
    expect(report).toEqual({
      screen: 'Orders',
      platform: 'android',
      elements: [
        { index: 1, announcement: 'Orders, heading', role: 'header', label: 'Orders' },
        { index: 2, announcement: '', label: '' },
      ],
      warnings: [
        {
          code: 'missing-label',
          message: 'Pressable element has no label: screen readers announce only its role.',
          index: 2,
        },
      ],
    });
    expect(toMarkdown(report)).toMatchInlineSnapshot(`
      "## Orders (TalkBack)

      | # | Announcement |
      | --- | --- |
      | 1 | Orders, heading |
      | 2 |  |

      ### Warnings

      - #2 \`missing-label\`: Pressable element has no label: screen readers announce only its role.
      "
    `);
  });
});
