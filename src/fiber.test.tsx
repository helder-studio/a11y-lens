// @vitest-environment happy-dom
/// <reference lib="dom" />
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Fiber, fiberToTree, measure, readRoots } from './fiber';
import { a11yLens } from './lens';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Card({ title }: { title: string }) {
  return (
    <section aria-label="card">
      <h2>{title}</h2>
      <button type="button" onClick={() => {}}>
        Buy
      </button>
    </section>
  );
}

function renderFiber(ui: React.ReactNode): Fiber {
  const el = document.createElement('div');
  act(() => createRoot(el).render(ui));
  const key = Object.keys(el).find((k) => k.startsWith('__reactContainer$')) as string;
  // The container points at the first HostRoot fiber; its FiberRoot knows the committed one.
  const hostRoot = (el as unknown as Record<string, Fiber>)[key] as Fiber;
  return (hostRoot.stateNode as { current: Fiber }).current;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fiberToTree', () => {
  it('keeps host components and text, skipping composite components', () => {
    const root = renderFiber(<Card title="Shoes" />);
    const tree = fiberToTree(root.child);
    expect(tree).toMatchObject([
      {
        type: 'section',
        props: { 'aria-label': 'card' },
        children: [
          { type: 'h2', children: ['Shoes'] },
          { type: 'button', children: ['Buy'] },
        ],
      },
    ]);
  });
});

describe('measure', () => {
  it('uses measureInWindow on New Architecture and legacy instances', async () => {
    const m = (x: number) => ({
      measureInWindow: (cb: (...n: number[]) => void) => cb(x, 2, 30, 40),
    });
    expect(await measure({ canonical: { publicInstance: m(1) } })).toEqual({
      x: 1,
      y: 2,
      width: 30,
      height: 40,
    });
    expect(await measure(m(5))).toEqual({ x: 5, y: 2, width: 30, height: 40 });
    expect(await measure({})).toBe(undefined);
    expect(
      await measure({
        measureInWindow: () => {
          throw new Error('detached');
        },
      }),
    ).toBe(undefined);
  });
});

describe('scan', () => {
  it('reads roots through the DevTools hook, measures and analyses', async () => {
    const instance = { measureInWindow: (cb: (...n: number[]) => void) => cb(10, 20, 24, 24) };
    const fiber: Fiber = {
      tag: 5,
      type: 'RCTView',
      memoizedProps: { accessible: true, onClick: () => {}, 'aria-label': 'Close' },
      child: null,
      sibling: null,
      stateNode: instance,
    };
    const roots = new Set([
      {
        current: {
          tag: 3,
          type: null,
          memoizedProps: null,
          child: fiber,
          sibling: null,
          stateNode: null,
        },
      },
    ]);
    vi.stubGlobal('__REACT_DEVTOOLS_GLOBAL_HOOK__', {
      renderers: new Map([[1, {}]]),
      getFiberRoots: () => roots,
    });
    expect(readRoots()).toHaveLength(1);
    const analysis = await a11yLens.scan();
    expect(analysis.elements[0]).toMatchObject({
      index: 1,
      announcement: 'Close',
      frame: { x: 10, y: 20, width: 24, height: 24 },
    });
    expect(analysis.warnings.map((w) => w.code)).toEqual(['small-target']);
    a11yLens.setPlatform('android');
    expect(a11yLens.getState().analysis?.platform).toBe('android');
  });

  it('finds nothing without the hook', () => {
    expect(readRoots()).toEqual([]);
  });
});
