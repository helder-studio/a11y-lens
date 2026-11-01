<div align="center">

# @helder-studio/a11y-lens

**See what VoiceOver and TalkBack will say, before you turn them on.**

Numbered reading-order badges, predicted announcements and accessibility warnings over your React
Native screens, plus a report you can assert on in tests.

[![npm](https://img.shields.io/npm/v/@helder-studio/a11y-lens?color=cb3837&logo=npm)](https://www.npmjs.com/package/@helder-studio/a11y-lens)
[![bundle size](https://img.shields.io/bundlejs/size/@helder-studio/a11y-lens?label=min%2Bgzip)](https://bundlejs.com/?q=@helder-studio/a11y-lens)
[![CI](https://github.com/helder-studio/a11y-lens/actions/workflows/ci.yml/badge.svg)](https://github.com/helder-studio/a11y-lens/actions/workflows/ci.yml)
[![provenance](https://img.shields.io/badge/npm-provenance-2ea44f?logo=sigstore)](https://www.npmjs.com/package/@helder-studio/a11y-lens#provenance)
[![license](https://img.shields.io/npm/l/@helder-studio/a11y-lens?color=blue)](./LICENSE)

<!-- demo GIF -->

</div>

```sh
npm install --save-dev @helder-studio/a11y-lens
```

## Why

Most accessibility bugs are invisible until someone turns on a screen reader, and most of us don't.
A11y Lens draws what the screen reader would do right on top of your app: which element comes first,
what it announces ("Add to cart, button, dimmed"), and what's wrong with it.

## Quick start

```tsx
import { A11yLens } from '@helder-studio/a11y-lens';

export default function Root() {
  return (
    <View style={{ flex: 1 }}>
      <App />
      <A11yLens enabled={__DEV__} />
    </View>
  );
}
```

Tap the ♿ button, switch on the overlay, and pick VoiceOver or TalkBack wording.

## Features

- 🔢 **Reading order**: a numbered badge on every element, in predicted screen-reader order
- 🗣️ **Announcements**: label, value, role, state and hint, worded like VoiceOver or TalkBack
- ⚠️ **Warnings**: pressables without a label, "Button, button", touch targets under 44×44 pt / 48×48 dp
  (hitSlop counted), images without a label, accessible containers hiding pressable children
- 🧪 **Reports for tests**: `getA11yReport(screen.toJSON())` in React Native Testing Library, as data
  or Markdown
- 🧩 **Zero adoption**: works on plain React Native components, legacy `accessibility*` and ARIA props
- 🚫 **Dev only**: the overlay renders nothing outside `__DEV__`

## In tests

```tsx
import { render, screen } from '@testing-library/react-native';
import { getA11yReport, toMarkdown } from '@helder-studio/a11y-lens';

test('checkout is accessible', () => {
  render(<Checkout />);
  const report = getA11yReport(screen.toJSON(), { platform: 'ios', screen: 'Checkout' });
  expect(report.warnings).toEqual([]);
  expect(report.elements.map((e) => e.announcement)).toMatchSnapshot();
  console.log(toMarkdown(report));
});
```

Touch-target checks need real layout, so they only run on device.

## With dev-dock

```tsx
import { A11yLensOverlay, a11yLensTab } from '@helder-studio/a11y-lens';
import { DevDock } from '@helder-studio/dev-dock';

<>
  <App />
  <A11yLensOverlay />
  <DevDock enabled={__DEV__} tabs={[a11yLensTab]} />
</>;
```

## How accurate is it?

The lens walks the React tree through the DevTools hook React Native installs in dev builds, applies
React Native's grouping rules, and measures each element. Labels, roles, states and target sizes are
reliable. **Order is a prediction**: VoiceOver and TalkBack also use screen geometry, and content in a
`Modal` renders in a separate native root the lens can't see yet. A native module that reads the real
accessibility tree is planned.

## API

| Export                         | What it does                                      |
| ------------------------------ | ------------------------------------------------- |
| `<A11yLens enabled />`         | overlay + button + panel                          |
| `<A11yLensOverlay />`          | just the badges (for dev-dock setups)             |
| `a11yLensTab`                  | dev-dock tab                                      |
| `a11yLens.scan()`              | rescan the mounted screen                         |
| `getA11yReport(tree, options)` | `{ elements, warnings }` for a test-renderer tree |
| `toMarkdown(report)`           | the report as a Markdown table                    |
| `announce(element, platform)`  | announcement wording for one element              |

## Compared with other tools

[eslint-plugin-react-native-a11y](https://github.com/FormidableLabs/eslint-plugin-react-native-a11y)
checks JSX statically and can't see layout or order. [AMA](https://github.com/FormidableLabs/react-native-ama)
checks at runtime through its own components. A11y Lens works on the components you already have and
shows the reading order and announcements on screen.

## Support

If this saves you time, you can buy me a coffee on Ko-fi. It keeps the helder-studio libraries maintained.

<a href="https://ko-fi.com/gorian" target="_blank" rel="noopener">
  <img src="https://storage.ko-fi.com/cdn/kofi3.png?v=6" alt="Support me on Ko-fi" height="40">
</a>

## License

[MIT](./LICENSE) © [Helder Studio](https://www.helderstudio.com/en/)
