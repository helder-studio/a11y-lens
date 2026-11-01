import { type Analysis, analyze } from './core/analyze';
import { type Complete, type FixSuggestion, suggestFixes } from './core/suggest';
import { type HostNode, kindOf, type Platform } from './core/tree';
import { measure, readRoots } from './fiber';

type LensState = {
  /** Badges are drawn over the app. */
  showOverlay: boolean;
  platform: Platform;
  analysis: Analysis | null;
  scanning: boolean;
  /** A model is configured, so the panel can offer AI fix suggestions. */
  canSuggest: boolean;
  suggesting: boolean;
  suggestions: FixSuggestion[] | null;
  suggestError: string | null;
};

let state: LensState = {
  showOverlay: false,
  platform: 'ios',
  analysis: null,
  scanning: false,
  canSuggest: false,
  suggesting: false,
  suggestions: null,
  suggestError: null,
};
let complete: Complete | undefined;
const listeners = new Set<() => void>();
/** Host tree of the last scan, kept so switching platform re-analyses without re-measuring. */
let lastRoots: HostNode[] = [];

function set(patch: Partial<LensState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function images(nodes: (HostNode | string)[], out: HostNode[] = []): HostNode[] {
  for (const node of nodes) {
    if (typeof node === 'string') continue;
    if (kindOf(node.type) === 'image') out.push(node);
    images(node.children ?? [], out);
  }
  return out;
}

/** Overlay state and on-demand scans of the mounted screen. */
export const a11yLens = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setPlatform(platform: Platform) {
    set({ platform, analysis: state.analysis && analyze(lastRoots, platform) });
  },
  showOverlay: (showOverlay: boolean) => set({ showOverlay }),

  /** Connect a model for AI fix suggestions (opt-in). See `Complete`. */
  configure(options: { complete?: Complete }) {
    complete = options.complete;
    set({ canSuggest: Boolean(complete) });
  },

  /** Asks the configured model for fixes to the current warnings. */
  async suggest(): Promise<FixSuggestion[]> {
    if (!complete || !state.analysis) return [];
    set({ suggesting: true, suggestError: null });
    try {
      const suggestions = await suggestFixes(state.analysis, complete);
      set({ suggestions, suggesting: false });
      return suggestions;
    } catch (error) {
      set({
        suggesting: false,
        suggestError: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  },

  /**
   * Walks the mounted React tree, measures each element and analyses the result. Runs on demand
   * (open the panel, tap Rescan), never every frame.
   */
  async scan(): Promise<Analysis> {
    set({ scanning: true });
    const roots = readRoots();
    const first = analyze(roots, state.platform);
    const targets = [...first.elements.map((e) => e.node), ...images(roots)];
    await Promise.all(
      targets.map(async (node) => {
        const frame = await measure(node.instance);
        if (frame) node.frame = frame;
      }),
    );
    const analysis = analyze(roots, state.platform);
    lastRoots = roots;
    set({ analysis, scanning: false, suggestions: null, suggestError: null });
    return analysis;
  },
};
