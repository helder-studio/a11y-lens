export {
  type A11yElement,
  type Analysis,
  analyze,
  MIN_TARGET,
  type Warning,
  type WarningCode,
} from './core/analyze';
export { announce, roleName } from './core/announce';
export { type A11yReport, getA11yReport, toMarkdown } from './core/report';
export {
  buildFixPrompt,
  type Complete,
  type FixSuggestion,
  parseFixes,
  suggestFixes,
} from './core/suggest';
export type { A11yState, A11yValue, Frame, HostNode, Platform } from './core/tree';
