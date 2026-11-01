# @helder-studio/a11y-lens

nShared rules, commands and conventions: @AGENTS.md

Predicts screen-reader order and announcements for React Native screens and flags common issues;
overlay on device, report in tests. PDF: "Library 4: A11y Lens".

## Layout

- `src/core/tree.ts`: `HostNode` (react-test-renderer `toJSON()` shape), `readA11y` (legacy + ARIA props),
  `textOf`. `src/core/announce.ts`: VoiceOver / TalkBack wording. `src/core/analyze.ts`: order,
  grouping, warnings. `src/core/report.ts`: `getA11yReport`, `toMarkdown`.
- `src/fiber.ts`: fiber → `HostNode` via `__REACT_DEVTOOLS_GLOBAL_HOOK__`, `measureInWindow`
  (Fabric `canonical.publicInstance` first). `src/lens.ts`: scan store.
- `src/native/A11yLens.tsx`: overlay, panel, standalone button, `a11yLensTab`.
- Entries: `index` (report only, no RN), `native` (`react-native` condition), `noop`.

## Status / open

- Spike not run: fiber walk and measuring are untested on device (no devices here). Compare 3 fixture
  screens with real VoiceOver/TalkBack transcripts before 0.1.
- Wording is approximate; adjust `announce.ts` from real transcripts.
- v0.3 native module for exact order not started.

## Commands

`pnpm verify`, `pnpm coverage`, `pnpm changeset`.
