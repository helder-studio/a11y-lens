export * from './index';

const noop = () => {};

/** Production stand-in for the overlay parts; the report functions stay real for tests. */
export const a11yLens = {
  getState: () => ({
    showOverlay: false,
    platform: 'ios' as const,
    analysis: null,
    scanning: false,
  }),
  subscribe: () => noop,
  setPlatform: noop,
  showOverlay: noop,
  scan: async () => ({ platform: 'ios' as const, elements: [], warnings: [] }),
};

export function A11yLens(_props: { enabled: boolean }): null {
  return null;
}
export function A11yLensOverlay(): null {
  return null;
}
export function A11yLensPanel(): null {
  return null;
}
export const a11yLensTab = {
  id: 'a11y-lens',
  title: 'A11y',
  status: () => null,
  subscribe: () => noop,
  render: () => null,
};
