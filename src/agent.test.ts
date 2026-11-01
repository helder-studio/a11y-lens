import { afterEach, describe, expect, it, vi } from 'vitest';
import { a11yAgentTools } from './agent';
import type { Fiber } from './fiber';
import { a11yLens } from './lens';

afterEach(() => {
  vi.unstubAllGlobals();
  a11yLens.showOverlay(false);
});

describe('a11yAgentTools', () => {
  it('scans the mounted screen and returns a Markdown report', async () => {
    const button: Fiber = {
      tag: 5,
      type: 'RCTView',
      memoizedProps: { accessible: true, onClick: () => {} },
      child: null,
      sibling: null,
      stateNode: null,
    };
    vi.stubGlobal('__REACT_DEVTOOLS_GLOBAL_HOOK__', {
      renderers: new Map([[1, {}]]),
      getFiberRoots: () => new Set([{ current: { ...button, tag: 3, child: button } }]),
    });
    const scan = a11yAgentTools.find((t) => t.tool.name === 'a11y-scan');
    const markdown = (await scan?.handler({ platform: 'android' })) as string;
    expect(markdown).toContain('(TalkBack)');
    expect(markdown).toContain('`missing-label`');
  });

  it('toggles the overlay', () => {
    a11yAgentTools.find((t) => t.tool.name === 'a11y-overlay')?.handler({ show: true });
    expect(a11yLens.getState().showOverlay).toBe(true);
  });
});
