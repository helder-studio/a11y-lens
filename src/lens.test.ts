import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Fiber } from './fiber';
import { a11yLens } from './lens';

function stubScreen() {
  const close: Fiber = {
    tag: 5,
    type: 'RCTView',
    memoizedProps: { accessible: true, onClick: () => {}, testID: 'close' },
    child: null,
    sibling: null,
    stateNode: null,
  };
  vi.stubGlobal('__REACT_DEVTOOLS_GLOBAL_HOOK__', {
    renderers: new Map([[1, {}]]),
    getFiberRoots: () => new Set([{ current: { ...close, tag: 3, child: close } }]),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  a11yLens.configure({});
});

describe('a11yLens suggestions', () => {
  it('offers suggestions only once a model is configured', async () => {
    stubScreen();
    await a11yLens.scan();
    expect(a11yLens.getState().canSuggest).toBe(false);
    expect(await a11yLens.suggest()).toEqual([]);

    const complete = vi.fn(
      async (_prompt: string) =>
        '[{"index":1,"code":"missing-label","label":"Close","fix":"aria-label=\\"Close\\""}]',
    );
    a11yLens.configure({ complete });
    expect(a11yLens.getState().canSuggest).toBe(true);
    await a11yLens.suggest();
    expect(complete.mock.calls[0]?.[0]).toContain('testID="close"');
    expect(a11yLens.getState().suggestions).toEqual([
      { index: 1, code: 'missing-label', label: 'Close', fix: 'aria-label="Close"' },
    ]);
    await a11yLens.scan();
    expect(a11yLens.getState().suggestions).toBe(null);
  });

  it('reports model failures without throwing', async () => {
    stubScreen();
    await a11yLens.scan();
    a11yLens.configure({
      complete: async () => {
        throw new Error('proxy down');
      },
    });
    expect(await a11yLens.suggest()).toEqual([]);
    expect(a11yLens.getState()).toMatchObject({ suggesting: false, suggestError: 'proxy down' });
  });
});
