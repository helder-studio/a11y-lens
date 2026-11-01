# @helder-studio/a11y-lens

## 0.2.0

### Minor Changes

- 4674aef: Add opt-in AI fix suggestions: suggestFixes, buildFixPrompt and parseFixes, plus a 'Suggest fixes (AI)' button in the panel via a11yLens.configure({ complete }). Bring your own model; no API key in the app.
- 5a7aa15: Add a11yAgentTools (React Native): tool definitions so AI coding agents can scan the current screen and toggle the overlay through Rozenite for Agents.

## 0.1.0

### Minor Changes

- 7080093: First release: predicted reading order and VoiceOver/TalkBack announcements, five accessibility warnings, getA11yReport and toMarkdown for tests, and the dev overlay with panel and dev-dock tab.

### Patch Changes

- 5974322: Fix: text inside one Text is no longer split by spaces, display: none in style arrays hides content, role-only controls like Switch are detected, and custom roles with regex characters no longer throw.
