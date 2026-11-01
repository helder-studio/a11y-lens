import type { A11yState, A11yValue, Platform } from './tree';

const ROLE_NAMES: Record<string, [ios: string, android: string]> = {
  button: ['button', 'button'],
  link: ['link', 'link'],
  header: ['heading', 'heading'],
  heading: ['heading', 'heading'],
  image: ['image', 'image'],
  img: ['image', 'image'],
  imagebutton: ['button, image', 'button'],
  search: ['search field', 'search field'],
  searchbox: ['search field', 'search field'],
  adjustable: ['adjustable', 'slider'],
  slider: ['adjustable', 'slider'],
  checkbox: ['checkbox', 'checkbox'],
  switch: ['switch button', 'switch'],
  radio: ['radio button', 'radio button'],
  tab: ['tab', 'tab'],
  togglebutton: ['toggle button', 'toggle button'],
  combobox: ['pop up button', 'drop down list'],
  menu: ['menu', 'menu'],
  menuitem: ['menu item', 'menu item'],
  progressbar: ['progress', 'progress bar'],
  alert: ['alert', 'alert'],
  spinbutton: ['stepper', 'spin button'],
  timer: ['timer', 'timer'],
  keyboardkey: ['key', 'key'],
  textbox: ['text field', 'edit box'],
};

/** What the screen reader calls the role, e.g. `heading` or `switch button`. Empty for plain text. */
export function roleName(role: string | undefined, platform: Platform): string {
  if (!role || role === 'none' || role === 'text' || role === 'summary') return '';
  const names = ROLE_NAMES[role.toLowerCase()];
  return names ? names[platform === 'ios' ? 0 : 1] : role.toLowerCase();
}

function valueText(value: A11yValue): string {
  if (value.text) return value.text;
  if (value.now === undefined) return '';
  if (value.min !== undefined && value.max !== undefined && value.max > value.min) {
    return `${Math.round(((value.now - value.min) / (value.max - value.min)) * 100)}%`;
  }
  return String(value.now);
}

function checkedWords(role: string | undefined, checked: A11yState['checked'], platform: Platform) {
  if (checked === undefined) return '';
  if (role === 'switch') return checked === true ? 'on' : 'off';
  if (checked === 'mixed') return platform === 'ios' ? 'mixed' : 'partially checked';
  return checked ? 'checked' : platform === 'ios' ? 'unchecked' : 'not checked';
}

/**
 * Predicted announcement, e.g. iOS `Add to cart, button, dimmed` / Android
 * `Add to cart, button, disabled`. Approximates VoiceOver and TalkBack ordering: VoiceOver says
 * "selected" first and "dimmed" for disabled; TalkBack leads with the checked state.
 */
export function announce(
  el: {
    label: string;
    role?: string | undefined;
    state: A11yState;
    value: A11yValue;
    hint?: string | undefined;
  },
  platform: Platform,
): string {
  const { state } = el;
  const parts: string[] = [];
  const checked = checkedWords(el.role, state.checked, platform);
  if (platform === 'ios') {
    if (state.selected) parts.push('selected');
    parts.push(el.label, valueText(el.value), roleName(el.role, platform), checked);
    if (state.expanded !== undefined) parts.push(state.expanded ? 'expanded' : 'collapsed');
    if (state.busy) parts.push('busy');
    if (state.disabled) parts.push('dimmed');
  } else {
    parts.push(checked, el.label, valueText(el.value), roleName(el.role, platform));
    if (state.selected) parts.push('selected');
    if (state.expanded !== undefined) parts.push(state.expanded ? 'expanded' : 'collapsed');
    if (state.busy) parts.push('busy');
    if (state.disabled) parts.push('disabled');
  }
  if (el.hint) parts.push(el.hint);
  return parts.filter(Boolean).join(', ');
}
